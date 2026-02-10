-- Rollback: remove updated_at trigger and column
DROP TRIGGER IF EXISTS scans_updated_at ON scans;
DROP FUNCTION IF EXISTS update_updated_at();
DROP POLICY IF EXISTS "Service role can update scans" ON scans;
ALTER TABLE scans DROP COLUMN IF EXISTS updated_at;
