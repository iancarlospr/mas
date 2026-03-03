'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeUrl } from '@/lib/utils';
import { ScanInput } from '@/components/scan/scan-input';
import { PendingVerificationCard } from '@/components/scan/pending-verification-card';
import { useScanOrchestrator } from '@/lib/scan-orchestrator';
import { useWindowManager } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';
import { analytics } from '@/lib/analytics';

type FlowState = 'idle' | 'waiting-auth' | 'existing-prompt';

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

/** Check if a date string falls on the same calendar day as now (local time) */
function isSameDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** Hours since a given date */
function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowLocal.getTime() - dLocal.getTime()) / (1000 * 60 * 60 * 24));
}

export function HeroScanFlow() {
  const [state, setState] = useState<FlowState>('idle');
  const [capturedUrl, setCapturedUrl] = useState('');
  const [capturedToken, setCapturedToken] = useState('');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [existingScan, setExistingScan] = useState<ExistingScan | null>(null);
  const orchestrator = useScanOrchestrator();
  const wm = useWindowManager();
  const authListenerRef = useRef(false);

  // Check for pending verification on mount (logged-out users only)
  useEffect(() => {
    if (isAuthenticated === false) {
      setPendingVerification(getPendingVerification());
    } else if (isAuthenticated === true) {
      try { localStorage.removeItem('alphascan_pending_verification'); } catch { /* */ }
    }
  }, [isAuthenticated]);

  // Listen for auth state change while waiting for registration
  useEffect(() => {
    if (state !== 'waiting-auth' || authListenerRef.current) return;
    authListenerRef.current = true;

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && capturedUrl) {
        // User just registered/logged in — close auth window, resume sequence, fire backend
        wm.closeWindow('auth');
        orchestrator.resumeVisualSequence();

        try {
          const res = await fetch('/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: capturedUrl, turnstileToken: capturedToken }),
          });

          if (res.ok) {
            const { scanId, cached } = await res.json();
            const domain = new URL(capturedUrl).hostname;
            analytics.scanStarted(domain, 'full');
            // Transition from visual-only to real scan (SSE takes over)
            orchestrator.connectScan(scanId, domain, cached);
          } else {
            // Scan creation failed — cancel sequence
            orchestrator.cancelVisualSequence();
          }
        } catch {
          orchestrator.cancelVisualSequence();
        }

        setState('idle');
        authListenerRef.current = false;
        subscription.unsubscribe();
      }
    });

    return () => {
      subscription.unsubscribe();
      authListenerRef.current = false;
    };
  }, [state, capturedUrl, capturedToken, orchestrator, wm]);

  /** Check if the user has a recent scan for this domain */
  const checkExistingScan = useCallback(async (url: string): Promise<ExistingScan | null> => {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return null;

    let domain: string;
    try {
      domain = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data } = await supabase
      .from('scans')
      .select('id, domain, created_at, marketing_iq')
      .eq('user_id', currentUser.id)
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

  /** Run a new scan (POST /api/scans + start Hollywood Hack with SSE) */
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
      const domain = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');

      if (isAuthenticated) {
        // Authenticated user — check for existing recent scan
        const existing = await checkExistingScan(url);

        if (existing && (isSameDay(existing.created_at) || hoursSince(existing.created_at) < 12)) {
          wm.closeWindow('scan-input');
          orchestrator.openScanWindow(existing.id, existing.domain);
          return;
        }

        if (existing) {
          setCapturedUrl(url);
          setCapturedToken(turnstileToken);
          setExistingScan(existing);
          setState('existing-prompt');
          return;
        }

        // No recent scan — proceed normally
        await runNewScan(url, turnstileToken);
      } else {
        // ── Unauthenticated user ──
        // 1. Start the Hollywood Hack visuals immediately (no backend)
        // 2. After 2s, pause sequence and open auth window
        // 3. On registration → resume sequence + fire real backend scan
        setCapturedUrl(url);
        setCapturedToken(turnstileToken);
        wm.closeWindow('scan-input');
        orchestrator.startVisualSequence(domain);
        analytics.signupWallShown(domain);

        // After 2 seconds: pause sequence and show auth window
        setTimeout(() => {
          orchestrator.pauseVisualSequence();
          wm.openWindow('auth');
          setState('waiting-auth');
        }, 2000);
      }
    },
    [isAuthenticated, checkExistingScan, runNewScan, orchestrator, wm],
  );

  const domain = capturedUrl ? (() => { try { return new URL(normalizeUrl(capturedUrl)).hostname.replace(/^www\./, ''); } catch { return capturedUrl; } })() : '';

  // Show "check your email" card if user signed up but hasn't verified yet
  if (pendingVerification && !authLoading && !isAuthenticated) {
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

  // Existing scan prompt — same domain scanned this week
  if (state === 'existing-prompt' && existingScan) {
    const days = daysSince(existingScan.created_at);
    const scoreText = existingScan.marketing_iq != null
      ? ` (MarketingIQ: ${existingScan.marketing_iq})`
      : '';
    const timeLabel = days <= 0 ? 'earlier today' : days === 1 ? 'yesterday' : `${days} days ago`;

    return (
      <div className="w-full space-y-gs-3">
        <div className="bevel-sunken bg-gs-paper p-gs-4">
          <p className="font-system text-os-sm font-bold" style={{ color: 'var(--gs-void)' }}>
            You scanned {existingScan.domain} {timeLabel}{scoreText}
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
      onCapture={!authLoading ? handleCapture : undefined}
    />
  );
}
