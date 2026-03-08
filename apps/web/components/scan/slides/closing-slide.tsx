'use client';

import { useRef, useEffect } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { getMarketingIQLabel } from '@marketing-alpha/types';

/**
 * Closing Slide — The Back Cover
 * ═══════════════════════════════
 *
 * McKinsey meets Mean Girls. Maximum brand confidence, minimal content.
 * Centered vertical stack: logo bloom → domain → final grade → sign-off.
 *
 * The ASCII brand gets its most intense glow of the entire deck (4-layer
 * text-shadow bloom). "Now you know." in Permanent Marker is Chloe's
 * mic-drop sign-off. Bayer dither at bottom mirrors the title slide
 * (bookend effect).
 *
 * Shows for all tiers — every audit deserves a proper ending.
 */

const ASCII_BRAND = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

// ── Typography scale (cqi) — 12px minimum ───────────────────────────
const T = {
  brand:      'clamp(5px, 0.72cqi, 8px)',
  subtitle:   'clamp(12px, 1.3cqi, 15px)',
  domain:     'clamp(30px, 4.5cqi, 58px)',
  scoreNum:   'clamp(40px, 6.5cqi, 80px)',
  scoreSub:   'clamp(12px, 1.2cqi, 14px)',
  scoreLabel: 'clamp(14px, 1.6cqi, 18px)',
  meta:       'clamp(12px, 1.2cqi, 14px)',
  signoff:    'clamp(20px, 2.8cqi, 34px)',
  footer:     'clamp(12px, 1.1cqi, 13px)',
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--gs-terminal)';
  if (score >= 40) return 'var(--gs-warning)';
  return 'var(--gs-critical)';
}

export function ClosingSlide({ scan }: { scan: ScanWithResults }) {
  const ditherRef = useRef<HTMLCanvasElement>(null);
  const ditherContainerRef = useRef<HTMLDivElement>(null);

  // Bayer 8x8 dither strip — mirrors title slide (bookend)
  useEffect(() => {
    const canvas = ditherRef.current;
    const container = ditherContainerRef.current;
    if (!canvas || !container) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;

    const px = 2;
    const cols = Math.ceil(w / px);
    const rows = Math.ceil(h / px);

    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(cols, rows);
    const d = imageData.data;
    const pr = 255, pg = 178, pb = 239;

    for (let y = 0; y < rows; y++) {
      const yRatio = y / rows;
      // Fades upward from bottom (denser at bottom)
      const vDensity = Math.min(0.35, Math.pow(yRatio, 2));
      for (let x = 0; x < cols; x++) {
        const xRatio = x / cols;
        // Symmetrical fade from center outward
        const hFade = Math.sin(xRatio * Math.PI);
        const intensity = vDensity * hFade * 0.5;
        const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
        const idx = (y * cols + x) * 4;
        if (intensity > threshold) {
          d[idx] = pr;
          d[idx + 1] = pg;
          d[idx + 2] = pb;
          d[idx + 3] = Math.round(intensity * 255 * 0.6);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  const score = scan.marketingIq;
  const label = score != null ? getMarketingIQLabel(score) : null;
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;
  const scanDate = new Date(scan.createdAt);
  const dateStr = scanDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      style={{
        aspectRatio: '14 / 8.5',
        background: 'var(--gs-void)',
        borderRadius: '2px',
        containerType: 'inline-size',
      }}
    >
      {/* Radial glow — centered, most intense in the deck */}
      <div className="absolute pointer-events-none" style={{
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', height: '90%',
        background: 'radial-gradient(ellipse at center, rgba(255,178,239,0.09) 0%, rgba(255,178,239,0.03) 40%, transparent 70%)',
      }} />

      {/* Secondary glow — behind score area */}
      <div className="absolute pointer-events-none" style={{
        top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(255,178,239,0.06) 0%, transparent 60%)',
      }} />

      {/* ═══ Centered vertical stack ═══ */}
      <div
        className="relative z-10 h-full flex flex-col items-center justify-center"
        style={{ padding: '2% 5% 0' }}
      >
        {/* ASCII Brand — 4-layer bloom glow (most intense in the deck) */}
        <pre
          className="font-data leading-none whitespace-pre select-none"
          style={{
            fontSize: T.brand,
            lineHeight: '1.1',
            color: 'var(--gs-base)',
            textShadow: [
              '0 0 12px rgba(255,178,239,0.4)',
              '0 0 30px rgba(255,178,239,0.2)',
              '0 0 60px rgba(255,178,239,0.1)',
              '0 0 120px rgba(255,178,239,0.05)',
            ].join(', '),
            marginBottom: '0.5em',
          }}
        >
          {ASCII_BRAND}
        </pre>

        {/* Subtitle */}
        <div className="font-data uppercase" style={{
          fontSize: T.subtitle,
          letterSpacing: '0.25em',
          color: 'var(--gs-mid)',
          marginBottom: '1.5em',
        }}>
          Marketing Technology Audit
        </div>

        {/* Glowing divider */}
        <div style={{
          width: '30%', height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(255,178,239,0.35), transparent)',
          boxShadow: '0 0 10px rgba(255,178,239,0.12)',
          marginBottom: '1.3em',
        }} />

        {/* Domain — the case file subject */}
        <h2 className="font-display uppercase" style={{
          fontSize: T.domain,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--gs-light)',
          lineHeight: 1,
          marginBottom: '0.5em',
        }}>
          {scan.domain}
        </h2>

        {/* MarketingIQ — the final grade */}
        {score != null && (
          <div style={{ textAlign: 'center', marginBottom: '0.3em' }}>
            <span
              className="font-data tabular-nums"
              style={{
                fontSize: T.scoreNum,
                fontWeight: 700,
                lineHeight: 0.9,
                color: getScoreColor(score),
                filter: `drop-shadow(0 0 20px ${score >= 70 ? 'rgba(0,255,136,0.15)' : score >= 40 ? 'rgba(255,200,0,0.15)' : 'rgba(255,80,80,0.15)'})`,
              }}
            >
              {score}
            </span>
          </div>
        )}
        <div className="font-data uppercase" style={{
          fontSize: T.scoreSub,
          letterSpacing: '0.2em',
          color: 'var(--gs-mid)',
          marginBottom: '0.15em',
        }}>
          MarketingIQ&trade;
        </div>
        {label && (
          <div className="font-display" style={{
            fontSize: T.scoreLabel,
            fontWeight: 300,
            letterSpacing: '0.08em',
            color: score != null ? getScoreColor(score) : 'var(--gs-mid)',
            marginBottom: '1.3em',
          }}>
            {label}
          </div>
        )}

        {/* Glowing divider */}
        <div style={{
          width: '30%', height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(255,178,239,0.35), transparent)',
          boxShadow: '0 0 10px rgba(255,178,239,0.12)',
          marginBottom: '1em',
        }} />

        {/* Date + module count */}
        <div className="font-data" style={{
          fontSize: T.meta,
          color: 'var(--gs-mid)',
          letterSpacing: '0.12em',
          marginBottom: '1.2em',
        }}>
          {dateStr} &middot; {moduleCount} modules analyzed
        </div>

        {/* Sign-off — Permanent Marker (Chloe's mic drop) */}
        <p className="font-marker" style={{
          fontSize: T.signoff,
          color: 'var(--gs-base)',
          textShadow: '0 0 16px rgba(255,178,239,0.25), 0 0 40px rgba(255,178,239,0.08)',
          lineHeight: 1,
        }}>
          Now you know.
        </p>
      </div>

      {/* Footer — above dither */}
      <div className="absolute left-0 right-0 z-10" style={{
        bottom: 'clamp(18px, 3cqi, 34px)',
        textAlign: 'center',
      }}>
        <p className="font-data uppercase" style={{
          fontSize: T.footer,
          letterSpacing: '0.2em',
          color: 'var(--gs-mid)',
          opacity: 0.35,
        }}>
          Automated MarTech Assessment &middot; alphascan.pro
        </p>
      </div>

      {/* Verification seal — bottom right, notary/diploma style */}
      <div className="absolute z-10 pointer-events-none" style={{
        bottom: 'clamp(28px, 5cqi, 60px)',
        right: 'clamp(20px, 4cqi, 50px)',
        width: 'clamp(70px, 11cqi, 130px)',
        aspectRatio: '1',
        opacity: 0.5,
        filter: 'drop-shadow(0 0 10px rgba(255,178,239,0.12))',
      }}>
        <AuditSeal score={score} />
      </div>

      {/* Bayer dither strip — bottom edge (bookend with title slide) */}
      <div
        ref={ditherContainerRef}
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '50px', zIndex: 5 }}
      >
        <canvas ref={ditherRef} />
      </div>
    </div>
  );
}

/* ── Verification Seal — notary/diploma style SVG ── */

function AuditSeal({ score }: { score: number | null }) {
  const s = 120;
  const cx = s / 2;
  const cy = s / 2;

  // 24 dots around the rosette perimeter
  const dots = Array.from({ length: 24 }, (_, i) => {
    const angle = ((i * 15) - 90) * Math.PI / 180;
    return {
      x: cx + 54 * Math.cos(angle),
      y: cy + 54 * Math.sin(angle),
      r: i % 3 === 0 ? 2 : 1,
    };
  });

  // 8 diamond accent points
  const diamonds = Array.from({ length: 8 }, (_, i) => {
    const angle = ((i * 45) - 90) * Math.PI / 180;
    return {
      x: cx + 57 * Math.cos(angle),
      y: cy + 57 * Math.sin(angle),
    };
  });

  const pk = 'rgba(255,178,239,';

  return (
    <svg viewBox={`0 0 ${s} ${s}`} className="w-full h-full">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={56} fill="none" stroke={`${pk}0.35)`} strokeWidth="1.2" />

      {/* Rosette dots */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`${pk}${d.r > 1 ? '0.5' : '0.25'})`} />
      ))}

      {/* Diamond accent points */}
      {diamonds.map((p, i) => (
        <path
          key={`d-${i}`}
          d={`M ${p.x} ${p.y - 2.5} L ${p.x + 1} ${p.y} L ${p.x} ${p.y + 2.5} L ${p.x - 1} ${p.y} Z`}
          fill={`${pk}0.4)`}
        />
      ))}

      {/* Inner dashed ring */}
      <circle cx={cx} cy={cy} r={44} fill="none" stroke={`${pk}0.18)`} strokeWidth="0.5" strokeDasharray="3 3" />

      {/* Inner decorative ring */}
      <circle cx={cx} cy={cy} r={40} fill="none" stroke={`${pk}0.12)`} strokeWidth="0.5" />

      {/* ALPHASCAN */}
      <text
        x={cx} y={cy - 18}
        textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: '6.5px', fontFamily: 'var(--font-data)', fill: `${pk}0.55)`, letterSpacing: '2.5px' }}
      >
        ALPHASCAN
      </text>

      {/* Rule */}
      <line x1={cx - 22} y1={cy - 10} x2={cx + 22} y2={cy - 10} stroke={`${pk}0.2)`} strokeWidth="0.5" />

      {/* VERIFIED */}
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: '11px', fontFamily: 'var(--font-display-face)', fontWeight: 700, fill: `${pk}0.65)`, letterSpacing: '2px' }}
      >
        VERIFIED
      </text>

      {/* AUDIT */}
      <text
        x={cx} y={cy + 13}
        textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: '7px', fontFamily: 'var(--font-data)', fill: `${pk}0.45)`, letterSpacing: '3px' }}
      >
        AUDIT
      </text>

      {/* Rule */}
      <line x1={cx - 22} y1={cy + 21} x2={cx + 22} y2={cy + 21} stroke={`${pk}0.2)`} strokeWidth="0.5" />

      {/* Score stamp */}
      {score != null ? (
        <text
          x={cx} y={cy + 32}
          textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: '9px', fontFamily: 'var(--font-data)', fontWeight: 700, fill: `${pk}0.5)`, letterSpacing: '1px' }}
        >
          MIQ {score}
        </text>
      ) : (
        <path
          d={`M ${cx - 6} ${cy + 30} L ${cx - 1} ${cy + 35} L ${cx + 8} ${cy + 25}`}
          fill="none" stroke={`${pk}0.5)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
