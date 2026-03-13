-- Rollback: drop chat tables
DROP POLICY IF EXISTS "Users see own credits" ON chat_credits;
DROP POLICY IF EXISTS "Users insert own chat" ON chat_messages;
DROP POLICY IF EXISTS "Users see own chat" ON chat_messages;
DROP INDEX IF EXISTS idx_chat_messages_scan;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_credits;
