'use client';

import { useRef, useEffect } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { getMarketingIQLabel } from '@marketing-alpha/types';

/**
 * Verdict Slide — Psychedelic Hero Quote
 * ═══════════════════════════════════════
 *
 * Slide 2. Full-bleed animated plasma background with the M42 verdict
 * headline massive and centered. Breaks from the clean dark slides
 * around it — meant to punch.
 *
 * Paid: M42 verdict_headline in curly quotes
 * Free: "MarketingIQ: {score} — {label}"
 */

interface VerdictSlideProps {
  scan: ScanWithResults;
}

export function VerdictSlide({ scan }: VerdictSlideProps) {
  const isPaid = scan.tier === 'paid';
  const score = scan.marketingIq;
  const label = score != null ? getMarketingIQLabel(score) : null;

  // M42 verdict headline
  const resultMap = new Map<string, ModuleResult>(
    scan.moduleResults.map((r) => [r.moduleId, r]),
  );
  const m42 = resultMap.get('M42');
  const synthesis = isPaid
    ? (m42?.data?.['synthesis'] as { verdict_headline?: string } | undefined)
    : null;
  const headline = synthesis?.verdict_headline ?? null;

  // Display text
  const displayText = headline
    ?? (score != null && label ? `MarketingIQ: ${score} — ${label}` : null);

  if (!displayText) return null;

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      style={{
        aspectRatio: '14 / 8.5',
        borderRadius: '2px',
        containerType: 'inline-size',
      }}
    >
      {/* Layer 1: Animated plasma */}
      <PlasmaCanvas />

      {/* Layer 2: Noise grain to break up color banding */}
      <svg className="absolute" width="0" height="0" aria-hidden="true">
        <filter id="verdict-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          filter: 'url(#verdict-noise)',
          opacity: 0.12,
          zIndex: 2,
        }}
      />

      {/* Layer 3: Vignette — dark edges, readable center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 0%, rgba(8,8,8,0.25) 55%, rgba(8,8,8,0.7) 100%)',
          zIndex: 3,
        }}
      />

      {/* Layer 4: Content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ zIndex: 4, padding: '2% 8%' }}
      >
        {/* Overline */}
        <p
          className="font-display uppercase"
          style={{
            fontSize: 'clamp(12px, 1.3cqi, 15px)',
            letterSpacing: '0.3em',
            color: 'var(--gs-base)',
            marginBottom: '0.8em',
            textShadow: '0 0 20px rgba(255,178,239,0.4)',
          }}
        >
          AlphaScan Verdict by Prof G.
        </p>

        {/* Headline */}
        <h2
          className="font-display"
          style={{
            fontSize: 'clamp(28px, 5cqi, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#fff',
            textShadow: '0 0 40px rgba(255,178,239,0.35), 0 0 80px rgba(255,178,239,0.15), 0 2px 4px rgba(0,0,0,0.5)',
            maxWidth: '85%',
          }}
        >
          &ldquo;{displayText}&rdquo;
        </h2>

        {/* Attribution */}
        <p
          className="font-data"
          style={{
            fontSize: 'clamp(12px, 1.3cqi, 15px)',
            color: 'rgba(255,255,255,0.45)',
            marginTop: '1.2em',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          — Scott &ldquo;YT Professor, The Most Relevant Person in Marketing, Best-Selling Author, and with More Followers Than Your CMO&rdquo;
        </p>
      </div>
    </div>
  );
}

// ── Animated Plasma Background ────────────────────────────────────────

function PlasmaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const PX = 2; // 2px blocks — small enough that blur dissolves them
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;

    function resize() {
      w = container!.offsetWidth;
      h = container!.offsetHeight;
      cols = Math.ceil(w / PX);
      rows = Math.ceil(h / PX);
      canvas!.width = cols;
      canvas!.height = rows;
      canvas!.style.width = w + 'px';
      canvas!.style.height = h + 'px';
    }

    resize();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(cols, rows);
    const buf = imageData.data;

    function draw() {
      timeRef.current += 0.008;
      const t = timeRef.current;

      for (let y = 0; y < rows; y++) {
        const ny = y / rows;
        for (let x = 0; x < cols; x++) {
          const nx = x / cols;
          const idx = (y * cols + x) * 4;

          // 4 sine interference waves at different frequencies + phases
          const v1 = Math.sin(nx * 6.0 + t * 1.2);
          const v2 = Math.sin(ny * 8.0 - t * 0.9 + nx * 3.0);
          const v3 = Math.sin((nx + ny) * 5.0 + t * 0.7);
          const v4 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 12.0 - t * 1.5);

          const v = (v1 + v2 + v3 + v4) / 4.0; // -1 to 1

          // Pink(330) → purple(280) → magenta(310) → violet(270)
          const hue = 300 + v * 40 + Math.sin(t * 0.4) * 30;
          const sat = 65 + v * 25;
          const lit = 18 + v * 15 + Math.sin(nx * 4 + t) * 5;

          // HSL to RGB inline (avoid function call overhead per pixel)
          const h2 = ((hue % 360) + 360) % 360;
          const s2 = sat / 100;
          const l2 = lit / 100;
          const c = (1 - Math.abs(2 * l2 - 1)) * s2;
          const x2 = c * (1 - Math.abs(((h2 / 60) % 2) - 1));
          const m = l2 - c / 2;
          let r1: number, g1: number, b1: number;

          if (h2 < 60) { r1 = c; g1 = x2; b1 = 0; }
          else if (h2 < 120) { r1 = x2; g1 = c; b1 = 0; }
          else if (h2 < 180) { r1 = 0; g1 = c; b1 = x2; }
          else if (h2 < 240) { r1 = 0; g1 = x2; b1 = c; }
          else if (h2 < 300) { r1 = x2; g1 = 0; b1 = c; }
          else { r1 = c; g1 = 0; b1 = x2; }

          // Dither: add ±1.5 random noise per channel to break 8-bit banding
          const d = () => (Math.random() - 0.5) * 3;
          buf[idx]     = Math.max(0, Math.min(255, Math.round((r1 + m) * 255 + d())));
          buf[idx + 1] = Math.max(0, Math.min(255, Math.round((g1 + m) * 255 + d())));
          buf[idx + 2] = Math.max(0, Math.min(255, Math.round((b1 + m) * 255 + d())));
          buf[idx + 3] = 255;
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 1 }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', filter: 'blur(16px)', transform: 'scale(1.1)' }}
      />
    </div>
  );
}
