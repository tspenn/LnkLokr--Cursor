/*
  # Add Content Type Categorization

  1. Changes
    - Add `content_type` column to `links` table to distinguish URL types
    - Add `content_type` column to `saved_items` table for better filtering
    - Create index for efficient filtering by content type
  
  2. Content Types
    - 'url' - Regular web links
    - 'image' - Image files
    - 'pdf' - PDF documents  
    - 'file' - Other file downloads
  
  3. Notes
    - Existing records will default to 'url' for links and 'image' for saved_items
    - The content_type makes filtering easier than using mime_type
*/

-- Add content_type column to links table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'links' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE links ADD COLUMN content_type text DEFAULT 'url';
  END IF;
END $$;

-- Add content_type column to saved_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_items' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE saved_items ADD COLUMN content_type text DEFAULT 'image';
  END IF;
END $$;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_links_content_type ON links(content_type);
CREATE INDEX IF NOT EXISTS idx_saved_items_content_type ON saved_items(content_type);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_content ON saved_items(user_id, content_type);