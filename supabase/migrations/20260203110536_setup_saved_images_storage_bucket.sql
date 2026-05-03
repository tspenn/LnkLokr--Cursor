-- Setup Supabase Storage bucket for saved images
--
-- 1. Create Storage Bucket
--   - Create 'saved-images' bucket if it doesn't exist
--   - Make bucket public for reading (users can view images)
--   - Set file size limits and allowed MIME types
--
-- 2. Storage Policies
--   - Users can upload files to their own folder (user_id/*)
--   - Users can delete files from their own folder
--   - Public can view all files (for public URLs)
--
-- 3. Notes
--   - Files are organized by user_id: {user_id}/{timestamp}-{filename}
--   - Public URLs allow sharing without authentication
--   - File uploads are restricted by authenticated user policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saved-images',
  'saved-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload to own folder'
  ) THEN
    CREATE POLICY "Users can upload to own folder"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'saved-images' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own files'
  ) THEN
    CREATE POLICY "Users can update own files"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'saved-images' AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'saved-images' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own files'
  ) THEN
    CREATE POLICY "Users can delete own files"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'saved-images' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public can view all files'
  ) THEN
    CREATE POLICY "Public can view all files"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'saved-images');
  END IF;
END $$;
