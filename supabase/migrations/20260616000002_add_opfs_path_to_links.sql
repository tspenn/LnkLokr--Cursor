/*
  # Add opfs_path to links table

  Adds an optional opfs_path column to the links table to track when a link's
  binary payload (image, PDF, file) is stored in the browser's Origin Private
  File System (OPFS) on the user's device rather than in Supabase Storage.

  Free tier flow:
    - File saved to OPFS on device           → opfs_path = 'timestamp-uuid.ext'
    - Small thumbnail stored in Supabase      → thumbnail_url = 'data:image/jpeg;base64,...'
    - On original device: full file available from OPFS
    - On other devices:   thumbnail visible, full file not available

  Paid tier flow:
    - File uploaded to Supabase Storage       → opfs_path = NULL
    - public_url stored in saved_items table  → existing SavedItem flow unchanged
*/

ALTER TABLE links ADD COLUMN IF NOT EXISTS opfs_path TEXT DEFAULT NULL;
