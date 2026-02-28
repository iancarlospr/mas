'use client';

import { useEffect, useRef } from 'react';
import { HeroScanFlow } from '@/components/scan/hero-scan-flow';

/* ═══════════════════════════════════════════════════════════════
   Scan.exe — URL Input Dialog Window

   ASCII banner title + scan URL input.
   ═══════════════════════════════════════════════════════════════ */

const ASCII_TITLE = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

function CurvedArrow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      if (!ref.current) return;
      frame++;
      const y = Math.sin(frame * 0.08) * 6;
      ref.current.style.transform = `translateY(${y}px)`;
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={ref} className="font-marker select-none" style={{ marginTop: '24px' }}>
      <span
        style={{
          fontSize: '52px',
          color: 'var(--gs-base)',
          display: 'block',
          lineHeight: '0.7',
        }}
      >
        &#8595;
      </span>
    </div>
  );
}

export default function ScanInputWindow() {
  return (
    <div className="p-gs-4 flex flex-col items-center">
      {/* ASCII Title */}
      <div className="flex justify-center" style={{ marginTop: '8px' }}>
        <pre
          className="font-data leading-none whitespace-pre select-none text-center"
          style={{
            fontSize: '12px',
            lineHeight: '1.05',
            color: 'var(--gs-base)',
            textShadow: '0 0 8px var(--gs-base), 0 0 20px rgba(255,178,239,0.3)',
          }}
        >
          {ASCII_TITLE}
        </pre>
      </div>

      {/* Headline */}
      <div className="text-center select-none" style={{ marginTop: '24px' }}>
        <p
          className="font-display"
          style={{
            fontSize: '26px',
            fontWeight: 300,
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
            color: 'var(--gs-light)',
          }}
        >
          Babe, your website is losing you money.
        </p>
        <p
          className="font-marker"
          style={{
            fontSize: '32px',
            lineHeight: '1.2',
            color: 'var(--gs-base)',
            marginTop: '6px',
          }}
        >
          Let&apos;s fix that.
        </p>
      </div>

      {/* Nudge CTA + Arrow */}
      <div className="flex flex-col items-center select-none" style={{ marginTop: '180px', marginBottom: '20px' }}>
        <p
          className="font-data"
          style={{
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--gs-mid)',
          }}
        >
          one scan. no consultants. no bs.
        </p>
        <CurvedArrow />
      </div>

      <div className="w-full">
        <HeroScanFlow />
      </div>
    </div>
  );
}
