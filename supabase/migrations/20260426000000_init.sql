-- Migration: 20260426000000_init.sql
-- Purpose: Create the _meta key-value table and establish the RLS baseline.
--          This table is an internal placeholder — it holds no business data.
--          It demonstrates the full convention:
--            CREATE TABLE -> ENABLE ROW LEVEL SECURITY -> CREATE POLICY
--          See: docs/architecture/repo-layout.md §"Initial data model"
--               docs/adr/0003-rls-baseline-conventions.md

CREATE TABLE IF NOT EXISTS public._meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public._meta ENABLE ROW LEVEL SECURITY;

-- Only service_role (admin) can read or write _meta rows.
-- Anon and authenticated users have no access.
CREATE POLICY "service_role only"
  ON public._meta
  AS RESTRICTIVE
  TO service_role
  USING (true)
  WITH CHECK (true);
