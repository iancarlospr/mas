-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_scan ON chat_messages(scan_id);

-- Chat credits
CREATE TABLE chat_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own chat" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own chat" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own credits" ON chat_credits
  FOR SELECT USING (auth.uid() = user_id);
