'use client';

import { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chloé's Bedroom OS — Chloé Sprite Renderer
 * =============================================
 *
 * 32x32 pixel art ghost rendered on canvas.
 * Pink monochrome palette with more detail:
 * - Body: near-white pink (#FFF0FA) with shading (#FFCAF3)
 * - Outline: deep neutral (#1A161A)
 * - Eyes: bright pink (#FFB2EF) with white highlight
 * - Glow: radial #FFB2EF
 * - Blush marks, wisp details, expression nuance
 */

/* -- Types ---------------------------------------------------- */

export type ChloeState =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'critical'
  | 'smug'
  | 'chat'
  | 'sleeping'
  | 'mischief'
  | 'celebrating';

export interface ChloeSpriteProps {
  state?: ChloeState;
  size?: 32 | 64 | 128 | 256;
  glowing?: boolean;
  laserEyes?: boolean;
  frame?: number;
  flipped?: boolean;
  className?: string;
}

/* -- Color Constants ------------------------------------------ */

const C = {
  body: 'var(--gs-light)',
  shade: 'var(--gs-bright)',
  outline: 'var(--gs-deep)',
  eyes: 'var(--gs-base)',
  eyeHighlight: 'var(--gs-light)',
  glow: 'var(--gs-base)',
  blush: 'oklch(0.82 0.15 350)',
  sleep: 'var(--gs-mid)',
  alert: 'var(--gs-warning)',
  t: 'transparent',
} as const;

/* -- Resolved colors for canvas ------------------------------- */

const CANVAS_COLORS: Record<keyof typeof C, string> = {
  body: '#FFF0FA',
  shade: '#FFCAF3',
  outline: '#1A161A',
  eyes: '#FFB2EF',
  eyeHighlight: '#FFFFFF',
  glow: '#FFB2EF',
  blush: '#FFD4E8',
  sleep: '#4A3844',
  alert: '#FFB84D',
  t: 'transparent',
};

/* -- Pixel Grid Definition (32x32) ---------------------------- */

type PixelColor = keyof typeof C | null;
type PixelGrid = PixelColor[][];

const GRID_W = 32;
const GRID_H = 42;

function getStateGrid(state: ChloeState, frame: number): PixelGrid {
  const _ = null;
  const o: PixelColor = 'outline';
  const b: PixelColor = 'body';
  const s: PixelColor = 'shade';
  const e: PixelColor = 'eyes';
  const h: PixelColor = 'eyeHighlight';
  const l: PixelColor = 'blush';

  // 32x42 base ghost body — tall feminine bedsheet ghost
  const baseBody: PixelGrid = [
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
    /* 12 */ [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
    /* 13 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
    /* 14 */ [_,_,o,b,b,b,b,e,e,h,e,e,b,b,b,b,b,b,b,e,e,h,e,e,b,b,b,b,b,o,_,_],
    /* 15 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
    /* 16 */ [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
    /* 17 */ [_,_,o,b,b,b,l,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,l,b,b,b,b,o,_,_],
    /* 18 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
    /* 19 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,o,o,o,o,o,o,b,b,b,b,b,b,b,b,b,b,o,_,_],
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

  const grid = baseBody.map(row => [...row]);

  // Animate wavy bottom — shift tail rows (36-40) based on frame
  const waveOffset = [0, 1, 1, 0, -1, -1, 0, 1][frame % 8]!;
  for (let r = 36; r <= 40; r++) {
    if (!grid[r]) continue;
    const row = grid[r]!;
    const shift = waveOffset * (r >= 39 ? 2 : 1); // tips sway more
    if (shift === 0) continue;
    const newRow: PixelColor[] = new Array(GRID_W).fill(null);
    for (let c = 0; c < GRID_W; c++) {
      const src = c - shift;
      if (src >= 0 && src < GRID_W) {
        newRow[c] = row[src]!;
      }
    }
    grid[r] = newRow;
  }

  switch (state) {
    case 'idle': {
      // Blink on every 4th frame
      if (frame % 4 === 3) {
        // Close eyes — replace eye rows with horizontal lines
        for (let r = 12; r <= 16; r++) {
          for (let c = 7; c <= 11; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
          for (let c = 19; c <= 23; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
        }
      }
      break;
    }

    case 'scanning': {
      // Eyes glow brighter — expand upward
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      break;
    }

    case 'found': {
      // Wide eyes — expand
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      break;
    }

    case 'critical': {
      // Laser eyes — beams extending outward
      for (let c = 3; c <= 6; c++) { grid[13]![c] = 'eyes'; grid[14]![c] = 'eyes'; }
      for (let c = 25; c <= 28; c++) { grid[13]![c] = 'eyes'; grid[14]![c] = 'eyes'; }
      break;
    }

    case 'smug': {
      // Half-lidded eyes
      for (let c = 7; c <= 11; c++) grid[12]![c] = 'body';
      for (let c = 19; c <= 23; c++) grid[12]![c] = 'body';
      // Smirk
      grid[19]![14] = 'body'; grid[19]![15] = 'outline'; grid[19]![16] = 'outline'; grid[19]![17] = 'outline';
      break;
    }

    case 'chat': {
      // Attentive — extra blush
      grid[17]![5] = 'blush'; grid[17]![6] = 'blush';
      grid[17]![25] = 'blush'; grid[17]![24] = 'blush';
      break;
    }

    case 'sleeping': {
      // Closed eyes (lines)
      for (let r = 12; r <= 16; r++) {
        for (let c = 7; c <= 11; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
        for (let c = 19; c <= 23; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
      }
      // Remove mouth
      grid[19]![13] = 'body'; grid[19]![14] = 'body'; grid[19]![15] = 'body';
      grid[19]![16] = 'body'; grid[19]![17] = 'body'; grid[19]![18] = 'body';
      break;
    }

    case 'mischief': {
      // Sideways glance — shift eye pupils
      for (let r = 12; r <= 16; r++) {
        for (let c = 7; c <= 9; c++) grid[r]![c] = 'body';
        for (let c = 19; c <= 21; c++) grid[r]![c] = 'body';
      }
      grid[13]![10] = 'eyes'; grid[13]![11] = 'eyes';
      grid[14]![10] = 'eyes'; grid[14]![11] = 'eyes';
      grid[15]![10] = 'eyes'; grid[15]![11] = 'eyes';
      grid[13]![22] = 'eyes'; grid[13]![23] = 'eyes';
      grid[14]![22] = 'eyes'; grid[14]![23] = 'eyes';
      grid[15]![22] = 'eyes'; grid[15]![23] = 'eyes';
      // Grin
      grid[19]![12] = 'outline'; grid[19]![19] = 'outline';
      break;
    }

    case 'celebrating': {
      // Big eyes + open mouth
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      // Open mouth
      grid[19]![14] = 'outline'; grid[19]![15] = 'outline';
      grid[19]![16] = 'outline'; grid[19]![17] = 'outline';
      grid[20]![14] = 'outline'; grid[20]![17] = 'outline';
      grid[21]![14] = 'outline'; grid[21]![15] = 'outline';
      grid[21]![16] = 'outline'; grid[21]![17] = 'outline';
      break;
    }
  }

  return grid;
}

/* -- Animation class mapping ---------------------------------- */

const STATE_ANIMATIONS: Record<ChloeState, string> = {
  idle: 'animate-ghost-float',
  scanning: 'animate-ghost-pulse',
  found: 'animate-shake',
  critical: '',
  smug: '',
  chat: '',
  sleeping: '',
  mischief: '',
  celebrating: 'animate-ghost-float',
};

/* -- Component ------------------------------------------------ */

export function ChloeSprite({
  state = 'idle',
  size = 64,
  glowing = true,
  laserEyes = false,
  frame = 0,
  flipped = false,
  className,
}: ChloeSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = size / GRID_W;
  const canvasH = Math.round(GRID_H * scale);
  const animClass = STATE_ANIMATIONS[state] ?? '';

  const grid = useMemo(() => getStateGrid(state, frame), [state, frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_W, GRID_H);

    for (let y = 0; y < grid.length; y++) {
      const row = grid[y]!;
      for (let x = 0; x < row.length; x++) {
        const colorKey = row[x];
        if (colorKey == null) continue;
        const color = CANVAS_COLORS[colorKey];
        if (color === 'transparent') continue;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid]);

  return (
    <div
      className={cn(
        'relative inline-block',
        animClass,
        className,
      )}
      style={{ width: size, height: canvasH }}
      role="img"
      aria-label={`Chloé the ghost — ${state}`}
    >
      <canvas
        ref={canvasRef}
        width={GRID_W}
        height={GRID_H}
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: canvasH,
          imageRendering: 'pixelated',
          transform: flipped ? 'scaleX(-1)' : undefined,
        }}
      />

      {/* Ghost glow overlay — layered for depth */}
      {glowing && (
        <>
          <div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(ellipse at center, #FFB2EF 0%, transparent 70%)',
              filter: 'blur(10px)',
              transform: 'scale(1.6)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute inset-0 rounded-full opacity-10"
            style={{
              background: 'radial-gradient(ellipse at center, #FFCAF3 0%, transparent 50%)',
              filter: 'blur(4px)',
              transform: 'scale(1.2)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Laser beam effect (critical state) */}
      {(laserEyes || state === 'critical') && (
        <>
          <div
            className="absolute animate-laser"
            style={{
              top: `${13 * scale}px`,
              left: `${1 * scale}px`,
              width: 0,
              height: `${2 * scale}px`,
              background: 'linear-gradient(90deg, #FFB2EF, #FF80E0)',
              opacity: 0.8,
              filter: 'blur(1px)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute animate-laser"
            style={{
              top: `${13 * scale}px`,
              right: `${1 * scale}px`,
              width: 0,
              height: `${2 * scale}px`,
              background: 'linear-gradient(270deg, #FFB2EF, #FF80E0)',
              opacity: 0.8,
              filter: 'blur(1px)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Sleeping Z's */}
      {state === 'sleeping' && (
        <div
          className="absolute font-personality text-gs-mid animate-ghost-float"
          style={{
            top: `-${scale * 6}px`,
            right: `-${scale * 3}px`,
            fontSize: `${scale * 5}px`,
          }}
        >
          z
          <span className="ml-0.5" style={{ fontSize: `${scale * 7}px` }}>z</span>
          <span className="ml-0.5" style={{ fontSize: `${scale * 9}px` }}>z</span>
        </div>
      )}

      {/* Found exclamation mark */}
      {state === 'found' && (
        <div
          className="absolute font-system font-bold text-gs-warning animate-bounce"
          style={{
            top: `-${scale * 10}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${scale * 8}px`,
            textShadow: '0 0 6px var(--gs-warning)',
          }}
        >
          !
        </div>
      )}
    </div>
  );
}
