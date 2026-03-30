-- Rollback: drop audit_log table
DROP INDEX IF EXISTS idx_audit_log_user;
DROP INDEX IF EXISTS idx_audit_log_action;
DROP INDEX IF EXISTS idx_audit_log_created;
DROP TABLE IF EXISTS audit_log;
