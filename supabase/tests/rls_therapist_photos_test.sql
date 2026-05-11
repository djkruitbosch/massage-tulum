-- rls_therapist_photos_test.sql
-- pgTAP RLS policy tests for storage.objects (therapist-photos bucket).
--
-- KNOWN LIMITATION — see PR description:
--   Testing storage.objects RLS via pgTAP requires the test runner to have access
--   to the storage schema and the storage.foldername() helper function. In the
--   Supabase local dev pgTAP runner the storage schema IS available because the
--   local stack includes the storage service and its schema migrations. However,
--   if the CI runner does not initialise the storage schema (or uses a stripped
--   Postgres image), these tests will fail at the SELECT plan() stage rather than
--   in the policy assertions.
--
--   Status after local verification (supabase test db):
--     - storage.objects table: present in local Supabase stack
--     - storage.foldername(): present in local Supabase stack
--     - Policy CREATE in migration 20260503000009: applies cleanly
--     - These tests PASS locally
--
--   If CI fails on this file with "schema storage does not exist" or
--   "function storage.foldername does not exist", file a follow-up DevOps ticket
--   to configure the CI pgTAP runner with the storage schema. That ticket is
--   separate from this feature ticket (CU-869d8k3wb). The migrations themselves
--   are correct; only the pgTAP runner environment is the open question.
--
-- Policy model:
--   SELECT  — authenticated studio owner can read photos for their own therapists.
--   INSERT  — authenticated studio owner can upload photos for their own therapists.
--   UPDATE  — authenticated studio owner can overwrite/replace their own photos.
--   DELETE  — authenticated studio owner can delete their own therapists' photos.
--   anon    — blocked for all operations.
--
-- Four test cases (ADR-0013 requirement):
--   1. anon-read-blocked: anon cannot SELECT from storage.objects for this bucket
--   2. owner-read-allowed: owner can SELECT their own therapist's photo
--   3. cross-owner-read-blocked: owner cannot SELECT another studio's photo
--   4. anon-write-blocked: anon cannot INSERT into storage.objects for this bucket
--
-- Fixture UUIDs (eeeeeeee / ffffffff prefix — matches rls_therapists_test.sql):
--   These fixtures depend on the therapists and studio data already inserted
--   in the same transaction. This test file is standalone (BEGIN/ROLLBACK) and
--   re-inserts all required fixtures.
--
-- Storage path scheme: therapists/{therapist_id}/{uuid}.webp
--   Photo A path: therapists/eeeeeeee-0002-0000-0000-000000000000/photo-001.webp
--   Photo B path: therapists/ffffffff-0002-0000-0000-000000000000/photo-001.webp
--
-- See: docs/architecture/CU-869d29f1p-therapist-roster.md §12c
--      docs/research/CU-869d29f1p-therapist-photo-upload.md §3 Q2, §6 R4

BEGIN;
SELECT plan(4);

-- ─── Arrange ─────────────────────────────────────────────────────────────────
-- Insert auth.users rows directly (no DISABLE TRIGGER ALL — requires superuser).
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'photos-owner-a@test.local'),
  ('ffffffff-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'photos-owner-b@test.local');

INSERT INTO public.studios (id, name)
VALUES
  ('eeeeeeee-0001-0000-0000-000000000000', 'Photo Test Studio A'),
  ('ffffffff-0001-0000-0000-000000000000', 'Photo Test Studio B');

INSERT INTO public.studio_profiles (id, studio_id)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000000',
   'eeeeeeee-0001-0000-0000-000000000000'),
  ('ffffffff-0000-0000-0000-000000000000',
   'ffffffff-0001-0000-0000-000000000000');

INSERT INTO public.therapists (id, studio_id, name, role, status)
VALUES
  ('eeeeeeee-0002-0000-0000-000000000000',
   'eeeeeeee-0001-0000-0000-000000000000',
   'Ana Lopez', 'Masajista', 'active'),
  ('ffffffff-0002-0000-0000-000000000000',
   'ffffffff-0001-0000-0000-000000000000',
   'Maria Santos', 'Masajista', 'active');

-- Insert storage objects directly as service_role (bypasses RLS for test setup).
-- We set owner_id to match the corresponding user so the test fixtures are
-- realistic. The bucket_id must match the bucket created in migration 20260503000009.
INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id)
VALUES
  ('eeeeeeee-0004-0000-0000-000000000000',
   'therapist-photos',
   'therapists/eeeeeeee-0002-0000-0000-000000000000/photo-001.webp',
   'eeeeeeee-0000-0000-0000-000000000000',
   'eeeeeeee-0000-0000-0000-000000000000'),
  ('ffffffff-0003-0000-0000-000000000000',
   'therapist-photos',
   'therapists/ffffffff-0002-0000-0000-000000000000/photo-001.webp',
   'ffffffff-0000-0000-0000-000000000000',
   'ffffffff-0000-0000-0000-000000000000');

-- ─── Test 1: anon cannot SELECT any storage.objects rows in this bucket ───────
SET LOCAL role = anon;
SELECT is_empty(
  $$ SELECT * FROM storage.objects WHERE bucket_id = 'therapist-photos' $$,
  'anon: cannot read any therapist-photos storage objects'
);

-- ─── Test 2: anon cannot INSERT into storage.objects ─────────────────────────
SELECT throws_ok(
  $$ INSERT INTO storage.objects (bucket_id, name)
     VALUES ('therapist-photos',
             'therapists/eeeeeeee-0002-0000-0000-000000000000/evil.webp') $$,
  'new row violates row-level security policy for table "objects"',
  'anon: cannot insert into storage.objects for therapist-photos bucket'
);

-- ─── Test 3: owner-A can SELECT their own therapist''s photo ─────────────────
RESET role;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" =
  '{"sub": "eeeeeeee-0000-0000-0000-000000000000", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int
   FROM storage.objects
   WHERE bucket_id = 'therapist-photos'
     AND name LIKE 'therapists/eeeeeeee-0002-0000-0000-000000000000/%'),
  1,
  'owner-A: can read own therapist photo object'
);

-- ─── Test 4: owner-A cannot read Studio B''s therapist photo (cross-owner) ────
SELECT is_empty(
  $$ SELECT * FROM storage.objects
     WHERE bucket_id = 'therapist-photos'
       AND name LIKE 'therapists/ffffffff-0002-0000-0000-000000000000/%' $$,
  'owner-A: cannot read cross-owner therapist photo'
);

SELECT * FROM finish();
ROLLBACK;
