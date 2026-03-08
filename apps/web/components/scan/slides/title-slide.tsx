'use client';

import { useRef, useEffect } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { getMarketingIQLabel } from '@marketing-alpha/types';

/**
 * Title Slide -- Report Cover Page
 * =================================
 *
 * Left 3/5: ASCII brand, domain headline, score label, meta pills.
 * Right 2/5: Score as architectural visual -- concentric arcs with
 * category scores forming a radial composition around the number.
 *
 * Uses report type scale (cqi) — document-grade sizing independent
 * of the app's OS-level text tokens.
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

// ── Report type scale (container-relative with fallback) ──────────────
const T = {
  brand:     'clamp(5px, 0.75cqi, 8px)',     // ASCII art
  subtitle:  'clamp(12px, 1.3cqi, 15px)',     // "Marketing Technology Audit"
  domain:    'clamp(36px, 5.5cqi, 68px)',     // Domain headline
  urlPath:   'clamp(12px, 1.3cqi, 15px)',     // Path below domain
  scoreLabel:'clamp(22px, 3.2cqi, 42px)',     // "Marketing Leader" etc
  metaLabel: 'clamp(12px, 1.2cqi, 14px)',     // Meta pill labels
  metaValue: 'clamp(12px, 1.3cqi, 14px)',     // Meta pill values
  scoreNum:  'clamp(60px, 10cqi, 130px)',     // Big score number
  scoreSub:  'clamp(12px, 1.2cqi, 14px)',     // "MarketingIQ" under score
  pending:   'clamp(14px, 1.8cqi, 20px)',     // "Pending" fallback
} as const;

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--gs-terminal)';
  if (score >= 40) return 'var(--gs-warning)';
  return 'var(--gs-critical)';
}

const CATEGORY_SHORT_LABELS: Record<string, string> = {
  seo_content: 'SEO',
  paid_media: 'PPC',
  martech_infrastructure: 'MarTech',
};

interface TitleSlideProps {
  scan: ScanWithResults;
}

export function TitleSlide({ scan }: TitleSlideProps) {
  const score = scan.marketingIq;
  const label = score != null ? getMarketingIQLabel(score) : null;
  const categories = scan.marketingIqResult?.categories ?? [];
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;
  const totalModules = scan.moduleResults.length;
  const isPaid = scan.tier === 'paid';

  const scanDate = new Date(scan.createdAt);
  const dateStr = scanDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = scanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Only show full URL if it has a meaningful path beyond the domain
  const urlPath = (() => {
    try {
      const u = new URL(scan.url.startsWith('http') ? scan.url : `https://${scan.url}`);
      const path = u.pathname === '/' ? '' : u.pathname;
      return path ? `${scan.domain}${path}` : '';
    } catch {
      return '';
    }
  })();

  // Build SVG arcs for the score ring
  const scorePercent = score != null ? score / 100 : 0;

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
      {/* Radial glow behind right panel */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '10%',
          right: '-5%',
          width: '55%',
          height: '80%',
          background: 'radial-gradient(ellipse at center, rgba(255,178,239,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Content grid */}
      <div className="relative z-10 h-full flex">

        {/* -- LEFT PANEL (3/5) -- */}
        <div
          className="flex flex-col"
          style={{ width: '58%', padding: '1.5% 3% 1.5% 3.5%' }}
        >
          {/* Top: Brand + subtitle tight together */}
          <div>
            <pre
              className="font-data leading-none whitespace-pre select-none"
              style={{
                fontSize: T.brand,
                lineHeight: '1.1',
                color: 'var(--gs-base)',
                textShadow: '0 0 12px rgba(255,178,239,0.25)',
                marginBottom: '0.6em',
              }}
            >
              {ASCII_BRAND}
            </pre>
            <div
              className="font-data uppercase"
              style={{
                fontSize: T.subtitle,
                letterSpacing: '0.2em',
                color: 'var(--gs-mid)',
              }}
            >
              Marketing Technology Audit
            </div>
          </div>

          {/* Center: Domain + score label -- vertically centered with the circle */}
          <div className="flex-1 flex flex-col justify-center">
            <h1
              className="font-display uppercase"
              style={{
                fontSize: T.domain,
                fontWeight: 600,
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                color: 'var(--gs-light)',
              }}
            >
              {scan.domain}
            </h1>

            {urlPath && (
              <p
                className="font-data truncate"
                style={{
                  fontSize: T.urlPath,
                  color: 'var(--gs-mid)',
                  marginTop: '0.5em',
                }}
              >
                {urlPath}
              </p>
            )}

            {label && (
              <div
                className="font-display uppercase"
                style={{
                  fontSize: T.scoreLabel,
                  fontWeight: 300,
                  letterSpacing: '0.1em',
                  color: score != null ? getScoreColor(score) : 'var(--gs-mid)',
                  lineHeight: 1.2,
                  marginTop: '0.6em',
                }}
              >
                {label}
              </div>
            )}
          </div>

          {/* Bottom: Meta row */}
          <div
            className="flex items-center flex-wrap"
            style={{ gap: '1.5em' }}
          >
            <MetaPill label="Date" value={dateStr} />
            <MetaPill label="Time" value={timeStr} />
            <MetaPill label="Modules" value={`${moduleCount} / ${totalModules}`} />
            <MetaPill
              label="Tier"
              value={isPaid ? 'Alpha' : 'Free'}
              accent={isPaid}
            />
          </div>
        </div>

        {/* -- RIGHT PANEL (2/5) -- */}
        <div
          className="flex items-center justify-center"
          style={{ width: '42%', padding: '1.5% 3.5% 1.5% 2%', overflow: 'visible' }}
        >
          <ScoreVisual
            score={score}
            scorePercent={scorePercent}
            categories={categories}
          />
        </div>
      </div>

      {/* Bayer dither strip along the bottom */}
      <DitherStrip />
    </div>
  );
}

/* -- Bayer 8x8 dither strip -- horizontal fade along bottom edge -- */

function DitherStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
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
    const data = imageData.data;

    // Pink: #FFB2EF
    const r = 255, g = 178, b = 239;

    for (let y = 0; y < rows; y++) {
      const yRatio = y / rows;
      // Ramps up toward the bottom, stays at cap — overflow:hidden clips the edge
      const vDensity = Math.min(0.35, Math.pow(yRatio, 2));

      for (let x = 0; x < cols; x++) {
        const xRatio = x / cols;
        const hFade = 1.0 - Math.pow(1.0 - xRatio, 1.4) * 0.85;

        const intensity = vDensity * hFade * 0.5;
        const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
        const idx = (y * cols + x) * 4;

        if (intensity > threshold) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = Math.round(intensity * 255 * 0.6);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{ height: '60px', zIndex: 5 }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

/* -- Score Visual: concentric arcs + number + category ticks -- */

function ScoreVisual({
  score,
  scorePercent,
  categories,
}: {
  score: number | null;
  scorePercent: number;
  categories: { category: string; score: number }[];
}) {
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const scoreColor = score != null ? getScoreColor(score) : 'var(--gs-mid)';

  // Ring order: SEO at 0, PPC at 3, MarTech at 6 → triangle (~120° apart)
  const RING_ORDER = [
    'seo_content',            // 0 — top
    'security_compliance',    // 1
    'analytics_measurement',  // 2
    'paid_media',             // 3 — lower-right
    'performance_experience', // 4
    'brand_presence',         // 5
    'martech_infrastructure', // 6 — left
    'market_intelligence',    // 7
  ];
  const ringIndex = (key: string) => {
    const idx = RING_ORDER.indexOf(key);
    return idx >= 0 ? idx : RING_ORDER.length;
  };
  const sortedCategories = [...categories].sort(
    (a, b) => ringIndex(a.category) - ringIndex(b.category),
  );

  // Arc helper: draws an arc from startAngle to endAngle (degrees, 0=top)
  function arcPath(r: number, startDeg: number, endDeg: number): string {
    const startRad = ((startDeg - 90) * Math.PI) / 180;
    const endRad = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Main score arc
  const mainR = 170;
  const scoreEndDeg = Math.max(1, scorePercent * 360);

  // Category arcs — 8 segments evenly spaced around the outer ring
  const catR = 192;
  const catGap = 3; // degrees gap between segments
  const segmentAngle = (360 - catGap * categories.length) / Math.max(categories.length, 1);

  return (
    <div className="relative" style={{ width: '100%', aspectRatio: '1' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        {/* Background ring track */}
        <circle
          cx={cx} cy={cy} r={mainR}
          fill="none"
          stroke="rgba(255,178,239,0.06)"
          strokeWidth="8"
        />

        {/* Score arc */}
        {score != null && scoreEndDeg > 0 && (
          <path
            d={arcPath(mainR, 0, scoreEndDeg)}
            fill="none"
            stroke={scoreColor}
            strokeWidth="8"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${scoreColor === 'var(--gs-terminal)' ? 'rgba(0,255,136,0.3)' : scoreColor === 'var(--gs-warning)' ? 'rgba(255,200,0,0.3)' : 'rgba(255,80,80,0.3)'})`,
            }}
          />
        )}

        {/* Outer category ring — thin track */}
        <circle
          cx={cx} cy={cy} r={catR}
          fill="none"
          stroke="rgba(255,178,239,0.04)"
          strokeWidth="4"
        />

        {/* Category arc segments — reordered so SEO/PPC/MarTech form a triangle */}
        {sortedCategories.map((cat, i) => {
          const startDeg = i * (segmentAngle + catGap);
          const catPercent = cat.score / 100;
          const filledDeg = Math.max(1, catPercent * segmentAngle);
          const catColor = getScoreColor(cat.score);

          return (
            <g key={cat.category}>
              {/* Segment track */}
              <path
                d={arcPath(catR, startDeg, startDeg + segmentAngle)}
                fill="none"
                stroke="rgba(255,178,239,0.08)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Filled portion */}
              <path
                d={arcPath(catR, startDeg, startDeg + filledDeg)}
                fill="none"
                stroke={catColor}
                strokeWidth="4"
                strokeLinecap="round"
                opacity="0.7"
              />
              {/* Label */}
              <CategoryLabel
                cx={cx} cy={cy} r={catR + 18}
                angleDeg={startDeg + segmentAngle / 2}
                label={CATEGORY_SHORT_LABELS[cat.category] ?? ''}
                score={cat.score}
                color={catColor}
              />
            </g>
          );
        })}

        {/* Inner decorative ring */}
        <circle
          cx={cx} cy={cy} r={142}
          fill="none"
          stroke="rgba(255,178,239,0.04)"
          strokeWidth="0.5"
        />
      </svg>

      {/* Center: score number + label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        {score != null ? (
          <>
            <div
              className="font-data tabular-nums"
              style={{
                fontSize: T.scoreNum,
                fontWeight: 700,
                lineHeight: 0.85,
                letterSpacing: '-0.04em',
                color: 'var(--gs-light)',
                filter: 'drop-shadow(0 0 30px rgba(255,178,239,0.1))',
              }}
            >
              {score}
            </div>
            <div
              className="font-data uppercase"
              style={{
                fontSize: T.scoreSub,
                letterSpacing: '0.2em',
                color: 'var(--gs-mid)',
                marginTop: '0.5em',
              }}
            >
              MarketingIQ
            </div>
          </>
        ) : (
          <div
            className="font-data"
            style={{
              fontSize: T.pending,
              color: 'var(--gs-mid)',
            }}
          >
            Pending
          </div>
        )}
      </div>
    </div>
  );
}

/* -- Category label positioned around the ring -- */

let categoryLabelIdCounter = 0;

function CategoryLabel({
  cx, cy, r, angleDeg, label, score, color,
}: {
  cx: number; cy: number; r: number; angleDeg: number;
  label: string; score: number; color: string;
}) {
  if (!label) return null;

  // Flip text on the left side so it reads outside-in like the others
  const flip = angleDeg > 180 && angleDeg <= 270;
  const arcSpan = 30; // degrees the text arc covers
  const halfSpan = arcSpan / 2;

  let startDeg: number;
  let endDeg: number;
  if (flip) {
    startDeg = angleDeg + halfSpan;
    endDeg = angleDeg - halfSpan;
  } else {
    startDeg = angleDeg - halfSpan;
    endDeg = angleDeg + halfSpan;
  }

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const sweep = flip ? 0 : 1;

  const pathId = `cat-arc-${categoryLabelIdCounter++}`;

  return (
    <>
      <defs>
        <path id={pathId} d={`M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`} />
      </defs>
      <text
        style={{
          fontSize: '9px',
          fontFamily: 'var(--font-data)',
          fill: color,
          opacity: 0.6,
          letterSpacing: '0.08em',
        }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label} {score}
        </textPath>
      </text>
    </>
  );
}

/* -- Meta pill -- */

function MetaPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center" style={{ gap: '0.4em' }}>
      <span
        className="font-data uppercase"
        style={{
          fontSize: T.metaLabel,
          letterSpacing: '0.12em',
          color: 'var(--gs-mid)',
        }}
      >
        {label}
      </span>
      <span
        className="font-data"
        style={{
          fontSize: T.metaValue,
          color: accent ? 'var(--gs-base)' : 'var(--gs-light)',
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
