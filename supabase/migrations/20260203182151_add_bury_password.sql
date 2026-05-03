/*
  # Add Bury Password Feature

  1. Changes
    - Add `bury_password` column to `users` table to store encrypted password for accessing buried items
    - Password will be optional - if null, no password protection is active
    
  2. Security
    - Password stored as plain text for now (will be hashed in production)
    - Users can set/change password in settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'bury_password'
  ) THEN
    ALTER TABLE users ADD COLUMN bury_password text;
  END IF;
END $$;