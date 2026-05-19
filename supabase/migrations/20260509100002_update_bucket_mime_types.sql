/*
  # Update saved-images bucket to allow PDFs and generic files

  The original bucket only allowed image MIME types. The app and
  extension both support saving PDFs and generic files to the same
  bucket, so we need to expand the allowed types.
*/

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    -- Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/ico',
    'image/x-icon',
    -- PDFs
    'application/pdf',
    -- Common files
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    -- Audio / Video
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/mp3'
  ],
  -- Raise limit to 50 MB for files/PDFs
  file_size_limit = 52428800
WHERE id = 'saved-images';
