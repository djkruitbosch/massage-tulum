-- Migration: 20260503000004_create_studios_owner_policies.sql
-- Purpose: Owner SELECT/UPDATE policies on public.studios that depend on the
--          public.studio_profiles join. Split out from
--          20260503000002_create_studios.sql so the policy creation runs
--          *after* studio_profiles exists (created in 20260503000003).
--          See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--               docs/adr/0003-rls-baseline-conventions.md

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
