'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PendingVerificationCardProps {
  email: string;
  scanUrl: string;
  onDismiss: () => void;
}

export function PendingVerificationCard({ email, scanUrl, onDismiss }: PendingVerificationCardProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const pendingDomain = (() => {
    try { return new URL(scanUrl).hostname.replace(/^www\./, ''); } catch { return scanUrl; }
  })();

  const handleResend = async () => {
    setResending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: 'signup', email });
      setResent(true);
    } catch {
      // Silently fail — user can try again
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-surface border border-border rounded-2xl p-8 text-center shadow-lg">
        <div className="mx-auto w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h2 className="font-heading text-h4 text-primary mb-2">Check your email</h2>
        <p className="text-sm text-muted mb-1">
          We sent a verification link to <strong className="text-primary">{email}</strong>.
        </p>
        <p className="text-sm text-muted mb-5">
          Your scan of <strong className="text-primary">{pendingDomain}</strong> will start automatically once verified.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-background transition-colors disabled:opacity-50"
          >
            {resent ? 'Email resent' : resending ? 'Resending...' : 'Resend verification email'}
          </button>
          <button
            onClick={onDismiss}
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            Start a new scan instead
          </button>
        </div>
      </div>
    </div>
  );
}
