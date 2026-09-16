-- ═══════════════════════════════════════════════════════════════════════
--  secure.sql — bring the LIVE Supabase project in line with the app's
--  intended security. Fixes the Security Advisor findings:
--    • RLS disabled on tables            → enable on all app tables
--    • RLS Policy Always True (menu etc) → drop all, recreate scoped policies
--    • Public can execute functions      → revoke from anon/public
--    • Function search_path mutable       → pin search_path = public
--  NON-DESTRUCTIVE: touches only RLS/policies/function grants. No table or
--  row is dropped or changed. Wrapped in a transaction — all-or-nothing, and
--  concurrent readers see the old state until COMMIT, so zero exposure window.
--  App is login-only (staff sign in; demo-login button), so removing anon
--  access breaks nothing. Idempotent — safe to re-run. Paste into
--  Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- 1) Drop EVERY existing policy on our tables (clears the permissive/duplicate
--    'USING (true)' ones the advisor flagged), so we can recreate a clean set.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','products','menu_items','sales','sale_items',
        'stock_purchases','expenses','capital_injections','bottle_depletions',
        'bookings','attendance','tabs','tab_items')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Enable Row-Level Security on every app table.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.menu_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_purchases enable row level security;
alter table public.expenses enable row level security;
alter table public.capital_injections enable row level security;
alter table public.bottle_depletions enable row level security;
alter table public.bookings enable row level security;
alter table public.attendance enable row level security;
alter table public.tabs enable row level security;
alter table public.tab_items enable row level security;

-- 3) Recreate the canonical, scoped policies (verbatim from your db/*.sql).

-- public.profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_owner());

-- public.products
create policy products_read on public.products for select to authenticated using (public.is_active());
create policy products_write on public.products for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- public.menu_items
create policy menu_read on public.menu_items for select to authenticated using (public.is_active());
create policy menu_write on public.menu_items for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- public.sales
create policy sales_insert on public.sales for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy sales_read on public.sales for select to authenticated
  using (staff_id = auth.uid() or public.is_owner());
create policy sales_delete on public.sales for delete to authenticated using (public.is_owner());

-- public.sale_items
create policy items_insert on public.sale_items for insert to authenticated
  with check (public.is_active() and exists
    (select 1 from public.sales s where s.id = sale_id and s.staff_id = auth.uid()));
create policy items_read on public.sale_items for select to authenticated
  using (public.is_owner() or exists
    (select 1 from public.sales s where s.id = sale_id and s.staff_id = auth.uid()));
create policy items_delete on public.sale_items for delete to authenticated using (public.is_owner());

-- public.stock_purchases
create policy purch_insert on public.stock_purchases for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy purch_read on public.stock_purchases for select to authenticated using (public.is_owner());

-- public.expenses
create policy exp_read on public.expenses for select to authenticated using (public.is_active());
create policy exp_insert on public.expenses for insert to authenticated with check (public.is_active());
create policy exp_write on public.expenses for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy exp_delete on public.expenses for delete to authenticated using (public.is_owner());

-- public.capital_injections
create policy cap_all on public.capital_injections for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- public.bottle_depletions
create policy depl_read on public.bottle_depletions for select to authenticated using (public.is_active());
create policy depl_insert on public.bottle_depletions for insert to authenticated
  with check (public.is_active());

-- public.bookings
create policy bookings_read on public.bookings for select to authenticated using (public.is_active());
create policy bookings_insert on public.bookings for insert to authenticated with check (public.is_active());
create policy bookings_update on public.bookings for update to authenticated
  using (public.is_active()) with check (public.is_active());

-- public.attendance
create policy attendance_read on public.attendance for select to authenticated
  using (staff_id = auth.uid() or public.is_owner());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (staff_id = auth.uid() and public.is_active());
create policy attendance_update on public.attendance for update to authenticated
  using (staff_id = auth.uid() and clock_out is null)
  with check (clock_out is not null);

-- public.tabs
create policy tabs_read on public.tabs for select to authenticated using (public.is_active());
create policy tabs_insert on public.tabs for insert to authenticated with check (staff_id = auth.uid() and public.is_active());
create policy tabs_update on public.tabs for update to authenticated
  using (staff_id = auth.uid() or public.is_owner())
  with check (staff_id = auth.uid() or public.is_owner());
create policy tabs_delete on public.tabs for delete to authenticated using (public.is_owner());

-- public.tab_items
create policy titems_read on public.tab_items for select to authenticated using (public.is_active());
create policy titems_insert on public.tab_items for insert to authenticated with check (public.is_active() and exists (select 1 from public.tabs t where t.id = tab_id and t.status='open'));
create policy titems_delete on public.tab_items for delete to authenticated
  using (public.is_owner() or exists
    (select 1 from public.tabs t where t.id = tab_id and t.staff_id = auth.uid()));

-- 4) Pin search_path on every function (fixes 'Function Search Path Mutable').
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
           where pronamespace = 'public'::regnamespace loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- 5) Lock down function execution: revoke from anon/public, grant to
--    authenticated only (fixes 'Public/Signed-in can execute SECURITY DEFINER').
--    Trigger functions don't need caller EXECUTE; the two policy helpers
--    (is_active/is_owner) and any RPCs stay callable by signed-in users.
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
           where pronamespace = 'public'::regnamespace loop
    execute format('revoke execute on function %s from anon, public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

commit;
