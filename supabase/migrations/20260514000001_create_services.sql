-- Migration: 20260514000001_create_services.sql
-- Purpose: Create the services table for the Service Catalog feature (CU-869d29f21).
--
-- Design decisions:
--   - studio_id FK to studios with ON DELETE CASCADE.
--   - name: required, 1–120 chars after trim.
--   - description: optional, max 1000 chars (spec §3 AC#7 authoritative at 1000).
--   - category: optional, max 60 chars. Stored verbatim (case-sensitive).
--     No separate categories table; derived from DISTINCT category WHERE studio_id.
--   - duration_minutes: required, positive integer >= 1. No upper bound DB constraint
--     (spec has no hard cap; DurationPicker caps at 480 in UI only).
--   - base_price_mxn: required, integer >= 0. Whole pesos (spec §9 decision 2).
--   - status: 'active' | 'inactive'. Soft-delete only.
--   - updated_at maintained by set_updated_at() trigger (created in 20260503000005).
--   - RLS: 3 policies (SELECT, INSERT, UPDATE). No DELETE policy.
--     Ownership via studio_profiles join (ADR-0011, pattern from PR #86).
--
-- Historical price integrity: price_snapshot_mxn on future bookings table
--   (ADR-0010). No version table needed here.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
--   DROP TABLE IF EXISTS public.services;
--
-- See: docs/architecture/CU-869d29f21-service-catalog.md §2
--      docs/adr/0010-service-price-snapshot-for-historical-bookings.md
--      docs/adr/0011-studio-scoped-resource-pattern.md

CREATE TABLE public.services (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id          uuid        NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name               text        NOT NULL
                                 CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  description        text        CHECK (description IS NULL OR length(description) <= 1000),
  category           text        CHECK (category IS NULL OR length(category) <= 60),
  duration_minutes   integer     NOT NULL CHECK (duration_minutes >= 1),
  base_price_mxn     integer     NOT NULL CHECK (base_price_mxn >= 0),
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'inactive')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_studio_id_status ON public.services (studio_id, status);

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS (ADR-0003 Convention 1, ADR-0011)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_services"
  ON public.services FOR SELECT TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "owner_update_services"
  ON public.services FOR UPDATE TO authenticated
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

-- No DELETE policy — soft delete only.
