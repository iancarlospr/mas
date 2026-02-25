'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Pending Verification Card
 * ═══════════════════════════════════════════════
 *
 * WHAT: Inline card shown on landing page when user registered but hasn't
 *       verified email yet.
 * WHY:  Reminds returning users to check their email. Retro styling matches
 *       the GhostScan OS "incoming mail" metaphor (Plan Section 17).
 * HOW:  Bevel-raised card with mail icon, Chloé, resend button, dismiss option.
 */

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
      // Silently fail
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bevel-raised bg-gs-light p-gs-6 text-center">
        <ChloeSprite state="idle" size={32} glowing className="mx-auto mb-gs-4" />

        <div className="bevel-sunken bg-gs-near-white w-[56px] h-[56px] mx-auto flex items-center justify-center mb-gs-4">
          <span className="text-[28px]">📧</span>
        </div>

        <h2 className="font-system text-os-lg font-bold text-gs-black mb-gs-2">
          Check your email
        </h2>
        <p className="font-data text-data-sm text-gs-mid mb-gs-1">
          Verification link sent to <strong className="text-gs-black">{email}</strong>.
        </p>
        <p className="font-data text-data-sm text-gs-mid mb-gs-4">
          Your scan of <strong className="text-gs-fuchsia">{pendingDomain}</strong> will
          start automatically once verified.
        </p>

        <div className="flex flex-col gap-gs-2">
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="bevel-button text-os-sm w-full disabled:opacity-50"
          >
            {resent ? 'Email resent' : resending ? 'Resending...' : 'Resend verification email'}
          </button>
          <button
            onClick={onDismiss}
            className="font-data text-data-xs text-gs-mid hover:text-gs-fuchsia transition-colors"
          >
            Start a new scan instead
          </button>
        </div>
      </div>
    </div>
  );
}
