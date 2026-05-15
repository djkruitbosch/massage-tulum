-- rls_therapists_test.sql
-- pgTAP RLS policy tests for public.therapists.
--
-- Policy model:
--   SELECT  — authenticated studio owner can read only their own studio's therapists.
--   INSERT  — authenticated studio owner can insert therapists for their own studio only.
--   UPDATE  — authenticated studio owner can update only their own studio's therapists.
--   DELETE  — no DELETE policy; soft-delete via status='inactive' only (ADR-0011).
--   anon    — blocked for all operations.
--
-- Four test cases required per ADR-0011 and ADR-0003 Convention 3
-- (in canonical ADR-0003 order):
--   1. anon-read-blocked
--   2. owner-read-allowed
--   3. cross-owner-read-blocked
--   4. anon-write-blocked
--
-- Fixture UUIDs (eeeeeeee-* and ffffffff-* prefix — no collision with other test files):
--   User A:   eeeeeeee-0000-0000-0000-000000000000
--   User B:   ffffffff-0000-0000-0000-000000000000
--   Studio A: eeeeeeee-0001-0000-0000-000000000000
--   Studio B: ffffffff-0001-0000-0000-000000000000
--   Therapist A1: eeeeeeee-0002-0000-0000-000000000000  (belongs to Studio A)
--   Therapist A2: eeeeeeee-0003-0000-0000-000000000000  (belongs to Studio A)
--   Therapist B1: ffffffff-0002-0000-0000-000000000000  (belongs to Studio B)
--
-- See: docs/architecture/CU-869d29f1p-therapist-roster.md §3b
--      docs/adr/0011-studio-scoped-resource-pattern.md
--      docs/adr/0003-rls-baseline-conventions.md §Convention 3

BEGIN;
SELECT plan(4);

-- ─── Arrange ─────────────────────────────────────────────────────────────────
-- Insert auth.users rows via INSERT (not DISABLE TRIGGER ALL — that requires
-- superuser and will fail in CI). The FK on studio_profiles.id requires the
-- auth.users row to exist before inserting into studio_profiles.

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'therapist-owner-a@test.local'),
  ('ffffffff-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'therapist-owner-b@test.local');

INSERT INTO public.studios (id, name)
VALUES
  ('eeeeeeee-0001-0000-0000-000000000000', 'Therapist Test Studio A'),
  ('ffffffff-0001-0000-0000-000000000000', 'Therapist Test Studio B');

INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000000',
   'eeeeeeee-0001-0000-0000-000000000000'),
  ('ffffffff-0000-0000-0000-000000000000',
   'ffffffff-0001-0000-0000-000000000000');

-- Seed therapists: 2 for Studio A, 1 for Studio B.
INSERT INTO public.therapists (id, studio_id, name, role, status)
VALUES
  ('eeeeeeee-0002-0000-0000-000000000000',
   'eeeeeeee-0001-0000-0000-000000000000',
   'Ana Lopez', 'Masajista', 'active'),
  ('eeeeeeee-0003-0000-0000-000000000000',
   'eeeeeeee-0001-0000-0000-000000000000',
   'Carlos Ruiz', 'Terapeuta', 'inactive'),
  ('ffffffff-0002-0000-0000-000000000000',
   'ffffffff-0001-0000-0000-000000000000',
   'Maria Santos', 'Masajista', 'active');

-- ─── Test 1: anon cannot SELECT any therapists rows ──────────────────────────
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM public.therapists $$,
  'anon: cannot read any therapists rows'
);

-- ─── Test 2: owner-A can SELECT only their own studio''s therapists ───────────
-- Matches rls_studios_test.sql pattern: results_eq with explicit UUID array.
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub": "eeeeeeee-0000-0000-0000-000000000000", "role": "authenticated"}';

SELECT results_eq(
  $$ SELECT id FROM public.therapists
     WHERE studio_id = 'eeeeeeee-0001-0000-0000-000000000000'
     ORDER BY name $$,
  ARRAY[
    'eeeeeeee-0002-0000-0000-000000000000'::uuid,
    'eeeeeeee-0003-0000-0000-000000000000'::uuid
  ],
  'owner-A: can read both own therapists (results_eq with explicit UUID array)'
);

-- ─── Test 3: owner-A cannot read Studio B''s therapists (cross-owner blocked) ─
SELECT is_empty(
  $$ SELECT * FROM public.therapists
     WHERE studio_id = 'ffffffff-0001-0000-0000-000000000000' $$,
  'owner-A: cannot read cross-owner therapists'
);

-- ─── Test 4: anon cannot INSERT into therapists ───────────────────────────────
RESET role;
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public.therapists (studio_id, name, role)
     VALUES ('eeeeeeee-0001-0000-0000-000000000000', 'Evil Therapist', 'Hacker') $$,
  'new row violates row-level security policy for table "therapists"',
  'anon: cannot insert into therapists'
);

SELECT * FROM finish();
ROLLBACK;
