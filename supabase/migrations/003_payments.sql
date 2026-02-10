-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  scan_id UUID REFERENCES scans(id),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  product TEXT NOT NULL CHECK (product IN ('alpha_brief', 'chat_credits')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments(user_id);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);
