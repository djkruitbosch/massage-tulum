-- seed.sql
-- Local dev seed data. Populated per-feature; empty at Foundation.
-- Add feature-specific seed rows below when a feature ticket requires test data.

-- ─── Studios module seed (CU-869d4z9yz) ───────────────────────────────────────
-- Creates one test studio and the matching studio_profiles row.
-- The test user auth.users row is created by the local Supabase CLI inbucket;
-- the magic-link for owner@test.local is caught by Inbucket (http://localhost:54324).
--
-- Auth user email: owner@test.local
-- Auth user id:    used below as the studio_profiles.id FK.
-- This seed uses a deterministic UUID for reproducibility.

-- The auth.users row is created by the Supabase CLI `supabase db seed` using
-- the local admin API. Seed SQL cannot INSERT into auth.users directly in hosted
-- mode; it works in local dev because the service_role key has full access.

-- Studio for the test owner.
INSERT INTO public.studios (id, name, created_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Test Studio Tulum',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Note: studio_profiles.id FK references auth.users.id.
-- In local dev, the test user must have logged in at least once
-- (or been created via admin API) before this seed row can be inserted.
-- If Supabase CLI creates the user on first run, re-run seed after first login.
--
-- For CI pgTAP tests, the FK is disabled in the test transactions — see
-- supabase/tests/rls_studios_test.sql and rls_studio_profiles_test.sql.

-- ─── Therapist Roster seed (CU-869d8k3wb) ─────────────────────────────────────
-- Adds 3 therapists for the test studio created above.
-- photo_url is null for all seed therapists — photos are uploaded via the UI.
-- Requires the studios row above to exist (ON CONFLICT DO NOTHING handles reruns).

INSERT INTO public.therapists (id, studio_id, name, role, phone, status)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Ana Martinez',
  'Masajista Certificada',
  '+529841234567',
  'active'
),
(
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Carlos Reyes',
  'Terapeuta de Tejido Profundo',
  NULL,
  'active'
),
(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Sofia Herrera',
  'Experta en Masaje Tailandes',
  NULL,
  'inactive'
)
ON CONFLICT (id) DO NOTHING;
