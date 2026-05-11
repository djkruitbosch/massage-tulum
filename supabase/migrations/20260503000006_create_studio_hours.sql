-- Migration: 20260503000006_create_studio_hours.sql
-- Purpose: Create studio_hours table for per-weekday business hours.
--
-- Design decisions:
--   - Composite PK (studio_id, weekday): exactly one row per studio per day.
--   - weekday: smallint 1–7 (1=Monday, 7=Sunday, ISO 8601).
--   - is_open: boolean. When false, open_time and close_time must be NULL.
--   - open_time / close_time: Postgres TIME WITHOUT TIME ZONE in HH:MM:SS.
--     NestJS trims to HH:MM before returning to client.
--     Timezone is fixed to America/Cancun (no TZ stored here; FE interprets).
--   - CHECK: either closed (is_open=false, times NULL) or open with valid range.
--
-- Rollback: DROP TABLE public.studio_hours;
--
-- See: docs/adr/0012-business-hours-time-storage.md
--      docs/architecture/CU-869d29f1h-studio-profile.md §2

CREATE TABLE public.studio_hours (
  studio_id  uuid     NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  is_open    boolean  NOT NULL DEFAULT false,
  open_time  time     CHECK (open_time IS NULL OR (EXTRACT(SECOND FROM open_time) = 0)),
  close_time time     CHECK (close_time IS NULL OR (EXTRACT(SECOND FROM close_time) = 0)),

  PRIMARY KEY (studio_id, weekday),

  -- When open: both times required and close must be after open.
  -- When closed: times must be NULL.
  CONSTRAINT studio_hours_open_times_check
    CHECK (
      (is_open = false AND open_time IS NULL AND close_time IS NULL)
      OR
      (is_open = true AND open_time IS NOT NULL AND close_time IS NOT NULL
        AND close_time > open_time)
    )
);

-- Index for fast lookup of all hours for a given studio.
CREATE INDEX idx_studio_hours_studio_id ON public.studio_hours (studio_id);

-- RLS baseline (ADR-0003 Convention 1).
ALTER TABLE public.studio_hours ENABLE ROW LEVEL SECURITY;

-- INSERT: Only the owning studio's authenticated user may insert.
--         Ownership resolved via studio_profiles join.
CREATE POLICY "owner_insert_studio_hours"
  ON public.studio_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    studio_id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );

-- SELECT: Authenticated studio owner can read only their own hours.
CREATE POLICY "owner_select_studio_hours"
  ON public.studio_hours
  FOR SELECT
  TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );

-- UPDATE: Authenticated studio owner can update only their own hours.
CREATE POLICY "owner_update_studio_hours"
  ON public.studio_hours
  FOR UPDATE
  TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );

-- DELETE: Owner may delete their own hours (needed for upsert function).
CREATE POLICY "owner_delete_studio_hours"
  ON public.studio_hours
  FOR DELETE
  TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id
      FROM public.studio_profiles
      WHERE id = auth.uid()
    )
  );
