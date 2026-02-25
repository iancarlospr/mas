'use client';

import { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * GhostScan OS — Chloé Sprite Renderer
 * ═══════════════════════════════════════
 *
 * WHAT: Renders Chloé as a pixel art ghost using pure CSS.
 * WHY:  She IS the GhostScan brand personified (Plan Section 4).
 *       No external image dependencies — resolution-independent,
 *       animatable via CSS, and infinitely scalable.
 * HOW:  CSS box-shadow pixel art technique. Each "pixel" is a
 *       box-shadow offset from a 1x1px element. This produces
 *       crisp pixel art at any size via CSS transform scale.
 *
 * Chloé is a bedsheet ghost: white body, cyan glow outline,
 * fuchsia eyes that emit laser beams on critical alerts.
 * She is cute but implies she could ruin your life.
 *
 * 9 emotional states defined as sprite data, each with
 * distinct pixel patterns for eyes, mouth, and accessories.
 */

/* ── Types ──────────────────────────────────────────────────── */

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
  /** Current emotional/behavioral state */
  state?: ChloeState;
  /** Render size — base pixel grid scales to this */
  size?: 32 | 64 | 128 | 256;
  /** Whether to show the cyan ghost glow */
  glowing?: boolean;
  /** Whether eyes should show laser beam effect */
  laserEyes?: boolean;
  /** Animation frame for multi-frame states (0-indexed) */
  frame?: number;
  /** Flip horizontally (face left instead of right) */
  flipped?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/* ── Color Constants ────────────────────────────────────────── */

/** Chloé's color palette — matches Plan Section 4 */
const C = {
  /** Ghost body — near-white */
  body: 'var(--gs-paper)',
  /** Body shadow — slightly darker for depth */
  bodyShade: 'var(--gs-paper)',
  /** Outline — dark for contrast */
  outline: 'var(--gs-chrome-dark)',
  /** Eyes — fuchsia (idle), brighter when active */
  eyes: 'var(--gs-red)',
  /** Cyan glow — ghost aura */
  glow: 'var(--gs-red)',
  /** Blush — subtle warmth */
  blush: 'oklch(0.75 0.12 15)',
  /** Sleep Z's */
  sleep: 'var(--gs-chrome)',
  /** Exclamation — alert yellow */
  alert: 'var(--gs-warning)',
  /** Transparent */
  t: 'transparent',
} as const;

/* ── Pixel Grid Definition ──────────────────────────────────
   Each state is a 16x16 grid where each cell is a color key.
   The grid is rendered as CSS box-shadows on a 1x1px element.
   Empty cells (null) are transparent.
   ─────────────────────────────────────────────────────────── */

type PixelColor = keyof typeof C | null;
type PixelGrid = PixelColor[][];

/**
 * Base ghost body shape shared across most states.
 * 16 rows × 16 columns. Row 0 = top.
 *
 * Legend:
 *   o = outline, b = body, s = bodyShade, e = eyes,
 *   g = glow, l = blush, null = transparent
 */
function getStateGrid(state: ChloeState, frame: number): PixelGrid {
  const _ = null; // shorthand for transparent

  // Base ghost silhouette (shared)
  // Rows 0-15, 16 columns
  const baseBody: PixelGrid = [
    /*  0 */ [_, _, _, _, _, 'outline', 'outline', 'outline', 'outline', 'outline', 'outline', _, _, _, _, _],
    /*  1 */ [_, _, _, _, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _, _, _, _],
    /*  2 */ [_, _, _, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _, _, _],
    /*  3 */ [_, _, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _, _],
    /*  4 */ [_, _, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _, _],
    /*  5 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /*  6 */ [_, 'outline', 'body', 'body', 'eyes', 'eyes', 'body', 'body', 'body', 'body', 'eyes', 'eyes', 'body', 'body', 'outline', _],
    /*  7 */ [_, 'outline', 'body', 'body', 'eyes', 'eyes', 'body', 'body', 'body', 'body', 'eyes', 'eyes', 'body', 'body', 'outline', _],
    /*  8 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /*  9 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'outline', 'outline', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /* 10 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /* 11 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /* 12 */ [_, 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', _],
    /* 13 */ [_, 'outline', 'body', 'body', 'outline', 'body', 'body', 'body', 'body', 'body', 'body', 'outline', 'body', 'body', 'outline', _],
    /* 14 */ [_, _, 'outline', 'outline', _, 'outline', 'outline', 'body', 'body', 'outline', 'outline', _, 'outline', 'outline', _, _],
    /* 15 */ [_, _, _, _, _, _, _, 'outline', 'outline', _, _, _, _, _, _, _],
  ];

  // Clone base and modify per state
  const grid = baseBody.map(row => [...row]);

  switch (state) {
    case 'idle': {
      // Gentle expression — small smile, blush marks
      // Blink on frame 1
      if (frame % 4 === 3) {
        // Blink: close eyes (horizontal line)
        grid[6]![4] = 'outline';
        grid[6]![5] = 'outline';
        grid[6]![10] = 'outline';
        grid[6]![11] = 'outline';
        grid[7]![4] = 'body';
        grid[7]![5] = 'body';
        grid[7]![10] = 'body';
        grid[7]![11] = 'body';
      }
      // Blush under eyes
      grid[8]![3] = 'blush';
      grid[8]![12] = 'blush';
      break;
    }

    case 'scanning': {
      // Eyes glow brighter, slightly larger
      grid[5]![4] = 'eyes';
      grid[5]![5] = 'eyes';
      grid[5]![10] = 'eyes';
      grid[5]![11] = 'eyes';
      break;
    }

    case 'found': {
      // Wide eyes (surprised), exclamation mark above
      grid[5]![4] = 'eyes';
      grid[5]![5] = 'eyes';
      grid[5]![10] = 'eyes';
      grid[5]![11] = 'eyes';
      // Exclamation mark above head (if we had row -1, we'd put it there)
      // We'll use the animation class for this instead
      break;
    }

    case 'critical': {
      // Laser eyes — extended eye pixels pointing outward
      grid[6]![2] = 'eyes';
      grid[6]![3] = 'eyes';
      grid[6]![12] = 'eyes';
      grid[6]![13] = 'eyes';
      grid[7]![1] = 'eyes';
      grid[7]![2] = 'eyes';
      grid[7]![13] = 'eyes';
      grid[7]![14] = 'eyes';
      break;
    }

    case 'smug': {
      // Half-lidded eyes (confident), slight smirk
      grid[6]![4] = 'body';
      grid[6]![5] = 'body';
      grid[6]![10] = 'body';
      grid[6]![11] = 'body';
      // Smirk — asymmetric mouth
      grid[9]![7] = 'body';
      grid[9]![8] = 'outline';
      grid[9]![9] = 'outline';
      break;
    }

    case 'chat': {
      // Attentive, listening — eyes slightly angled
      grid[8]![3] = 'blush';
      grid[8]![12] = 'blush';
      break;
    }

    case 'sleeping': {
      // Closed eyes (horizontal lines), Z's floating
      grid[6]![4] = 'outline';
      grid[6]![5] = 'outline';
      grid[6]![10] = 'outline';
      grid[6]![11] = 'outline';
      grid[7]![4] = 'body';
      grid[7]![5] = 'body';
      grid[7]![10] = 'body';
      grid[7]![11] = 'body';
      // Remove mouth
      grid[9]![7] = 'body';
      grid[9]![8] = 'body';
      break;
    }

    case 'mischief': {
      // Sideways glance, mischievous grin
      grid[6]![5] = 'eyes';
      grid[6]![11] = 'eyes';
      grid[7]![5] = 'eyes';
      grid[7]![11] = 'eyes';
      grid[6]![4] = 'body';
      grid[6]![10] = 'body';
      grid[7]![4] = 'body';
      grid[7]![10] = 'body';
      // Grin
      grid[9]![6] = 'outline';
      grid[9]![9] = 'outline';
      break;
    }

    case 'celebrating': {
      // Big eyes, sparkles
      grid[5]![4] = 'eyes';
      grid[5]![5] = 'eyes';
      grid[5]![10] = 'eyes';
      grid[5]![11] = 'eyes';
      grid[8]![3] = 'blush';
      grid[8]![12] = 'blush';
      // Open mouth (happy)
      grid[9]![7] = 'outline';
      grid[9]![8] = 'outline';
      break;
    }
  }

  return grid;
}

/* ── Resolved colors for canvas (CSS vars don't work in canvas) ── */

const CANVAS_COLORS: Record<keyof typeof C, string> = {
  body: '#FFFBF5',
  bodyShade: '#FFFBF5',
  outline: '#D1CBC1',
  eyes: '#E63946',
  glow: '#E63946',
  blush: '#FFD6D9',
  sleep: '#E8E3DB',
  alert: '#FFB84D',
  t: 'transparent',
};

/* ── Animation class mapping ───────────────────────────────── */

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

/* ── Component ─────────────────────────────────────────────── */

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
  const scale = size / 16;
  const animClass = STATE_ANIMATIONS[state] ?? '';

  /** Render pixel art to canvas */
  const grid = useMemo(() => getStateGrid(state, frame), [state, frame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 16, 16);

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
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Chloe the ghost — ${state}`}
    >
      {/* Canvas pixel art: 16×16 native, CSS scales with pixelated rendering */}
      <canvas
        ref={canvasRef}
        width={16}
        height={16}
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
          transform: flipped ? 'scaleX(-1)' : undefined,
        }}
      />

      {/* Ghost glow overlay (subtle pale blue, not red) */}
      {glowing && (
        <div
          className="absolute inset-0 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse at center, var(--gs-ghost) 0%, transparent 70%)',
            filter: 'blur(8px)',
            transform: 'scale(1.5)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Laser beam effect (critical state) */}
      {(laserEyes || state === 'critical') && (
        <>
          <div
            className="absolute animate-laser"
            style={{
              top: `${6 * scale}px`,
              left: `${1 * scale}px`,
              width: 0,
              height: `${scale}px`,
              background: 'linear-gradient(90deg, #E63946, #C1121F)',
              opacity: 0.8,
              filter: 'blur(1px)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute animate-laser"
            style={{
              top: `${6 * scale}px`,
              right: `${1 * scale}px`,
              width: 0,
              height: `${scale}px`,
              background: 'linear-gradient(270deg, #E63946, #C1121F)',
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
          className="absolute font-personality text-gs-muted animate-ghost-float"
          style={{
            top: `-${scale * 4}px`,
            right: `-${scale * 2}px`,
            fontSize: `${scale * 3}px`,
          }}
        >
          z
          <span className="ml-1" style={{ fontSize: `${scale * 4}px` }}>z</span>
          <span className="ml-1" style={{ fontSize: `${scale * 5}px` }}>z</span>
        </div>
      )}

      {/* Found exclamation mark */}
      {state === 'found' && (
        <div
          className="absolute font-system font-bold text-gs-warning animate-bounce"
          style={{
            top: `-${scale * 6}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${scale * 5}px`,
            textShadow: '0 0 4px var(--gs-warning)',
          }}
        >
          !
        </div>
      )}
    </div>
  );
}
