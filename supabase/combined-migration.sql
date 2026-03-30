-- =============================================================================
-- MarketingAlphaScan: Combined Migration (001 through 007)
-- =============================================================================
-- This file combines all 7 individual migration files into a single idempotent
-- SQL script. It can be run against a fresh database or re-run safely against
-- an existing one. All CREATE TABLE/INDEX statements use IF NOT EXISTS, all
-- CREATE POLICY statements are wrapped in existence checks, and the trigger
-- in 006 is guarded with DROP TRIGGER IF EXISTS.
-- =============================================================================


-- =============================================================================
-- Migration 001: Scans
-- =============================================================================

-- Scans table: core scan tracking
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('peek', 'full', 'paid')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'passive', 'browser', 'ghostscan', 'external', 'synthesis', 'complete', 'failed', 'cancelled')),
  marketing_iq INTEGER,
  marketing_iq_result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  country_code TEXT,
  cache_source UUID REFERENCES scans(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(domain);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_cache ON scans(domain, tier, status, created_at DESC);

-- RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Users see own scans" ON scans
      FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can insert scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Anon can insert scans" ON scans
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;


-- =============================================================================
-- Migration 002: Module Results
-- =============================================================================

-- Module results: per-module scan output
CREATE TABLE IF NOT EXISTS module_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'partial', 'error', 'skipped')),
  data JSONB DEFAULT '{}',
  signals JSONB DEFAULT '[]',
  checkpoints JSONB DEFAULT '[]',
  score INTEGER,
  ai_synthesis JSONB,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scan_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_results_scan ON module_results(scan_id);

-- RLS
ALTER TABLE module_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own module results' AND tablename = 'module_results'
  ) THEN
    CREATE POLICY "Users see own module results" ON module_results
      FOR SELECT USING (
        scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid() OR user_id IS NULL)
      );
  END IF;
END $$;


-- =============================================================================
-- Migration 003: Payments
-- =============================================================================

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


-- =============================================================================
-- Migration 004: Chat
-- =============================================================================

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_scan ON chat_messages(scan_id);

-- Chat credits
CREATE TABLE IF NOT EXISTS chat_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own chat' AND tablename = 'chat_messages'
  ) THEN
    CREATE POLICY "Users see own chat" ON chat_messages
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own chat' AND tablename = 'chat_messages'
  ) THEN
    CREATE POLICY "Users insert own chat" ON chat_messages
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own credits' AND tablename = 'chat_credits'
  ) THEN
    CREATE POLICY "Users see own credits" ON chat_credits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================================================
-- Migration 005: Audit Log
-- =============================================================================

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);


-- =============================================================================
-- Migration 006: Add updated_at
-- =============================================================================

-- Add updated_at column and auto-update trigger

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at to scans
ALTER TABLE scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS scans_updated_at ON scans;
CREATE TRIGGER scans_updated_at
  BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add service role UPDATE policy for engine writes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can update scans' AND tablename = 'scans'
  ) THEN
    CREATE POLICY "Service role can update scans" ON scans
      FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
END $$;


-- =============================================================================
-- Migration 007: Email System
-- =============================================================================

-- Description: Email log, suppression list, and preferences for the email system (PRD-cont-5)

-- 1. Email log (for dedup, analytics, and audit trail)
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  reference_id TEXT,
  resend_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_dedup ON public.email_log(user_id, template_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON public.email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_log_resend_id ON public.email_log(resend_id);

-- 2. Email suppression list
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Email preferences (per user)
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_in BOOLEAN DEFAULT false,
  scan_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Row Level Security
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
-- email_suppression_list: NO RLS (service_role access only)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users see own email log' AND tablename = 'email_log'
  ) THEN
    CREATE POLICY "Users see own email log" ON public.email_log
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own preferences' AND tablename = 'email_preferences'
  ) THEN
    CREATE POLICY "Users manage own preferences" ON public.email_preferences
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Retention cleanup — requires pg_cron extension (enable later via Database > Extensions)
-- Once pg_cron is enabled, run:
-- SELECT cron.schedule('cleanup-email-log', '0 3 * * *',
--   $$DELETE FROM public.email_log WHERE created_at < now() - interval '90 days'$$);
