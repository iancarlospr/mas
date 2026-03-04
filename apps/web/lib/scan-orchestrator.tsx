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
  /** Called by auth window after signUp() to pass credentials for server-side polling */
  setGateCredentials(email: string, password: string): void;
  activeScanId: string | null;
  isVisualSequenceActive: boolean;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

/**
 * Polls for email verification by attempting signInWithPassword() every 5 seconds.
 * Works cross-browser and cross-device — no localStorage or cookie dependency.
 *
 * Security hardening:
 * - 5s interval (not 3s) — gentler on Supabase auth rate limits
 * - Max 60 attempts (5 min timeout) — prevents indefinite polling
 * - Credentials cleared from ref immediately after success or timeout
 */
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 60 × 5s = 5 minutes

function AuthGatePoller({
  capturedUrl,
  capturedToken,
  domain,
  credentialsRef,
  onVerified,
}: {
  capturedUrl: string;
  capturedToken: string;
  domain: string;
  credentialsRef: React.MutableRefObject<{ email: string; password: string } | null>;
  onVerified: (scanId: string, domain: string, cached: boolean) => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let attempts = 0;

    const interval = setInterval(async () => {
      if (firedRef.current) return;

      const creds = credentialsRef.current;
      if (!creds) return; // credentials not yet set by auth window

      attempts++;

      // Timeout: stop polling after MAX_POLL_ATTEMPTS
      if (attempts > MAX_POLL_ATTEMPTS) {
        firedRef.current = true;
        clearInterval(interval);
        credentialsRef.current = null;
        onVerified('', domain, false);
        return;
      }

      // Try signing in — if email is confirmed, this returns a session.
      // If not confirmed, Supabase returns "Email not confirmed" error.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });

      if (signInError) {
        // Not yet verified — keep polling
        return;
      }

      // Session established — clear credentials immediately, fire the scan
      firedRef.current = true;
      clearInterval(interval);
      credentialsRef.current = null;

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
          onVerified('', domain, false);
        }
      } catch {
        onVerified('', domain, false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      credentialsRef.current = null; // clear on unmount too
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stable refs, reads from credentialsRef

  return null;
}

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [visualSequence, setVisualSequence] = useState<VisualSequence | null>(null);
  const closeWindowRef = useRef(wm.closeWindow);
  closeWindowRef.current = wm.closeWindow;

  // Credentials ref — set by auth window after signUp(), read by AuthGatePoller.
  // Using a ref (not state) so credentials never appear in React DevTools.
  const gateCredentialsRef = useRef<{ email: string; password: string } | null>(null);

  const setGateCredentials = useCallback((email: string, password: string) => {
    gateCredentialsRef.current = { email, password };
  }, []);

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
    gateCredentialsRef.current = null; // reset from any previous attempt
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
    gateCredentialsRef.current = null; // clear credentials
    closeWindowRef.current('auth');
    if (scanId) {
      setVisualSequence(null);
      setActiveScan({ scanId, domain, isCached: cached });
    } else {
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
      setGateCredentials,
      activeScanId: activeScan?.scanId ?? null,
      isVisualSequenceActive: visualSequence != null,
    }),
    [startScan, openScanWindow, startVisualSequence, pauseVisualSequence, resumeVisualSequence, connectScan, cancelVisualSequence, setGateCredentials, activeScan?.scanId, visualSequence],
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
      {visualSequence?.paused && (
        <AuthGatePoller
          key="auth-poller"
          capturedUrl={visualSequence.capturedUrl}
          capturedToken={visualSequence.capturedToken}
          domain={visualSequence.domain}
          credentialsRef={gateCredentialsRef}
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
