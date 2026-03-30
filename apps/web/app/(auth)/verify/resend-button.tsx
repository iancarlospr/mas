'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * GhostScan OS — Resend Verification Button
 * ═══════════════════════════════════════════════
 *
 * WHAT: Button to resend the email verification link.
 * WHY:  Users miss emails. This gives them a retry path without
 *       leaving the retro verification dialog (Plan Section 15).
 * HOW:  Bevel button with status states, retro styling.
 */

export function ResendVerificationButton({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'already_verified'>('idle');

  const handleResend = async () => {
    setStatus('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    if (error) {
      if (error.message?.toLowerCase().includes('already confirmed') ||
          error.message?.toLowerCase().includes('already registered')) {
        setStatus('already_verified');
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
      return;
    }

    setStatus('sent');
  };

  if (status === 'already_verified') {
    return (
      <div className="flex flex-col items-center gap-gs-2">
        <p className="font-data text-data-xs text-gs-terminal">
          Your email is already verified.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="bevel-button-primary text-os-sm"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleResend}
      disabled={status !== 'idle'}
      className="font-data text-data-xs text-gs-red hover:text-gs-red disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'sent'
        ? 'Verification email resent'
        : status === 'sending'
          ? 'Resending...'
          : status === 'error'
            ? 'Failed to resend — try again'
            : 'Resend verification email'}
    </button>
  );
}
