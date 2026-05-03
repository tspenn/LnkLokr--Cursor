/*
  # Add Subscription Tier System
  
  This migration implements a three-tier subscription model:
  
  1. Subscription Tiers
    - FREE: Local device storage only, no cloud saves
    - STANDARD: Cloud database access, can save links/images
    - PREMIUM: Full cloud storage with extended features
    - COMPLIMENTARY: Free premium access (for family/testers)
  
  2. Schema Changes
    - Add `subscription_tier` enum type
    - Add `subscription_tier` column to users table (default: 'free')
    - Remove `is_premium` column (replaced by tier system)
    - Keep `premium_until` for expiration tracking
  
  3. Access Rules
    - FREE tier: Cannot INSERT into database (local only)
    - STANDARD tier: Can INSERT links, folders, tags, saved_items
    - PREMIUM tier: Can INSERT everything + extended storage limits
    - COMPLIMENTARY tier: Same access as PREMIUM
  
  4. Updated Helper Function
    - Update `is_user_premium()` to check tier (standard, premium, or complimentary)
  
  5. Security
    - All policies enforce tier-based access
    - Manual grants via 'complimentary' tier for family/testers
*/

-- Create subscription tier enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'standard', 'premium', 'complimentary');
  END IF;
END $$;

-- Add subscription_tier column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_tier subscription_tier DEFAULT 'free';
  END IF;
END $$;

-- Migrate existing users based on is_premium flag
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_premium'
  ) THEN
    UPDATE users 
    SET subscription_tier = CASE 
      WHEN is_premium = true THEN 'premium'::subscription_tier
      ELSE 'free'::subscription_tier
    END
    WHERE subscription_tier = 'free'::subscription_tier;
    
    -- Drop the old is_premium column
    ALTER TABLE users DROP COLUMN IF EXISTS is_premium;
  END IF;
END $$;

-- Create index for efficient tier queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Update helper function to check subscription tier
CREATE OR REPLACE FUNCTION is_user_premium(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT subscription_tier IN ('standard', 'premium', 'complimentary')
     FROM public.users 
     WHERE id = user_id),
    false
  );
$$;

-- Create helper function to check specific tier
CREATE OR REPLACE FUNCTION get_user_tier(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT subscription_tier::text FROM public.users WHERE id = user_id),
    'free'
  );
$$;

-- ============================================================================
-- Update all INSERT policies to use tier-based access
-- ============================================================================

-- LINKS TABLE
DROP POLICY IF EXISTS "Premium users can create links" ON links;

CREATE POLICY "Paid tier users can create links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- SAVED_ITEMS TABLE
DROP POLICY IF EXISTS "Premium users can create saved items" ON saved_items;

CREATE POLICY "Paid tier users can create saved items"
  ON saved_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- FOLDERS TABLE
DROP POLICY IF EXISTS "Premium users can create folders" ON folders;

CREATE POLICY "Paid tier users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- TAGS TABLE
DROP POLICY IF EXISTS "Premium users can create tags" ON tags;

CREATE POLICY "Paid tier users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- BORROW_CATEGORIES TABLE
DROP POLICY IF EXISTS "Premium users can insert own categories" ON borrow_categories;

CREATE POLICY "Paid tier users can insert own categories"
  ON borrow_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    is_user_premium((select auth.uid()))
  );

-- STORAGE BUCKET
DROP POLICY IF EXISTS "Premium users can upload to own folder" ON storage.objects;

CREATE POLICY "Paid tier users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'saved-images' AND
    (storage.foldername(name))[1] = (select auth.uid())::text AND
    is_user_premium((select auth.uid()))
  );
