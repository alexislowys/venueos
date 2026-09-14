-- ═══════════════════════════════════════════════════════════════
--  HARDENING MIGRATION — run after demo-schema.sql + add-tabs.sql.
--  Closes three gaps found in a security audit:
--   1. a direct API insert into sales could carry fabricated totals
--      and a backdated sold_at — the recompute trigger only fires
--      when sale_items arrive, so a zero-item sale kept them
--   2. owner-deleting a sale_item left the parent sale's totals stale
--   3. any active staff could update another staff's tab, or delete
--      its items before settle
--  Idempotent — safe to re-run in Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Sales start at zero and now(); totals only ever come from the
--    sale_items triggers. auth.uid() is null in the SQL editor and the
--    seed/reset scripts, which legitimately insert historical demo data —
--    those are left untouched.
create or replace function public.sanitize_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.total_revenue  := 0;
    new.total_cogs     := 0;
    new.service_amount := 0;
    new.tax_amount     := 0;
    new.total_amount   := 0;
    new.sold_at        := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_sanitize_sale on public.sales;
create trigger trg_sanitize_sale before insert on public.sales
for each row execute function public.sanitize_sale();

-- 2. Same 0.05 / 0.10 rates as apply_sale_item (src/config.js)
create or replace function public.recompute_sale_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sub numeric; v_srv numeric; v_tax numeric;
begin
  select coalesce(sum(qty * unit_price), 0) into v_sub
  from public.sale_items where sale_id = old.sale_id;
  v_srv := round(v_sub * 0.05);
  v_tax := round((v_sub + v_srv) * 0.10);
  update public.sales set
    total_revenue = v_sub, service_amount = v_srv,
    tax_amount = v_tax, total_amount = v_sub + v_srv + v_tax
  where id = old.sale_id;
  return old;
end $$;
drop trigger if exists trg_recompute_on_item_delete on public.sale_items;
create trigger trg_recompute_on_item_delete after delete on public.sale_items
for each row execute function public.recompute_sale_totals();

-- 3. A tab belongs to the staff member who opened it; only they (or the
--    owner) may update it or pull items off it before settle.
drop policy if exists tabs_update on public.tabs;
create policy tabs_update on public.tabs for update to authenticated
  using (staff_id = auth.uid() or public.is_owner())
  with check (staff_id = auth.uid() or public.is_owner());
drop policy if exists titems_delete on public.tab_items;
create policy titems_delete on public.tab_items for delete to authenticated
  using (public.is_owner() or exists
    (select 1 from public.tabs t where t.id = tab_id and t.staff_id = auth.uid()));

notify pgrst, 'reload schema';
