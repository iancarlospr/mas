'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWindowManager } from '@/lib/window-manager';
import { ScanProgress } from '@/components/scan/scan-progress';
import { ScanSequence } from '@/components/scan/scan-sequence';
import { analytics } from '@/lib/analytics';
import type { ScanStatus } from '@marketing-alpha/types';

const VERIFIED_KEY = 'alphascan_email_verified';

interface ActiveScan {
  scanId: string;
  domain: string;
  isCached?: boolean;
}

interface VisualSequence {
  domain: string;
  paused: boolean;
  capturedUrl: string;
  capturedToken: string;
}

interface ScanOrchestratorValue {
  startScan(scanId: string, domain: string, isCached?: boolean): void;
  openScanWindow(scanId: string, domain: string): void;
  startVisualSequence(domain: string, capturedUrl: string, capturedToken: string): void;
  pauseVisualSequence(): void;
  resumeVisualSequence(): void;
  connectScan(scanId: string, domain: string, isCached?: boolean): void;
  cancelVisualSequence(): void;
  activeScanId: string | null;
  isVisualSequenceActive: boolean;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

/**
 * Standalone polling component — mounts when visual sequence is paused,
 * polls localStorage every second for the verification flag.
 * When found: closes auth, resumes sequence, fires backend scan.
 * No useEffect deps. No event listeners. Just a setInterval.
 */
function AuthGatePoller({
  capturedUrl,
  capturedToken,
  domain,
  onVerified,
}: {
  capturedUrl: string;
  capturedToken: string;
  domain: string;
  onVerified: (scanId: string, domain: string, cached: boolean) => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (firedRef.current) return;

      const flag = localStorage.getItem(VERIFIED_KEY);
      if (flag !== 'true') {
        // Also check cookie (set by confirm route)
        if (!document.cookie.includes('alphascan_verified=true')) return;
      }

      firedRef.current = true;
      clearInterval(interval);

      // Read session tokens passed from verification tab via localStorage.
      // Server-side cookies from verifyOtp() may not survive a raw NextResponse(html),
      // so tokens are explicitly passed through localStorage and set via setSession().
      const at = localStorage.getItem('alphascan_at') ?? '';
      const rt = localStorage.getItem('alphascan_rt') ?? '';

      try { localStorage.removeItem(VERIFIED_KEY); } catch { /* */ }
      try { localStorage.removeItem('alphascan_at'); } catch { /* */ }
      try { localStorage.removeItem('alphascan_rt'); } catch { /* */ }
      document.cookie = 'alphascan_verified=; path=/; max-age=0';

      const supabase = createClient();
      if (at && rt) {
        // Establish the session from verification tab tokens
        await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      } else {
        // Fallback: try reading session from cookies (may work if cookies were set)
        await supabase.auth.refreshSession();
      }

      try {
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: capturedUrl, turnstileToken: capturedToken, autoScan: true }),
        });

        if (res.ok) {
          const { scanId, cached } = await res.json();
          analytics.scanStarted(new URL(capturedUrl).hostname, 'full');
          onVerified(scanId, domain, cached);
        } else {
          onVerified('', domain, false); // signal failure
        }
      } catch {
        onVerified('', domain, false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally stable, reads from refs/localStorage

  return null; // renders nothing
}

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [visualSequence, setVisualSequence] = useState<VisualSequence | null>(null);
  const closeWindowRef = useRef(wm.closeWindow);
  closeWindowRef.current = wm.closeWindow;

  const openScanWindow = useCallback(
    (scanId: string, domain: string) => {
      const windowId = `scan-${scanId}`;
      if (wm.windows[windowId]?.isOpen) {
        wm.focusWindow(windowId);
        return;
      }
      wm.registerWindow(windowId, {
        title: domain || 'Loading...',
        width: 900,
        height: 600,
        componentType: 'scan-report',
      });
      wm.openWindow(windowId, { scanId });
      wm.maximizeWindow(windowId);
    },
    [wm],
  );

  const startScan = useCallback(
    (scanId: string, domain: string, isCached?: boolean) => {
      setVisualSequence(null);
      setActiveScan({ scanId, domain, isCached });
    },
    [],
  );

  const handleScanComplete = useCallback(
    (scanId: string, domain: string) => {
      setActiveScan(null);
      openScanWindow(scanId, domain);
    },
    [openScanWindow],
  );

  const startVisualSequence = useCallback((domain: string, capturedUrl: string, capturedToken: string) => {
    setVisualSequence({ domain, paused: false, capturedUrl, capturedToken });
  }, []);

  const pauseVisualSequence = useCallback(() => {
    setVisualSequence((prev) => prev ? { ...prev, paused: true } : null);
  }, []);

  const resumeVisualSequence = useCallback(() => {
    setVisualSequence((prev) => prev ? { ...prev, paused: false } : null);
  }, []);

  const connectScan = useCallback(
    (scanId: string, domain: string, isCached?: boolean) => {
      setVisualSequence(null);
      setActiveScan({ scanId, domain, isCached });
    },
    [],
  );

  const cancelVisualSequence = useCallback(() => {
    setVisualSequence(null);
  }, []);

  // Called by AuthGatePoller when verification detected
  const handleAuthVerified = useCallback((scanId: string, domain: string, cached: boolean) => {
    closeWindowRef.current('auth');
    if (scanId) {
      // Success — transition to real scan with SSE
      setVisualSequence(null);
      setActiveScan({ scanId, domain, isCached: cached });
    } else {
      // Failed — cancel everything
      setVisualSequence(null);
    }
  }, []);

  const value = useMemo<ScanOrchestratorValue>(
    () => ({
      startScan,
      openScanWindow,
      startVisualSequence,
      pauseVisualSequence,
      resumeVisualSequence,
      connectScan,
      cancelVisualSequence,
      activeScanId: activeScan?.scanId ?? null,
      isVisualSequenceActive: visualSequence != null,
    }),
    [startScan, openScanWindow, startVisualSequence, pauseVisualSequence, resumeVisualSequence, connectScan, cancelVisualSequence, activeScan?.scanId, visualSequence],
  );

  return (
    <ScanOrchestratorContext.Provider value={value}>
      {children}
      {activeScan && (
        <ScanProgress
          key={activeScan.scanId}
          scanId={activeScan.scanId}
          domain={activeScan.domain}
          isCached={activeScan.isCached}
          onComplete={() => handleScanComplete(activeScan.scanId, activeScan.domain)}
        />
      )}
      {visualSequence && (
        <ScanSequence
          key="visual-sequence"
          domain={visualSequence.domain}
          scanStatus={'queued' as ScanStatus}
          progress={0}
          completedModules={[]}
          onComplete={() => {}}
          paused={visualSequence.paused}
        />
      )}
      {/* Polls for cross-tab verification — only mounts when sequence is paused */}
      {visualSequence?.paused && (
        <AuthGatePoller
          key="auth-poller"
          capturedUrl={visualSequence.capturedUrl}
          capturedToken={visualSequence.capturedToken}
          domain={visualSequence.domain}
          onVerified={handleAuthVerified}
        />
      )}
    </ScanOrchestratorContext.Provider>
  );
}

export function useScanOrchestrator(): ScanOrchestratorValue {
  const ctx = useContext(ScanOrchestratorContext);
  if (!ctx) {
    throw new Error('useScanOrchestrator must be used within ScanOrchestratorProvider');
  }
  return ctx;
}
