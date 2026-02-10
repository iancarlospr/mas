-- Rollback: drop scans table and related objects
DROP POLICY IF EXISTS "Users see own scans" ON scans;
DROP POLICY IF EXISTS "Anon can insert scans" ON scans;
DROP POLICY IF EXISTS "Service role can update scans" ON scans;
DROP INDEX IF EXISTS idx_scans_user;
DROP INDEX IF EXISTS idx_scans_domain;
DROP INDEX IF EXISTS idx_scans_status;
DROP INDEX IF EXISTS idx_scans_cache;
DROP TABLE IF EXISTS scans;
