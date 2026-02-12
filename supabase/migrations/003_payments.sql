-- Payments table
CREATE TABLE IF NOT EXISTS payments (
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

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own payments' AND tablename = 'payments'
  ) THEN
    CREATE POLICY "Users see own payments" ON payments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
