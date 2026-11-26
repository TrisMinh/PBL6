ALTER TABLE payments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
