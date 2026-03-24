'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeUrl } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { ScanInput } from '@/components/scan/scan-input';
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
}

export function MobileScanFlow({ myScansRef }: MobileScanFlowProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const orchestrator = useScanOrchestrator();
  const router = useRouter();
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

        // After 2.5s: pause the visual and redirect to register
        setTimeout(() => {
          orchestrator.pauseVisualSequence();
          // Small delay so the pause is visible before navigation
          setTimeout(() => {
            orchestrator.cancelVisualSequence();
            router.push('/register?redirect=/');
          }, 300);
        }, 2500);
      }
    },
    [isAuthenticated, orchestrator, router, myScansRef],
  );

  return (
    <>
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
