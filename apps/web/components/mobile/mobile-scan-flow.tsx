'use client';

import { useState, useCallback, useEffect } from 'react';
import { normalizeUrl } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { ScanInput } from '@/components/scan/scan-input';
import { createClient } from '@/lib/supabase/client';
import { analytics } from '@/lib/analytics';

/**
 * Mobile Scan Flow — Auth-aware wrapper around ScanInput
 *
 * Authenticated: POST /api/scans → orchestrator.startScan (overlay plays, completes to landing)
 * Unauthenticated: visual tease 2-3s → save URL to localStorage → redirect to /register
 *
 * No useWindowManager() — all mobile.
 */

interface MobileScanFlowProps {
  /** Ref to scroll to after scan completes (My Scans section) */
  myScansRef?: React.RefObject<HTMLDivElement | null>;
  /** Open the mobile auth overlay instead of navigating to /register */
  onRequestAuth?: (mode: 'login' | 'register') => void;
}

function CreditIndicator() {
  const { user, isAuthenticated } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    async function load() {
      const supabase = createClient();
      const [creditsRes, scansRes] = await Promise.all([
        supabase.from('scan_credits').select('remaining').eq('user_id', user!.id).maybeSingle(),
        supabase.from('scans').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      setRemaining(creditsRes.data?.remaining ?? 0);
      setScanCount(scansRes.count ?? 0);
    }

    load();
  }, [isAuthenticated, user]);

  if (!isAuthenticated || remaining == null || scanCount == null) return null;
  if (remaining === 1 && scanCount === 0) return null;

  const hasCredits = remaining > 0;

  const content = hasCredits ? (
    <span><span style={{ color: 'var(--gs-base)', fontWeight: 600 }}>{remaining}</span> scan{remaining !== 1 ? 's' : ''} remaining</span>
  ) : (
    <span>0 scans remaining — <span style={{ color: 'var(--gs-base)', fontWeight: 600 }}>Upgrade</span></span>
  );

  const pillClass = "font-data inline-flex items-center rounded-full";
  const pillStyle: React.CSSProperties = {
    fontSize: '11px',
    padding: '3px 10px',
    background: 'rgba(255,178,239,0.08)',
    border: '1px solid rgba(255,178,239,0.15)',
    color: 'var(--gs-mid)',
  };

  return (
    <div className="flex justify-center select-none" style={{ marginBottom: '6px' }}>
      {hasCredits ? (
        <div className={pillClass} style={pillStyle}>{content}</div>
      ) : (
        <a
          href="/pricing"
          className={`${pillClass} transition-opacity hover:opacity-80`}
          style={{ ...pillStyle, cursor: 'pointer' }}
        >
          {content}
        </a>
      )}
    </div>
  );
}

export function MobileScanFlow({ myScansRef, onRequestAuth }: MobileScanFlowProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const orchestrator = useScanOrchestrator();
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(
    async (url: string, turnstileToken: string) => {
      setError(null);

      if (isAuthenticated) {
        // ── Authenticated: fire the scan ──
        try {
          const res = await fetch('/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, turnstileToken }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? 'Failed to start scan');
            return;
          }

          const { scanId, cached } = await res.json();
          const domain = new URL(url).hostname;
          analytics.scanStarted(domain, 'full');

          // Set mobile handler: on complete, scroll to My Scans instead of opening desktop window
          orchestrator.setMobileCompleteHandler(() => {
            setTimeout(() => {
              myScansRef?.current?.scrollIntoView({ behavior: 'smooth' });
            }, 300);
          });

          orchestrator.startScan(scanId, domain, cached);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Network error. Try again.');
        }
      } else {
        // ── Unauthenticated: visual tease → register ──
        const domain = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');

        // Save URL for auto-scan after registration
        try {
          localStorage.setItem(
            'alphascan_pending_url',
            JSON.stringify({ url, timestamp: Date.now() }),
          );
        } catch { /* storage full */ }

        // Start visual-only Hollywood Hack sequence
        orchestrator.startVisualSequence(domain, url, turnstileToken);
        analytics.signupWallShown(domain);

        // After 2.5s: pause the visual and show mobile auth overlay
        setTimeout(() => {
          orchestrator.pauseVisualSequence();
          // Small delay so the pause is visible before overlay opens
          setTimeout(() => {
            orchestrator.cancelVisualSequence();
            onRequestAuth?.('register');
          }, 300);
        }, 2500);
      }
    },
    [isAuthenticated, orchestrator, onRequestAuth, myScansRef],
  );

  return (
    <>
      <CreditIndicator />
      <ScanInput
        variant="dialog"
        onCapture={!authLoading ? handleCapture : undefined}
      />
      {error && (
        <div className="px-gs-4 mt-gs-2">
          <p className="font-data text-data-sm text-gs-critical text-center">{error}</p>
        </div>
      )}
    </>
  );
}
