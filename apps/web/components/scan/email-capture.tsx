'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

interface EmailCaptureProps {
  scanId: string;
  className?: string;
}

export function EmailCapture({ scanId, className }: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = email.trim();
      if (!trimmed || !trimmed.includes('@')) {
        setError('Please enter a valid email');
        return;
      }

      setLoading(true);

      try {
        const supabase = createClient();
        const { error: authError } = await supabase.auth.signUp({
          email: trimmed,
          password: crypto.randomUUID(),
          options: {
            data: { scan_id: scanId },
            emailRedirectTo: `${window.location.origin}/scan/${scanId}`,
          },
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            setError('Already registered. Please log in to unlock the full scan.');
          } else {
            setError(authError.message);
          }
          setLoading(false);
          return;
        }

        // Upgrade the scan tier from peek to full
        await fetch(`/api/scans/${scanId}/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        setSuccess(true);
        analytics.emailCaptured(scanId);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [email, scanId],
  );

  if (dismissed || success) {
    if (success) {
      return (
        <div className={cn('bg-success/10 border border-success/20 rounded-xl p-6 text-center', className)}>
          <p className="text-sm font-heading font-700 text-success">Check your email!</p>
          <p className="text-xs text-muted mt-1">
            Confirm your email to unlock the full scan with all 40+ modules and AI insights.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={cn('bg-accent/5 border border-accent/20 rounded-xl p-6', className)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-heading text-sm font-700 text-primary">
            Unlock the Full Scan
          </h3>
          <p className="text-xs text-muted mt-1">
            Register free to run all 40+ modules, GhostScan, AI insights, and more.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted hover:text-primary transition-colors -mt-1 -mr-1 p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter your email"
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-highlight text-highlight-foreground px-4 py-2 text-sm font-heading font-700 transition-colors hover:bg-highlight/90 disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Unlock Free'}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}
    </div>
  );
}
