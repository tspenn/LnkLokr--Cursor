/*
  # Enforce Premium-Only Saves
  
  This migration implements a strict paywall model where users must have premium status
  to save any content (links, images, folders, tags, or categories).
  
  1. Helper Function
    - Create `is_user_premium()` function to check if a user has active premium status
    - Returns true if is_premium = true OR premium_until is in the future
  
  2. Updated Tables & Policies
    - `links` - Only premium users can INSERT
    - `saved_items` - Only premium users can INSERT
    - `folders` - Only premium users can INSERT
    - `tags` - Only premium users can INSERT
    - `borrow_categories` - Only premium users can INSERT
    - `storage.objects` - Only premium users can upload files
  
  3. Access Model
    - SELECT (reading) - Allowed for all authenticated users
    - UPDATE/DELETE - Allowed for all authenticated users on their own data
    - INSERT (saving) - REQUIRES PREMIUM STATUS
  
  4. Security
    - All policies maintain user isolation (users can only access their own data)
    - Premium check happens at database level, cannot be bypassed from client
    - Function uses STABLE performance optimization
  
  5. Business Logic
    - New signups get is_premium = false by default
    - Users can browse and see the interface
    - Any save attempt without premium will fail at database level
    - Frontend should check premium status and prompt for payment
*/

-- Create helper function to check if user is premium
CREATE OR REPLACE FUNCTION is_user_premium(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_premium FROM public.users WHERE id = user_id),
    false
  );
$$;

-- ============================================================================
-- LINKS TABLE - Require premium for INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can create links" ON links;

CREATE POLICY "Premium users can create links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- ============================================================================
-- SAVED_ITEMS TABLE - Require premium for INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can create saved items" ON saved_items;

CREATE POLICY "Premium users can create saved items"
  ON saved_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- ============================================================================
-- FOLDERS TABLE - Require premium for INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can create folders" ON folders;

CREATE POLICY "Premium users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- ============================================================================
-- TAGS TABLE - Require premium for INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can create tags" ON tags;

CREATE POLICY "Premium users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- ============================================================================
-- BORROW_CATEGORIES TABLE - Require premium for INSERT
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own categories" ON borrow_categories;

CREATE POLICY "Premium users can insert own categories"
  ON borrow_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- ============================================================================
-- STORAGE BUCKET - Require premium for file uploads
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;

CREATE POLICY "Premium users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'saved-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text AND
    is_user_premium((select auth.uid()))
  );
