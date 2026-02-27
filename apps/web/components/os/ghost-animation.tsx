'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Ghost Animation — Programmatic ASCII animation engine

   Renders Chloe ghost moving across a character grid at 15fps.
   Ghost shape: rounded top, big eyes, wide body, wavy bottom with tails.
   Matches the actual Chloe sprite silhouette.
   ================================================================= */

const W = 120;
const H = 30;
const INTERVAL = 67; // ~15fps

// ── Ghost Sprites — matching Chloe's bedsheet ghost shape ──────
// Rounded dome top, wide body, two big eyes, wavy bottom with 3 tails

const GHOST: string[] = [
  '           .::::::::::::.           ',
  '        .::              ::.        ',
  '      .::                  ::.      ',
  '     ::                      ::     ',
  '    ::                        ::    ',
  '   ::    .###.      .###.      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    # * #      # * #      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    \'###\'      \'###\'      ::   ',
  '   ::                          ::   ',
  '   ::           ....           ::   ',
  '   ::                          ::   ',
  '    ::                        ::    ',
  '     ::                      ::     ',
  '      ::                    ::      ',
  '       ::    ::      ::    ::       ',
  '        \'::  \'::    ::\'  ::\'        ',
  '          \'::  \'::::\'  ::\'          ',
  '            \'::      ::\'            ',
];

const GHOST_WINK: string[] = [
  '           .::::::::::::.           ',
  '        .::              ::.        ',
  '      .::                  ::.      ',
  '     ::                      ::     ',
  '    ::                        ::    ',
  '   ::    .###.      .###.      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    # - #      # * #      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    \'###\'      \'###\'      ::   ',
  '   ::                          ::   ',
  '   ::           ....           ::   ',
  '   ::                          ::   ',
  '    ::                        ::    ',
  '     ::                      ::     ',
  '      ::                    ::      ',
  '       ::    ::      ::    ::       ',
  '        \'::  \'::    ::\'  ::\'        ',
  '          \'::  \'::::\'  ::\'          ',
  '            \'::      ::\'            ',
];

const GHOST_HAPPY: string[] = [
  '           .::::::::::::.           ',
  '        .::              ::.        ',
  '      .::                  ::.      ',
  '     ::                      ::     ',
  '    ::                        ::    ',
  '   ::    .###.      .###.      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    # ^ #      # ^ #      ::   ',
  '   ::    #   #      #   #      ::   ',
  '   ::    \'###\'      \'###\'      ::   ',
  '   ::                          ::   ',
  '   ::         .:::::::          ::   ',
  '   ::                          ::   ',
  '    ::                        ::    ',
  '     ::                      ::     ',
  '      ::                    ::      ',
  '       ::    ::      ::    ::       ',
  '        \'::  \'::    ::\'  ::\'        ',
  '          \'::  \'::::\'  ::\'          ',
  '            \'::      ::\'            ',
];

const GHOST_SM: string[] = [
  '      .:::::::.      ',
  '    ::         ::    ',
  '   ::           ::   ',
  '  ::  .##. .##.  ::  ',
  '  ::  # *# # *#  ::  ',
  '  ::  \'##\' \'##\'  ::  ',
  '  ::     ..      ::  ',
  '   ::           ::   ',
  '    ::   :  :  ::    ',
  '     \':  \'::\'  :\'    ',
  '       \'::  ::\'      ',
];

const GHOST_BIG: string[] = [
  '                     .::::::::::::::::::::::.                     ',
  '                 .::\'                        \'::.                 ',
  '              .::\'                              \'::.              ',
  '            ::\'                                    \'::            ',
  '          ::\'                                        \'::          ',
  '         ::                                            ::         ',
  '        ::       .#######.            .#######.         ::        ',
  '       ::        #       #            #       #          ::       ',
  '       ::        #   *   #            #   *   #          ::       ',
  '       ::        #       #            #       #          ::       ',
  '       ::        \'#######\'            \'#######\'          ::       ',
  '       ::                                                ::       ',
  '       ::                  ........                      ::       ',
  '       ::                                                ::       ',
  '        ::                                              ::        ',
  '         ::                                            ::         ',
  '          ::                                          ::          ',
  '           ::                                        ::           ',
  '            ::        ::            ::        ::    ::             ',
  '             \'::      \'::          ::\'      ::\'  ::\'              ',
  '               \'::     \'::       ::\'     ::\'  ::\'                 ',
  '                 \'::     \':::::::\'     ::\'  ::\'                   ',
  '                   \'::              ::\'                            ',
  '                     \'::::::::::::\'                               ',
];

const SPRITE_W = 35;
const SPRITE_H = 20;

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
      for (let sx = 0; sx < row.length; sx += 3) {
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
    for (let i = 0; i < 12; i++) {
      const tx = direction > 0 ? px - 2 - i * 3 : px + SPRITE_W + 2 + i * 3;
      const ty = py + 2 + Math.floor(Math.random() * (spriteH - 4));
      trails.push({ x: Math.round(tx), y: Math.round(ty), char: i < 4 ? '-' : '~', age: 0 });
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
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 1,
        life: Math.floor(Math.random() * 10) + 4,
        char: SPARKLE_CHARS[Math.floor(Math.random() * SPARKLE_CHARS.length)]!,
      });
    }
  }, []);

  const drawScanlines = useCallback((density: number) => {
    const g = gridRef.current;
    for (let y = 0; y < H; y += 2) {
      if (Math.random() < density) {
        for (let x = 0; x < W; x++) {
          if (g[y]![x] === ' ' && Math.random() < 0.25) {
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
    const t = (f % LOOP) / LOOP;
    const sec = t * 32;

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
      gx = lerp(-SPRITE_W - 10, W * 0.35, easeOut(p));
      gy = H * 0.2 + Math.sin(f * 0.12) * 3;
      showTrail = p < 0.7;
      showSpeedTrail = p < 0.5;
      speedDir = 1;
    }
    // ── Scene 2: Float around center, looking around (4–9s) ──
    else if (sec < 9) {
      const p = (sec - 4) / 5;
      gx = W * 0.35 + Math.sin(p * Math.PI * 3) * 15;
      gy = H * 0.2 + Math.sin(f * 0.1) * 3.5 + Math.cos(f * 0.07) * 2;
      if (Math.floor(sec * 2) % 6 === 0) sprite = GHOST_WINK;
      if (f % 90 === 0) spawnSparkles(gx + SPRITE_W / 2, gy + SPRITE_H / 2, 6);
    }
    // ── Scene 3: Ghost rushes toward camera (9–11s) ──────────
    else if (sec < 11) {
      const p = (sec - 9) / 2;
      gx = lerp(W * 0.35, W * 0.22, easeInOut(p));
      gy = lerp(H * 0.2, 1, easeInOut(p));
      sprite = GHOST_HAPPY;
      if (p > 0.7) drawScanlines(0.4);
    }
    // ── Scene 4: SCREEN TAKEOVER — huge ghost face (11–14s) ──
    else if (sec < 14) {
      const p = (sec - 11) / 3;
      sprite = GHOST_BIG;
      gx = W / 2 - 33;
      gy = lerp(-6, 3, easeOut(Math.min(p * 1.5, 1)));
      drawScanlines(0.12);
      if (p < 0.2 || (p > 0.8 && p < 1)) drawStatic(0.04);
      if (f % 25 === 0) spawnSparkles(W / 2, H / 2, 10);
    }
    // ── Scene 5: Screen clears, ghost is small top-right (14–16s)
    else if (sec < 16) {
      const p = (sec - 14) / 2;
      sprite = GHOST_SM;
      gx = lerp(W / 2, W * 0.78, easeInOut(p));
      gy = lerp(H / 2, 2, easeInOut(p));
      if (p < 0.3) drawStatic(0.05 * (1 - p / 0.3));
    }
    // ── Scene 6: Speed dash right-to-left (16–19s) ───────────
    else if (sec < 19) {
      const p = (sec - 16) / 3;
      gx = lerp(W + 15, -SPRITE_W - 15, easeInOut(p));
      gy = H * 0.3 + Math.sin(f * 0.2) * 2;
      showSpeedTrail = true;
      speedDir = -1;
    }
    // ── Scene 7: Peek from bottom, rise up (19–22s) ──────────
    else if (sec < 22) {
      const p = (sec - 19) / 3;
      gx = W * 0.38 + Math.sin(p * Math.PI) * 10;
      gy = lerp(H + 5, H * 0.18, easeInOut(p));
      if (p > 0.7) sprite = GHOST_WINK;
    }
    // ── Scene 8: Zigzag across screen (22–27s) ───────────────
    else if (sec < 27) {
      const p = (sec - 22) / 5;
      gx = lerp(W * 0.05, W * 0.7, p) + Math.sin(p * Math.PI * 6) * 12;
      gy = H * 0.1 + Math.sin(p * Math.PI * 4) * (H * 0.3);
      showTrail = true;
      if (f % 50 === 0) spawnSparkles(gx + SPRITE_W / 2, gy, 5);
    }
    // ── Scene 9: Ghost pauses center, happy (27–29.5s) ────────
    else if (sec < 29.5) {
      const p = (sec - 27) / 2.5;
      gx = W * 0.35 + Math.sin(f * 0.08) * 3;
      gy = H * 0.2 + Math.cos(f * 0.06) * 1.5;
      sprite = GHOST_HAPPY;
      if (p > 0.4) spawnSparkles(gx + SPRITE_W / 2, gy - 2, 3);
    }
    // ── Scene 10: Exit right fast (29.5–32s) ─────────────────
    else {
      const p = (sec - 29.5) / 2.5;
      gx = lerp(W * 0.35, W + 25, easeInOut(p));
      gy = H * 0.2 + Math.sin(f * 0.15) * 2.5;
      showTrail = p < 0.6;
      showSpeedTrail = true;
      speedDir = 1;
    }

    // ── Compose frame ────────────────────────────────────────

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
        fontSize: '12px',
        color: 'var(--gs-base)',
        textShadow: '0 0 4px var(--gs-base), 0 0 10px oklch(0.82 0.15 340 / 0.15)',
        lineHeight: '1.15',
      }}
    />
  );
}
