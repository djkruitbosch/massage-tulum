-- Migration: 20260503000008_create_therapists.sql
-- Purpose: Create the therapists table for the Therapist Roster feature (CU-869d8k3wb).
--          Stores therapist records scoped to a studio, with soft-delete support.
--
-- Design decisions:
--   - studio_id FK to studios with ON DELETE CASCADE: if a studio is deleted,
--     its therapists are cascade-deleted (no orphaned therapist rows).
--   - name: required, max 120 chars after trim — matches the therapist form field.
--   - role: required, max 80 chars — specialty/role label.
--   - phone: optional, E.164 basic check (full validation in NestJS).
--   - email: optional, loose format guard (authoritative validation in NestJS DTO).
--   - notes: optional, max 500 chars — internal notes, studio-side only.
--   - photo_url: nullable text — stores Storage object path only (not a full URL).
--     NestJS generates signed URLs at render time. No DB constraint on format.
--   - status: 'active' | 'inactive' — soft-delete via deactivation (ADR-0013).
--     No hard DELETE policy; no DELETE API endpoint.
--   - updated_at: maintained by set_updated_at() trigger created in 20260503000005.
--   - RLS: 3 policies (SELECT, INSERT, UPDATE). No DELETE policy (soft-delete only).
--     Ownership resolved via studio_profiles join (ADR-0013).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS therapists_set_updated_at ON public.therapists;
--   DROP TABLE IF EXISTS public.therapists;
--
-- See: docs/architecture/CU-869d29f1p-therapist-roster.md §3
--      docs/adr/0013-studio-scoped-resource-pattern.md

CREATE TABLE public.therapists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id  uuid        NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name       text        NOT NULL
                         CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  role       text        NOT NULL
                         CHECK (length(trim(role)) > 0 AND length(role) <= 80),
  phone      text        CHECK (phone IS NULL OR (phone LIKE '+%' AND length(phone) >= 8)),
  email      text        CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
  notes      text        CHECK (notes IS NULL OR length(notes) <= 500),
  photo_url  text,
  status     text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for the common access pattern: list by studio + filter by status.
-- The studio_id leading column also covers plain WHERE studio_id = $1 queries.
CREATE INDEX idx_therapists_studio_id_status ON public.therapists (studio_id, status);

-- Trigger to maintain updated_at on every row UPDATE.
-- set_updated_at() was created in migration 20260503000005_alter_studios_add_profile_fields.sql.
-- No need to recreate it here.
CREATE TRIGGER therapists_set_updated_at
  BEFORE UPDATE ON public.therapists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (ADR-0003 Convention 1, ADR-0013) ────────────────────────────────────
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;

-- SELECT: studio owner can read only their own studio's therapists.
CREATE POLICY "owner_select_therapists"
  ON public.therapists FOR SELECT TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- INSERT: studio owner can insert therapists only for their own studio.
CREATE POLICY "owner_insert_therapists"
  ON public.therapists FOR INSERT TO authenticated
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: studio owner can update therapists only for their own studio.
-- Both USING and WITH CHECK required to prevent moving a row to another studio.
CREATE POLICY "owner_update_therapists"
  ON public.therapists FOR UPDATE TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- No DELETE policy — soft delete only (ADR-0013).
-- Therapists are deactivated via status = 'inactive'; no hard delete via API.
