/*
  # Restore is_premium column

  Migration 20260203123454 dropped `is_premium` and replaced it with
  `subscription_tier`. However the entire application (frontend, webhook,
  auth trigger) still reads and writes `is_premium`.

  This migration adds the column back as a plain boolean and derives its
  initial value from the existing `subscription_tier` column so no data
  is lost. The webhook and trigger are updated in migration
  20260509100003 to keep both columns in sync going forward.
*/

-- Re-add is_premium if it was dropped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_premium'
  ) THEN
    ALTER TABLE users ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Backfill from subscription_tier for existing rows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    UPDATE users
    SET is_premium = (
      subscription_tier IN ('standard', 'premium', 'complimentary')
    )
    WHERE is_premium = false
      AND subscription_tier IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium);
