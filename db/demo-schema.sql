-- ═══════════════════════════════════════════════════════════════
--  FULL SCHEMA — run once on a FRESH Supabase project (demo copy).
--  Everything the app needs: tables, triggers, security policies.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── tables ────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null default 'staff' check (role in ('owner','staff')),
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  brand          text,
  category       text not null,
  volume_ml      integer,
  abv            numeric(4,1),
  barcode        text unique,
  unit_cost      numeric(12,2) not null default 0,
  sale_price     numeric(12,2),
  qty_on_hand    integer not null default 0,
  reorder_level  integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.capital_injections (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid references public.profiles(id),
  amount       numeric(12,2) not null check (amount > 0),
  note         text,
  injected_at  timestamptz not null default now()
);

create table public.stock_purchases (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete restrict,
  staff_id      uuid references public.profiles(id),
  qty           integer not null check (qty > 0),
  total_cost    numeric(12,2) not null check (total_cost >= 0),
  supplier      text,
  purchased_at  timestamptz not null default now()
);

create table public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  subcategory  text,
  price        numeric not null,
  whole_bottle boolean not null default false,
  product_id   uuid references public.products(id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  staff_id       uuid references public.profiles(id),
  total_revenue  numeric(12,2) not null default 0,
  total_cogs     numeric(12,2) not null default 0,
  customer_name  text,
  customer_phone text,
  payment_method text not null default 'cash',
  cash_received  numeric,
  change_due     numeric,
  service_amount numeric not null default 0,
  tax_amount     numeric not null default 0,
  total_amount   numeric not null default 0,
  note           text,
  sold_at        timestamptz not null default now()
);

create table public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete cascade,
  menu_item_id  uuid not null references public.menu_items(id),
  qty           integer not null check (qty > 0),
  unit_price    numeric(12,2) not null default 0
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.profiles(id),
  category    text not null,
  amount      numeric(12,2) not null check (amount > 0),
  note        text,
  spent_at    timestamptz not null default now()
);

create table public.bottle_depletions (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  qty        integer not null default 1,
  unit_cost  numeric not null default 0,
  reason     text not null default 'used',
  staff_id   uuid,
  note       text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone         text,
  party_size    integer not null check (party_size > 0),
  starts_at     timestamptz not null,
  duration_min  integer not null default 120,
  note          text,
  status        text not null default 'booked' check (status in ('booked','seated','cancelled','no_show')),
  created_at    timestamptz not null default now()
);

create table public.attendance (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references public.profiles(id),
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  created_at timestamptz not null default now()
);

create index on public.sales (sold_at);
create index on public.expenses (spent_at);
create index on public.stock_purchases (purchased_at);
create index on public.sale_items (sale_id);
create index on public.bookings (starts_at);
create index on public.attendance (clock_in);

-- ── helpers ───────────────────────────────────────────────────

create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_active()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- ── triggers ──────────────────────────────────────────────────

create or replace function public.fill_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_price numeric;
begin
  select price into v_price from public.menu_items where id = new.menu_item_id;
  new.unit_price := coalesce(v_price, 0);
  return new;
end $$;
create trigger trg_fill_sale_item before insert on public.sale_items
for each row execute function public.fill_sale_item();

-- rates 0.05 / 0.10 — keep in sync with SERVICE_PCT / TAX_PCT in src/config.js
create or replace function public.apply_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_whole boolean; v_product uuid; v_sub numeric; v_srv numeric; v_tax numeric;
begin
  select whole_bottle, product_id into v_whole, v_product
  from public.menu_items where id = new.menu_item_id;
  if v_whole and v_product is not null then
    insert into public.bottle_depletions(product_id, qty, note, reason)
    values (v_product, new.qty, 'whole-bottle sale', 'used');
  end if;
  select coalesce(sum(qty * unit_price), 0) into v_sub
  from public.sale_items where sale_id = new.sale_id;
  v_srv := round(v_sub * 0.05);
  v_tax := round((v_sub + v_srv) * 0.10);
  update public.sales set
    total_revenue = v_sub, service_amount = v_srv,
    tax_amount = v_tax, total_amount = v_sub + v_srv + v_tax
  where id = new.sale_id;
  return new;
end $$;
create trigger trg_apply_sale_item after insert on public.sale_items
for each row execute function public.apply_sale_item();

create or replace function public.apply_bottle_depletion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cost numeric; v_left integer;
begin
  select unit_cost into v_cost from public.products where id = new.product_id;
  new.unit_cost := coalesce(v_cost, 0);
  update public.products set qty_on_hand = qty_on_hand - new.qty
  where id = new.product_id
  returning qty_on_hand into v_left;
  if v_left < 0 then
    raise exception 'Not enough stock: only % left', v_left + new.qty;
  end if;
  return new;
end $$;
create trigger trg_apply_bottle_depletion before insert on public.bottle_depletions
for each row execute function public.apply_bottle_depletion();

create or replace function public.apply_stock_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products set
    unit_cost = case when qty_on_hand + new.qty > 0
      then round(((qty_on_hand * unit_cost) + new.total_cost) / (qty_on_hand + new.qty), 2)
      else unit_cost end,
    qty_on_hand = qty_on_hand + new.qty
  where id = new.product_id;
  return new;
end $$;
create trigger trg_apply_stock_purchase after insert on public.stock_purchases
for each row execute function public.apply_stock_purchase();

create or replace function public.protect_attendance()
returns trigger language plpgsql as $$
begin
  new.staff_id := old.staff_id;
  new.clock_in := old.clock_in;
  if old.clock_out is not null then raise exception 'Shift already closed'; end if;
  return new;
end $$;
create trigger trg_protect_attendance before update on public.attendance
for each row execute function public.protect_attendance();

-- 10 — keep in sync with SEAT_LIMIT in src/config.js
create or replace function public.check_booking_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_taken integer;
begin
  if new.status in ('booked','seated') then
    select coalesce(sum(party_size), 0) into v_taken
    from public.bookings b
    where b.id <> new.id and b.status in ('booked','seated')
      and b.starts_at < new.starts_at + make_interval(mins => new.duration_min)
      and b.starts_at + make_interval(mins => b.duration_min) > new.starts_at;
    if v_taken + new.party_size > 10 then
      raise exception 'Not enough seats at that time (% taken of 10)', v_taken;
    end if;
  end if;
  return new;
end $$;
create trigger trg_booking_capacity before insert or update on public.bookings
for each row execute function public.check_booking_capacity();

-- ── cash ledger ───────────────────────────────────────────────

create view public.cash_ledger with (security_invoker = true) as
    select id, injected_at  as at, 'capital'  as kind,  amount as amount from public.capital_injections
  union all
    select id, sold_at as at, 'sale' as kind, greatest(total_amount, total_revenue) as amount from public.sales
  union all
    select id, purchased_at as at, 'purchase' as kind, -total_cost as amount from public.stock_purchases
  union all
    select id, spent_at as at, 'expense' as kind, -amount as amount from public.expenses;

-- ── row level security ────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.products           enable row level security;
alter table public.capital_injections enable row level security;
alter table public.stock_purchases    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.sales              enable row level security;
alter table public.sale_items         enable row level security;
alter table public.expenses           enable row level security;
alter table public.bottle_depletions  enable row level security;
alter table public.bookings           enable row level security;
alter table public.attendance         enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_owner());

create policy products_read on public.products for select to authenticated using (public.is_active());
create policy products_write on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy menu_read on public.menu_items for select to authenticated using (public.is_active());
create policy menu_write on public.menu_items for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy sales_insert on public.sales for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy sales_read on public.sales for select to authenticated
  using (staff_id = auth.uid() or public.is_owner());
create policy sales_delete on public.sales for delete to authenticated using (public.is_owner());

create policy items_insert on public.sale_items for insert to authenticated
  with check (public.is_active() and exists
    (select 1 from public.sales s where s.id = sale_id and s.staff_id = auth.uid()));
create policy items_read on public.sale_items for select to authenticated
  using (public.is_owner() or exists
    (select 1 from public.sales s where s.id = sale_id and s.staff_id = auth.uid()));
create policy items_delete on public.sale_items for delete to authenticated using (public.is_owner());

create policy purch_insert on public.stock_purchases for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy purch_read on public.stock_purchases for select to authenticated using (public.is_owner());

create policy exp_read on public.expenses for select to authenticated using (public.is_active());
create policy exp_insert on public.expenses for insert to authenticated with check (public.is_active());
create policy exp_write on public.expenses for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy exp_delete on public.expenses for delete to authenticated using (public.is_owner());

create policy cap_all on public.capital_injections for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy depl_read on public.bottle_depletions for select to authenticated using (public.is_active());
create policy depl_insert on public.bottle_depletions for insert to authenticated
  with check (public.is_active());

create policy bookings_read on public.bookings for select to authenticated using (public.is_active());
create policy bookings_insert on public.bookings for insert to authenticated with check (public.is_active());
create policy bookings_update on public.bookings for update to authenticated
  using (public.is_active()) with check (public.is_active());

create policy attendance_read on public.attendance for select to authenticated
  using (staff_id = auth.uid() or public.is_owner());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy attendance_update on public.attendance for update to authenticated
  using (staff_id = auth.uid() and clock_out is null)
  with check (clock_out is not null);

commit;
notify pgrst, 'reload schema';
