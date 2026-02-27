'use client';

import { HeroScanFlow } from '@/components/scan/hero-scan-flow';

/* ═══════════════════════════════════════════════════════════════
   Scan.exe — URL Input Dialog Window

   ASCII banner title + scan URL input.
   ═══════════════════════════════════════════════════════════════ */

const ASCII_TITLE = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗ ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

export default function ScanInputWindow() {
  return (
    <div className="p-gs-4">
      {/* ASCII Title */}
      <div className="flex justify-center mb-gs-4">
        <pre
          className="font-data leading-none whitespace-pre select-none text-center"
          style={{
            fontSize: '5.5px',
            lineHeight: '1.1',
            color: 'var(--gs-base)',
            textShadow: '0 0 6px var(--gs-base), 0 0 15px rgba(255,178,239,0.3)',
          }}
        >
          {ASCII_TITLE}
        </pre>
      </div>

      <HeroScanFlow />
    </div>
  );
}
