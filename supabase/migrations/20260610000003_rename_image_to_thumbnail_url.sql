/*
  Rename links.image → links.thumbnail_url to match the TypeScript Link type
  used throughout the app and the /api/scrape response shape.

  Also adds links.notes and the status index that were missing from initial schema.

  Applied live to project psbdjnqcjpxapypcfigx on 2026-06-10.
*/

ALTER TABLE links RENAME COLUMN image TO thumbnail_url;

ALTER TABLE links ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_links_status ON links(user_id, status);
