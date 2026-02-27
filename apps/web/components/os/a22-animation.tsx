'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   A22 Films — Cinematic Intro Animation

   Particles stream in from edges, converge to form "A22",
   hold with shimmer, "FILMS" fades in, dissolve to "presents",
   then "a ghostscan film" with Chloe peek. Full 32s loop.
   ================================================================= */

const W = 120;
const H = 30;
const INTERVAL = 67; // ~15fps

// ── Letter definitions (9 rows × 8 cols binary grids) ──────────

const L_A = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,0,0,1,1,0],
  [0,1,0,0,0,0,1,0],
  [1,1,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,0,0,0,0,1,1],
  [1,1,0,0,0,0,1,1],
  [1,1,0,0,0,0,1,1],
];

const L_2 = [
  [0,1,1,1,1,1,1,0],
  [1,1,0,0,0,0,1,1],
  [0,0,0,0,0,0,1,1],
  [0,0,0,0,0,1,1,0],
  [0,0,0,1,1,1,0,0],
  [0,0,1,1,0,0,0,0],
  [0,1,1,0,0,0,0,0],
  [1,1,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1],
];

// Each pixel rendered as "##" (2 chars wide). Letters 16 chars wide each.
// A22 total: 16 + 5 + 16 + 5 + 16 = 58 chars. Centered in 120 = offset 31.
const LETTER_W = 16;
const LETTER_GAP = 5;
const LETTERS_TOTAL_W = LETTER_W * 3 + LETTER_GAP * 2;
const LETTERS_X = Math.floor((W - LETTERS_TOTAL_W) / 2);
const LETTERS_Y = 8; // vertical offset for letters

// ── Particle system ────────────────────────────────────────────

interface Particle {
  tx: number; // target
  ty: number;
  x: number;  // current
  y: number;
  settled: boolean;
  scattered: boolean;
  sx: number; // scatter velocity
  sy: number;
  delay: number; // frames before moving
  char: string;
}

function buildTargets(): { tx: number; ty: number }[] {
  const targets: { tx: number; ty: number }[] = [];
  const letters = [L_A, L_2, L_2];

  for (let li = 0; li < 3; li++) {
    const letter = letters[li]!;
    const baseX = LETTERS_X + li * (LETTER_W + LETTER_GAP);
    for (let row = 0; row < letter.length; row++) {
      for (let col = 0; col < letter[row]!.length; col++) {
        if (letter[row]![col]) {
          // Each pixel = "##" (2 chars)
          targets.push({ tx: baseX + col * 2, ty: LETTERS_Y + row });
          targets.push({ tx: baseX + col * 2 + 1, ty: LETTERS_Y + row });
        }
      }
    }
  }
  return targets;
}

function createParticles(): Particle[] {
  const targets = buildTargets();
  return targets.map((t, i) => {
    // Start from random edge
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    if (edge === 0) { x = Math.random() * W; y = -5; }         // top
    else if (edge === 1) { x = Math.random() * W; y = H + 5; } // bottom
    else if (edge === 2) { x = -5; y = Math.random() * H; }    // left
    else { x = W + 5; y = Math.random() * H; }                 // right

    return {
      tx: t.tx,
      ty: t.ty,
      x,
      y,
      settled: false,
      scattered: false,
      sx: (Math.random() - 0.5) * 4,
      sy: (Math.random() - 0.5) * 3,
      delay: Math.floor(i * 0.15 + Math.random() * 15),
      char: '#',
    };
  });
}

// ── Ghost sprite for the "ghostscan film" reveal ───────────────

const GHOST_PEEK: string[] = [
  '     .:::::::.     ',
  '   .::       ::.   ',
  '  ::           ::  ',
  ' ::  .##. .##.  :: ',
  ' ::  # *# # *#  :: ',
  ' ::  \'##\' \'##\'  :: ',
  ' ::     ..      :: ',
  '  ::           ::  ',
  '   ::  :  :  ::    ',
  '    \':  \'::\'  :\'   ',
  '      \'::  ::\'     ',
];

// ── Sparkle / ambient particles ────────────────────────────────

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  char: string;
}

const SPARK_CHARS = ['*', '+', '.', ':', '~', '`'];

// ── Main component ─────────────────────────────────────────────

export function A22Animation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);
  const gridRef = useRef<string[][]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const initRef = useRef(false);

  const createGrid = useCallback((): string[][] => {
    return Array.from({ length: H }, () => Array(W).fill(' '));
  }, []);

  const clearGrid = useCallback(() => {
    const g = gridRef.current;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        g[y]![x] = ' ';
      }
    }
  }, []);

  const drawChar = useCallback((x: number, y: number, ch: string) => {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
      gridRef.current[gy]![gx] = ch;
    }
  }, []);

  const drawText = useCallback((text: string, cx: number, cy: number) => {
    const startX = Math.round(cx - text.length / 2);
    for (let i = 0; i < text.length; i++) {
      drawChar(startX + i, cy, text[i]!);
    }
  }, [drawChar]);

  const drawSprite = useCallback((sprite: string[], px: number, py: number) => {
    for (let sy = 0; sy < sprite.length; sy++) {
      const row = sprite[sy]!;
      for (let sx = 0; sx < row.length; sx++) {
        if (row[sx] !== ' ') {
          drawChar(px + sx, py + sy, row[sx]!);
        }
      }
    }
  }, [drawChar]);

  const drawLensFlare = useCallback((cx: number, cy: number, width: number, intensity: number) => {
    const chars = ['=', '#', '*', '+', '-', '.'];
    for (let dx = -width; dx <= width; dx++) {
      const dist = Math.abs(dx) / width;
      const charIdx = Math.min(Math.floor(dist * chars.length), chars.length - 1);
      if (Math.random() < intensity * (1 - dist * 0.7)) {
        drawChar(cx + dx, cy, chars[charIdx]!);
      }
      // Subtle vertical bleed
      if (dist < 0.3 && Math.random() < intensity * 0.3) {
        drawChar(cx + dx, cy - 1, '.');
        drawChar(cx + dx, cy + 1, '.');
      }
    }
  }, [drawChar]);

  const drawScanline = useCallback((y: number, progress: number) => {
    const g = gridRef.current;
    const endX = Math.floor(progress * W);
    for (let x = 0; x < endX; x++) {
      if (g[y]![x] === ' ') {
        g[y]![x] = x > endX - 3 ? '#' : x > endX - 8 ? '-' : '.';
      }
    }
  }, []);

  const spawnSparks = useCallback((cx: number, cy: number, count: number) => {
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 0.8,
        life: Math.floor(Math.random() * 12) + 4,
        char: SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!,
      });
    }
  }, []);

  const updateSparks = useCallback(() => {
    const parts = sparksRef.current;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      drawChar(p.x, p.y, p.char);
    }
  }, [drawChar]);

  const renderGrid = useCallback((): string => {
    return gridRef.current.map(row => row.join('')).join('\n');
  }, []);

  // ── Animation loop ─────────────────────────────────────────

  const animate = useCallback(() => {
    if (!gridRef.current.length) gridRef.current = createGrid();
    if (!initRef.current) {
      particlesRef.current = createParticles();
      initRef.current = true;
    }

    const f = frameRef.current;
    const LOOP = 480; // 32 seconds
    const localF = f % LOOP;
    const sec = (localF / LOOP) * 32;

    // Reset particles at loop start
    if (localF === 0) {
      particlesRef.current = createParticles();
      sparksRef.current = [];
    }

    clearGrid();

    const particles = particlesRef.current;

    // ── Phase 0: Dark, pulsing dot (0–2s) ────────────────────
    if (sec < 2) {
      const pulse = Math.sin(f * 0.3) * 0.5 + 0.5;
      const ch = pulse > 0.6 ? '#' : pulse > 0.3 ? '+' : '.';
      drawChar(W / 2, H / 2, ch);
      if (pulse > 0.7) {
        drawChar(W / 2 - 1, H / 2, '.');
        drawChar(W / 2 + 1, H / 2, '.');
      }
    }

    // ── Phase 1: Lens flare (2–3.5s) ─────────────────────────
    else if (sec < 3.5) {
      const p = (sec - 2) / 1.5;
      const flareW = Math.floor(easeOut(p) * 55);
      const intensity = p < 0.7 ? easeOut(p / 0.7) : 1 - (p - 0.7) / 0.3;
      drawLensFlare(W / 2, H / 2, flareW, intensity * 0.9);
    }

    // ── Phase 2: Particles converge to form A22 (3.5–9s) ─────
    else if (sec < 9) {
      const elapsed = Math.floor((sec - 3.5) * 15); // frames since phase start
      for (const p of particles) {
        if (p.settled) {
          // Shimmer settled chars
          const shimmer = Math.random() < 0.03;
          drawChar(p.tx, p.ty, shimmer ? '+' : p.char);
          continue;
        }
        if (elapsed < p.delay) {
          // Still waiting — draw as flying spark
          if (Math.random() < 0.5) drawChar(p.x, p.y, '.');
          continue;
        }
        // Move toward target
        const speed = 0.12;
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1.5) {
          p.x = p.tx;
          p.y = p.ty;
          p.settled = true;
          drawChar(p.tx, p.ty, p.char);
          // Spark on settle
          if (Math.random() < 0.3) spawnSparks(p.tx, p.ty, 1);
        } else {
          p.x += dx * speed + (Math.random() - 0.5) * 0.5;
          p.y += dy * speed + (Math.random() - 0.5) * 0.3;
          drawChar(p.x, p.y, dist < 5 ? '*' : dist < 15 ? '+' : '.');
        }
      }
      updateSparks();
    }

    // ── Phase 3: A22 holds, FILMS appears (9–14s) ────────────
    else if (sec < 14) {
      const p = (sec - 9) / 5;
      // Draw settled letters with shimmer
      for (const pt of particles) {
        if (!pt.scattered) {
          const shimmer = Math.random() < 0.04;
          drawChar(pt.tx, pt.ty, shimmer ? (Math.random() < 0.5 ? '*' : '+') : pt.char);
        }
      }
      // "FILMS" fades in
      if (p > 0.15) {
        const filmsAlpha = Math.min((p - 0.15) / 0.3, 1);
        const text = 'F  I  L  M  S';
        const startX = Math.round(W / 2 - text.length / 2);
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== ' ' && Math.random() < filmsAlpha) {
            drawChar(startX + i, LETTERS_Y + 11, text[i]!);
          }
        }
      }
      // Divider line sweeps at p ~0.5
      if (p > 0.45 && p < 0.65) {
        const lineP = (p - 0.45) / 0.2;
        drawScanline(LETTERS_Y + 10, lineP);
      }
      // Ambient sparkles
      if (f % 20 === 0) spawnSparks(W / 2, LETTERS_Y + 5, 3);
      updateSparks();
    }

    // ── Phase 4: Scatter / dissolve (14–16.5s) ───────────────
    else if (sec < 16.5) {
      const p = (sec - 14) / 2.5;
      // Trigger scatter on first frame
      if (p < 0.05) {
        for (const pt of particles) {
          pt.scattered = true;
          pt.sx = (Math.random() - 0.5) * 6;
          pt.sy = (Math.random() - 0.5) * 4;
        }
      }
      for (const pt of particles) {
        pt.x = pt.tx + pt.sx * p * 30;
        pt.y = pt.ty + pt.sy * p * 30;
        const alpha = 1 - p;
        if (Math.random() < alpha) {
          const ch = alpha > 0.6 ? '#' : alpha > 0.3 ? '+' : '.';
          drawChar(pt.x, pt.y, ch);
        }
      }
      updateSparks();
    }

    // ── Phase 5: "presents" (16.5–19.5s) ─────────────────────
    else if (sec < 19.5) {
      const p = (sec - 16.5) / 3;
      if (p < 0.2) {
        // Fade in char by char
        const text = 'p r e s e n t s';
        const reveal = Math.floor(p / 0.2 * text.length);
        drawText(text.substring(0, reveal), W / 2, H / 2);
      } else if (p < 0.85) {
        drawText('p r e s e n t s', W / 2, H / 2);
      } else {
        // Fade out
        const fade = (p - 0.85) / 0.15;
        const text = 'p r e s e n t s';
        const startX = Math.round(W / 2 - text.length / 2);
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== ' ' && Math.random() > fade) {
            drawChar(startX + i, H / 2, text[i]!);
          }
        }
      }
    }

    // ── Phase 6: Dark pause (19.5–20.5s) ─────────────────────
    else if (sec < 20.5) {
      // Empty — dramatic pause
    }

    // ── Phase 7: "a ghostscan film" + ghost peek (20.5–27s) ──
    else if (sec < 27) {
      const p = (sec - 20.5) / 6.5;

      // Text fades in
      if (p > 0.05) {
        const textAlpha = Math.min((p - 0.05) / 0.2, 1);
        const text = 'a   g h o s t s c a n   f i l m';
        const startX = Math.round(W / 2 - text.length / 2);
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== ' ' && Math.random() < textAlpha) {
            drawChar(startX + i, H / 2 - 4, text[i]!);
          }
        }
      }

      // Ghost enters from below
      if (p > 0.3) {
        const ghostP = (p - 0.3) / 0.4;
        const ghostY = lerp(H + 2, H / 2 - 1, easeOut(Math.min(ghostP, 1)));
        const ghostX = W / 2 - 10 + Math.sin(f * 0.08) * 2;
        drawSprite(GHOST_PEEK, ghostX, ghostY);

        if (f % 30 === 0 && ghostP > 0.5) {
          spawnSparks(ghostX + 10, ghostY, 4);
        }
      }

      // Fade everything out at end
      if (p > 0.85) {
        const fade = (p - 0.85) / 0.15;
        const g = gridRef.current;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (g[y]![x] !== ' ' && Math.random() < fade) {
              g[y]![x] = ' ';
            }
          }
        }
      }

      updateSparks();
    }

    // ── Phase 8: Hold black until loop (27–32s) ──────────────
    // else: empty

    if (preRef.current) {
      preRef.current.textContent = renderGrid();
    }

    frameRef.current = f + 1;
  }, [createGrid, clearGrid, drawChar, drawText, drawSprite, drawLensFlare,
      drawScanline, spawnSparks, updateSparks, renderGrid]);

  useEffect(() => {
    gridRef.current = createGrid();
    const id = setInterval(animate, INTERVAL);
    return () => clearInterval(id);
  }, [animate, createGrid]);

  return (
    <pre
      ref={preRef}
      className="font-data leading-none whitespace-pre select-none"
      style={{
        fontSize: '12px',
        color: 'var(--gs-base)',
        textShadow: '0 0 4px var(--gs-base), 0 0 10px oklch(0.82 0.15 340 / 0.15)',
        lineHeight: '1.15',
      }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
