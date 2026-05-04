-- Migration: 20260503000003_create_studio_profiles.sql
-- Purpose: Create the studio_profiles table linking auth.users to studios.
--          Created by NestJS admin approval endpoint; not creatable via anon API.
--          See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--               docs/adr/0003-rls-baseline-conventions.md

CREATE TABLE public.studio_profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id  uuid        NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for studio lookup (inverse direction of PK).
CREATE INDEX idx_studio_profiles_studio_id ON public.studio_profiles (studio_id);

-- RLS baseline (ADR-0003 Convention 1).
ALTER TABLE public.studio_profiles ENABLE ROW LEVEL SECURITY;

-- INSERT: No policy — only service-role (NestJS admin approval) can insert.
-- DELETE: No policy — nobody can delete via the API.

-- SELECT: Authenticated owner can read only their own profile row.
CREATE POLICY "owner_select_studio_profile"
  ON public.studio_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- UPDATE: Authenticated owner can update only their own profile row.
CREATE POLICY "owner_update_studio_profile"
  ON public.studio_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
