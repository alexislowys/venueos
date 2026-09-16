-- ═══════════════════════════════════════════════════════════════════════
--  secure-2.sql — follow-up after secure.sql. Clears the remaining
--  "Signed-In Users Can Execute SECURITY DEFINER Function" warnings for the
--  TRIGGER functions. Trigger functions run automatically as part of a
--  trigger — no caller needs EXECUTE — so we revoke it from everyone but the
--  owner. Safe: triggers still fire on insert/update exactly as before.
--
--  NOT touched: is_active() / is_owner() — those are called inside 35 RLS
--  policies, so signed-in users MUST keep EXECUTE or every query breaks.
--  Their advisor warning is expected and harmless (a staff member calling
--  is_active() only learns their own boolean status). Leave them.
--
--  Idempotent. Paste into Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════

begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'pg_catalog.trigger'::regtype   -- trigger functions only
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

commit;
