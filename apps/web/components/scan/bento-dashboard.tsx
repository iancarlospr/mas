'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import { Window } from '@/components/os/window';
import { ChloeReactionsProvider } from '@/components/chloe/chloe-reactions';
import { ScanDashboardContent } from './scan-dashboard-content';

/**
 * GhostScan OS — Desktop Dashboard (Route Fallback)
 * ═══════════════════════════════════════════════════════
 *
 * Thin wrapper around ScanDashboardContent for the /scan/[id] route
 * fallback (mobile + direct links). Desktop users get the managed
 * window version via ScanReportWindow instead.
 */

interface BentoDashboardProps {
  scan: ScanWithResults;
}

export function BentoDashboard({ scan }: BentoDashboardProps) {
  return (
    <ChloeReactionsProvider>
      <Window
        id="dashboard"
        title={`Dashboard — ${scan.domain} — Scanned ${new Date(scan.createdAt).toLocaleDateString()}`}
        isActive
        isMaximized
      >
        <ScanDashboardContent scan={scan} />
      </Window>
    </ChloeReactionsProvider>
  );
}
