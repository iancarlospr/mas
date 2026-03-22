import React, { useEffect, useRef } from 'react';

/**
 * Chloé Ghost Sprite — Remotion-compatible version
 *
 * 32x42 pixel art ghost rendered on canvas.
 * Frame-driven (no internal animation state).
 * Adapted from apps/web/components/chloe/chloe-sprite.tsx
 */

export type ChloeState =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'critical'
  | 'smug'
  | 'celebrating';

interface Props {
  state?: ChloeState;
  size?: number;
  glowing?: boolean;
  frame?: number;
  flipped?: boolean;
  style?: React.CSSProperties;
}

const GRID_W = 32;
const GRID_H = 42;

const COLORS: Record<string, string> = {
  body: '#FFF0FA',
  shade: '#FFCAF3',
  outline: '#1A161A',
  eyes: '#FFB2EF',
  eyeHighlight: '#FFFFFF',
  blush: '#FFD4E8',
};

type Px = string | null;

function getGrid(state: ChloeState, frame: number): Px[][] {
  const _ = null;
  const o = 'outline';
  const b = 'body';
  const s = 'shade';
  const e = 'eyes';
  const h = 'eyeHighlight';
  const l = 'blush';

  const base: Px[][] = [
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

  const grid = base.map(row => [...row]);

  // Animate tail sway
  const waveOffset = [0, 1, 1, 0, -1, -1, 0, 1][frame % 8]!;
  for (let r = 36; r <= 40; r++) {
    if (!grid[r]) continue;
    const row = grid[r]!;
    const shift = waveOffset * (r >= 39 ? 2 : 1);
    if (shift === 0) continue;
    const newRow: Px[] = new Array(GRID_W).fill(null);
    for (let c = 0; c < GRID_W; c++) {
      const src = c - shift;
      if (src >= 0 && src < GRID_W) newRow[c] = row[src]!;
    }
    grid[r] = newRow;
  }

  // State-specific eye modifications
  switch (state) {
    case 'idle':
      if (frame % 4 === 3) {
        for (let r = 12; r <= 16; r++) {
          for (let c = 7; c <= 11; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
          for (let c = 19; c <= 23; c++) grid[r]![c] = r === 14 ? 'outline' : 'body';
        }
      }
      break;
    case 'scanning':
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      break;
    case 'found':
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      break;
    case 'celebrating':
      grid[11]![8] = 'eyes'; grid[11]![9] = 'eyes'; grid[11]![10] = 'eyes';
      grid[11]![20] = 'eyes'; grid[11]![21] = 'eyes'; grid[11]![22] = 'eyes';
      grid[19]![14] = 'outline'; grid[19]![15] = 'outline';
      grid[19]![16] = 'outline'; grid[19]![17] = 'outline';
      grid[20]![14] = 'outline'; grid[20]![17] = 'outline';
      grid[21]![14] = 'outline'; grid[21]![15] = 'outline';
      grid[21]![16] = 'outline'; grid[21]![17] = 'outline';
      break;
    case 'smug':
      for (let c = 7; c <= 11; c++) grid[12]![c] = 'body';
      for (let c = 19; c <= 23; c++) grid[12]![c] = 'body';
      grid[19]![14] = 'body'; grid[19]![15] = 'outline';
      grid[19]![16] = 'outline'; grid[19]![17] = 'outline';
      break;
    case 'critical':
      for (let c = 3; c <= 6; c++) { grid[13]![c] = 'eyes'; grid[14]![c] = 'eyes'; }
      for (let c = 25; c <= 28; c++) { grid[13]![c] = 'eyes'; grid[14]![c] = 'eyes'; }
      break;
  }

  return grid;
}

export const ChloeSprite: React.FC<Props> = ({
  state = 'idle',
  size = 128,
  glowing = true,
  frame = 0,
  flipped = false,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = size / GRID_W;
  const canvasH = Math.round(GRID_H * scale);

  const grid = getGrid(state, frame);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_W, GRID_H);

    for (let y = 0; y < grid.length; y++) {
      const row = grid[y]!;
      for (let x = 0; x < row.length; x++) {
        const key = row[x];
        if (key == null) continue;
        const color = COLORS[key];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: canvasH,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        width={GRID_W}
        height={GRID_H}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: canvasH,
          imageRendering: 'pixelated',
          transform: flipped ? 'scaleX(-1)' : undefined,
        }}
      />
      {glowing && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              opacity: 0.2,
              background: 'radial-gradient(ellipse at center, #FFB2EF 0%, transparent 70%)',
              filter: 'blur(10px)',
              transform: 'scale(1.6)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              opacity: 0.1,
              background: 'radial-gradient(ellipse at center, #FFCAF3 0%, transparent 50%)',
              filter: 'blur(4px)',
              transform: 'scale(1.2)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
    </div>
  );
};
