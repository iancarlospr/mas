import { ScanInput } from '@/components/scan/scan-input';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Empty State
 * ═══════════════════════════════
 *
 * WHAT: Shown when user has no scans yet (history page, dashboard).
 * WHY:  Chloe invites them to start — not a generic "no data" card
 *       (Plan Section 17).
 * HOW:  Chloe idle sprite, personality invitation, embedded scan input.
 */

export function EmptyState() {
  return (
    <div className="max-w-lg mx-auto text-center py-gs-12">
      <ChloeSprite state="idle" size={64} glowing className="mx-auto mb-gs-6" />

      <h2 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
        Nothing here yet
      </h2>
      <p className="font-data text-data-sm text-gs-muted mb-gs-8">
        Drop a URL to wake me up. I&apos;ll extract the ground truth.
      </p>

      <ScanInput variant="inline" />
    </div>
  );
}
