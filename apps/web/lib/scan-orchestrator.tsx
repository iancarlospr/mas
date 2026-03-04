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

/**
 * GhostScan OS — Scan Orchestrator
 * ═══════════════════════════════════
 *
 * Manages the scan lifecycle within the desktop OS:
 * 1. Start scan → Hollywood Hack sequence (full-screen, portaled)
 * 2. On complete → open scan report as a managed window
 * 3. Open existing scans from history as windows
 * 4. Visual-only sequence for unauthenticated users (pauses for auth gate)
 * 5. Cross-tab auth detection → resume sequence + fire backend scan
 *
 * Mounted at the desktop shell level — persists across window open/close.
 */

interface ActiveScan {
  scanId: string;
  domain: string;
  isCached?: boolean;
}

/** Visual-only sequence (no backend, for unauthenticated users) */
interface VisualSequence {
  domain: string;
  paused: boolean;
  /** Captured URL + turnstile token for firing the scan after auth */
  capturedUrl: string;
  capturedToken: string;
}

const VERIFIED_KEY = 'alphascan_email_verified';

interface ScanOrchestratorValue {
  startScan(scanId: string, domain: string, isCached?: boolean): void;
  openScanWindow(scanId: string, domain: string): void;
  /** Start visual-only sequence with captured scan params for later */
  startVisualSequence(domain: string, capturedUrl: string, capturedToken: string): void;
  pauseVisualSequence(): void;
  resumeVisualSequence(): void;
  connectScan(scanId: string, domain: string, isCached?: boolean): void;
  cancelVisualSequence(): void;
  activeScanId: string | null;
  isVisualSequenceActive: boolean;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [visualSequence, setVisualSequence] = useState<VisualSequence | null>(null);
  const resumingRef = useRef(false);

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

  // ── Cross-tab auth detection ─────────────────────────────────────────
  // When the visual sequence is paused (waiting for auth), listen for the
  // verification signal from the other tab via localStorage. This effect
  // lives HERE (not in HeroScanFlow) because it persists after scan-input
  // window is closed.
  useEffect(() => {
    if (!visualSequence?.paused) return;
    if (resumingRef.current) return;

    const { capturedUrl, capturedToken, domain } = visualSequence;

    const fireBackendScan = async () => {
      if (resumingRef.current) return;
      resumingRef.current = true;

      try { localStorage.removeItem(VERIFIED_KEY); } catch { /* */ }
      wm.closeWindow('auth');

      // Resume the visual sequence
      setVisualSequence((prev) => prev ? { ...prev, paused: false } : null);

      // Fire the real backend scan
      try {
        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: capturedUrl, turnstileToken: capturedToken, autoScan: true }),
        });

        if (res.ok) {
          const { scanId, cached } = await res.json();
          analytics.scanStarted(new URL(capturedUrl).hostname, 'full');
          setVisualSequence(null);
          setActiveScan({ scanId, domain, isCached: cached });
        } else {
          setVisualSequence(null);
        }
      } catch {
        setVisualSequence(null);
      }

      resumingRef.current = false;
    };

    const supabase = createClient();

    // 1. Supabase auth state change (same-tab sign-in, e.g. password login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fireBackendScan();
      }
    });

    // 2. storage event — fires when ANOTHER tab writes to localStorage
    const handleStorage = (e: StorageEvent) => {
      if (e.key === VERIFIED_KEY && e.newValue === 'true') {
        fireBackendScan();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. visibilitychange — fallback when user manually switches back
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (localStorage.getItem(VERIFIED_KEY) === 'true') {
        await fireBackendScan();
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fireBackendScan();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [visualSequence?.paused, visualSequence?.capturedUrl, visualSequence?.capturedToken, visualSequence?.domain, wm]);

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
