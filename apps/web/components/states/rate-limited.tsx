import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Rate Limited State
 * ═══════════════════════════════════════
 *
 * WHAT: Shown when user hits the 4-scan-per-day limit.
 * WHY:  Chloe enforces limits with personality, not apologies
 *       (Plan Section 17).
 * HOW:  Chloe smug sprite, usage counter, retro dialog styling.
 */

interface RateLimitedProps {
  used: number;
  limit: number;
  isAuthenticated: boolean;
}

export function RateLimited({ used, limit, isAuthenticated }: RateLimitedProps) {
  return (
    <div className="max-w-md mx-auto text-center bevel-raised bg-gs-light p-gs-8">
      <ChloeSprite state="smug" size={64} className="mx-auto mb-gs-4" />

      <h2 className="font-system text-os-lg font-bold text-gs-black mb-gs-2">
        Daily Limit Reached
      </h2>

      <div className="bevel-sunken bg-gs-near-white px-gs-4 py-gs-2 inline-block mb-gs-4">
        <span className="font-data text-data-lg font-bold text-gs-critical">
          {used}/{limit}
        </span>
        <span className="font-data text-data-xs text-gs-mid ml-gs-2">
          scans used today
        </span>
      </div>

      <p className="font-data text-data-sm text-gs-mid mb-gs-4">
        4 scans a day. You&apos;re out. Come back tomorrow.
      </p>

      {!isAuthenticated && (
        <Link href="/register" className="bevel-button-primary text-os-sm">
          Register for More Scans
        </Link>
      )}
    </div>
  );
}
