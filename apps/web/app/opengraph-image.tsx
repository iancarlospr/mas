import { ImageResponse } from 'next/og';

/**
 * Alpha Scan — Root OG Image (1200×630)
 *
 * Giant slanted Chloé ghost (smug face) behind a glowing pink
 * ASCII "ALPHA SCAN" logo. Social share image for Facebook,
 * WhatsApp, iMessage, LinkedIn, etc.
 */

export const runtime = 'edge';
export const alt = 'Alpha Scan — Forensic Marketing Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* ── Ghost pixel grid (smug state) — 32×42, from chloe-sprite.tsx ── */

type P = string | null;
const _ = null;
const o = '#1A161A';   // outline
const b = '#FFF0FA';   // body
const s = '#FFCAF3';   // shade
const e = '#FFB2EF';   // eyes
const h = '#FFFFFF';   // highlight
const l = '#FFD4E8';   // blush

// Smug state: half-lidded eyes (row 12 = body over eyes) + smirk (row 19 adjusted)
const grid: P[][] = [
  /* 00 */ [_,_,_,_,_,_,_,_,_,_,_,o,o,o,o,o,o,o,o,o,o,_,_,_,_,_,_,_,_,_,_,_],
  /* 01 */ [_,_,_,_,_,_,_,_,_,o,o,b,b,b,b,b,b,b,b,b,b,o,o,_,_,_,_,_,_,_,_,_],
  /* 02 */ [_,_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_,_],
  /* 03 */ [_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_],
  /* 04 */ [_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_],
  /* 05 */ [_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_],
  /* 06 */ [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  /* 07 */ [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  /* 08 */ [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  /* 09 */ [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  /* 10 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 11 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 12 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],  // half-lidded: eyes covered
  /* 13 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  /* 14 */ [_,_,o,b,b,b,b,e,e,h,e,e,b,b,b,b,b,b,b,e,e,h,e,e,b,b,b,b,b,o,_,_],
  /* 15 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  /* 16 */ [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
  /* 17 */ [_,_,o,b,b,b,l,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,l,b,b,b,b,o,_,_],
  /* 18 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 19 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,o,o,o,o,o,b,b,b,b,b,b,b,b,b,b,o,_,_],  // smirk shifted right
  /* 20 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 21 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 22 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 23 */ [_,_,o,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,o,_,_],
  /* 24 */ [_,_,o,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,o,_,_],
  /* 25 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 26 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 27 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 28 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 29 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 30 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 31 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 32 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 33 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 34 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 35 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 36 */ [_,_,o,b,b,b,s,b,b,b,b,b,b,s,b,b,b,b,s,b,b,b,b,b,b,s,b,b,b,o,_,_],
  /* 37 */ [_,_,o,b,b,s,b,b,b,o,b,b,s,b,b,b,o,s,b,b,b,o,b,b,s,b,b,b,o,_,_,_],
  /* 38 */ [_,_,_,o,s,b,b,o,_,_,o,s,b,b,o,_,_,o,b,b,o,_,_,o,b,b,o,o,_,_,_,_],
  /* 39 */ [_,_,_,_,o,b,o,_,_,_,_,o,b,o,_,_,_,_,o,o,_,_,_,_,o,o,_,_,_,_,_,_],
  /* 40 */ [_,_,_,_,_,o,_,_,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  /* 41 */ [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

/**
 * Render the ghost pixel grid as SVG rects.
 * Each grid cell becomes a 1×1 rect in SVG space — the viewBox handles scaling.
 * shapeRendering="crispEdges" keeps pixels sharp.
 */
function GhostSvg({ size: s, style }: { size: number; style?: React.CSSProperties }) {
  const rects: React.JSX.Element[] = [];
  let key = 0;
  for (let y = 0; y < 42; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < 32; x++) {
      const color = row[x];
      if (!color) continue;
      rects.push(
        <rect key={key++} x={x} y={y} width={1} height={1} fill={color} />
      );
    }
  }
  return (
    <svg
      width={s}
      height={Math.round(s * (42 / 32))}
      viewBox="0 0 32 42"
      style={{ imageRendering: 'pixelated' as 'auto', ...style }}
    >
      <g shapeRendering="crispEdges">{rects}</g>
    </svg>
  );
}

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#080808',
        }}
      >
        {/* Subtle radial glow behind center */}
        <div
          style={{
            position: 'absolute',
            width: '900px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,178,239,0.10) 0%, transparent 70%)',
            top: '15px',
            left: '150px',
          }}
        />

        {/* Giant slanted ghost — background, right-heavy like CTA section */}
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            bottom: '-120px',
            transform: 'rotate(-35deg)',
            opacity: 0.18,
            display: 'flex',
          }}
        >
          <GhostSvg size={700} />
        </div>

        {/* Second ghost echo — even more faded, left side */}
        <div
          style={{
            position: 'absolute',
            left: '-180px',
            top: '-80px',
            transform: 'rotate(20deg)',
            opacity: 0.06,
            display: 'flex',
          }}
        >
          <GhostSvg size={500} />
        </div>

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #FFB2EF, transparent)',
          }}
        />

        {/* Brand logo — large pink text, Satori-safe (no Unicode box chars) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: '96px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#FFB2EF',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            ALPHA SCAN
          </div>
          <div
            style={{
              fontSize: '16px',
              color: '#5A4C5F',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginTop: '16px',
            }}
          >
            Forensic Marketing Intelligence
          </div>
        </div>

        {/* Glowing divider */}
        <div
          style={{
            width: '500px',
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(255,178,239,0.5), transparent)',
            marginTop: '36px',
            marginBottom: '36px',
            position: 'relative',
          }}
        />

        {/* Bottom tagline — from scan-input window */}
        <div
          style={{
            fontSize: '20px',
            color: 'rgba(255,240,250,0.55)',
            letterSpacing: '0.08em',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          MarTech breakdown. Strategic insights. Actionable recommendations.
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #FFB2EF, transparent)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
