'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import { getMarketingIQLabel } from '@marketing-alpha/types';
import { ScoreGauge } from './score-gauge';
import { cn } from '@/lib/utils';

/**
 * GhostScan Mobile — Score Hero Card
 * Compact horizontal layout: ScoreGauge(sm) beside MarketingIQ label + domain + date.
 */
export function MobileScoreHero({ scan }: { scan: ScanWithResults }) {
  const score = scan.marketingIq;
  const label = score != null ? getMarketingIQLabel(score) : 'Unavailable';

  return (
    <div className="px-gs-3 py-gs-3">
      <div className="bevel-sunken bg-gs-paper p-gs-3 flex items-center gap-gs-3">
        <ScoreGauge score={score ?? 0} size="sm" animate />
        <div className="flex-1 min-w-0">
          <div className="font-system text-os-xs text-gs-muted">MarketingIQ™</div>
          <div
            className={cn(
              'font-data text-data-lg font-bold',
              score != null && score >= 70
                ? 'text-gs-terminal'
                : score != null && score >= 40
                  ? 'text-gs-warning'
                  : 'text-gs-critical',
            )}
          >
            {score ?? '--'} — {label}
          </div>
          <div className="font-data text-data-xs text-gs-muted mt-gs-1 truncate">
            {scan.domain} — {new Date(scan.createdAt).toLocaleDateString()}
          </div>
          <div className="font-data text-data-xs text-gs-muted">
            {scan.tier === 'paid' ? scan.moduleResults.filter((r) => r.status === 'success' || r.status === 'partial').length : 3} modules completed
          </div>
        </div>
      </div>
    </div>
  );
}
