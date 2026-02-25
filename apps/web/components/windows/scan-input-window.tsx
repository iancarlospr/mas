'use client';

import { HeroScanFlow } from '@/components/scan/hero-scan-flow';

/* ═══════════════════════════════════════════════════════════════
   Scan.exe — URL Input Dialog Window

   Small dialog with scan URL input. Wraps HeroScanFlow.
   ═══════════════════════════════════════════════════════════════ */

export default function ScanInputWindow() {
  return (
    <div className="p-gs-4">
      <HeroScanFlow />
    </div>
  );
}
