-- Migration: 20260503000007_create_upsert_studio_hours_fn.sql
-- Purpose: Atomic DELETE+INSERT function for studio business hours.
--
-- SECURITY INVOKER: RLS is enforced using the calling user's identity.
--   The NestJS service calls this via the anon client with user JWT context,
--   so RLS policies on studio_hours apply (owner can only upsert their own).
--
-- Input format (hours jsonb array, one element per weekday):
--   [
--     { "weekday": 1, "is_open": true,  "open_time": "09:00", "close_time": "21:00" },
--     { "weekday": 2, "is_open": false, "open_time": null,     "close_time": null    },
--     ...
--   ]
--
-- The function deletes all existing rows for the studio then inserts all 7.
-- Atomicity is guaranteed by the transaction wrapping the function call.
--
-- Returns: void
--
-- Rollback: DROP FUNCTION public.upsert_studio_hours(uuid, jsonb);
--
-- See: docs/architecture/CU-869d29f1h-studio-profile.md §4

CREATE OR REPLACE FUNCTION public.upsert_studio_hours(
  p_studio_id uuid,
  p_hours     jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = public
AS $$
BEGIN
  -- Delete all existing rows for this studio (RLS enforces ownership).
  DELETE FROM public.studio_hours
  WHERE studio_id = p_studio_id;

  -- Insert all 7 weekday rows from the JSON payload.
  INSERT INTO public.studio_hours (studio_id, weekday, is_open, open_time, close_time)
  SELECT
    p_studio_id,
    (entry->>'weekday')::smallint,
    (entry->>'is_open')::boolean,
    CASE
      WHEN (entry->>'open_time') IS NOT NULL
      THEN (entry->>'open_time')::time
      ELSE NULL
    END,
    CASE
      WHEN (entry->>'close_time') IS NOT NULL
      THEN (entry->>'close_time')::time
      ELSE NULL
    END
  FROM jsonb_array_elements(p_hours) AS entry;
END;
$$;

-- Grant EXECUTE to authenticated role so RLS-scoped users can call it.
GRANT EXECUTE ON FUNCTION public.upsert_studio_hours(uuid, jsonb) TO authenticated;
