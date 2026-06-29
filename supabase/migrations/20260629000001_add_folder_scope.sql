-- Add scope column to folders to support per-bucket folder organisation.
-- All existing folders (which belong to Keep) default to 'keep'.
ALTER TABLE folders ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'keep';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'folders_scope_check' AND conrelid = 'folders'::regclass
  ) THEN
    ALTER TABLE folders ADD CONSTRAINT folders_scope_check
      CHECK (scope IN ('keep', 'borrow', 'share', 'bury'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_folders_user_scope ON folders(user_id, scope);
