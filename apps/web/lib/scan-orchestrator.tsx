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

interface GateIdentity {
  userId: string;
  email: string;
  password: string;
}

interface ScanOrchestratorValue {
  startScan(scanId: string, domain: string, isCached?: boolean): void;
  openScanWindow(scanId: string, domain: string): void;
  startVisualSequence(domain: string, capturedUrl: string, capturedToken: string): void;
  pauseVisualSequence(): void;
  resumeVisualSequence(): void;
  connectScan(scanId: string, domain: string, isCached?: boolean): void;
  cancelVisualSequence(): void;
  /** Called by auth window after signUp() to pass identity for verification polling */
  setGateIdentity(userId: string, email: string, password: string): void;
  /** Set a callback for mobile scan completion (skips openScanWindow). Pass null to clear. */
  setMobileCompleteHandler(handler: ((scanId: string, domain: string) => void) | null): void;
  activeScanId: string | null;
  isVisualSequenceActive: boolean;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

/**
 * Polls GET /api/auth/check-verified?userId=<uuid> every 5 seconds to detect
 * email verification. Works cross-browser and cross-device.
 *
 * When confirmed: signs in with stored credentials to establish a session,
 * then fires the scan. Credentials held only in a ref (not state/localStorage),
 * cleared immediately after use.
 *
 * Security:
 * - Polls a read-only endpoint (no auth attempt logs in Supabase)
 * - No passwords sent over the wire during polling — only userId (UUID)
 * - Max 60 attempts (5 min timeout) prevents indefinite polling
 * - Credentials cleared from ref on success, timeout, or unmount
 */
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 60 × 5s = 5 minutes

function AuthGatePoller({
  capturedUrl,
  capturedToken,
  domain,
  identityRef,
  onVerified,
}: {
  capturedUrl: string;
  capturedToken: string;
  domain: string;
  identityRef: React.MutableRefObject<GateIdentity | null>;
  onVerified: (scanId: string, domain: string, cached: boolean) => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    let attempts = 0;

    const interval = setInterval(async () => {
      if (firedRef.current) return;

      const identity = identityRef.current;
      if (!identity) return; // identity not yet set by auth window

      attempts++;

      if (attempts > MAX_POLL_ATTEMPTS) {
        firedRef.current = true;
        clearInterval(interval);
        identityRef.current = null;
        onVerified('', domain, false);
        return;
      }

      // Lightweight check — no auth attempt, no Supabase rate limit concern
      try {
        const res = await fetch(`/api/auth/check-verified?userId=${identity.userId}`);
        if (!res.ok) return;
        const { confirmed } = await res.json();
        if (!confirmed) return;
      } catch {
        return; // network error — retry next interval
      }

      // Email confirmed — sign in to establish session, then fire scan
      firedRef.current = true;
      clearInterval(interval);

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: identity.email,
        password: identity.password,
      });
      identityRef.current = null; // clear credentials immediately

      if (signInError) {
        onVerified('', domain, false);
        return;
      }

      // Redeem beta invite BEFORE creating scan so credits are ready.
      // Idempotent — auth-context may also fire maybeRedeemBetaInvite(); 409 = no-op.
      const inviteCookie = document.cookie.match(/(?:^|;\s*)__alphascan_invite=([^;]+)/);
      const inviteCode = inviteCookie ? decodeURIComponent(inviteCookie[1]!) : null;
      if (inviteCode) {
        try {
          await fetch('/api/beta/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: inviteCode }),
          });
        } catch {} // silent — auth-context retries via onAuthStateChange
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
          onVerified('', domain, false);
        }
      } catch {
        onVerified('', domain, false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      identityRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stable refs

  return null;
}

/**
 * Sign-in-only verification poller for mobile registration (no pending scan).
 * Polls /api/auth/check-verified, signs in with stored credentials when confirmed.
 * Session establishment triggers onAuthStateChange → isAuthenticated → overlay closes.
 */
function SignInPoller({
  identityRef,
  onComplete,
}: {
  identityRef: React.MutableRefObject<GateIdentity | null>;
  onComplete: () => void;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    let attempts = 0;

    const interval = setInterval(async () => {
      if (firedRef.current) return;

      const identity = identityRef.current;
      if (!identity) return;

      attempts++;
      if (attempts > MAX_POLL_ATTEMPTS) {
        firedRef.current = true;
        clearInterval(interval);
        identityRef.current = null;
        onComplete();
        return;
      }

      try {
        const res = await fetch(`/api/auth/check-verified?userId=${identity.userId}`);
        if (!res.ok) return;
        const { confirmed } = await res.json();
        if (!confirmed) return;
      } catch {
        return;
      }

      // Email confirmed — sign in to establish session in this browser context
      firedRef.current = true;
      clearInterval(interval);

      const supabase = createClient();
      await supabase.auth.signInWithPassword({
        email: identity.email,
        password: identity.password,
      });
      identityRef.current = null;
      onComplete();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stable refs

  return null;
}

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [visualSequence, setVisualSequence] = useState<VisualSequence | null>(null);
  const closeWindowRef = useRef(wm.closeWindow);
  closeWindowRef.current = wm.closeWindow;

  // Identity ref — userId for polling, email+password for one-time signIn after confirmation.
  // Using a ref (not state) so credentials never appear in React DevTools.
  const gateIdentityRef = useRef<GateIdentity | null>(null);

  // Tracks whether we should poll for email verification (mobile registration without a pending scan)
  const [gatePollingActive, setGatePollingActive] = useState(false);

  const setGateIdentity = useCallback((userId: string, email: string, password: string) => {
    gateIdentityRef.current = { userId, email, password };
    setGatePollingActive(true);
  }, []);

  // Mobile completion handler — when set, scan complete calls this instead of openScanWindow
  const mobileCompleteRef = useRef<((scanId: string, domain: string) => void) | null>(null);

  const setMobileCompleteHandler = useCallback((handler: ((scanId: string, domain: string) => void) | null) => {
    mobileCompleteRef.current = handler;
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
        minWidth: 800,
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
      const mobileHandler = mobileCompleteRef.current;
      if (mobileHandler) {
        mobileCompleteRef.current = null;
        mobileHandler(scanId, domain);
      } else {
        openScanWindow(scanId, domain);
      }
    },
    [openScanWindow],
  );

  const startVisualSequence = useCallback((domain: string, capturedUrl: string, capturedToken: string) => {
    gateIdentityRef.current = null;
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

  const handleAuthVerified = useCallback((scanId: string, domain: string, cached: boolean) => {
    gateIdentityRef.current = null;
    setGatePollingActive(false);
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
      setGateIdentity,
      setMobileCompleteHandler,
      activeScanId: activeScan?.scanId ?? null,
      isVisualSequenceActive: visualSequence != null,
    }),
    [startScan, openScanWindow, startVisualSequence, pauseVisualSequence, resumeVisualSequence, connectScan, cancelVisualSequence, setGateIdentity, setMobileCompleteHandler, activeScan?.scanId, visualSequence],
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
          onExit={() => {
            setActiveScan(null);
            const mobileHandler = mobileCompleteRef.current;
            if (mobileHandler) {
              mobileCompleteRef.current = null;
              mobileHandler('', '');
            } else {
              wm.openWindow('history');
            }
          }}
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
          identityRef={gateIdentityRef}
          onVerified={handleAuthVerified}
        />
      )}
      {gatePollingActive && !visualSequence && (
        <SignInPoller
          key="sign-in-poller"
          identityRef={gateIdentityRef}
          onComplete={() => setGatePollingActive(false)}
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
