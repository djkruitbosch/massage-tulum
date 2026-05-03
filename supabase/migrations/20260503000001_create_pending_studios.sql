-- Migration: 20260503000001_create_pending_studios.sql
-- Purpose: Create the pending_studios holding table for studio owner self-signup.
--          Applicants land here; admin reviews and approves or rejects.
--          See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §2a
--               docs/adr/0008-studio-onboarding-self-signup.md
--               docs/adr/0003-rls-baseline-conventions.md

-- Enum type for pending studio status.
CREATE TYPE public.pending_studio_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.pending_studios (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text        NOT NULL,
  studio_name      text        NOT NULL,
  contact_phone    text,
  description      text        NOT NULL,
  locale           text        NOT NULL DEFAULT 'en' CHECK (locale IN ('es', 'en')),
  status           public.pending_studio_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  auth_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pending_studios_email_unique UNIQUE (email)
);

-- Indices for common query patterns
CREATE INDEX idx_pending_studios_status ON public.pending_studios (status);
CREATE INDEX idx_pending_studios_email  ON public.pending_studios (email);

-- RLS baseline: enable must precede any policy (ADR-0003 Convention 1).
ALTER TABLE public.pending_studios ENABLE ROW LEVEL SECURITY;

-- INSERT: No policy — only service-role (NestJS backend) can insert.
--         Service-role bypasses RLS; anon INSERT is blocked by default.

-- DELETE: No policy — nobody can delete via the API.

-- SELECT (admin only):
-- Admin is identified by a Postgres session variable 'app.admin_emails',
-- set by NestJS at the start of each admin request.
-- current_setting returns NULL-safe empty string when missing (second arg true).
CREATE POLICY "admin_select_pending_studios"
  ON public.pending_studios
  FOR SELECT
  TO authenticated
  USING (
    auth.email() = ANY(
      string_to_array(
        current_setting('app.admin_emails', true), ','
      )
    )
  );

-- UPDATE (admin only — approve / reject):
CREATE POLICY "admin_update_pending_studios"
  ON public.pending_studios
  FOR UPDATE
  TO authenticated
  USING (
    auth.email() = ANY(
      string_to_array(
        current_setting('app.admin_emails', true), ','
      )
    )
  )
  WITH CHECK (
    auth.email() = ANY(
      string_to_array(
        current_setting('app.admin_emails', true), ','
      )
    )
  );
