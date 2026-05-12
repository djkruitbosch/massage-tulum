-- Migration: 20260503000009_create_therapist_photos_bucket.sql
-- Purpose: Create the private Supabase Storage bucket for therapist photos
--          and the 4 RLS policies that gate access by studio ownership.
--
-- Bucket: therapist-photos (private)
--   - public: false — all reads require a signed URL or the user's JWT.
--   - file_size_limit: 5 MB (5,242,880 bytes) — defense-in-depth backstop;
--     NestJS MaxFileSizeValidator enforces this first.
--   - allowed_mime_types: jpeg, png, webp — defense-in-depth backstop;
--     NestJS FileTypeValidator (magic-byte check) enforces this first.
--
-- Storage path scheme: therapists/{therapist_id}/{uuid}.webp
--   - (storage.foldername(objects.name))[1] = 'therapists'
--   - (storage.foldername(objects.name))[2] = {therapist_id}
--
-- CRITICAL — column ambiguity footgun (Research §R1):
--   storage.foldername() must reference objects.name (explicitly qualified), not
--   bare 'name', to avoid a Postgres ambiguity error when the policy joins
--   public.therapists, which also has a 'name' column.
--   Source: Supabase Community Discussion #31073.
--
-- RLS note: storage.objects has RLS enabled by default in hosted Supabase.
--   No ALTER TABLE ... ENABLE ROW LEVEL SECURITY needed here.
--
-- DELETE policy exception to ADR-0013:
--   ADR-0013's "no DELETE policy" rule applies to studio-scoped *row* tables.
--   storage.objects is a Supabase system table where DELETE is required for
--   photo replacement cleanup and the "Remove photo" endpoint. The therapist
--   *row* itself remains soft-deleted only.
--
-- Rollback:
--   DELETE FROM storage.buckets WHERE id = 'therapist-photos';
--   (Note: emptying the bucket first is required if objects exist.)
--   DROP POLICY IF EXISTS "therapist_photos_owner_select" ON storage.objects;
--   DROP POLICY IF EXISTS "therapist_photos_owner_insert" ON storage.objects;
--   DROP POLICY IF EXISTS "therapist_photos_owner_update" ON storage.objects;
--   DROP POLICY IF EXISTS "therapist_photos_owner_delete" ON storage.objects;
--
-- See: docs/architecture/CU-869d29f1p-therapist-roster.md §12
--      docs/research/CU-869d29f1p-therapist-photo-upload.md §3 Q2

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'therapist-photos',
  'therapist-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- ─── SELECT: studio owner can read photos for their own therapists ─────────────
CREATE POLICY "therapist_photos_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'therapist-photos'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      JOIN public.studio_profiles sp ON sp.studio_id = t.studio_id
      WHERE t.id::text = (storage.foldername(objects.name))[2]
        AND sp.id = auth.uid()
    )
  );

-- ─── INSERT: studio owner can upload photos for their own therapists ───────────
CREATE POLICY "therapist_photos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'therapist-photos'
    AND (storage.foldername(objects.name))[1] = 'therapists'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      JOIN public.studio_profiles sp ON sp.studio_id = t.studio_id
      WHERE t.id::text = (storage.foldername(objects.name))[2]
        AND sp.id = auth.uid()
    )
  );

-- ─── UPDATE: allow upsert (overwrite) — required for photo replacement ─────────
CREATE POLICY "therapist_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'therapist-photos'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      JOIN public.studio_profiles sp ON sp.studio_id = t.studio_id
      WHERE t.id::text = (storage.foldername(objects.name))[2]
        AND sp.id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'therapist-photos'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      JOIN public.studio_profiles sp ON sp.studio_id = t.studio_id
      WHERE t.id::text = (storage.foldername(objects.name))[2]
        AND sp.id = auth.uid()
    )
  );

-- ─── DELETE: studio owner can delete photos for their own therapists ───────────
-- Required for photo-replacement cleanup and the "Remove photo" endpoint.
CREATE POLICY "therapist_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'therapist-photos'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      JOIN public.studio_profiles sp ON sp.studio_id = t.studio_id
      WHERE t.id::text = (storage.foldername(objects.name))[2]
        AND sp.id = auth.uid()
    )
  );
