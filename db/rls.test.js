// Security tests for the database layer. Runs the real migrations in an
// in-process Postgres (PGlite) — no server or Supabase project needed — with
// Supabase's `auth.uid()` and API roles stubbed, then acts as each user and
// checks that row-level security and triggers hold against direct API calls.

import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = ['demo-schema.sql', 'add-tabs.sql', 'harden.sql', 'secure.sql', 'secure-2.sql']

const OWNER = '00000000-0000-0000-0000-00000000000a'
const STAFF = '00000000-0000-0000-0000-00000000000b'
const OTHER = '00000000-0000-0000-0000-00000000000c'
const FIRED = '00000000-0000-0000-0000-00000000000d'

let db
let menuItem
let bottle

// Run `sql` as a signed-in user (uid) or as the anonymous API role (null).
async function as(uid, sql, params = []) {
  await db.query('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ''])
  await db.query(uid ? 'set role authenticated' : 'set role anon')
  try {
    return await db.query(sql, params)
  } finally {
    await db.query('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  // Minimal stand-in for what Supabase provides out of the box
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
  `)
  for (const f of MIGRATIONS) {
    const sql = readFileSync(new URL(f, import.meta.url), 'utf8').replace(/notify pgrst[^;]*;/g, '')
    await db.exec(sql)
  }
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    insert into profiles (id, name, role, active) values
      ('${OWNER}', 'Owner', 'owner', true),
      ('${STAFF}', 'Staff', 'staff', true),
      ('${OTHER}', 'Other', 'staff', true),
      ('${FIRED}', 'Fired', 'staff', false);
    insert into capital_injections (amount) values (1000000);
  `)
  bottle = (await db.query(
    `insert into products (name, category, unit_cost, qty_on_hand) values ('Gin', 'spirits', 300000, 2) returning id`,
  )).rows[0].id
  menuItem = (await db.query(
    `insert into menu_items (name, category, price, whole_bottle, product_id)
     values ('Gin bottle', 'spirits', 1000000, true, $1) returning id`, [bottle],
  )).rows[0].id
  // A sale by another staff member, recorded server-side
  await db.query(`insert into sales (staff_id, total_revenue) values ($1, 500000)`, [OTHER])
})

describe('staff vs owner visibility', () => {
  it('staff cannot see capital injections', async () => {
    expect((await as(STAFF, 'select * from capital_injections')).rows).toHaveLength(0)
    expect((await as(OWNER, 'select * from capital_injections')).rows).toHaveLength(1)
  })

  it("staff cannot read another staff member's sales", async () => {
    expect((await as(STAFF, 'select * from sales where staff_id = $1', [OTHER])).rows).toHaveLength(0)
    expect((await as(OWNER, 'select * from sales where staff_id = $1', [OTHER])).rows).toHaveLength(1)
  })

  it('anonymous API callers see nothing', async () => {
    expect((await as(null, 'select * from sales')).rows).toHaveLength(0)
    expect((await as(null, 'select * from products')).rows).toHaveLength(0)
  })
})

describe('privilege escalation', () => {
  it('staff cannot promote themselves to owner', async () => {
    await as(STAFF, `update profiles set role = 'owner' where id = $1`, [STAFF])
    const { rows } = await db.query('select role from profiles where id = $1', [STAFF])
    expect(rows[0].role).toBe('staff')
  })

  it('staff cannot change menu prices', async () => {
    await as(STAFF, 'update menu_items set price = 1 where id = $1', [menuItem])
    const { rows } = await db.query('select price from menu_items where id = $1', [menuItem])
    expect(Number(rows[0].price)).toBe(1000000)
  })

  it('a deactivated account cannot record sales through the API', async () => {
    await expect(as(FIRED, 'insert into sales (staff_id) values ($1)', [FIRED])).rejects.toThrow(/row-level security/)
  })

  it('staff cannot record a sale under someone else', async () => {
    await expect(as(STAFF, 'insert into sales (staff_id) values ($1)', [OTHER])).rejects.toThrow(/row-level security/)
  })
})

describe('server-side money and stock rules', () => {
  it('ignores client-sent totals and backdating; recomputes from items', async () => {
    const { rows } = await as(STAFF,
      `insert into sales (staff_id, total_revenue, total_amount, sold_at)
       values ($1, 1, 1, '2020-01-01') returning id, total_amount, sold_at`, [STAFF])
    const sale = rows[0]
    expect(Number(sale.total_amount)).toBe(0)
    expect(new Date(sale.sold_at).getFullYear()).toBeGreaterThan(2020)

    // unit_price sent by the client is overwritten with the menu price
    await as(STAFF, 'insert into sale_items (sale_id, menu_item_id, qty, unit_price) values ($1, $2, 1, 1)',
      [sale.id, menuItem])
    const after = (await db.query('select * from sales where id = $1', [sale.id])).rows[0]
    expect(Number(after.total_revenue)).toBe(1000000)
    expect(Number(after.service_amount)).toBe(50000)   // 5% service
    expect(Number(after.tax_amount)).toBe(105000)      // 10% PB1 on subtotal + service
    expect(Number(after.total_amount)).toBe(1155000)
  })

  it('blocks selling bottles that are not in stock', async () => {
    // one of two bottles was sold above; selling two more must fail
    const { rows } = await as(STAFF, 'insert into sales (staff_id) values ($1) returning id', [STAFF])
    await expect(as(STAFF, 'insert into sale_items (sale_id, menu_item_id, qty) values ($1, $2, 2)',
      [rows[0].id, menuItem])).rejects.toThrow(/Not enough stock/)
  })
})

describe('attendance', () => {
  it('clock-in time is stamped by the server, not the client', async () => {
    const { rows } = await as(STAFF,
      `insert into attendance (staff_id, clock_in) values ($1, '2020-01-01') returning clock_in`, [STAFF])
    expect(new Date(rows[0].clock_in).getFullYear()).toBeGreaterThan(2020)
  })

  it('a closed shift cannot be edited', async () => {
    await as(STAFF, 'update attendance set clock_out = now() where staff_id = $1', [STAFF])
    await as(STAFF, `update attendance set clock_out = '2099-01-01' where staff_id = $1`, [STAFF])
    const { rows } = await db.query('select clock_out from attendance where staff_id = $1', [STAFF])
    expect(new Date(rows[0].clock_out).getFullYear()).toBeLessThan(2099)
  })
})
