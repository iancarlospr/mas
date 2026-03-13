import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ScanInput } from '@/components/scan/scan-input';
import { AutoScanTrigger } from '@/components/scan/auto-scan-trigger';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';

/**
 * GhostScan OS — Scan History (My Scans Folder)
 * ═══════════════════════════════════════════════════
 *
 * WHAT: Past scans displayed as a file-explorer folder window.
 * WHY:  History should feel like browsing files on the OS desktop —
 *       each scan is a "file" with domain, date, score, tier badge
 *       (Plan Section 18).
 * HOW:  Bevel-raised card with file-list rows, favicon placeholders,
 *       traffic light scores, tier badges. Chloe empty state.
 */

export const metadata: Metadata = { title: 'My Scans' };

function getScoreColor(score: number | null): string {
  if (score == null) return 'text-gs-muted';
  if (score >= 70) return 'text-gs-terminal';
  if (score >= 40) return 'text-gs-warning';
  return 'text-gs-critical';
}

function getTrafficDot(score: number | null): string {
  if (score == null) return 'bg-gs-muted';
  if (score >= 70) return 'bg-gs-terminal';
  if (score >= 40) return 'bg-gs-warning';
  return 'bg-gs-critical';
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-gs-ink flex items-center justify-center">
        <div className="noise-grain" aria-hidden="true" />
        <div className="text-center">
          <ChloeSprite state="idle" size={64} glowing className="mx-auto mb-gs-4" />
          <h1 className="font-system text-os-lg font-bold text-gs-paper mb-gs-4">
            Authentication Required
          </h1>
          <Link href="/login" className="bevel-button-primary text-os-sm">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const { data: scans } = await supabase
    .from('scans')
    .select('id, domain, tier, status, marketing_iq, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!scans || scans.length === 0) {
    return (
      <div className="min-h-screen bg-gs-paper p-gs-8">
        <Suspense><AutoScanTrigger /></Suspense>
        <div className="max-w-lg mx-auto text-center py-gs-12">
          <ChloeSprite state="idle" size={64} glowing className="mx-auto mb-gs-6" />
          <h1 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
            No scans yet
          </h1>
          <p className="font-data text-data-sm text-gs-muted mb-gs-8">
            Drop a URL to wake me up. I&apos;ll extract the ground truth.
          </p>
          <ScanInput variant="inline" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gs-paper p-gs-4 md:p-gs-8">
      <Suspense><AutoScanTrigger /></Suspense>

      <div className="max-w-4xl mx-auto">
        {/* Window chrome */}
        <div className="bevel-raised bg-gs-chrome">
          {/* Title bar */}
          <div className="h-[28px] bg-gs-red flex items-center justify-between px-gs-3">
            <span className="font-system text-os-xs text-gs-ink font-bold">
              My Scans
            </span>
            <span className="font-system text-os-xs text-gs-ink">
              {scans.length} file{scans.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-gs-4 py-gs-2 border-b-2 border-gs-chrome bg-gs-chrome">
            <span className="font-system text-os-xs text-gs-muted flex-1">Domain</span>
            <span className="font-system text-os-xs text-gs-muted w-[80px] text-center">Score</span>
            <span className="font-system text-os-xs text-gs-muted w-[80px] text-center">Status</span>
            <span className="font-system text-os-xs text-gs-muted w-[60px] text-center">Tier</span>
            <span className="font-system text-os-xs text-gs-muted w-[100px] text-right">Date</span>
          </div>

          {/* File rows */}
          <div className="bg-gs-paper">
            {scans.map((scan, i) => (
              <Link
                key={scan.id}
                href={`/scan/${scan.id}`}
                className={cn(
                  'flex items-center px-gs-4 py-gs-3 hover:bg-gs-red/10 transition-colors',
                  i % 2 === 0 ? 'bg-gs-paper' : 'bg-gs-paper',
                )}
              >
                {/* Domain */}
                <div className="flex items-center gap-gs-2 flex-1 min-w-0">
                  <span className="text-[16px] flex-shrink-0">🌐</span>
                  <span className="font-data text-data-sm font-bold text-gs-ink truncate">
                    {scan.domain}
                  </span>
                </div>

                {/* Score */}
                <div className="w-[80px] flex items-center justify-center gap-gs-1">
                  {scan.marketing_iq != null ? (
                    <>
                      <span className={cn('w-[8px] h-[8px] rounded-full flex-shrink-0', getTrafficDot(scan.marketing_iq))} />
                      <span className={cn('font-data text-data-sm font-bold', getScoreColor(scan.marketing_iq))}>
                        {scan.marketing_iq}
                      </span>
                    </>
                  ) : (
                    <span className="font-data text-data-xs text-gs-muted">&mdash;</span>
                  )}
                </div>

                {/* Status */}
                <div className="w-[80px] text-center">
                  <span className={cn(
                    'bevel-sunken px-gs-2 py-gs-1 font-data text-data-xs inline-block',
                    scan.status === 'complete' ? 'bg-gs-terminal/10 text-gs-terminal' :
                    scan.status === 'failed' ? 'bg-gs-critical/10 text-gs-critical' :
                    'bg-gs-red/10 text-gs-red',
                  )}>
                    {scan.status}
                  </span>
                </div>

                {/* Tier */}
                <div className="w-[60px] text-center">
                  <span className={cn(
                    'font-data text-data-xs font-bold',
                    scan.tier === 'paid' ? 'text-gs-red' : 'text-gs-muted',
                  )}>
                    {scan.tier === 'paid' ? 'PRO' : 'FREE'}
                  </span>
                </div>

                {/* Date */}
                <span className="w-[100px] text-right font-data text-data-xs text-gs-muted">
                  {new Date(scan.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>

          {/* Status bar */}
          <div className="bevel-sunken bg-gs-chrome px-gs-4 py-gs-1 flex items-center justify-between">
            <span className="font-data text-data-xs text-gs-muted">
              {scans.length} scan{scans.length !== 1 ? 's' : ''}
            </span>
            <span className="font-data text-data-xs text-gs-muted">
              Double-click to open
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
