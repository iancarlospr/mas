'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ScanInput } from '@/components/scan/scan-input';
import { FakeScanProgress } from '@/components/scan/fake-scan-progress';
import { SignupWall } from '@/components/scan/signup-wall';
import { PendingVerificationCard } from '@/components/scan/pending-verification-card';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { useWindowManager } from '@/lib/window-manager';
import { analytics } from '@/lib/analytics';

type FlowState = 'idle' | 'fakeLoading' | 'gated';

interface PendingVerification {
  email: string;
  scanUrl: string;
  timestamp: number;
}

/** Read the pending-verification flag from localStorage (24h TTL). */
function getPendingVerification(): PendingVerification | null {
  try {
    const raw = localStorage.getItem('alphascan_pending_verification');
    if (!raw) return null;
    const data: PendingVerification = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('alphascan_pending_verification');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function HeroScanFlow() {
  const [state, setState] = useState<FlowState>('idle');
  const [capturedUrl, setCapturedUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const orchestrator = useScanOrchestrator();
  const wm = useWindowManager();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
      if (user) {
        // Authenticated — clear any pending verification flag
        try { localStorage.removeItem('alphascan_pending_verification'); } catch { /* */ }
      } else {
        setPendingVerification(getPendingVerification());
      }
    });
  }, []);

  const handleCapture = useCallback(
    async (url: string, turnstileToken: string) => {
      if (isAuthenticated) {
        // Authenticated user — start real scan immediately
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, turnstileToken }),
        });

        if (!res.ok) {
          let errorMsg = 'Failed to start scan';
          try {
            const data = await res.json();
            errorMsg = data.error ?? errorMsg;
          } catch { /* non-JSON response (e.g. Next.js error page) */ }
          throw new Error(errorMsg);
        }

        const { scanId, cached } = await res.json();
        const domain = new URL(url).hostname;
        analytics.scanStarted(domain, 'full');
        wm.closeWindow('scan-input');
        orchestrator.startScan(scanId, domain, cached);
      } else {
        // Anonymous user — fake loading → signup wall
        setCapturedUrl(url);
        setState('fakeLoading');
        analytics.signupWallShown(new URL(url).hostname);
      }
    },
    [isAuthenticated, orchestrator, wm],
  );

  const domain = capturedUrl ? new URL(capturedUrl).hostname.replace(/^www\./, '') : '';

  // Show "check your email" card if user signed up but hasn't verified yet
  if (pendingVerification && isAuthenticated === false) {
    return (
      <PendingVerificationCard
        email={pendingVerification.email}
        scanUrl={pendingVerification.scanUrl}
        onDismiss={() => {
          try { localStorage.removeItem('alphascan_pending_verification'); } catch { /* */ }
          setPendingVerification(null);
        }}
      />
    );
  }

  if (state === 'fakeLoading') {
    return (
      <div className="w-full">
        <FakeScanProgress
          url={capturedUrl}
          onGateReached={() => setState('gated')}
        />
      </div>
    );
  }

  if (state === 'gated') {
    return (
      <div className="w-full relative">
        <FakeScanProgress url={capturedUrl} onGateReached={() => {}} />
        <SignupWall domain={domain} scanUrl={capturedUrl} />
      </div>
    );
  }

  // Idle — show normal scan input
  // Wait for auth check before rendering to avoid flash
  return (
    <ScanInput
      variant="dialog"
      onCapture={isAuthenticated != null ? handleCapture : undefined}
    />
  );
}
