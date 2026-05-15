-- rls_services_test.sql
-- pgTAP RLS policy tests for public.services.
--
-- Policy model:
--   SELECT  — authenticated studio owner can read only their own studio's services.
--   INSERT  — authenticated studio owner can insert services for their own studio only.
--   UPDATE  — authenticated studio owner can update only their own studio's services.
--   DELETE  — no DELETE policy; soft-delete via status='inactive' only.
--   anon    — blocked for all operations.
--
-- Seven test cases (ADR-0003 Convention 3 minimum 4 + 3 additional per architect spec):
--   1. anon-read-blocked
--   2. owner-read-allowed
--   3. cross-owner-read-blocked
--   4. anon-write-blocked
--   5. owner-insert-allowed
--   6. owner-insert-cross-studio-blocked
--   7. owner-update-cross-studio-blocked
--
-- Fixture UUIDs (11111111-* / 22222222-* prefix — no collision with any existing test file):
--   User A:    11111111-0000-0000-0000-000000000000
--   User B:    22222222-0000-0000-0000-000000000000
--   Studio A:  11111111-0001-0000-0000-000000000000
--   Studio B:  22222222-0001-0000-0000-000000000000
--   Service A1: 11111111-0002-0000-0000-000000000000  (Studio A, active)
--   Service A2: 11111111-0003-0000-0000-000000000000  (Studio A, inactive)
--   Service A3: 11111111-0004-0000-0000-000000000000  (Studio A, active)
--   Service B1: 22222222-0002-0000-0000-000000000000  (Studio B, active)
--
-- See: docs/architecture/CU-869d29f21-service-catalog.md §2
--      docs/adr/0011-studio-scoped-resource-pattern.md
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(7);

-- ─── Arrange ─────────────────────────────────────────────────────────────────
-- Insert auth.users rows (FK required by studio_profiles.id before inserting profiles).
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('11111111-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'service-owner-a@test.local'),
  ('22222222-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'service-owner-b@test.local');

INSERT INTO public.studios (id, name)
VALUES
  ('11111111-0001-0000-0000-000000000000', 'Service Test Studio A'),
  ('22222222-0001-0000-0000-000000000000', 'Service Test Studio B');

INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  ('11111111-0000-0000-0000-000000000000',
   '11111111-0001-0000-0000-000000000000'),
  ('22222222-0000-0000-0000-000000000000',
   '22222222-0001-0000-0000-000000000000');

-- Seed services: 3 for Studio A (mix active/inactive), 1 for Studio B.
INSERT INTO public.services (id, studio_id, name, category, duration_minutes, base_price_mxn, status)
VALUES
  ('11111111-0002-0000-0000-000000000000',
   '11111111-0001-0000-0000-000000000000',
   'Masaje Relajante', 'Relajación', 60, 800, 'active'),
  ('11111111-0003-0000-0000-000000000000',
   '11111111-0001-0000-0000-000000000000',
   'Masaje Deportivo', 'Terapéutico', 90, 1200, 'inactive'),
  ('11111111-0004-0000-0000-000000000000',
   '11111111-0001-0000-0000-000000000000',
   'Masaje con Piedras Calientes', NULL, 75, 950, 'active'),
  ('22222222-0002-0000-0000-000000000000',
   '22222222-0001-0000-0000-000000000000',
   'Reflexología', 'Terapéutico', 45, 600, 'active');

-- ─── Test 1: anon cannot SELECT any services rows ─────────────────────────────
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.services $$,
  'anon: cannot read any services rows'
);

-- ─── Test 2: owner-A can SELECT only their own studio''s services ──────────────
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub": "11111111-0000-0000-0000-000000000000", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT id FROM public.services
     WHERE studio_id = '11111111-0001-0000-0000-000000000000'
     ORDER BY name $$,
  ARRAY[
    '11111111-0004-0000-0000-000000000000'::uuid,
    '11111111-0002-0000-0000-000000000000'::uuid,
    '11111111-0003-0000-0000-000000000000'::uuid
  ],
  'owner-A: can read all own studio''s services (results_eq with explicit UUID array)'
);

-- ─── Test 3: owner-A cannot SELECT studio-B''s services (cross-owner blocked) ──
SELECT is_empty(
  $$ SELECT * FROM public.services
     WHERE studio_id = '22222222-0001-0000-0000-000000000000' $$,
  'owner-A: cannot read cross-owner services'
);

-- ─── Test 4: anon cannot INSERT into services ──────────────────────────────────
RESET role;
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('11111111-0001-0000-0000-000000000000', 'Evil Service', 60, 0) $$,
  'new row violates row-level security policy for table "services"',
  'anon: cannot insert into services'
);

-- ─── Test 5: owner-A can INSERT services for their own studio ─────────────────
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub": "11111111-0000-0000-0000-000000000000", "role": "authenticated"}';

SELECT lives_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('11111111-0001-0000-0000-000000000000', 'Nuevo Masaje', 60, 500) $$,
  'owner-A: can insert services for their own studio'
);

-- ─── Test 6: owner-A cannot INSERT services for studio-B ──────────────────────
SELECT throws_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('22222222-0001-0000-0000-000000000000', 'Hacked Service', 60, 0) $$,
  'new row violates row-level security policy for table "services"',
  'owner-A: cannot insert services for cross-owner studio'
);

-- ─── Test 7: owner-A cannot UPDATE studio-B''s services ───────────────────────
SELECT is(
  (WITH upd AS (
    UPDATE public.services SET name = 'Hacked'
    WHERE studio_id = '22222222-0001-0000-0000-000000000000'
    RETURNING id
  ) SELECT count(*)::int FROM upd),
  0,
  'owner-A: cannot update cross-studio services'
);

SELECT * FROM finish();
ROLLBACK;
