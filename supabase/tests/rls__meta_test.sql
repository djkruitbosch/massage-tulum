-- rls__meta_test.sql
-- pgTAP RLS policy tests for public._meta.
-- The _meta table is an internal key-value store. No user-facing reads.
-- Policy: service_role RESTRICTIVE — anon and authenticated are fully blocked.
-- See: docs/adr/0003-rls-baseline-conventions.md §Convention 3
--      docs/architecture/repo-layout.md §"Initial data model"

BEGIN;
SELECT plan(4);

-- Arrange: insert test data as the current role (service_role in test context — bypasses RLS).
INSERT INTO public._meta (key, value)
VALUES
  ('schema_version', '1'),
  ('project_id',     'massage-tulum-dev');

-- Test 1: anon cannot read _meta rows.
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public._meta $$,
  'anon: cannot read any _meta rows'
);

-- Test 2: service_role can read _meta rows.
-- Reset role to service_role (the test session's default superuser-equivalent context).
RESET role;
SELECT results_eq(
  $$ SELECT count(*)::int FROM public._meta $$,
  ARRAY[2],
  'service_role: can read all _meta rows'
);

-- Test 3: authenticated users cannot read _meta rows.
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-0000-0000-0000-000000000000", "role": "authenticated"}';
SELECT is_empty(
  $$ SELECT * FROM public._meta $$,
  'authenticated: cannot read any _meta rows'
);

-- Test 4: anon cannot insert into _meta.
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public._meta (key, value) VALUES ('evil_key', 'evil_value') $$,
  'new row violates row-level security policy for table "_meta"',
  'anon: cannot insert into _meta'
);

SELECT * FROM finish();
ROLLBACK;
