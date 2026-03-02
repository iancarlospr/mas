'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeUrl } from '@/lib/utils';
import { ScanInput } from '@/components/scan/scan-input';
import { FakeScanProgress } from '@/components/scan/fake-scan-progress';
import { SignupWall } from '@/components/scan/signup-wall';
import { PendingVerificationCard } from '@/components/scan/pending-verification-card';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { useWindowManager } from '@/lib/window-manager';
import { analytics } from '@/lib/analytics';

type FlowState = 'idle' | 'fakeLoading' | 'gated' | 'existing-prompt';

interface PendingVerification {
  email: string;
  scanUrl: string;
  timestamp: number;
}

interface ExistingScan {
  id: string;
  domain: string;
  created_at: string;
  marketing_iq: number | null;
}

/** Read the pending-verification flag from localStorage (24h TTL). */
function getPendingVerification(): PendingVerification | null {
  try {
    const raw = localStorage.getItem('alphascan_pending_verification');
    if (!raw) return null;
    const data: PendingVerification = JSON.parse(raw);
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('alphascan_pending_verification');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function isSameDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function HeroScanFlow() {
  const [state, setState] = useState<FlowState>('idle');
  const [capturedUrl, setCapturedUrl] = useState('');
  const [capturedToken, setCapturedToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [existingScan, setExistingScan] = useState<ExistingScan | null>(null);
  const orchestrator = useScanOrchestrator();
  const wm = useWindowManager();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
      if (user) {
        try { localStorage.removeItem('alphascan_pending_verification'); } catch { /* */ }
      } else {
        setPendingVerification(getPendingVerification());
      }
    });
  }, []);

  /** Check if the user has a recent scan for this domain */
  const checkExistingScan = useCallback(async (url: string): Promise<ExistingScan | null> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let domain: string;
    try {
      domain = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }

    // Look for completed scans of this domain in the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data } = await supabase
      .from('scans')
      .select('id, domain, created_at, marketing_iq')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('status', 'complete')
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0] as ExistingScan;
    }
    return null;
  }, []);

  /** Run a new scan (POST /api/scans + start Hollywood Hack) */
  const runNewScan = useCallback(async (url: string, turnstileToken: string) => {
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
      } catch { /* non-JSON response */ }
      throw new Error(errorMsg);
    }

    const { scanId, cached } = await res.json();
    const domain = new URL(url).hostname;
    analytics.scanStarted(domain, 'full');
    wm.closeWindow('scan-input');
    orchestrator.startScan(scanId, domain, cached);
  }, [orchestrator, wm]);

  const handleCapture = useCallback(
    async (url: string, turnstileToken: string) => {
      if (isAuthenticated) {
        // Check for existing recent scan of this domain
        const existing = await checkExistingScan(url);

        if (existing && isSameDay(existing.created_at)) {
          // Same day — just open the existing report, no new scan
          wm.closeWindow('scan-input');
          orchestrator.openScanWindow(existing.id, existing.domain);
          return;
        }

        if (existing) {
          // Same week — ask the user
          setCapturedUrl(url);
          setCapturedToken(turnstileToken);
          setExistingScan(existing);
          setState('existing-prompt');
          return;
        }

        // No recent scan — proceed normally
        await runNewScan(url, turnstileToken);
      } else {
        // Anonymous user — fake loading → signup wall
        setCapturedUrl(url);
        setState('fakeLoading');
        analytics.signupWallShown(new URL(url).hostname);
      }
    },
    [isAuthenticated, checkExistingScan, runNewScan, orchestrator, wm],
  );

  const domain = capturedUrl ? (() => { try { return new URL(normalizeUrl(capturedUrl)).hostname.replace(/^www\./, ''); } catch { return capturedUrl; } })() : '';

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

  // Existing scan prompt — same domain scanned this week
  if (state === 'existing-prompt' && existingScan) {
    const days = daysSince(existingScan.created_at);
    const scoreText = existingScan.marketing_iq != null
      ? ` (MarketingIQ: ${existingScan.marketing_iq})`
      : '';

    return (
      <div className="w-full space-y-gs-3">
        <div className="bevel-sunken bg-gs-paper p-gs-4">
          <p className="font-system text-os-sm font-bold" style={{ color: 'var(--gs-void)' }}>
            You scanned {existingScan.domain} {days === 1 ? 'yesterday' : `${days} days ago`}{scoreText}
          </p>
          <p className="font-data text-data-xs mt-gs-1" style={{ color: 'var(--gs-mid)' }}>
            Want to view the existing report or run a fresh scan?
          </p>
        </div>
        <div className="flex gap-gs-2">
          <button
            onClick={() => {
              wm.closeWindow('scan-input');
              orchestrator.openScanWindow(existingScan.id, existingScan.domain);
            }}
            className="bevel-button-primary text-os-sm flex-1"
          >
            View Report
          </button>
          <button
            onClick={async () => {
              setState('idle');
              setExistingScan(null);
              await runNewScan(capturedUrl, capturedToken);
            }}
            className="bevel-button text-os-sm flex-1"
          >
            Scan Again
          </button>
        </div>
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
