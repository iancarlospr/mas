-- Rollback: drop payments table
DROP POLICY IF EXISTS "Users see own payments" ON payments;
DROP INDEX IF EXISTS idx_payments_user;
DROP TABLE IF EXISTS payments;
