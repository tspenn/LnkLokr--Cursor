/*
  # Add Borrow Categories System

  1. New Tables
    - `borrow_categories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Category name like "Weekend Reading", "Recipes", etc.
      - `position` (integer) - Display order
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Changes to Existing Tables
    - Add `category_id` column to `links` table (nullable, for temporary categorization)
    - Add `category_id` column to `saved_items` table (nullable, for temporary categorization)
    - Add `status` column to `links` table ('borrow', 'keep', 'share', 'bury')
    - Add `status` column to `saved_items` table ('borrow', 'keep', 'share', 'bury')
  
  3. Security
    - Enable RLS on `borrow_categories` table
    - Users can only view and manage their own categories
  
  4. Notes
    - Categories are optional groupings within Borrow
    - Items can exist in Borrow without a category
    - Status defaults to 'keep' for backward compatibility
*/

-- Create borrow_categories table
CREATE TABLE IF NOT EXISTS borrow_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add category_id to links table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'links' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE links ADD COLUMN category_id uuid REFERENCES borrow_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add category_id to saved_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_items' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE saved_items ADD COLUMN category_id uuid REFERENCES borrow_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add status to links table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'links' AND column_name = 'status'
  ) THEN
    ALTER TABLE links ADD COLUMN status text DEFAULT 'keep';
  END IF;
END $$;

-- Add status to saved_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE saved_items ADD COLUMN status text DEFAULT 'keep';
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_borrow_categories_user ON borrow_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
CREATE INDEX IF NOT EXISTS idx_saved_items_category ON saved_items(category_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_status ON saved_items(status);

-- Enable RLS on borrow_categories
ALTER TABLE borrow_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for borrow_categories
CREATE POLICY "Users can view own categories"
  ON borrow_categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON borrow_categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON borrow_categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON borrow_categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);