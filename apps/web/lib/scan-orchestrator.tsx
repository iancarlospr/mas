'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { ScanProgress } from '@/components/scan/scan-progress';
import { ScanSequence } from '@/components/scan/scan-sequence';
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
 *
 * Mounted at the desktop shell level, above ChloeReactionsProvider.
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
}

interface ScanOrchestratorValue {
  /** Start the Hollywood Hack sequence for a scan (SSE + full-screen animation) */
  startScan(scanId: string, domain: string, isCached?: boolean): void;
  /** Open a completed scan in a managed window */
  openScanWindow(scanId: string, domain: string): void;
  /** Start the Hollywood Hack visuals ONLY — no backend. For unauth users. */
  startVisualSequence(domain: string): void;
  /** Pause the visual-only sequence (for auth gate overlay) */
  pauseVisualSequence(): void;
  /** Resume the visual-only sequence (auth completed) */
  resumeVisualSequence(): void;
  /** Stop the visual-only sequence and transition to real scan */
  connectScan(scanId: string, domain: string, isCached?: boolean): void;
  /** Cancel the visual-only sequence (user didn't register) */
  cancelVisualSequence(): void;
  /** Currently active scan (in Hollywood Hack phase), null if none */
  activeScanId: string | null;
  /** Whether a visual-only sequence is active */
  isVisualSequenceActive: boolean;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);
  const [visualSequence, setVisualSequence] = useState<VisualSequence | null>(null);

  const openScanWindow = useCallback(
    (scanId: string, domain: string) => {
      const windowId = `scan-${scanId}`;

      // If already open, just focus it
      if (wm.windows[windowId]?.isOpen) {
        wm.focusWindow(windowId);
        return;
      }

      // Register dynamic window
      wm.registerWindow(windowId, {
        title: domain || 'Loading...',
        width: 900,
        height: 600,
        componentType: 'scan-report',
      });

      // Open with scanId in openData, then maximize
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

  // Visual-only sequence (no backend)
  const startVisualSequence = useCallback((domain: string) => {
    setVisualSequence({ domain, paused: false });
  }, []);

  const pauseVisualSequence = useCallback(() => {
    setVisualSequence((prev) => prev ? { ...prev, paused: true } : null);
  }, []);

  const resumeVisualSequence = useCallback(() => {
    setVisualSequence((prev) => prev ? { ...prev, paused: false } : null);
  }, []);

  // Transition from visual-only to real scan (user just registered)
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
      {/* Active Hollywood Hack sequence — portals to document.body via ScanSequence */}
      {activeScan && (
        <ScanProgress
          key={activeScan.scanId}
          scanId={activeScan.scanId}
          domain={activeScan.domain}
          isCached={activeScan.isCached}
          onComplete={() => handleScanComplete(activeScan.scanId, activeScan.domain)}
        />
      )}
      {/* Visual-only sequence for unauthenticated users — no SSE, just the animation */}
      {visualSequence && (
        <ScanSequence
          key="visual-sequence"
          domain={visualSequence.domain}
          scanStatus={'queued' as ScanStatus}
          progress={0}
          completedModules={[]}
          onComplete={() => {/* visual-only never completes on its own */}}
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
