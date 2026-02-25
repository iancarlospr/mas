'use client';

import { useState } from 'react';

/**
 * GhostScan OS — Partial Results Banner
 * ═══════════════════════════════════════════
 *
 * WHAT: Dismissible warning when a scan completes with some module errors.
 * WHY:  Transparency about data quality without panic (Plan Section 17).
 * HOW:  Bevel-raised warning banner with retro styling, dismiss button.
 */

interface PartialResultsProps {
  errorCount: number;
}

export function PartialResults({ errorCount }: PartialResultsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bevel-raised bg-gs-warning/10 px-gs-4 py-gs-3 flex items-center justify-between">
      <p className="font-data text-data-sm text-gs-muted">
        Most of the scan went fine but{' '}
        <strong className="text-gs-warning">
          {errorCount} module{errorCount !== 1 ? 's' : ''}
        </strong>{' '}
        ghosted us. Showing what I found. MarketingIQ is based on available data.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="bevel-button text-os-xs ml-gs-4 flex-shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
