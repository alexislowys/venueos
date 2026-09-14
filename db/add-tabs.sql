create table if not exists public.tabs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  staff_id uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open','closed','void')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  sale_id uuid references public.sales(id)
);
create table if not exists public.tab_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  qty integer not null default 1 check (qty > 0),
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tab_items_tab_idx on public.tab_items (tab_id);
do $$ begin
  alter table public.tabs add constraint tab_label_len check (char_length(label) <= 60) not valid;
exception when duplicate_object then null; end $$;

create or replace function public.fill_tab_item()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.unit_price := coalesce((select price from public.menu_items where id=new.menu_item_id),0);
  return new;
end $$;
drop trigger if exists trg_fill_tab_item on public.tab_items;
create trigger trg_fill_tab_item before insert on public.tab_items
for each row execute function public.fill_tab_item();

alter table public.tabs enable row level security;
alter table public.tab_items enable row level security;
drop policy if exists tabs_read on public.tabs;
create policy tabs_read on public.tabs for select to authenticated using (public.is_active());
drop policy if exists tabs_insert on public.tabs;
create policy tabs_insert on public.tabs for insert to authenticated with check (staff_id = auth.uid() and public.is_active());
drop policy if exists tabs_update on public.tabs;
create policy tabs_update on public.tabs for update to authenticated using (public.is_active()) with check (public.is_active());
drop policy if exists tabs_delete on public.tabs;
create policy tabs_delete on public.tabs for delete to authenticated using (public.is_owner());
drop policy if exists titems_read on public.tab_items;
create policy titems_read on public.tab_items for select to authenticated using (public.is_active());
drop policy if exists titems_insert on public.tab_items;
create policy titems_insert on public.tab_items for insert to authenticated with check (public.is_active() and exists (select 1 from public.tabs t where t.id = tab_id and t.status='open'));
drop policy if exists titems_delete on public.tab_items;
create policy titems_delete on public.tab_items for delete to authenticated using (public.is_active());
notify pgrst, 'reload schema';
