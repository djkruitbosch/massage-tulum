-- Migration: 20260503000002_create_studios.sql
-- Purpose: Create the studios table for approved studio owners.
--          Created by NestJS admin approval endpoint; not creatable via anon API.
--          See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--               docs/adr/0003-rls-baseline-conventions.md

CREATE TABLE public.studios (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS baseline (ADR-0003 Convention 1).
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- INSERT: No policy — only service-role (NestJS admin approval) can insert.
-- DELETE: No policy — nobody can delete via the API.

-- SELECT: Studio owner can read only their own studio.
--         Resolved via studio_profiles join (see ADR-0007).
CREATE POLICY "owner_select_studio"
  ON public.studios
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );

-- UPDATE: Studio owner can update only their own studio.
CREATE POLICY "owner_update_studio"
  ON public.studios
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );
