'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { ScanProgressEvent, ScanStatus } from '@marketing-alpha/types';
import { soundEffects } from '@/lib/sound-effects';
import { ScanSequence } from './scan-sequence';

/**
 * GhostScan OS — Scan Progress (SSE → Hollywood Hack Bridge)
 * ═══════════════════════════════════════════════════════════════
 *
 * WHAT: Connects the SSE scan progress stream to the Hollywood Hack
 *       loading sequence. This is the bridge between backend events
 *       and the theatrical frontend experience.
 * WHY:  The original component was a generic progress bar with phase dots.
 *       Now it drives the full-screen cinematic scan sequence that is
 *       the single most memorable moment in the product (Plan Section 5).
 * HOW:  Opens EventSource to /api/scans/{id}/stream, collects SSE events,
 *       and passes them as props to <ScanSequence> which handles all
 *       the visual choreography. SSE logic is UNCHANGED from original —
 *       only the rendering is replaced.
 *
 * Backend contract (unchanged):
 *   SSE events: { type: 'status'|'module'|'complete'|'error',
 *                 scanId, status, moduleId?, moduleScore?, progress?,
 *                 marketingIq?, error? }
 */

interface ScanProgressProps {
  /** Scan ID for SSE stream */
  scanId: string;
  /** Target domain (for display in the sequence) */
  domain: string;
  /** Callback when scan completes and sequence finishes */
  onComplete: () => void;
  /** Whether this scan was served from cache */
  isCached?: boolean;
  /** Whether this is the user's first scan */
  isFirstScan?: boolean;
  /** User's display name */
  userName?: string;
}

/** Module name lookup — maps IDs to human-readable names for the terminal boot */
const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security',
  M02: 'CMS & Infrastructure',
  M03: 'Performance',
  M04: 'Page Metadata',
  M05: 'Analytics Architecture',
  M06: 'Paid Media',
  M06b: 'PPC Landing Audit',
  M07: 'MarTech Orchestration',
  M08: 'Tag Governance',
  M09: 'Behavioral Intel',
  M10: 'Accessibility',
  M11: 'Console Errors',
  M12: 'Compliance',
  M13: 'Performance & Carbon',
  M14: 'Mobile & Responsive',
  M15: 'Social & Sharing',
  M16: 'PR & Media',
  M17: 'Careers & HR',
  M18: 'Investor Relations',
  M19: 'Support',
  M20: 'Ecommerce/SaaS',
  M21: 'Ad Library',
  M22: 'News Sentiment',
  M23: 'Social Sentiment',
  M24: 'Monthly Visits',
  M25: 'Traffic by Country',
  M26: 'Rankings',
  M27: 'Paid Traffic Cost',
  M28: 'Top Paid Keywords',
  M29: 'Competitors',
  M30: 'Traffic Sources',
  M31: 'Domain Trust',
  M33: 'Brand Search',
  M34: 'Losing Keywords',
  M36: 'Google Shopping',
  M37: 'Review Velocity',
  M38: 'Local Pack',
  M39: 'Sitemap & Indexing',
  M40: 'Attack Surface',
  M42: 'Executive Brief',
  M43: 'Remediation Roadmap',
  M44: 'Impact Scenarios',
  M45: 'Stack Analyzer',
};

interface CompletedModule {
  id: string;
  name: string;
}

export function ScanProgress({
  scanId,
  domain,
  onComplete,
  isCached = false,
  isFirstScan = true,
  userName,
}: ScanProgressProps) {
  /* ── SSE state (logic preserved from original) ───────────── */
  const [status, setStatus] = useState<ScanStatus>('queued');
  const [progress, setProgress] = useState(0);
  const [completedModules, setCompletedModules] = useState<CompletedModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marketingIq, setMarketingIq] = useState<number | undefined>();
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── SSE connection (unchanged logic from original) ──────── */
  useEffect(() => {
    const es = new EventSource(`/api/scans/${scanId}/stream`);
    eventSourceRef.current = es;

    let scanStartFired = false;

    es.onmessage = (event) => {
      const data: ScanProgressEvent = JSON.parse(event.data);

      if (data.status) {
        setStatus(data.status);
        // Fire scanStart on first non-queued status
        if (!scanStartFired && data.status !== 'queued') {
          scanStartFired = true;
          soundEffects.play('scanStart');
        }
      }
      if (data.progress != null) setProgress(data.progress);
      if (data.marketingIq != null) setMarketingIq(data.marketingIq);

      if (data.type === 'module' && data.moduleId) {
        soundEffects.play('moduleComplete');
        setCompletedModules((prev) => {
          if (prev.some((m) => m.id === data.moduleId)) return prev;
          return [
            ...prev,
            {
              id: data.moduleId!,
              name: MODULE_NAMES[data.moduleId!] ?? data.moduleId!,
            },
          ];
        });
      }

      if (data.type === 'complete') {
        soundEffects.play('scanComplete');
        es.close();
      }

      if (data.type === 'error') {
        setError(data.error ?? 'Scan failed');
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // SSE dropped — start HTTP polling fallback
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scans/${scanId}`);
          if (!res.ok) return;
          const scan = await res.json();
          if (scan.status === 'complete') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus('complete');
            setProgress(100);
            if (scan.marketingIq != null) setMarketingIq(scan.marketingIq);
            soundEffects.play('scanComplete');
          } else if (scan.status === 'failed' || scan.status === 'cancelled') {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(scan.error ?? 'Scan failed');
          } else {
            if (scan.progress != null) setProgress(scan.progress);
            if (scan.status) setStatus(scan.status);
          }
        } catch {
          // Network error — keep polling
        }
      }, 3000);
    };

    return () => {
      es.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scanId]);

  /* ── When the visual sequence finishes, notify parent ────── */
  const handleSequenceComplete = useCallback(() => {
    setSequenceComplete(true);
    onComplete();
  }, [onComplete]);

  /* ── Derive score label from MarketingIQ ─────────────────── */
  const scoreLabel = marketingIq != null
    ? marketingIq >= 85
      ? 'Marketing Leader'
      : marketingIq >= 70
        ? 'Competitive'
        : marketingIq >= 50
          ? 'Developing'
          : marketingIq >= 30
            ? 'At Risk'
            : 'Critical'
    : undefined;

  /* Don't render if sequence already completed */
  if (sequenceComplete) return null;

  /* Error state — show brief error then let parent handle */
  if (error) {
    return (
      <ScanSequence
        domain={domain}
        scanStatus="failed"
        progress={progress}
        completedModules={completedModules}
        isCached={isCached}
        isFirstScan={isFirstScan}
        onComplete={handleSequenceComplete}
        userName={userName}
      />
    );
  }

  /* ── Render the Hollywood Hack sequence ──────────────────── */
  return (
    <ScanSequence
      domain={domain}
      scanStatus={status}
      progress={progress}
      completedModules={completedModules}
      isCached={isCached}
      isFirstScan={isFirstScan}
      finalScore={marketingIq}
      finalScoreLabel={scoreLabel}
      moduleCount={completedModules.length}
      onComplete={handleSequenceComplete}
      userName={userName}
    />
  );
}
