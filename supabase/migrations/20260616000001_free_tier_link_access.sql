/*
  # Free Tier Link Access

  Revises the premium-only INSERT gate so that:

  - All authenticated users can save link metadata (links, folders, tags,
    borrow_categories) — this is text/URL data with negligible storage cost.
  - Binary file uploads (saved_items, storage.objects) remain premium-only —
    these drive actual storage costs and are the paid-tier differentiator.

  Free users get:
    - Persistent cloud storage of their link collection (multi-device read)
    - No binary file uploads
    - No data loss if browser storage is cleared

  Paid users get everything above plus binary file uploads and higher quotas.
*/

-- ============================================================================
-- LINKS TABLE — open INSERT to all authenticated users
-- ============================================================================

DROP POLICY IF EXISTS "Premium users can create links" ON links;

CREATE POLICY "Authenticated users can create links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- ============================================================================
-- FOLDERS TABLE — open INSERT to all authenticated users
-- ============================================================================

DROP POLICY IF EXISTS "Premium users can create folders" ON folders;

CREATE POLICY "Authenticated users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- ============================================================================
-- TAGS TABLE — open INSERT to all authenticated users
-- ============================================================================

DROP POLICY IF EXISTS "Premium users can create tags" ON tags;

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- ============================================================================
-- BORROW_CATEGORIES TABLE — open INSERT to all authenticated users
-- ============================================================================

DROP POLICY IF EXISTS "Premium users can insert own categories" ON borrow_categories;

CREATE POLICY "Authenticated users can insert own categories"
  ON borrow_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- ============================================================================
-- SAVED_ITEMS TABLE — remains premium-only (binary file metadata)
-- ============================================================================

-- Policy from enforce_premium_only_saves.sql already covers this.
-- No change needed — "Premium users can create saved items" stays in place.

-- ============================================================================
-- STORAGE BUCKET — remains premium-only (actual binary file uploads)
-- ============================================================================

-- Policy from enforce_premium_only_saves.sql already covers this.
-- No change needed — "Premium users can upload to own folder" stays in place.
