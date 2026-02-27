'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ScanProgress } from '@/components/scan/scan-progress';
import { BentoDashboard } from '@/components/scan/bento-dashboard';
import { MobileDashboard } from '@/components/scan/mobile-dashboard';
import { useViewport } from '@/hooks/use-viewport';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { Window } from '@/components/os/window';
import { pickRandom, ERROR_STATES } from '@/lib/chloe-ai-copy';
import type { ScanWithResults } from '@marketing-alpha/types';
import { analytics } from '@/lib/analytics';

/**
 * GhostScan OS — Scan Page
 * ═══════════════════════════
 *
 * WHAT: The main scan route — handles loading, in-progress (Hollywood Hack),
 *       failed, and complete (Desktop Dashboard) states.
 * WHY:  This is the entry point to the scan experience (Plan Section 5, 6).
 * HOW:  Fetches scan data, renders ScanProgress during scanning (which
 *       drives the full Hollywood Hack sequence), then BentoDashboard
 *       (which renders the Desktop OS) when complete.
 *
 * All states now use GhostScan OS visual language.
 */

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const viewport = useViewport();
  const [scan, setScan] = useState<ScanWithResults | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScan = useCallback(async () => {
    const res = await fetch(`/api/scans/${id}`);
    if (res.ok) {
      const data = await res.json();
      setScan(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  /* ── Loading state ───────────────────────────────────────── */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gs-ink flex items-center justify-center">
        <div className="text-center">
          <ChloeSprite state="scanning" size={64} glowing />
          <p className="font-data text-data-sm text-gs-terminal mt-gs-4 terminal-glow animate-blink">
            Loading scan data...
          </p>
        </div>
      </div>
    );
  }

  /* ── Not found state ─────────────────────────────────────── */
  if (!scan) {
    return (
      <div className="fixed inset-0 bg-gs-paper flex items-center justify-center">
        <Window id="not-found" title="⚠ Error" variant="dialog" isActive width={400}>
          <div className="p-gs-6 text-center">
            <ChloeSprite state="found" size={64} glowing className="mx-auto" />
            <h1 className="font-system text-os-lg text-gs-ink mt-gs-4 mb-gs-2">
              Scan not found
            </h1>
            <p className="font-data text-data-sm text-gs-muted">
              This scan doesn&apos;t exist or you don&apos;t have access.
            </p>
          </div>
        </Window>
      </div>
    );
  }

  /* ── In-progress → Hollywood Hack sequence ───────────────── */
  if (scan.status !== 'complete' && scan.status !== 'failed' && scan.status !== 'cancelled') {
    return (
      <ScanProgress
        scanId={id}
        domain={scan.domain}
        onComplete={() => {
          fetchScan().then(() => {
            if (scan) analytics.scanCompleted(id, scan.domain, scan.marketingIq);
          });
        }}
      />
    );
  }

  /* ── Failed state ────────────────────────────────────────── */
  if (scan.status === 'failed') {
    return (
      <div className="fixed inset-0 bg-gs-paper flex items-center justify-center">
        <div className="relative">
          <ChloeSprite state="found" size={64} glowing className="absolute -top-[80px] left-1/2 -translate-x-1/2" />
          <Window id="scan-failed" title="⚠ Scan Failed" variant="dialog" isActive width={440}>
            <div className="p-gs-6 text-center">
              <p className="font-data text-data-lg text-gs-critical font-bold mb-gs-2">
                Scan Could Not Complete
              </p>
              <p className="font-data text-data-sm text-gs-muted mb-gs-4">
                The scan hit a wall. {scan.domain} is either down or blocking us.
              </p>
              <p className="font-data text-data-xs text-gs-muted">
                Scan ID: {scan.id}
              </p>
            </div>
          </Window>
        </div>
      </div>
    );
  }

  /* ── Complete → Dashboard (mobile or desktop) ───────────── */
  if (viewport === 'mobile') {
    return <MobileDashboard scan={scan} />;
  }
  return <BentoDashboard scan={scan} />;
}
