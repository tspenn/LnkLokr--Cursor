/*
  # Optimize RLS Policies and Fix Security Issues

  1. Performance Optimization
    - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row, improving query performance at scale
  
  2. Function Security
    - Fix search_path for `handle_new_user` function
    - Fix search_path for `update_user_storage` function
    - Set explicit search_path to prevent SQL injection vulnerabilities
  
  3. Tables Updated
    - users
    - folders
    - tags
    - links
    - saved_items
    - borrow_categories
  
  4. Security Notes
    - All policies maintain the same authorization logic
    - Only the performance characteristics are improved
    - Function search paths are now immutable and secure
*/

-- Drop and recreate users table policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Drop and recreate folders table policies
DROP POLICY IF EXISTS "Users can read own folders" ON folders;
DROP POLICY IF EXISTS "Users can create folders" ON folders;
DROP POLICY IF EXISTS "Users can update own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

CREATE POLICY "Users can read own folders"
  ON folders FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own folders"
  ON folders FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Drop and recreate tags table policies
DROP POLICY IF EXISTS "Users can read own tags" ON tags;
DROP POLICY IF EXISTS "Users can create tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can read own tags"
  ON tags FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Drop and recreate links table policies
DROP POLICY IF EXISTS "Users can read own links" ON links;
DROP POLICY IF EXISTS "Users can create links" ON links;
DROP POLICY IF EXISTS "Users can update own links" ON links;
DROP POLICY IF EXISTS "Users can delete own links" ON links;

CREATE POLICY "Users can read own links"
  ON links FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own links"
  ON links FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own links"
  ON links FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Drop and recreate saved_items table policies
DROP POLICY IF EXISTS "Users can read own saved items" ON saved_items;
DROP POLICY IF EXISTS "Users can create saved items" ON saved_items;
DROP POLICY IF EXISTS "Users can update own saved items" ON saved_items;
DROP POLICY IF EXISTS "Users can delete own saved items" ON saved_items;

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

-- Drop and recreate borrow_categories table policies
DROP POLICY IF EXISTS "Users can view own categories" ON borrow_categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON borrow_categories;
DROP POLICY IF EXISTS "Users can update own categories" ON borrow_categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON borrow_categories;

CREATE POLICY "Users can view own categories"
  ON borrow_categories FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own categories"
  ON borrow_categories FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own categories"
  ON borrow_categories FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own categories"
  ON borrow_categories FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix handle_new_user function with secure search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, is_premium, premium_until)
  VALUES (
    new.id,
    new.email,
    false,
    NULL
  );
  RETURN new;
END;
$$;

-- Fix update_user_storage function with secure search_path
CREATE OR REPLACE FUNCTION update_user_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET storage_used = (
    SELECT COALESCE(SUM(file_size), 0)
    FROM public.saved_items
    WHERE user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;