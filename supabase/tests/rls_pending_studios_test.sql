-- rls_pending_studios_test.sql
-- pgTAP RLS policy tests for public.pending_studios.
-- Policy model:
--   INSERT  — blocked for all API roles; only service-role (NestJS) inserts.
--   SELECT  — admin only (via app.admin_emails session variable).
--   UPDATE  — admin only (same check).
--   DELETE  — blocked for all API roles.
-- See: docs/adr/0008-studio-onboarding-self-signup.md §4
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(4);

-- Arrange: insert test rows as service_role (bypasses RLS — test setup).
INSERT INTO public.pending_studios (id, email, studio_name, description, locale, status)
VALUES
  (
    'aaaaaaaa-0001-0000-0000-000000000000',
    'studio1@test.local',
    'Studio One',
    'First test studio',
    'en',
    'pending'
  ),
  (
    'aaaaaaaa-0002-0000-0000-000000000000',
    'studio2@test.local',
    'Studio Two',
    'Second test studio',
    'es',
    'pending'
  );

-- Test 1: anon cannot INSERT into pending_studios.
-- Service-role is the only insert path (NestJS uses service-role key).
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public.pending_studios (email, studio_name, description, locale)
     VALUES ('evil@test.local', 'Evil Studio', 'An exploit attempt', 'en') $$,
  'new row violates row-level security policy for table "pending_studios"',
  'anon: cannot insert into pending_studios'
);

-- Test 2: anon cannot SELECT pending_studios (no enumeration).
SELECT is_empty(
  $$ SELECT * FROM public.pending_studios $$,
  'anon: cannot read any pending_studios rows'
);

-- Test 3: authenticated non-admin cannot SELECT pending_studios.
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-0000-0000-0000-000000000000", "role": "authenticated", "email": "nonadmin@test.local"}';
SELECT is_empty(
  $$ SELECT * FROM public.pending_studios $$,
  'non-admin authenticated: cannot read pending_studios rows'
);

-- Test 4: authenticated admin (app.admin_emails set) can SELECT pending rows.
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "dddddddd-0000-0000-0000-000000000000", "role": "authenticated", "email": "admin@test.local"}';
SET LOCAL "app.admin_emails" = 'admin@test.local';
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.pending_studios WHERE status = 'pending' $$,
  ARRAY[2],
  'admin: can read pending_studios rows when app.admin_emails matches'
);

SELECT * FROM finish();
ROLLBACK;
