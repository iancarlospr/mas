import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Scan Failed State
 * ═══════════════════════════════════
 *
 * WHAT: Error state when a scan can't reach the target domain.
 * WHY:  Every error is a Chloe personality moment — no generic
 *       "Something went wrong" messages (Plan Section 17).
 * HOW:  Chloe critical sprite, personality copy, bevel error dialog,
 *       retry CTA.
 */

interface ScanFailedProps {
  domain: string;
  error?: string;
  scanId: string;
}

export function ScanFailed({ domain, error, scanId }: ScanFailedProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-gs-8">
      <ChloeSprite state="critical" size={64} glowing className="mx-auto mb-gs-6" />

      <h2 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
        Scan Hit a Wall
      </h2>
      <p className="font-data text-data-sm text-gs-muted mb-gs-6">
        <strong className="text-gs-red">{domain}</strong> is either down
        or blocking me. Not personal — some sites are like that.
      </p>

      <Link
        href="/"
        className="bevel-button-primary text-os-sm"
      >
        Scan a Different URL
      </Link>

      {error && (
        <div className="mt-gs-6 bevel-sunken bg-gs-paper p-gs-3">
          <p className="font-data text-data-xs text-gs-muted">Error: {error}</p>
          <p className="font-data text-data-xs text-gs-muted">Scan ID: {scanId}</p>
        </div>
      )}
    </div>
  );
}
