'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Ghost Animation — Programmatic ASCII animation engine

   Renders a ghost sprite moving across a character grid at 15fps.
   Ghost floats, dashes, does screen takeovers, leaves trails.
   All computed in real-time — no JSON frames.
   ================================================================= */

const W = 100;
const H = 24;
const INTERVAL = 67; // ~15fps

// ── Ghost Sprites ──────────────────────────────────────────────

const GHOST_SM: string[] = [
  '  .:::.  ',
  ' :: o o::',
  ' ::  _  ::',
  '  \':::\' ',
  '   \': :\'  ',
];

const GHOST: string[] = [
  '      .:::::::.      ',
  '    .::       ::.    ',
  '   ::           ::   ',
  '  ::   ##   ##   ::  ',
  '  ::             ::  ',
  '  ::    .---.    ::  ',
  '   ::           ::   ',
  '    \'::       ::\'    ',
  '      \':::.:::\'      ',
  '        \': :\'        ',
  '         \':\'         ',
];

const GHOST_WINK: string[] = [
  '      .:::::::.      ',
  '    .::       ::.    ',
  '   ::           ::   ',
  '  ::   --   ##   ::  ',
  '  ::             ::  ',
  '  ::    .---.    ::  ',
  '   ::           ::   ',
  '    \'::       ::\'    ',
  '      \':::.:::\'      ',
  '        \': :\'        ',
  '         \':\'         ',
];

const GHOST_OOH: string[] = [
  '      .:::::::.      ',
  '    .::       ::.    ',
  '   ::           ::   ',
  '  ::   OO   OO   ::  ',
  '  ::             ::  ',
  '  ::     (O)     ::  ',
  '   ::           ::   ',
  '    \'::       ::\'    ',
  '      \':::.:::\'      ',
  '        \': :\'        ',
  '         \':\'         ',
];

const GHOST_BIG: string[] = [
  '             .:::::::::::::::::::::::.             ',
  '           .::                       ::.           ',
  '         .::                           ::.         ',
  '        ::                               ::        ',
  '       ::                                 ::       ',
  '      ::      .####.          .####.       ::      ',
  '      ::      #    #          #    #       ::      ',
  '      ::      \'####\'          \'####\'       ::      ',
  '      ::                                   ::      ',
  '      ::                                   ::      ',
  '      ::         .:::::::::::.             ::      ',
  '       ::       ::           ::           ::       ',
  '        ::       \':::::::::::\'            ::       ',
  '         \'::                           ::\'         ',
  '           \'::                       ::\'           ',
  '             \'::::::::::::::::::::::\'              ',
  '                  \':            :\'                  ',
  '                    \':        :\'                    ',
];

const SPRITE_W = 21;
const SPRITE_H = 11;

// ── Math helpers ───────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ── Trail system ───────────────────────────────────────────────

interface Trail {
  x: number;
  y: number;
  char: string;
  age: number;
}

const TRAIL_FADE = ['.', ':', '.', ' '];

// ── Particle system ────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  char: string;
}

const SPARKLE_CHARS = ['*', '+', '.', ':', '~'];

// ── Main component ─────────────────────────────────────────────

export function GhostAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);
  const gridRef = useRef<string[][]>([]);
  const trailsRef = useRef<Trail[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const prevPosRef = useRef({ x: -100, y: -100 });

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

  const drawSprite = useCallback((sprite: string[], px: number, py: number) => {
    const g = gridRef.current;
    for (let sy = 0; sy < sprite.length; sy++) {
      const row = sprite[sy]!;
      for (let sx = 0; sx < row.length; sx++) {
        const gx = Math.round(px) + sx;
        const gy = Math.round(py) + sy;
        if (gx >= 0 && gx < W && gy >= 0 && gy < H && row[sx] !== ' ') {
          g[gy]![gx] = row[sx]!;
        }
      }
    }
  }, []);

  const addTrailFromSprite = useCallback((sprite: string[], px: number, py: number) => {
    const trails = trailsRef.current;
    for (let sy = 0; sy < sprite.length; sy++) {
      const row = sprite[sy]!;
      // Only add edge characters as trails (every other char for perf)
      for (let sx = 0; sx < row.length; sx += 2) {
        if (row[sx] !== ' ') {
          trails.push({
            x: Math.round(px) + sx,
            y: Math.round(py) + sy,
            char: row[sx]!,
            age: 0,
          });
        }
      }
    }
  }, []);

  const addSpeedTrail = useCallback((px: number, py: number, spriteH: number, direction: number) => {
    const trails = trailsRef.current;
    const chars = direction > 0 ? ['-', '~', '.'] : ['-', '~', '.'];
    for (let i = 0; i < 8; i++) {
      const tx = direction > 0 ? px - 2 - i * 3 : px + SPRITE_W + 2 + i * 3;
      const ty = py + Math.floor(Math.random() * spriteH);
      trails.push({ x: Math.round(tx), y: Math.round(ty), char: chars[i % chars.length]!, age: 0 });
    }
  }, []);

  const updateTrails = useCallback(() => {
    const g = gridRef.current;
    const trails = trailsRef.current;
    for (let i = trails.length - 1; i >= 0; i--) {
      const t = trails[i]!;
      t.age++;
      if (t.age >= TRAIL_FADE.length) {
        trails.splice(i, 1);
        continue;
      }
      const fadeChar = TRAIL_FADE[t.age]!;
      if (t.x >= 0 && t.x < W && t.y >= 0 && t.y < H) {
        if (g[t.y]![t.x] === ' ') {
          g[t.y]![t.x] = fadeChar;
        }
      }
    }
  }, []);

  const updateParticles = useCallback(() => {
    const g = gridRef.current;
    const parts = particlesRef.current;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      const gx = Math.round(p.x);
      const gy = Math.round(p.y);
      if (gx >= 0 && gx < W && gy >= 0 && gy < H && g[gy]![gx] === ' ') {
        g[gy]![gx] = p.char;
      }
    }
  }, []);

  const spawnSparkles = useCallback((cx: number, cy: number, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 1,
        life: Math.floor(Math.random() * 8) + 3,
        char: SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)]!,
      });
    }
  }, []);

  const drawScanlines = useCallback((density: number) => {
    const g = gridRef.current;
    for (let y = 0; y < H; y += 2) {
      if (Math.random() < density) {
        for (let x = 0; x < W; x++) {
          if (g[y]![x] === ' ' && Math.random() < 0.3) {
            g[y]![x] = Math.random() < 0.5 ? '-' : '~';
          }
        }
      }
    }
  }, []);

  const drawStatic = useCallback((density: number) => {
    const g = gridRef.current;
    const chars = '.,:;\'`';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y]![x] === ' ' && Math.random() < density) {
          g[y]![x] = chars[Math.floor(Math.random() * chars.length)]!;
        }
      }
    }
  }, []);

  const renderGrid = useCallback((): string => {
    return gridRef.current.map(row => row.join('')).join('\n');
  }, []);

  // ── Animation loop ─────────────────────────────────────────

  const animate = useCallback(() => {
    if (!gridRef.current.length) gridRef.current = createGrid();

    const f = frameRef.current;
    const LOOP = 480; // ~32 seconds at 15fps
    const t = (f % LOOP) / LOOP; // 0–1 through the loop
    const sec = t * 32; // 0–32 seconds

    clearGrid();

    let gx = 0;
    let gy = 0;
    let sprite = GHOST;
    let showTrail = false;
    let showSpeedTrail = false;
    let speedDir = 1;

    // ── Scene 1: Ghost enters from far left (0–4s) ──────────
    if (sec < 4) {
      const p = sec / 4;
      gx = lerp(-SPRITE_W - 5, W * 0.38, easeOut(p));
      gy = H * 0.3 + Math.sin(f * 0.13) * 2.5;
      showTrail = p < 0.7;
      showSpeedTrail = p < 0.5;
      speedDir = 1;
    }
    // ── Scene 2: Float around center, looking around (4–9s) ──
    else if (sec < 9) {
      const p = (sec - 4) / 5;
      gx = W * 0.38 + Math.sin(p * Math.PI * 3) * 12;
      gy = H * 0.28 + Math.sin(f * 0.1) * 3 + Math.cos(f * 0.07) * 1.5;
      // Alternate wink every 1.5s
      if (Math.floor(sec * 2) % 6 === 0) sprite = GHOST_WINK;
      if (f % 90 === 0) spawnSparkles(gx + SPRITE_W / 2, gy + SPRITE_H / 2, 5);
    }
    // ── Scene 3: Ghost rushes toward camera (9–11s) ──────────
    else if (sec < 11) {
      const p = (sec - 9) / 2;
      gx = lerp(W * 0.38, W * 0.25, easeInOut(p));
      gy = lerp(H * 0.28, 2, easeInOut(p));
      if (p > 0.4) {
        sprite = GHOST_OOH;
      }
      if (p > 0.7) {
        drawScanlines(0.4);
      }
    }
    // ── Scene 4: SCREEN TAKEOVER — huge ghost face (11–13.5s) ─
    else if (sec < 13.5) {
      const p = (sec - 11) / 2.5;
      sprite = GHOST_BIG;
      gx = W / 2 - 25;
      gy = lerp(-5, 3, easeOut(Math.min(p * 1.5, 1)));
      drawScanlines(0.15);
      if (p < 0.2 || (p > 0.8 && p < 1)) drawStatic(0.04);
      if (f % 30 === 0) spawnSparkles(W / 2, H / 2, 8);
    }
    // ── Scene 5: Screen clears, ghost is tiny top-right (13.5–15s) ─
    else if (sec < 15) {
      const p = (sec - 13.5) / 1.5;
      sprite = GHOST_SM;
      gx = lerp(W / 2, W * 0.82, easeInOut(p));
      gy = lerp(H / 2, 2, easeInOut(p));
      if (p < 0.3) drawStatic(0.06 * (1 - p / 0.3));
    }
    // ── Scene 6: Speed dash right-to-left (15–18s) ───────────
    else if (sec < 18) {
      const p = (sec - 15) / 3;
      gx = lerp(W + 10, -SPRITE_W - 10, easeInOut(p));
      gy = H * 0.35 + Math.sin(f * 0.2) * 1.5;
      showSpeedTrail = true;
      speedDir = -1;
    }
    // ── Scene 7: Peek from bottom, rise up (18–21s) ──────────
    else if (sec < 21) {
      const p = (sec - 18) / 3;
      gx = W * 0.4 + Math.sin(p * Math.PI) * 8;
      gy = lerp(H + 3, H * 0.25, easeInOut(p));
      if (p > 0.7) sprite = GHOST_WINK;
    }
    // ── Scene 8: Zigzag across screen (21–26s) ───────────────
    else if (sec < 26) {
      const p = (sec - 21) / 5;
      gx = lerp(W * 0.1, W * 0.75, p) + Math.sin(p * Math.PI * 6) * 10;
      gy = H * 0.15 + Math.sin(p * Math.PI * 4) * (H * 0.3);
      showTrail = true;
      if (f % 60 === 0) spawnSparkles(gx + SPRITE_W / 2, gy, 4);
    }
    // ── Scene 9: Ghost pauses center, does "boo" (26–28.5s) ──
    else if (sec < 28.5) {
      const p = (sec - 26) / 2.5;
      gx = W * 0.38 + Math.sin(f * 0.08) * 2;
      gy = H * 0.3 + Math.cos(f * 0.06) * 1;
      sprite = GHOST_OOH;
      if (p > 0.5) spawnSparkles(gx + SPRITE_W / 2, gy - 2, 2);
    }
    // ── Scene 10: Exit right fast (28.5–32s) ─────────────────
    else {
      const p = (sec - 28.5) / 3.5;
      gx = lerp(W * 0.38, W + 20, easeInOut(p));
      gy = H * 0.3 + Math.sin(f * 0.15) * 2;
      showTrail = p < 0.6;
      showSpeedTrail = true;
      speedDir = 1;
    }

    // ── Compose frame ────────────────────────────────────────

    // Add trails before drawing sprite
    const currX = Math.round(gx);
    const currY = Math.round(gy);
    const moved = Math.abs(currX - prevPosRef.current.x) > 1 || Math.abs(currY - prevPosRef.current.y) > 1;

    if (showTrail && moved) {
      addTrailFromSprite(sprite, prevPosRef.current.x, prevPosRef.current.y);
    }
    if (showSpeedTrail && moved) {
      addSpeedTrail(gx, gy, sprite.length, speedDir);
    }

    updateTrails();
    updateParticles();
    drawSprite(sprite, gx, gy);

    prevPosRef.current = { x: currX, y: currY };

    if (preRef.current) {
      preRef.current.textContent = renderGrid();
    }

    frameRef.current = f + 1;
  }, [createGrid, clearGrid, drawSprite, addTrailFromSprite, addSpeedTrail,
      updateTrails, updateParticles, spawnSparkles, drawScanlines, drawStatic, renderGrid]);

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
        fontSize: '11px',
        color: 'var(--gs-base)',
        textShadow: '0 0 4px var(--gs-base), 0 0 10px oklch(0.82 0.15 340 / 0.15)',
        lineHeight: '1.1',
      }}
    />
  );
}
