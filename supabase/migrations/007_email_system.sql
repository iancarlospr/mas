-- Migration: 007_email_system
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

CREATE POLICY "Users see own email log" ON public.email_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own preferences" ON public.email_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 5. Retention cleanup (requires pg_cron extension enabled in Supabase)
-- Run daily at 3:00 AM UTC to delete email_log entries older than 90 days
-- Enable in Supabase: Database > Extensions > pg_cron
SELECT cron.schedule(
  'cleanup-email-log',
  '0 3 * * *',
  $$DELETE FROM public.email_log WHERE created_at < now() - interval '90 days'$$
);
