/*
  # Add Premium Status and Storage Tracking

  1. Changes
    - Add `is_premium` column to `users` table to track premium membership status
    - Add `storage_used` column to `users` table to track total storage usage in bytes
    - Add index on `is_premium` for efficient premium user queries
  
  2. Security
    - No RLS changes needed as users table inherits auth.users security
*/

-- Add premium status and storage tracking columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_premium'
  ) THEN
    ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'storage_used'
  ) THEN
    ALTER TABLE users ADD COLUMN storage_used BIGINT DEFAULT 0;
  END IF;
END $$;

-- Create index on is_premium for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium);

-- Create function to update user storage used
CREATE OR REPLACE FUNCTION update_user_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users
    SET storage_used = storage_used + COALESCE(NEW.file_size, 0)
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users
    SET storage_used = storage_used - COALESCE(OLD.file_size, 0)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update storage used on saved_items changes
DROP TRIGGER IF EXISTS trigger_update_user_storage ON saved_items;
CREATE TRIGGER trigger_update_user_storage
AFTER INSERT OR DELETE ON saved_items
FOR EACH ROW
EXECUTE FUNCTION update_user_storage();
