/*
  # Create saved_items table

  This table stores files (images, PDFs, generic files) saved by the
  Chrome extension or web app to the Supabase Storage bucket.

  Columns match exactly what background.js inserts and what
  SavedGallery / BorrowView read back.
*/

CREATE TABLE IF NOT EXISTS saved_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  public_url    text        NOT NULL,
  original_src  text        NOT NULL DEFAULT '',
  title         text        NOT NULL DEFAULT '',
  alt           text                 DEFAULT '',
  page_title    text                 DEFAULT '',
  page_url      text                 DEFAULT '',
  mime_type     text                 DEFAULT '',
  file_size     bigint               DEFAULT 0,
  content_type  text        NOT NULL DEFAULT 'image',
  status        text        NOT NULL DEFAULT 'keep',
  category_id   uuid                 DEFAULT NULL,
  thumbnail_url text                 DEFAULT NULL,
  folder_id     uuid                 DEFAULT NULL,
  file_name     text GENERATED ALWAYS AS (
    CASE
      WHEN title <> '' THEN title
      ELSE regexp_replace(storage_path, '^.+/', '')
    END
  ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved items"
  ON saved_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create saved items"
  ON saved_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own saved items"
  ON saved_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own saved items"
  ON saved_items FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_user_id      ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_content_type ON saved_items(content_type);
CREATE INDEX IF NOT EXISTS idx_saved_items_status       ON saved_items(status);
CREATE INDEX IF NOT EXISTS idx_saved_items_created_at   ON saved_items(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_content ON saved_items(user_id, content_type);
