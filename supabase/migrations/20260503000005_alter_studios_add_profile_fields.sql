-- Migration: 20260503000005_alter_studios_add_profile_fields.sql
-- Purpose: Add profile fields to public.studios for studio management (PROFILE-BE-1).
--          address, phone (E.164), email, and updated_at timestamp.
--          name already exists from 20260503000002.
--
-- Design decisions:
--   - No owner_id column: ownership resolved via studio_profiles join (ADR-0003).
--   - phone stores E.164 format (validated in NestJS before write).
--     See: docs/adr/0011-phone-number-storage-format.md
--   - phone doubles as WhatsApp contact number (single field, spec decision).
--   - email nullable: studio may use phone only.
--   - address nullable: optional field for display.
--   - updated_at: set to now() via trigger on every UPDATE.
--
-- Rollback: DROP TRIGGER, DROP FUNCTION, DROP columns (in reverse order).
--
-- See: docs/architecture/CU-869d29f1h-studio-profile.md §2

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS address    text,
  ADD COLUMN IF NOT EXISTS phone      text,
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- CHECK constraint: phone, if provided, must start with '+' (E.164 basic check).
-- Full validation is performed by the NestJS service layer before any write.
ALTER TABLE public.studios
  ADD CONSTRAINT studios_phone_e164_format
    CHECK (phone IS NULL OR (phone LIKE '+%' AND length(phone) >= 8));

-- Trigger function to keep updated_at current on every row UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER studios_set_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
