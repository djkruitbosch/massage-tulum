-- rls_studio_profiles_test.sql
-- pgTAP RLS policy tests for public.studio_profiles.
-- Policy model:
--   INSERT  — blocked for all API roles; only service-role (NestJS) inserts.
--   SELECT  — authenticated user can read only where id = auth.uid().
--   UPDATE  — authenticated user can update only where id = auth.uid().
--   DELETE  — blocked for all API roles.
-- See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(4);

-- Arrange: insert auth.users rows first to satisfy studio_profiles.id FK,
-- then studios and studio_profiles. Run as service_role (bypasses RLS for setup).
-- We can't DISABLE TRIGGER ALL because that touches RI system triggers, which
-- require superuser; instead we satisfy the FK by inserting the parent rows.
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('aaaaaaaa-1111-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-a@test.local'),
  ('bbbbbbbb-1111-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner-b@test.local');

INSERT INTO public.studios (id, name)
VALUES
  ('cccccccc-0001-0000-0000-000000000000', 'Profile Studio Alpha'),
  ('cccccccc-0002-0000-0000-000000000000', 'Profile Studio Beta');

INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  (
    'aaaaaaaa-1111-0000-0000-000000000000',
    'cccccccc-0001-0000-0000-000000000000'
  ),
  (
    'bbbbbbbb-1111-0000-0000-000000000000',
    'cccccccc-0002-0000-0000-000000000000'
  );

-- Test 1: anon cannot SELECT any studio_profiles.
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.studio_profiles $$,
  'anon: cannot read any studio_profiles rows'
);

-- Test 2: anon cannot INSERT into studio_profiles.
SELECT throws_ok(
  $$ INSERT INTO public.studio_profiles (id, studio_id)
     VALUES (gen_random_uuid(), 'cccccccc-0001-0000-0000-000000000000') $$,
  'new row violates row-level security policy for table "studio_profiles"',
  'anon: cannot insert into studio_profiles'
);

-- Test 3: owner-A can SELECT their own profile only.
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-1111-0000-0000-000000000000", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT id FROM public.studio_profiles $$,
  ARRAY['aaaaaaaa-1111-0000-0000-000000000000'::uuid],
  'owner-A: can read own studio_profiles row only'
);

-- Test 4: owner-A cannot read owner-B's profile (cross-owner read blocked).
SELECT is_empty(
  $$ SELECT * FROM public.studio_profiles WHERE id = 'bbbbbbbb-1111-0000-0000-000000000000' $$,
  'owner-A: cannot read cross-owner studio_profiles row'
);

SELECT * FROM finish();
ROLLBACK;
