-- Rollback: drop module_results table
DROP POLICY IF EXISTS "Users see own module results" ON module_results;
DROP INDEX IF EXISTS idx_module_results_scan;
DROP TABLE IF EXISTS module_results;
