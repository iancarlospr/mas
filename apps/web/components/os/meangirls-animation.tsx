'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/* =================================================================
   Mean Girls — THE star of the show. Every technique combined.
   200×55, 6.5px. Block art, box-drawing, braille, stippling,
   chaos chars, psychedelic fills, VHS glitch, 20px overlay.
   Ends BIG CRAZY OVER THE TOP GIRLY POP LOUD.
   55s loop.
   ================================================================= */

const W = 200;
const H = 55;
const FPS = 15;
const MS = Math.round(1000 / FPS);
const LOOP = 55;

// ── ALL character palettes ──────────────────────────────────────

const BLOCK = ['░', '▒', '▓', '█'];
const CHAOS = ['$', 'Ñ', '≈', '∞', '◊', '★', '♦', '♪', '◆', '●', '○', '▲', '▼', '◀', '▶'];
const STIPPLE = ['·', '∘', '◦', '•', '●', '○'];
const BRAILLE_L = ['⠁', '⠂', '⠄', '⠈', '⠐', '⠠'];
const BRAILLE_M = ['⠃', '⠅', '⠉', '⠑', '⠡', '⠆'];
const BRAILLE_D = ['⠇', '⠋', '⠓', '⠣', '⠞', '⠖'];
const BRAILLE_F = ['⠿', '⡿', '⣿', '⣷', '⣯', '⣟'];
const GLITCH = ['█', '▓', '░', '▒', '║', '═', '╬', '▌', '▐'];
const WAVE = [' ', '·', ':', '░', '▒', '▓', '█', '▓', '▒', '░', ':', '·'];
const HEARTS = ['♥', '♦', '★', '◆', '●', '♪'];

// ── Art pieces ──────────────────────────────────────────────────

const HEART: string[] = [
  '      ▄▓▓▓▓▓▄       ▄▓▓▓▓▓▄      ',
  '    ▓▓▓▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓▓▓▓▓    ',
  '   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ',
  '   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ',
  '    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ',
  '     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ',
  '       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '           ▓▓▓▓▓▓▓▓▓▓▓           ',
  '             ▓▓▓▓▓▓▓             ',
  '               ▓▓▓               ',
  '                ▓                ',
];

const CAR: string[] = [
  '               ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄               ',
  '            ▄▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▄            ',
  '          ▄▓░░░░░░  g h o s t s c a n  ░░░░░░░░▓▄          ',
  '        ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓        ',
  '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
  '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
  '   ██▓▓▓▓▓██                                 ██▓▓▓▓▓██     ',
  '    ▀▀▀▀▀▀▀                                   ▀▀▀▀▀▀▀      ',
];

const BURN_BOOK: string[] = [
  '  ╔══════════════════════════════════════════════════════╗  ',
  '  ║                                                      ║  ',
  '  ║         T H E   B U R N   B O O K                   ║  ',
  '  ║                                                      ║  ',
  '  ║     ┌──────────────────────────────────┐             ║  ',
  '  ║     │  ⣿⣿⣿    s e c r e t s    ⣿⣿⣿  │             ║  ',
  '  ║     │  ⠿⠿⠿      i n s i d e     ⠿⠿⠿  │             ║  ',
  '  ║     │  ⣷⣷⣷                      ⣷⣷⣷  │             ║  ',
  '  ║     └──────────────────────────────────┘             ║  ',
  '  ║                                                      ║  ',
  '  ║          p r o p e r t y   o f                       ║  ',
  '  ║       c h l o e  +  r e g i n a                      ║  ',
  '  ║                                                      ║  ',
  '  ╚══════════════════════════════════════════════════════╝  ',
];

const GHOST_SM: string[] = [
  '        ▄▓▓▓▓▓▓▓▓▓▓▓▓▄        ',
  '      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ',
  '     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ',
  '    ▓▓▓▓  ████▓▓  ████▓▓▓▓▓    ',
  '    ▓▓▓▓  █░█░▓▓  █░█░▓▓▓▓▓    ',
  '    ▓▓▓▓  ████▓▓  ████▓▓▓▓▓    ',
  '    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ',
  '    ▓▓▓▓▓▓  ▄▄▄▄  ▓▓▓▓▓▓▓▓    ',
  '     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ',
  '      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ',
  '     ▓▓  ▀▄  ▓▓  ▀▄  ▓▓▓      ',
  '      ▀▄  ▀▓▓  ▀▄  ▀▓          ',
];

// ── Finale catchphrases ─────────────────────────────────────────

const CATCHPHRASES = [
  'that\'s so fetch',
  'YOU CAN\'T SIT WITH US!',
  'she doesn\'t even go here!',
  'on wednesdays we wear pink',
  'get in loser',
  'the limit does not exist',
  'i\'m a cool ghost',
  'SO fetch',
  'YOU CAN\'T SIT WITH US!',
  'chloe x regina forever',
];

// ── Overlay ─────────────────────────────────────────────────────

type OverlayPos = 'right' | 'center-top' | 'center' | 'center-bottom' | 'hidden';

interface OverlayState {
  line1: string;
  line2: string;
  pos: OverlayPos;
  size: number;
  weight: number;
}

// ── Main component ──────────────────────────────────────────────

export function MeanGirlsAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fRef = useRef(0);
  const [, setTick] = useState(0);

  const render = useCallback(() => {
    const f = fRef.current;
    const g: string[][] = Array.from({ length: H }, () => Array(W).fill(' '));
    const sec = (f / FPS) % LOOP;
    const overlay: OverlayState = { line1: '', line2: '', pos: 'hidden', size: 20, weight: 500 };

    const put = (x: number, y: number, c: string) => {
      const ix = Math.round(x), iy = Math.round(y);
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) g[iy]![ix] = c;
    };

    const stamp = (spr: string[], px: number, py: number, fade = 1) => {
      for (let sy = 0; sy < spr.length; sy++) {
        const row = spr[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ' && Math.random() < fade) put(px + sx, py + sy, row[sx]!);
        }
      }
    };

    // ── Effect library ──────────────────────────────────────

    const stippleRain = (intensity: number, downward = true) => {
      for (let i = 0; i < Math.floor(intensity * 60); i++) {
        const x = Math.random() * W;
        const y = downward ? (f * 0.5 + Math.random() * H * 2) % H : Math.random() * H;
        put(x, y, STIPPLE[Math.floor(Math.random() * STIPPLE.length)]!);
      }
    };

    const heartRain = (intensity: number) => {
      for (let i = 0; i < Math.floor(intensity * 30); i++) {
        const x = Math.random() * W;
        const y = (f * 0.3 + i * 7.3) % H;
        put(x, y, HEARTS[Math.floor(Math.random() * HEARTS.length)]!);
      }
    };

    const shimmer = (intensity: number) => {
      for (let i = 0; i < Math.floor(intensity * 30); i++) {
        put(Math.random() * W, Math.random() * H,
          BRAILLE_L[Math.floor(Math.random() * BRAILLE_L.length)]!);
      }
    };

    const psycheFill = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (Math.random() > intensity) continue;
          const w1 = Math.sin(x * 0.09 + f * 0.08);
          const w2 = Math.cos(y * 0.2 + f * 0.06);
          const w3 = Math.sin((x + y) * 0.06 - f * 0.1);
          const w4 = Math.cos(Math.sqrt(((x - W / 2) * 0.3) ** 2 + (y - H / 2) ** 2) * 0.15 - f * 0.12);
          const val = (w1 + w2 + w3 + w4 + 4) / 8;
          const idx = Math.floor(val * (WAVE.length - 1));
          let ch = WAVE[Math.max(0, Math.min(idx, WAVE.length - 1))]!;
          if (Math.random() < 0.06) ch = CHAOS[Math.floor(Math.random() * CHAOS.length)]!;
          if (Math.random() < 0.04) ch = HEARTS[Math.floor(Math.random() * HEARTS.length)]!;
          g[y]![x] = ch;
        }
      }
    };

    const starburst = (cx: number, cy: number, intensity: number) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (x - cx) * 0.3;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const v = Math.sin(dist * 0.35 - f * 0.15) * Math.cos(angle * 10 + f * 0.08);
          if (v > 0.25 && Math.random() < intensity) {
            g[y]![x] = BLOCK[Math.floor((1 - v) * BLOCK.length)]!;
          }
        }
      }
    };

    const vhsGlitch = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        if (Math.random() < intensity * 0.15) {
          const shift = Math.floor((Math.random() - 0.5) * 20);
          const row = [...g[y]!];
          for (let x = 0; x < W; x++) {
            const sx = x - shift;
            g[y]![x] = (sx >= 0 && sx < W) ? row[sx]! : GLITCH[Math.floor(Math.random() * GLITCH.length)]!;
          }
        }
      }
    };

    const pinkStatic = (intensity: number) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (Math.random() < intensity)
            g[y]![x] = BLOCK[Math.floor(Math.random() * BLOCK.length)]!;
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

    const dissolve = (intensity: number) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (g[y]![x] !== ' ' && Math.random() < intensity) g[y]![x] = ' ';
    };

    // ═══════════════════════════════════════════════════════════
    // SCENES
    // ═══════════════════════════════════════════════════════════

    if (sec < 4) {
      // ── TITLE: MEAN GIRLS — stippling hearts + block border ─
      const p = sec / 4;
      // Stippling heart rain builds up
      stippleRain(easeOut(p) * 0.6);
      heartRain(easeOut(p) * 0.3);
      // Block hearts float
      if (p > 0.2) {
        const hx = Math.floor(W / 2 - 17);
        const hy = Math.floor(H / 2 + 2);
        stamp(HEART, hx, hy, Math.min((p - 0.2) / 0.3, 1) * 0.7);
      }
      if (p > 0.4) border('♥•◆★');
      // Title overlay
      if (p > 0.1) {
        overlay.line1 = 'MEAN GIRLS';
        overlay.pos = 'center-top';
        overlay.size = 28;
        overlay.weight = 700;
      }
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.5);
    }

    else if (sec < 8) {
      // ── BURN BOOK — box-drawing + braille ─────────────────
      const p = (sec - 4) / 4;
      shimmer(0.15);
      const revealLines = Math.floor(easeOut(Math.min(p * 1.5, 1)) * BURN_BOOK.length);
      const by = Math.floor(H / 2 - BURN_BOOK.length / 2);
      for (let i = 0; i < revealLines; i++) {
        const row = BURN_BOOK[i]!;
        const bx = Math.floor(W / 2 - row.length / 2);
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== ' ') put(bx + c, by + i, row[c]!);
        }
      }
      if (p > 0.3) heartRain(0.15);
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 12) {
      // ── "On Wednesdays we wear pink" — stippling hearts ───
      const p = (sec - 8) / 4;
      stippleRain(0.4);
      heartRain(0.2);
      shimmer(0.1);
      // Scattered block hearts
      for (let i = 0; i < 3; i++) {
        const hx = W * 0.15 + i * W * 0.3 + Math.sin(f * 0.04 + i * 2) * 10;
        const hy = H * 0.5 + Math.sin(f * 0.06 + i) * 5;
        stamp(HEART, hx, hy, 0.3);
      }
      const tp = Math.min(p / 0.4, 1);
      const msg = '"On Wednesdays, we wear pink."';
      overlay.line1 = msg.slice(0, Math.floor(tp * msg.length)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      overlay.line2 = p > 0.5 ? '- Karen Smith' : '';
      overlay.pos = 'center';
      overlay.size = 22;
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 15) {
      // ── "That is SO fetch" — braille pulse ────────────────
      const p = (sec - 12) / 3;
      // Braille texture pulses from center
      const pulse = Math.sin(f * 0.15) * 0.5 + 0.5;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) * 0.3;
          const dy = y - H / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < pulse * 30 + 5 && Math.random() < 0.15) {
            const pool = dist < 10 ? BRAILLE_F : dist < 20 ? BRAILLE_D : BRAILLE_M;
            g[y]![x] = pool[Math.floor(Math.random() * pool.length)]!;
          }
        }
      }
      const tp = Math.min(p / 0.35, 1);
      overlay.line1 = '"That is SO fetch."'.slice(0, Math.floor(tp * 19)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      overlay.line2 = p > 0.45 ? '- Gretchen Wieners' : '';
      overlay.pos = 'center';
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 19) {
      // ── "Stop trying to make fetch happen" — VHS glitch ───
      const p = (sec - 15) / 4;
      // Aggressive VHS + static
      pinkStatic(0.08 + p * 0.05);
      vhsGlitch(0.3 + p * 0.3);
      if (f % 6 < 3) border('█▓▒░');
      const msg1 = '"Stop trying to make fetch happen.';
      const msg2 = ' It\'s NOT going to happen."';
      const tp1 = Math.min(p / 0.3, 1);
      const tp2 = Math.max(0, Math.min((p - 0.3) / 0.25, 1));
      overlay.line1 = msg1.slice(0, Math.floor(tp1 * msg1.length)) + (tp1 < 1 && f % 10 < 5 ? '█' : '');
      if (tp2 > 0) overlay.line2 = msg2.slice(0, Math.floor(tp2 * msg2.length));
      overlay.pos = 'center';
      overlay.weight = 700;
      if (p > 0.65) {
        overlay.line2 = '- Regina George';
      }
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.5);
    }

    else if (sec < 23) {
      // ── "YOU CAN'T SIT WITH US!" — EXPLOSION ─────────────
      const p = (sec - 19) / 4;
      const fadeIn = Math.min(p * 4, 1);
      const fadeOut = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      const intensity = fadeIn * fadeOut;

      pinkStatic(intensity * 0.4);
      starburst(W / 2, H / 2, intensity * 0.5);
      vhsGlitch(intensity * 0.6);
      if (intensity > 0.3) border('█▓▒░♥★◆');
      // Chaos everywhere
      for (let i = 0; i < Math.floor(intensity * 30); i++) {
        put(Math.random() * W, Math.random() * H,
          [...CHAOS, ...HEARTS][Math.floor(Math.random() * (CHAOS.length + HEARTS.length))]!);
      }
      overlay.line1 = '"YOU CAN\'T SIT WITH US!"';
      overlay.pos = 'center';
      overlay.size = 26;
      overlay.weight = 700;
      overlay.line2 = p > 0.5 ? '- Gretchen Wieners' : '';
    }

    else if (sec < 28) {
      // ── "Get in loser" — car + speed lines ────────────────
      const p = (sec - 23) / 5;
      shimmer(0.1);
      // Car drives in from left
      const carX = lerp(-60, Math.floor(W / 2 - 30), easeOut(Math.min(p * 1.5, 1)));
      const carY = Math.floor(H / 2 - CAR.length / 2) + 5;
      stamp(CAR, carX, carY);
      // Speed lines behind car
      if (p > 0.2) {
        for (let i = 0; i < 20; i++) {
          const lx = carX - 4 - i * 5;
          const ly = carY + 2 + Math.floor(Math.random() * CAR.length);
          const ch = i < 5 ? '█' : i < 10 ? '▓' : i < 16 ? '▒' : '░';
          put(lx, ly, ch);
        }
      }
      const tp = Math.min(p / 0.3, 1);
      const msg1 = '"Get in loser,';
      const msg2 = ' we\'re going scanning."';
      overlay.line1 = msg1.slice(0, Math.floor(tp * msg1.length)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      if (p > 0.35) {
        const tp2 = Math.min((p - 0.35) / 0.25, 1);
        overlay.line2 = msg2.slice(0, Math.floor(tp2 * msg2.length));
      }
      if (p > 0.7) overlay.line2 = '- Chloe George';
      overlay.pos = 'center-top';
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 31) {
      // ── "She doesn't even go here!" — stippling portrait ──
      const p = (sec - 28) / 3;
      // Stippled face silhouette
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) * 0.4;
          const dy = (y - H / 2) * 0.9;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Head circle
          if (dist < 14 && Math.random() < 0.25) {
            put(x, y, STIPPLE[Math.floor(dist / 14 * STIPPLE.length)]!);
          }
          // Body
          if (dy > 8 && Math.abs(dx) < 10 + (dy - 8) * 0.5 && Math.random() < 0.2) {
            put(x, y, STIPPLE[Math.floor(Math.random() * 3)]!);
          }
        }
      }
      const tp = Math.min(p / 0.35, 1);
      const msg = '"She doesn\'t even go here!"';
      overlay.line1 = msg.slice(0, Math.floor(tp * msg.length)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      overlay.line2 = p > 0.5 ? '- Damian' : '';
      overlay.pos = 'center-top';
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 35) {
      // ── "I'm not a regular ghost" — ghost sprite ──────────
      const p = (sec - 31) / 4;
      shimmer(0.2);
      const spr = GHOST_SM;
      const gx = Math.floor(W / 2 - 15) + Math.sin(f * 0.06) * 8;
      const gy = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.09) * 3;
      stamp(spr, gx, gy);
      // Floating chaos around ghost
      if (f % 6 === 0) {
        for (let i = 0; i < 3; i++)
          put(gx + 15 + (Math.random() - 0.5) * 40, gy + 6 + (Math.random() - 0.5) * 15,
            HEARTS[Math.floor(Math.random() * HEARTS.length)]!);
      }
      const tp = Math.min(p / 0.3, 1);
      const msg1 = '"I\'m not a regular ghost,';
      const msg2 = ' I\'m a cool ghost."';
      overlay.line1 = msg1.slice(0, Math.floor(tp * msg1.length)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      if (p > 0.35) {
        const tp2 = Math.min((p - 0.35) / 0.2, 1);
        overlay.line2 = msg2.slice(0, Math.floor(tp2 * msg2.length));
      }
      if (p > 0.7) overlay.line2 = '- Chloe (Mrs. George energy)';
      overlay.pos = 'center-top';
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 39) {
      // ── "The Limit Does Not Exist" — box-drawing elegant ──
      const p = (sec - 35) / 4;
      shimmer(0.1);
      // Elegant box-drawing frame
      const frameW = 70;
      const frameH = 14;
      const fx = Math.floor(W / 2 - frameW / 2);
      const fy = Math.floor(H / 2 - frameH / 2);
      const revealP = easeOut(Math.min(p * 2, 1));
      const revealX = Math.floor(revealP * frameW);
      const revealY = Math.floor(revealP * frameH);
      // Top border
      for (let x = 0; x < revealX; x++) {
        put(fx + x, fy, x === 0 ? '╔' : x === frameW - 1 ? '╗' : '═');
        put(fx + x, fy + frameH - 1, x === 0 ? '╚' : x === frameW - 1 ? '╝' : '═');
      }
      // Side borders
      for (let y = 1; y < revealY - 1; y++) {
        put(fx, fy + y, '║');
        put(fx + frameW - 1, fy + y, '║');
      }
      // Braille interior fill
      if (p > 0.3) {
        const fillP = Math.min((p - 0.3) / 0.3, 1);
        for (let y = 1; y < frameH - 1; y++) {
          for (let x = 1; x < frameW - 1; x++) {
            if (Math.random() < fillP * 0.15) {
              put(fx + x, fy + y, BRAILLE_L[Math.floor(Math.random() * BRAILLE_L.length)]!);
            }
          }
        }
      }
      const tp = Math.min(p / 0.35, 1);
      const msg = '"The limit does not exist."';
      overlay.line1 = msg.slice(0, Math.floor(tp * msg.length)) + (tp < 1 && f % 10 < 5 ? '█' : '');
      overlay.line2 = p > 0.5 ? '...and neither does the number of tracking scripts on your website.' : '';
      overlay.pos = 'center';
      if (p > 0.9) dissolve((p - 0.9) / 0.1 * 0.4);
    }

    else if (sec < 52) {
      // ═════════════════════════════════════════════════════════
      // FINALE — BIG CRAZY OVER THE TOP GIRLY POP LOUD
      // ═════════════════════════════════════════════════════════
      const p = (sec - 39) / 13;

      // Escalating intensity
      const intensity = Math.min(p * 2, 1);

      // Layer 1: Psychedelic wave fill (builds from 0%)
      if (p > 0.05) psycheFill(Math.min((p - 0.05) * 1.5, 1) * 0.85);

      // Layer 2: Starburst overlay (builds from 15%)
      if (p > 0.15) starburst(W / 2, H / 2, Math.min((p - 0.15) * 2, 1) * 0.4);

      // Layer 3: VHS glitch (builds from 25%)
      if (p > 0.25) vhsGlitch(Math.min((p - 0.25) * 2, 1) * 0.6);

      // Layer 4: Heart rain (constant)
      heartRain(intensity * 0.5);

      // Layer 5: Stippling overlay (builds from 35%)
      if (p > 0.35) stippleRain(Math.min((p - 0.35) * 2, 1) * 0.4);

      // Layer 6: Block art hearts pulsing (from 40%)
      if (p > 0.4) {
        const heartBeat = Math.sin(f * 0.2) * 0.5 + 0.5;
        if (heartBeat > 0.3) {
          const hx1 = W * 0.2 + Math.sin(f * 0.03) * 15;
          const hx2 = W * 0.65 + Math.cos(f * 0.04) * 15;
          stamp(HEART, hx1, H * 0.3, heartBeat * 0.6);
          stamp(HEART, hx2, H * 0.35, heartBeat * 0.5);
        }
      }

      // Layer 7: Chaos chars EVERYWHERE (from 50%)
      if (p > 0.5) {
        const chaosCount = Math.floor((p - 0.5) * 60);
        for (let i = 0; i < chaosCount; i++) {
          put(Math.random() * W, Math.random() * H,
            [...CHAOS, ...HEARTS, ...BRAILLE_F][Math.floor(Math.random() * (CHAOS.length + HEARTS.length + BRAILLE_F.length))]!);
        }
      }

      // Layer 8: Border cycling through ALL char sets
      if (p > 0.3) {
        const patterns = ['█▓▒░', '♥★◆♪', '═║╬╠', '⣿⠿⠇⠁', '●•◦·'];
        const pi = Math.floor(f / 4) % patterns.length;
        border(patterns[pi]!);
      }

      // PEAK (75-90%): everything at max + braille texture flood
      if (p > 0.75 && p < 0.9) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (g[y]![x] === ' ' && Math.random() < 0.15) {
              g[y]![x] = BRAILLE_D[Math.floor(Math.random() * BRAILLE_D.length)]!;
            }
          }
        }
      }

      // Fade out (90-100%)
      if (p > 0.9) {
        const fade = (p - 0.9) / 0.1;
        dissolve(fade * 0.7);
      }

      // Overlay: cycling catchphrases
      const catchIdx = Math.floor(f / 12) % CATCHPHRASES.length;
      const isLast = p > 0.85;
      overlay.line1 = isLast ? 'chloe x regina forever' : CATCHPHRASES[catchIdx]!;
      overlay.pos = 'center';
      overlay.size = isLast ? 24 : (CATCHPHRASES[catchIdx]!.startsWith('YOU') ? 26 : 20);
      overlay.weight = isLast ? 300 : (CATCHPHRASES[catchIdx]!.startsWith('YOU') ? 700 : 500);
    }

    else {
      // ── Fade to black ─────────────────────────────────────
      const p = (sec - 52) / 3;
      shimmer((1 - p) * 0.1);
      if (p < 0.5) {
        overlay.line1 = 'chloe x regina forever';
        overlay.pos = 'center';
        overlay.size = 22;
        overlay.weight = 300;
      }
    }

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
        el.style.textAlign = 'center';
        el.style.transform = 'translateX(-50%)';
        if (overlay.pos === 'center-top') el.style.top = '8%';
        else if (overlay.pos === 'center-bottom') el.style.top = '75%';
        else el.style.top = '42%';
        el.style.fontSize = `${overlay.size}px`;
        el.style.fontWeight = String(overlay.weight);
        const line2Html = overlay.line2 ? `<br/><span style="margin-top:6px;display:inline-block;font-size:16px;font-weight:300;letter-spacing:0.08em">${overlay.line2}</span>` : '';
        el.innerHTML = overlay.line1 + line2Html;
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
          fontSize: '6.5px',
          color: 'var(--gs-base)',
          textShadow: '0 0 5px var(--gs-base), 0 0 15px oklch(0.82 0.15 340 / 0.2)',
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
          transition: 'opacity 0.15s ease',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
          zIndex: 10,
        }}
      />
    </div>
  );
}

function easeOut(t: number): number { return 1 - (1 - t) ** 3; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
