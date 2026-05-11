-- rls_studio_hours_test.sql
-- pgTAP RLS policy tests for public.studio_hours.
--
-- Policy model:
--   INSERT  — authenticated studio owner (resolved via studio_profiles join).
--   SELECT  — authenticated studio owner can read only their own studio's hours.
--   UPDATE  — authenticated studio owner can update only their own studio's hours.
--   DELETE  — authenticated studio owner can delete only their own studio's hours.
--   anon    — blocked for all operations.
--
-- See: docs/architecture/CU-869d29f1h-studio-profile.md §2
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(4);

-- Arrange: create auth users, studios, profiles, and hours.
-- Run as service_role (bypasses RLS for test setup).
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('cccccccc-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hours-owner-a@test.local'),
  ('dddddddd-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hours-owner-b@test.local');

INSERT INTO public.studios (id, name)
VALUES
  ('cccccccc-0001-0000-0000-000000000000', 'Studio Hours Alpha'),
  ('dddddddd-0001-0000-0000-000000000000', 'Studio Hours Beta');

INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  ('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0001-0000-0000-000000000000'),
  ('dddddddd-0000-0000-0000-000000000000', 'dddddddd-0001-0000-0000-000000000000');

-- Seed Studio Alpha's hours (Monday open, rest closed).
INSERT INTO public.studio_hours (studio_id, weekday, is_open, open_time, close_time)
VALUES
  ('cccccccc-0001-0000-0000-000000000000', 1, true, '09:00', '21:00'),
  ('cccccccc-0001-0000-0000-000000000000', 2, false, NULL, NULL),
  ('cccccccc-0001-0000-0000-000000000000', 3, false, NULL, NULL),
  ('cccccccc-0001-0000-0000-000000000000', 4, false, NULL, NULL),
  ('cccccccc-0001-0000-0000-000000000000', 5, false, NULL, NULL),
  ('cccccccc-0001-0000-0000-000000000000', 6, false, NULL, NULL),
  ('cccccccc-0001-0000-0000-000000000000', 7, false, NULL, NULL);

-- Seed Studio Beta's hours (all closed).
INSERT INTO public.studio_hours (studio_id, weekday, is_open, open_time, close_time)
VALUES
  ('dddddddd-0001-0000-0000-000000000000', 1, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 2, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 3, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 4, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 5, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 6, false, NULL, NULL),
  ('dddddddd-0001-0000-0000-000000000000', 7, false, NULL, NULL);

-- Test 1: anon cannot SELECT any studio_hours rows.
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.studio_hours $$,
  'anon: cannot read any studio_hours rows'
);

-- Test 2: anon cannot INSERT into studio_hours.
SELECT throws_ok(
  $$ INSERT INTO public.studio_hours (studio_id, weekday, is_open)
     VALUES ('cccccccc-0001-0000-0000-000000000000', 1, false) $$,
  'new row violates row-level security policy for table "studio_hours"',
  'anon: cannot insert into studio_hours'
);

-- Test 3: owner-A can SELECT only their own studio's hours (7 rows for Alpha).
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub": "cccccccc-0000-0000-0000-000000000000", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.studio_hours
   WHERE studio_id = 'cccccccc-0001-0000-0000-000000000000'),
  7,
  'owner-A: can read all 7 hours rows for own studio'
);

-- Test 4: owner-A cannot read Studio Beta's hours (cross-owner blocked).
SELECT is_empty(
  $$ SELECT * FROM public.studio_hours
     WHERE studio_id = 'dddddddd-0001-0000-0000-000000000000' $$,
  'owner-A: cannot read cross-owner studio_hours'
);

SELECT * FROM finish();
ROLLBACK;
