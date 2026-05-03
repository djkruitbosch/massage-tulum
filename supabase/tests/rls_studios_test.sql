-- rls_studios_test.sql
-- pgTAP RLS policy tests for public.studios.
-- Policy model:
--   INSERT  — blocked for all API roles; only service-role (NestJS) inserts.
--   SELECT  — authenticated studio owner can read only their own studio.
--   UPDATE  — authenticated studio owner can update only their own studio.
--   DELETE  — blocked for all API roles.
-- See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(4);

-- Arrange: create two studios and two studio_profiles as service_role.
-- We need auth.users rows; in test context we reference UUIDs that may not
-- exist in auth.users but studio_profiles.id FK references auth.users.
-- Use the existing test user pattern from the project (no FK enforcement in pgTAP isolation).

-- Note: studio_profiles.id FKs to auth.users. In local pgTAP tests run via
-- supabase test db, auth.users rows for these UUIDs do not exist. We disable the
-- FK temporarily for test isolation.
ALTER TABLE public.studio_profiles DISABLE TRIGGER ALL;

INSERT INTO public.studios (id, name)
VALUES
  ('bbbbbbbb-0001-0000-0000-000000000000', 'Studio Alpha'),
  ('bbbbbbbb-0002-0000-0000-000000000000', 'Studio Beta');

-- Link owner-A (UUID ending -aaaa) to Studio Alpha.
-- Link owner-B (UUID ending -bbbb) to Studio Beta.
INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000000',
    'bbbbbbbb-0001-0000-0000-000000000000'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000000',
    'bbbbbbbb-0002-0000-0000-000000000000'
  );

ALTER TABLE public.studio_profiles ENABLE TRIGGER ALL;

-- Test 1: anon cannot SELECT any studios.
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.studios $$,
  'anon: cannot read any studios rows'
);

-- Test 2: anon cannot INSERT into studios.
SELECT throws_ok(
  $$ INSERT INTO public.studios (name) VALUES ('Evil Studio') $$,
  'new row violates row-level security policy for table "studios"',
  'anon: cannot insert into studios'
);

-- Test 3: owner-A can SELECT their own studio and not Studio Beta.
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-0000-0000-0000-000000000000", "role": "authenticated"}';
SELECT results_eq(
  $$ SELECT id FROM public.studios ORDER BY name $$,
  ARRAY['bbbbbbbb-0001-0000-0000-000000000000'::uuid],
  'owner-A: can read own studio only'
);

-- Test 4: owner-A cannot read Studio Beta (cross-owner read blocked).
SELECT is_empty(
  $$ SELECT * FROM public.studios WHERE id = 'bbbbbbbb-0002-0000-0000-000000000000' $$,
  'owner-A: cannot read cross-owner studio'
);

SELECT * FROM finish();
ROLLBACK;
