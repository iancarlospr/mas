'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/* =================================================================
   A22 Films — Boutique studio intro. 200×55, 6.5px.
   Opens with FULL SCREEN pink ▒▓█ TV glitch.
   Logo constructs via box-drawing wireframe + braille fill.
   ================================================================= */

const W = 200;
const H = 55;
const FPS = 15;
const MS = Math.round(1000 / FPS);
const LOOP = 32;

// ── Character sets ──────────────────────────────────────────────

const STATIC = ['░', '▒', '▓', '█'];
const GLITCH = ['█', '▓', '░', '▒', '║', '═', '╬', '╠', '╣', '╦', '╩', '▌', '▐'];
const BRAILLE_LIGHT = ['⠁', '⠂', '⠄', '⠈', '⠐', '⠠'];
const BRAILLE_MED = ['⠃', '⠅', '⠉', '⠑', '⠡', '⠆', '⠊', '⠒', '⠢'];
const BRAILLE_DENSE = ['⠇', '⠋', '⠓', '⠣', '⠞', '⠖', '⠚', '⠲', '⠦', '⠴'];
const BRAILLE_FULL = ['⠿', '⡿', '⣿', '⣷', '⣯', '⣟', '⡷', '⢿'];

// ── Letter definitions (11 rows × 10 cols) ──────────────────────

const L_A = [
  [0,0,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0],
  [0,1,1,0,0,0,0,1,1,0],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1,1,1],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,0,0,0,0,0,0,1,1],
  [1,1,0,0,0,0,0,0,1,1],
];

const L_2 = [
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,0,0,0,0,0,0,1,1],
  [0,0,0,0,0,0,0,0,1,1],
  [0,0,0,0,0,0,0,1,1,0],
  [0,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,1,1,0,0,0],
  [0,0,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,0,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,0],
  [0,1,1,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1],
];

// Each pixel: 4 chars wide × 2 lines tall
const PX_W = 4;
const PX_H = 2;
const LETTER_PX_COLS = 10;
const LETTER_PX_ROWS = 11;
const LETTER_CHAR_W = LETTER_PX_COLS * PX_W; // 40
const LETTER_CHAR_H = LETTER_PX_ROWS * PX_H; // 22
const GAP = 8;
const TOTAL_W = LETTER_CHAR_W * 3 + GAP * 2; // 136
const OFFSET_X = Math.floor((W - TOTAL_W) / 2);
const OFFSET_Y = Math.floor((H - LETTER_CHAR_H) / 2);

// ── Overlay ─────────────────────────────────────────────────────

type OverlayPos = 'center-top' | 'center' | 'hidden';

interface OverlayState {
  line1: string;
  line2: string;
  pos: OverlayPos;
  big: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

function isEdge(grid: number[][], row: number, col: number): boolean {
  if (!grid[row]?.[col]) return false;
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr, dc] of dirs) {
    const nr = row + dr!, nc = col + dc!;
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0]!.length || !grid[nr]![nc]) return true;
  }
  return false;
}

function getBoxChar(grid: number[][], row: number, col: number): string {
  const u = row > 0 && !!grid[row - 1]?.[col];
  const d = row < grid.length - 1 && !!grid[row + 1]?.[col];
  const l = col > 0 && !!grid[row]![col - 1];
  const r = col < grid[0]!.length - 1 && !!grid[row]![col + 1];

  if (u && d && l && r) return '╬';
  if (u && d && r) return '╠';
  if (u && d && l) return '╣';
  if (u && l && r) return '╩';
  if (d && l && r) return '╦';
  if (u && d) return '║';
  if (l && r) return '═';
  if (d && r) return '╔';
  if (d && l) return '╗';
  if (u && r) return '╚';
  if (u && l) return '╝';
  if (u || d) return '║';
  if (l || r) return '═';
  return '╬';
}

// ── Main component ──────────────────────────────────────────────

export function A22Animation() {
  const preRef = useRef<HTMLPreElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fRef = useRef(0);
  const [, setTick] = useState(0);

  const render = useCallback(() => {
    const f = fRef.current;
    const g: string[][] = Array.from({ length: H }, () => Array(W).fill(' '));
    const sec = (f / FPS) % LOOP;
    const overlay: OverlayState = { line1: '', line2: '', pos: 'hidden', big: false };

    const put = (x: number, y: number, c: string) => {
      const ix = Math.round(x), iy = Math.round(y);
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) g[iy]![ix] = c;
    };

    // ── Render a letter at position using specific style ────
    const drawLetter = (
      grid: number[][],
      ox: number, oy: number,
      mode: 'wireframe' | 'braille' | 'full',
      progress: number // 0-1 how much to reveal
    ) => {
      const totalPx = LETTER_PX_ROWS * LETTER_PX_COLS;
      const revealCount = Math.floor(progress * totalPx);
      let count = 0;

      for (let row = 0; row < LETTER_PX_ROWS; row++) {
        for (let col = 0; col < LETTER_PX_COLS; col++) {
          if (!grid[row]![col]) continue;
          count++;
          if (count > revealCount) continue;

          const px = ox + col * PX_W;
          const py = oy + row * PX_H;
          const edge = isEdge(grid, row, col);

          for (let dy = 0; dy < PX_H; dy++) {
            for (let dx = 0; dx < PX_W; dx++) {
              const cx = px + dx;
              const cy = py + dy;

              if (mode === 'wireframe' || (mode === 'full' && edge)) {
                // Box-drawing for edges
                if (edge) {
                  const boxCh = getBoxChar(grid, row, col);
                  // Top/bottom of pixel block get horizontal chars, sides get vertical
                  if (dy === 0 && dx === 0) put(cx, cy, boxCh);
                  else if (dy === 0) put(cx, cy, '═');
                  else if (dx === 0) put(cx, cy, '║');
                  else if (dy === PX_H - 1 && dx === PX_W - 1) put(cx, cy, boxCh === '╔' ? '╝' : boxCh === '╗' ? '╚' : boxCh === '╚' ? '╗' : boxCh === '╝' ? '╔' : '╬');
                  else put(cx, cy, mode === 'full' ? '═' : ' ');
                } else if (mode === 'wireframe') {
                  // Interior during wireframe — mostly empty
                  if (Math.random() < 0.03) put(cx, cy, BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!);
                }
              }

              if (mode === 'braille' || (mode === 'full' && !edge)) {
                // Braille for interiors
                if (!edge || mode === 'braille') {
                  const depth = Math.random();
                  if (depth < 0.3) put(cx, cy, BRAILLE_FULL[Math.floor(Math.random() * BRAILLE_FULL.length)]!);
                  else if (depth < 0.6) put(cx, cy, BRAILLE_DENSE[Math.floor(Math.random() * BRAILLE_DENSE.length)]!);
                  else if (depth < 0.85) put(cx, cy, BRAILLE_MED[Math.floor(Math.random() * BRAILLE_MED.length)]!);
                  else put(cx, cy, BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!);
                }
              }
            }
          }
        }
      }
    };

    // ── Full screen pink static ─────────────────────────────
    const pinkStatic = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (Math.random() < intensity) {
            g[y]![x] = STATIC[Math.floor(Math.random() * STATIC.length)]!;
          }
        }
      }
    };

    // ── VHS tracking glitch ─────────────────────────────────
    const vhsGlitch = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        if (Math.random() < intensity * 0.2) {
          const shift = Math.floor((Math.random() - 0.5) * 20);
          const row = [...g[y]!];
          for (let x = 0; x < W; x++) {
            const sx = x - shift;
            g[y]![x] = (sx >= 0 && sx < W) ? row[sx]! : GLITCH[Math.floor(Math.random() * GLITCH.length)]!;
          }
        }
      }
    };

    const border = (pattern: string) => {
      for (let x = 0; x < W; x++) {
        put(x, 0, pattern[x % pattern.length]!);
        put(x, H - 1, pattern[(x + 2) % pattern.length]!);
      }
      for (let y = 0; y < H; y++) {
        put(0, y, pattern[y % pattern.length]!);
        put(W - 1, y, pattern[(y + 1) % pattern.length]!);
      }
    };

    // ═══════════════════════════════════════════════════════════
    // SCENES (32s, no loop — holds black at end)
    // ═══════════════════════════════════════════════════════════

    if (sec < 3) {
      // ── FULL SCREEN PINK GLITCH — in your face ────────────
      const p = sec / 3;
      // Entire screen is ▒▓█
      pinkStatic(1.0);
      // Heavy VHS tracking
      vhsGlitch(0.8);
      // Occasional full-line █ bars
      for (let y = 0; y < H; y++) {
        if (Math.random() < 0.12) {
          const ch = STATIC[Math.floor(Math.random() * STATIC.length)]!;
          for (let x = 0; x < W; x++) g[y]![x] = ch;
        }
      }
      // Border pulses
      if (f % 4 < 2) border('█▓▒░');
      // Start clearing from center in last second
      if (p > 0.65) {
        const clearP = (p - 0.65) / 0.35;
        const radius = clearP * Math.max(W, H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const dx = (x - W / 2) * 0.5;
            const dy = y - H / 2;
            if (Math.sqrt(dx * dx + dy * dy) < radius * 0.3) {
              if (Math.random() < clearP * 0.7) g[y]![x] = ' ';
            }
          }
        }
      }
    }

    else if (sec < 5) {
      // ── Static retreats to edges, center clears ───────────
      const p = (sec - 3) / 2;
      const clearRadius = easeOut(p) * 50;
      pinkStatic(1 - p * 0.7);
      // Clear center
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) * 0.5;
          const dy = y - H / 2;
          if (Math.sqrt(dx * dx + dy * dy) < clearRadius) {
            if (Math.random() < p) g[y]![x] = ' ';
          }
        }
      }
      vhsGlitch(0.3 * (1 - p));
      // Faint braille particles float in cleared area
      if (p > 0.4) {
        const count = Math.floor((p - 0.4) * 20);
        for (let i = 0; i < count; i++) {
          put(W / 2 + (Math.random() - 0.5) * 60, H / 2 + (Math.random() - 0.5) * 20,
            BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!);
        }
      }
    }

    else if (sec < 9) {
      // ── Wireframe constructs A22 ──────────────────────────
      const p = (sec - 5) / 4;
      // A builds 0-0.33, first 2 builds 0.33-0.66, second 2 builds 0.66-1
      const aP = Math.min(p / 0.33, 1);
      const t1P = Math.max(0, Math.min((p - 0.25) / 0.33, 1));
      const t2P = Math.max(0, Math.min((p - 0.5) / 0.33, 1));

      drawLetter(L_A, OFFSET_X, OFFSET_Y, 'wireframe', easeOut(aP));
      drawLetter(L_2, OFFSET_X + LETTER_CHAR_W + GAP, OFFSET_Y, 'wireframe', easeOut(t1P));
      drawLetter(L_2, OFFSET_X + (LETTER_CHAR_W + GAP) * 2, OFFSET_Y, 'wireframe', easeOut(t2P));

      // Residual static at edges
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if ((x < 8 || x > W - 8 || y < 3 || y > H - 3) && Math.random() < 0.05 * (1 - p)) {
            g[y]![x] = STATIC[Math.floor(Math.random() * STATIC.length)]!;
          }
        }
      }
    }

    else if (sec < 12) {
      // ── Braille texture fills in ──────────────────────────
      const p = (sec - 9) / 3;
      // Draw wireframe fully first
      drawLetter(L_A, OFFSET_X, OFFSET_Y, 'wireframe', 1);
      drawLetter(L_2, OFFSET_X + LETTER_CHAR_W + GAP, OFFSET_Y, 'wireframe', 1);
      drawLetter(L_2, OFFSET_X + (LETTER_CHAR_W + GAP) * 2, OFFSET_Y, 'wireframe', 1);
      // Overlay braille fill progressively
      const fillP = easeOut(p);
      drawLetter(L_A, OFFSET_X, OFFSET_Y, 'braille', fillP);
      drawLetter(L_2, OFFSET_X + LETTER_CHAR_W + GAP, OFFSET_Y, 'braille', Math.max(0, fillP - 0.1));
      drawLetter(L_2, OFFSET_X + (LETTER_CHAR_W + GAP) * 2, OFFSET_Y, 'braille', Math.max(0, fillP - 0.2));
    }

    else if (sec < 17) {
      // ── Full logo holds + FILMS appears ───────────────────
      const p = (sec - 12) / 5;
      drawLetter(L_A, OFFSET_X, OFFSET_Y, 'full', 1);
      drawLetter(L_2, OFFSET_X + LETTER_CHAR_W + GAP, OFFSET_Y, 'full', 1);
      drawLetter(L_2, OFFSET_X + (LETTER_CHAR_W + GAP) * 2, OFFSET_Y, 'full', 1);

      // Subtle braille shimmer around letters
      if (f % 3 === 0) {
        for (let i = 0; i < 6; i++) {
          put(OFFSET_X + Math.random() * TOTAL_W, OFFSET_Y + Math.random() * LETTER_CHAR_H,
            BRAILLE_MED[Math.floor(Math.random() * BRAILLE_MED.length)]!);
        }
      }

      // Divider line
      if (p > 0.15) {
        const lineP = Math.min((p - 0.15) / 0.15, 1);
        const lineY = OFFSET_Y + LETTER_CHAR_H + 2;
        const lineStart = Math.floor(W / 2 - TOTAL_W / 2 * lineP);
        const lineEnd = Math.floor(W / 2 + TOTAL_W / 2 * lineP);
        for (let x = lineStart; x < lineEnd; x++) put(x, lineY, '═');
      }

      // FILMS text overlay
      if (p > 0.25) {
        const tp = Math.min((p - 0.25) / 0.2, 1);
        const msg = 'F  I  L  M  S';
        overlay.line1 = msg.slice(0, Math.floor(tp * msg.length));
        overlay.pos = 'center';
      }
    }

    else if (sec < 19.5) {
      // ── Dissolve — letters scatter into braille dust ──────
      const p = (sec - 17) / 2.5;
      const letters = [L_A, L_2, L_2];
      const offsets = [0, LETTER_CHAR_W + GAP, (LETTER_CHAR_W + GAP) * 2];

      for (let li = 0; li < 3; li++) {
        const grid = letters[li]!;
        for (let row = 0; row < LETTER_PX_ROWS; row++) {
          for (let col = 0; col < LETTER_PX_COLS; col++) {
            if (!grid[row]![col]) continue;
            const px = OFFSET_X + offsets[li]! + col * PX_W;
            const py = OFFSET_Y + row * PX_H;
            // Scatter outward
            const angle = Math.atan2(row - LETTER_PX_ROWS / 2, col - LETTER_PX_COLS / 2);
            const dist = p * (10 + Math.random() * 20);
            const sx = px + Math.cos(angle) * dist * 2;
            const sy = py + Math.sin(angle) * dist;
            const fade = 1 - p;
            if (Math.random() < fade) {
              const ch = fade > 0.6 ? BRAILLE_FULL[Math.floor(Math.random() * BRAILLE_FULL.length)]!
                : fade > 0.3 ? BRAILLE_MED[Math.floor(Math.random() * BRAILLE_MED.length)]!
                : BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!;
              put(sx, sy, ch);
            }
          }
        }
      }
    }

    else if (sec < 22) {
      // ── "presents" ────────────────────────────────────────
      const p = (sec - 19.5) / 2.5;
      const fadeIn = Math.min(p * 4, 1);
      const fadeOut = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;

      if (fadeIn * fadeOut > 0.1) {
        overlay.line1 = 'p r e s e n t s';
        overlay.pos = 'center';
      }

      // Ambient braille dust
      const count = Math.floor(fadeIn * fadeOut * 15);
      for (let i = 0; i < count; i++) {
        put(W / 2 + (Math.random() - 0.5) * 80, H / 2 + (Math.random() - 0.5) * 20,
          BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!);
      }
    }

    else if (sec < 23.5) {
      // ── Dark pause ────────────────────────────────────────
      // Minimal floating braille
      for (let i = 0; i < 5; i++) {
        put(Math.random() * W, Math.random() * H,
          BRAILLE_LIGHT[Math.floor(Math.random() * BRAILLE_LIGHT.length)]!);
      }
    }

    else if (sec < 29) {
      // ── "a ghostscan film" ────────────────────────────────
      const p = (sec - 23.5) / 5.5;

      if (p > 0.05) {
        const tp = Math.min((p - 0.05) / 0.2, 1);
        const msg = 'a  g h o s t s c a n  f i l m';
        overlay.line1 = msg.slice(0, Math.floor(tp * msg.length));
        overlay.pos = 'center';
      }

      // Braille shimmer ambient
      const count = Math.floor(8);
      for (let i = 0; i < count; i++) {
        put(W / 2 + (Math.random() - 0.5) * 100, H / 2 + (Math.random() - 0.5) * 30,
          BRAILLE_MED[Math.floor(Math.random() * BRAILLE_MED.length)]!);
      }

      // Fade out
      if (p > 0.85) {
        overlay.line1 = '';
        overlay.pos = 'hidden';
      }
    }

    // else: hold black

    // ── Render ──────────────────────────────────────────────

    if (preRef.current) preRef.current.textContent = g.map(r => r.join('')).join('\n');

    if (overlayRef.current) {
      const el = overlayRef.current;
      if (overlay.pos === 'hidden' || !overlay.line1) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
        el.style.left = '50%';
        el.style.right = 'auto';
        if (overlay.pos === 'center-top') {
          el.style.top = '8%';
        } else {
          el.style.top = sec >= 12 && sec < 17 ? '72%' : '48%';
        }
        el.style.transform = 'translateX(-50%)';
        el.style.textAlign = 'center';
        el.style.fontSize = overlay.big ? '28px' : '20px';
        el.style.fontWeight = '300';
        el.style.letterSpacing = '0.15em';
        el.innerHTML = overlay.line1;
      }
    }

    fRef.current = f + 1;
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    const id = setInterval(render, MS);
    return () => clearInterval(id);
  }, [render]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <pre
        ref={preRef}
        className="font-data leading-none whitespace-pre select-none"
        style={{
          fontSize: 'min(6.5px, calc(100vw / 120))',
          color: 'var(--gs-base)',
          textShadow: '0 0 5px var(--gs-base), 0 0 12px oklch(0.82 0.15 340 / 0.2)',
          lineHeight: '1.1',
        }}
      />
      <div
        ref={overlayRef}
        className="font-data select-none pointer-events-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          fontSize: '20px',
          color: 'var(--gs-base)',
          textShadow: '0 0 8px var(--gs-base), 0 0 20px oklch(0.82 0.15 340 / 0.3), 0 0 40px oklch(0.82 0.15 340 / 0.1)',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          whiteSpace: 'nowrap',
          letterSpacing: '0.15em',
          fontWeight: 300,
          zIndex: 10,
        }}
      />
    </div>
  );
}

function easeOut(t: number): number { return 1 - (1 - t) ** 3; }
