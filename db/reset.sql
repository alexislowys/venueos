-- ═══════════════════════════════════════════════════════════════
--  RESET SCRIPT — empties ALL business data so you can start fresh.
--
--  ⚠️  THIS DELETES EVERYTHING: every sale, booking, expense,
--      product, menu item, restock and stock movement.
--      It does NOT delete your login accounts (profiles / auth).
--
--  Use this when reusing the app for a new venue.
--  Run it in Supabase → SQL Editor. It cannot be undone, so only
--  run it when you truly want a blank slate.
-- ═══════════════════════════════════════════════════════════════

truncate table
  sale_items,
  sales,
  bottle_depletions,
  stock_purchases,
  expenses,
  capital_injections,
  bookings,
  menu_items,
  products
restart identity cascade;

-- Tables kept on purpose: profiles (your staff/owner records) and
-- Supabase Auth users (your logins). Delete those manually in the
-- dashboard only if you also want to remove the people.
