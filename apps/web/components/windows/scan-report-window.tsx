'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { useWindowManager, useWindowState } from '@/lib/window-manager';
import { ScanDashboardContent } from '@/components/scan/scan-dashboard-content';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Scan Report Window (Dynamic)
 * ═══════════════════════════════════════════════
 *
 * Content component for dynamic scan report windows.
 * Reads scanId from openData, fetches scan data, renders ScanDashboardContent.
 * ManagedWindow provides the window chrome (titlebar, drag, resize).
 */

interface ScanReportWindowProps {
  windowId: string;
}

export default function ScanReportWindow({ windowId }: ScanReportWindowProps) {
  const wm = useWindowManager();
  const windowState = useWindowState(windowId);
  const scanId = windowState?.openData?.scanId as string | undefined;

  const [scan, setScan] = useState<ScanWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScan = useCallback(async () => {
    if (!scanId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      if (!res.ok) {
        setError('Scan not found or access denied.');
        setLoading(false);
        return;
      }
      const data: ScanWithResults = await res.json();
      setScan(data);

      // Update window title to domain
      wm.updateWindow(windowId, {
        title: `${data.domain} — Scanned ${new Date(data.createdAt).toLocaleDateString()}`,
      });
    } catch {
      setError('Failed to load scan data.');
    }
    setLoading(false);
  }, [scanId, windowId, wm]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Re-fetch when openData changes (e.g., after payment success)
  const paymentSuccess = windowState?.openData?.paymentSuccess;
  useEffect(() => {
    if (paymentSuccess) {
      const timer = setTimeout(fetchScan, 1500);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, fetchScan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-gs-8">
        <div className="text-center">
          <ChloeSprite state="scanning" size={64} glowing />
          <p className="font-data text-data-sm text-gs-terminal mt-gs-4 terminal-glow animate-blink">
            Loading scan data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="flex items-center justify-center h-full p-gs-8">
        <div className="text-center space-y-gs-4">
          <ChloeSprite state="found" size={64} />
          <p className="font-system text-os-base text-gs-critical">
            {error ?? 'Scan not found'}
          </p>
          <button onClick={fetchScan} className="bevel-button text-os-xs">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <ScanDashboardContent scan={scan} />;
}
