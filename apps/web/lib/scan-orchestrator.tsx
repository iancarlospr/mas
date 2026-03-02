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

/**
 * GhostScan OS — Scan Orchestrator
 * ═══════════════════════════════════
 *
 * Manages the scan lifecycle within the desktop OS:
 * 1. Start scan → Hollywood Hack sequence (full-screen, portaled)
 * 2. On complete → open scan report as a managed window
 * 3. Open existing scans from history as windows
 *
 * Mounted at the desktop shell level, above ChloeReactionsProvider.
 */

interface ActiveScan {
  scanId: string;
  domain: string;
  isCached?: boolean;
}

interface ScanOrchestratorValue {
  /** Start the Hollywood Hack sequence for a scan (SSE + full-screen animation) */
  startScan(scanId: string, domain: string, isCached?: boolean): void;
  /** Open a completed scan in a managed window */
  openScanWindow(scanId: string, domain: string): void;
  /** Currently active scan (in Hollywood Hack phase), null if none */
  activeScanId: string | null;
}

const ScanOrchestratorContext = createContext<ScanOrchestratorValue | null>(null);

export function ScanOrchestratorProvider({ children }: { children: ReactNode }) {
  const wm = useWindowManager();
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null);

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

  const value = useMemo<ScanOrchestratorValue>(
    () => ({
      startScan,
      openScanWindow,
      activeScanId: activeScan?.scanId ?? null,
    }),
    [startScan, openScanWindow, activeScan?.scanId],
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
