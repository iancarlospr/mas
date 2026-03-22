'use client';

import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Dashboard Error Boundary
 * ═══════════════════════════════════════════════
 *
 * WHAT: Error fallback for dashboard pages.
 * WHY:  Even crashes get the Chloé treatment (Plan Section 17).
 * HOW:  Chloé critical sprite, retro error dialog, retry + escape buttons.
 */

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-gs-16">
      <ChloeSprite state="critical" size={64} glowing className="mb-gs-6" />

      <h1 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
        Something Broke
      </h1>
      <p className="font-data text-data-sm text-gs-muted max-w-md text-center mb-gs-4">
        An error occurred while loading this page. Not my fault.
      </p>

      {error.digest && (
        <p className="font-data text-data-xs text-gs-muted mb-gs-6">
          Error ID: {error.digest}
        </p>
      )}

      <div className="flex gap-gs-4">
        <button onClick={reset} className="bevel-button-primary text-os-sm">
          Try Again
        </button>
        <Link href="/history" className="bevel-button text-os-sm">
          My Scans
        </Link>
      </div>
    </div>
  );
}
