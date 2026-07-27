-- ═══════════════════════════════════════════════════════════════
--  DEMO SEED — run AFTER demo-schema.sql on the demo project.
--  ⚠ FIRST: replace PASTE_OWNER_UID_HERE below with the UID of the
--    demo auth user you created (Authentication → Users).
--  Generates ~3 months of believable bar activity.
-- ═══════════════════════════════════════════════════════════════

begin;

-- people
insert into public.profiles (id, name, role, email) values
  ('PASTE_OWNER_UID_HERE', 'Alex (Demo Owner)', 'owner', 'demo@bar.app');
insert into public.profiles (id, name, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Budi', 'staff', 'budi@bar.app'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sinta', 'staff', 'sinta@bar.app');

-- opening capital
insert into public.capital_injections (staff_id, amount, note, injected_at) values
  ('PASTE_OWNER_UID_HERE', 150000000, 'Opening capital', now() - interval '95 days');

-- bottles on the shelf
insert into public.products (name, brand, category, volume_ml, reorder_level) values
  ('Clase Azul Reposado',  'Clase Azul',   'tequila',   750, 3),
  ('Don Julio 1942',       'Don Julio',    'tequila',   750, 3),
  ('Dom Pérignon Vintage', 'Dom Pérignon', 'champagne', 750, 3),
  ('Moët Impérial',        'Moët',         'champagne', 750, 4),
  ('Macallan 12',          'Macallan',     'whiskey',   750, 3),
  ('Hibiki Harmony',       'Suntory',      'whiskey',   700, 3),
  ('Grey Goose',           'Grey Goose',   'vodka',     750, 4),
  ('Hendrick''s Gin',      'Hendrick''s',  'gin',       750, 4),
  ('Campari',              'Campari',      'liqueur',   700, 4),
  ('Bintang Pilsener',     'Bintang',      'beer',      620, 24);

-- initial deliveries (sets stock + weighted cost)
insert into public.stock_purchases (product_id, staff_id, qty, total_cost, supplier, purchased_at)
select p.id, 'PASTE_OWNER_UID_HERE', v.qty, v.cost, 'Prime Distributor', now() - interval '92 days'
from (values
  ('Clase Azul Reposado',  40, 100000000),
  ('Don Julio 1942',       40, 132000000),
  ('Dom Pérignon Vintage', 40, 140000000),
  ('Moët Impérial',        50,  45000000),
  ('Macallan 12',          40,  72000000),
  ('Hibiki Harmony',       40,  68000000),
  ('Grey Goose',           50,  27500000),
  ('Hendrick''s Gin',      50,  25000000),
  ('Campari',              50,  15000000),
  ('Bintang Pilsener',    480,  12000000)
) as v(name, qty, cost)
join public.products p on p.name = v.name;

-- the menu
insert into public.menu_items (name, category, subcategory, price, whole_bottle, product_id)
select v.name, v.cat, v.sub, v.price, v.whole,
  case when v.whole then (select id from public.products where name = v.link) end
from (values
  ('Negroni',              'cocktail', null,        140000, false, null),
  ('Old Fashioned',        'cocktail', null,        150000, false, null),
  ('Espresso Martini',     'cocktail', null,        145000, false, null),
  ('Margarita',            'cocktail', null,        130000, false, null),
  ('Whiskey Sour',         'cocktail', null,        135000, false, null),
  ('Patrón Shot',          'shot',     null,         95000, false, null),
  ('Tequila Shot',         'shot',     null,         75000, false, null),
  ('Whiskey Neat',         'shot',     null,        110000, false, null),
  ('Glass of Champagne',   'glass',    null,        180000, false, null),
  ('House Wine Glass',     'glass',    null,        110000, false, null),
  ('Bintang',              'glass',    null,         55000, false, null),
  ('Clase Azul Reposado',  'bottle',   'tequila',  4500000, true,  'Clase Azul Reposado'),
  ('Don Julio 1942',       'bottle',   'tequila',  5500000, true,  'Don Julio 1942'),
  ('Dom Pérignon Vintage', 'bottle',   'champagne',6000000, true,  'Dom Pérignon Vintage'),
  ('Moët Impérial',        'bottle',   'champagne',2200000, true,  'Moët Impérial'),
  ('Macallan 12',          'bottle',   'whiskey',  3200000, true,  'Macallan 12'),
  ('Hibiki Harmony',       'bottle',   'whiskey',  3400000, true,  'Hibiki Harmony')
) as v(name, cat, sub, price, whole, link);

-- running costs, monthly-ish
insert into public.expenses (staff_id, category, amount, note, spent_at)
select 'PASTE_OWNER_UID_HERE', v.cat, v.amt, v.note, now() - (v.d || ' days')::interval
from (values
  ('rent',      12000000, 'Monthly rent',      80),
  ('rent',      12000000, 'Monthly rent',      50),
  ('rent',      12000000, 'Monthly rent',      20),
  ('wages',     18000000, 'Staff wages',       75),
  ('wages',     18000000, 'Staff wages',       45),
  ('wages',     18000000, 'Staff wages',       15),
  ('utilities',  2400000, 'Electricity',       70),
  ('utilities',  2500000, 'Electricity',       40),
  ('utilities',  2350000, 'Electricity',       10),
  ('supplies',   1200000, 'Glassware + garnish', 60),
  ('maintenance', 800000, 'Ice machine service', 33)
) as v(cat, amt, note, d);

-- ~3 months of sales (evenings, busier weekends)
do $$
declare
  d integer; n integer; i integer; j integer; items integer;
  v_sale uuid; v_menu uuid; v_staff uuid; v_when timestamptz;
  v_methods text[] := array['cash','card','qris'];
  v_names text[] := array[null,null,null,'Rizky','Maya','Kevin','Putri','James',null,'Anya'];
begin
  for d in reverse 90..1 loop
    n := 3 + floor(random() * 5)::int
         + case when extract(dow from now() - (d || ' days')::interval) in (5,6) then 4 else 0 end;
    for i in 1..n loop
      v_when := date_trunc('day', now() - (d || ' days')::interval)
                + interval '18 hours' + (random() * interval '6 hours');
      v_staff := case when random() < 0.5
        then 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
        else 'aaaaaaaa-0000-0000-0000-000000000002'::uuid end;
      insert into public.sales (staff_id, sold_at, payment_method, customer_name, note)
      values (v_staff, v_when,
              v_methods[1 + floor(random() * 3)::int],
              v_names[1 + floor(random() * 10)::int],
              'Counter sale')
      returning id into v_sale;

      items := 1 + floor(random() * 3)::int;
      for j in 1..items loop
        if random() < 0.04 then
          select id into v_menu from public.menu_items where whole_bottle order by random() limit 1;
        else
          select id into v_menu from public.menu_items where not whole_bottle order by random() limit 1;
        end if;
        insert into public.sale_items (sale_id, menu_item_id, qty)
        values (v_sale, v_menu, 1 + floor(random() * 2)::int);
      end loop;
    end loop;
  end loop;
end $$;

-- cocktail bottles emptied along the way (+ a little honest waste)
do $$
declare d integer; v_prod uuid;
begin
  for d in reverse 84..7 loop
    if d % 7 = 0 then
      select id into v_prod from public.products
      where name in ('Campari','Grey Goose','Hendrick''s Gin','Macallan 12') order by random() limit 1;
      insert into public.bottle_depletions (product_id, qty, reason, note, created_at)
      values (v_prod, 1 + floor(random() * 2)::int, 'used', 'weekly count',
              now() - (d || ' days')::interval);
    end if;
    if d % 30 = 3 then
      select id into v_prod from public.products where name = 'Bintang Pilsener';
      insert into public.bottle_depletions (product_id, qty, reason, note, created_at)
      values (v_prod, 2, 'breakage', 'dropped a tray', now() - (d || ' days')::interval);
    end if;
  end loop;
end $$;

-- upcoming bookings
insert into public.bookings (customer_name, phone, party_size, starts_at, duration_min, status, note) values
  ('Rizky',  '+62811922441', 4, date_trunc('day', now()) + interval '1 day 19 hours',   120, 'booked', 'birthday'),
  ('Maya',   '+62812334455', 2, date_trunc('day', now()) + interval '1 day 20 hours',   120, 'booked', null),
  ('Kevin',  '+62813556677', 3, date_trunc('day', now()) + interval '2 days 19 hours',  150, 'booked', 'window table'),
  ('Putri',  '+62815778899', 2, date_trunc('day', now()) + interval '2 days 21 hours',  120, 'booked', null),
  ('James',  '+62817990011', 5, date_trunc('day', now()) + interval '3 days 20 hours',  180, 'booked', 'bottle service');

-- staff attendance, last 2 weeks
insert into public.attendance (staff_id, clock_in, clock_out)
select s.id,
       date_trunc('day', now() - (d || ' days')::interval) + interval '17 hours' + (random() * interval '30 minutes'),
       date_trunc('day', now() - (d || ' days')::interval) + interval '25 hours' + (random() * interval '60 minutes')
from generate_series(1, 14) as d
cross join (select id from public.profiles where role = 'staff') s
where d % 7 <> 3;

commit;
notify pgrst, 'reload schema';
