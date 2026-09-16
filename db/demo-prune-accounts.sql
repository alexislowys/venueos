-- ═══════════════════════════════════════════════════════════════
--  DEMO-ONLY — run by .github/workflows/reset-demo.yml, never on a
--  real venue. The one-click demo signs every visitor in as the
--  owner, and the owner can mint staff logins through the
--  create-staff edge function. Those accounts would otherwise live
--  forever, so each reset removes every login except the demo owner
--  and every profile the seed does not own.
--
--  Requires the postgres role (session-pooler connection string);
--  auth.users is not reachable through the API roles.
--  Expects PASTE_OWNER_UID_HERE to be substituted, same as the seed.
-- ═══════════════════════════════════════════════════════════════

delete from public.profiles
where id not in (
  'PASTE_OWNER_UID_HERE',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002'
);

delete from auth.users
where id <> 'PASTE_OWNER_UID_HERE';
