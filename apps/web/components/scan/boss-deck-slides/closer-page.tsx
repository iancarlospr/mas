/**
 * Boss Deck — Closer Page (Page 7)
 * Full-bleed horizon image, ASCII brand, score display, seal SVG, dither.
 */

import type { BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import { formatDate } from './helpers';
import { GrainCanvas } from './grain-canvas';

const ASCII_BRAND = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

// ── Bayer 8x8 dither as inline SVG ─────────────────────────

function DitherSVG() {
  const BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];

  const cols = 300;
  const rows = 20;
  const rects: React.ReactNode[] = [];
  const r = 59, g = 130, b = 246;

  for (let y = 0; y < rows; y++) {
    const yRatio = y / rows;
    const vDensity = Math.min(0.35, Math.pow(yRatio, 2));
    for (let x = 0; x < cols; x++) {
      const xRatio = x / cols;
      const hFade = Math.sin(xRatio * Math.PI);
      const intensity = vDensity * hFade * 0.5;
      const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
      if (intensity > threshold) {
        const alpha = Math.round(intensity * 0.6 * 100) / 100;
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={`rgba(${r},${g},${b},${alpha})`} />);
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' as const }}>
      {rects}
    </svg>
  );
}

// ── Verification seal SVG ───────────────────────────────────

function SealSVG({ score }: { score: number | null }) {
  const s = 120, cx = 60, cy = 60;
  const bl = 'rgba(59,130,246,';

  const dots: React.ReactNode[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = ((i * 15) - 90) * Math.PI / 180;
    const x = cx + 54 * Math.cos(angle);
    const y = cy + 54 * Math.sin(angle);
    const r = i % 3 === 0 ? 2 : 1;
    dots.push(<circle key={`d${i}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r} fill={`${bl}${r > 1 ? '0.5' : '0.25'})`} />);
  }

  const diamonds: React.ReactNode[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = ((i * 45) - 90) * Math.PI / 180;
    const x = cx + 57 * Math.cos(angle);
    const y = cy + 57 * Math.sin(angle);
    diamonds.push(
      <path key={`dm${i}`} d={`M ${x.toFixed(1)} ${(y - 2.5).toFixed(1)} L ${(x + 1).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + 2.5).toFixed(1)} L ${(x - 1).toFixed(1)} ${y.toFixed(1)} Z`} fill={`${bl}0.4)`} />
    );
  }

  return (
    <svg viewBox={`0 0 ${s} ${s}`} style={{ width: '100%', height: '100%' }}>
      <circle cx={cx} cy={cy} r={56} fill="none" stroke={`${bl}0.35)`} strokeWidth="1.2" />
      {dots}
      {diamonds}
      <circle cx={cx} cy={cy} r={44} fill="none" stroke={`${bl}0.18)`} strokeWidth="0.5" strokeDasharray="3 3" />
      <circle cx={cx} cy={cy} r={40} fill="none" stroke={`${bl}0.12)`} strokeWidth="0.5" />
      <text x={cx} y={cy - 18} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '6.5px', fontFamily: "'Sora',sans-serif", fill: `${bl}0.55)`, letterSpacing: '2.5px' }}>ALPHASCAN</text>
      <line x1={cx - 22} y1={cy - 10} x2={cx + 22} y2={cy - 10} stroke={`${bl}0.2)`} strokeWidth="0.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '11px', fontFamily: "'Sora',sans-serif", fontWeight: 700, fill: `${bl}0.65)`, letterSpacing: '2px' }}>VERIFIED</text>
      <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '7px', fontFamily: "'Sora',sans-serif", fill: `${bl}0.45)`, letterSpacing: '3px' }}>AUDIT</text>
      <line x1={cx - 22} y1={cy + 21} x2={cx + 22} y2={cy + 21} stroke={`${bl}0.2)`} strokeWidth="0.5" />
      {score != null && (
        <text x={cx} y={cy + 32} textAnchor="middle" dominantBaseline="central" style={{ fontSize: '9px', fontFamily: "'Sora',sans-serif", fontWeight: 700, fill: `${bl}0.5)`, letterSpacing: '1px' }}>MIQ {score}</text>
      )}
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────

export function CloserPage({ ctx }: { ctx: BossDeckRenderContext }) {
  const score = ctx.marketingIQ;
  const label = ctx.marketingIQLabel ?? '';
  const scoreColor = score != null && score >= 70 ? '#22C55E' : score != null && score >= 40 ? '#EAB308' : '#EF4444';
  const dateFmt = formatDate(ctx.scanDate);

  return (
    <>
      {/* Layer 0: Horizon image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="closer-bg" src={ctx.closerImageDataUri ?? '/boss-deck/hero-horizon.jpg'} alt="" />

      {/* Layer 1: Deep gradient overlay */}
      <div className="closer-plasma" />

      {/* Layer 2: Radial color glows */}
      <div className="closer-glow-blue" />
      <div className="closer-glow-gold" />
      <div className="closer-glow-center" />
      <div className="closer-glow-top" />

      {/* Layer 3: Noise grain */}
      <GrainCanvas opacity={0.12} className="closer-grain" />

      {/* Layer 4: Vignette */}
      <div className="closer-vignette" />

      {/* Layer 5: Gold accent lines */}
      <div className="closer-line-top" />
      <div className="closer-line-bottom" />

      {/* Centered vertical stack */}
      <div className="closer-stack">
        <pre className="closer-ascii">{ASCII_BRAND}</pre>
        <div className="closer-subtitle">Marketing Technology Audit</div>
        <div className="closer-rule" />
        <h2 className="closer-domain-name">{ctx.domain}</h2>

        {score != null && (
          <>
            <div className="closer-score-num" style={{ color: scoreColor, filter: `drop-shadow(0 0 20px ${scoreColor}30)` }}>{score}</div>
            <div className="closer-score-sub">MARKETINGIQ&trade;</div>
            <div className="closer-score-label" style={{ color: scoreColor }}>{label}</div>
          </>
        )}

        <div className="closer-rule" />
        <div className="closer-meta">{dateFmt}</div>
        <p className="closer-signoff">Now you know.</p>
      </div>

      {/* Footer */}
      <div className="closer-footer-text">
        <span>Automated MarTech Assessment &middot; AlphaScan</span>
      </div>

      {/* Verification seal */}
      {score != null && (
        <div className="closer-seal"><SealSVG score={score} /></div>
      )}

      {/* Bayer dither strip */}
      <div className="closer-dither"><DitherSVG /></div>
    </>
  );
}
