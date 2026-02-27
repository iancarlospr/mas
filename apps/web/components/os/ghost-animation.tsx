'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/* =================================================================
   Chloe TV — Block-art ghost animation. 200×55, 6.5px.
   Classic bedsheet ghost with wavy bottom tails.
   Ethereal effects, floating particles, cute chaos.
   ================================================================= */

const W = 200;
const H = 55;
const FPS = 15;
const MS = Math.round(1000 / FPS);
const LOOP = 40; // seconds

// ── Character palettes ──────────────────────────────────────────

const BLOCK = ['░', '▒', '▓', '█'];
const CHAOS = ['$', 'Ñ', '≈', '∞', '◊', '★', '♦', '♪', '◆', '●', '○', '▲', '▼', '◀', '▶'];
const SHIMMER = ['·', ':', '░', '▒', ':', '·', ' '];
const GLITCH = ['█', '▓', '░', '▒', '║', '═', '╬', '▌', '▐'];

// ── Ghost sprites — bedsheet ghost with wavy scalloped bottom ───
// ~65 wide × ~30 tall

const GHOST_A: string[] = [
  '                    ▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄                    ',
  '                ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                ',
  '             ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄             ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ████████▓▓      ▓▓████████     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░░░░██▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░██░██▓▓      ▓▓██░██░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░░░░██▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ████████▓▓      ▓▓████████     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▄▄▄▄▄▄▄▄  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓             ',
  '            ▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓            ',
  '           ▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓            ',
  '            ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓             ',
  '               ▀▀▄▄▀▀     ▀▀▄▄▀▀     ▀▀▄▄▀▀                    ',
];

const GHOST_WINK: string[] = [
  '                    ▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄                    ',
  '                ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                ',
  '             ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄             ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓                 ▓▓      ▓▓████████     ▓▓▓▓▓▓▓     ',
  '        ▓▓▓▓▓     ▀▀▀▀▀▀     ▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓     ',
  '        ▓▓▓▓▓     ▄▄▄▄▄▄     ▓▓      ▓▓██░██░██     ▓▓▓▓▓▓▓     ',
  '        ▓▓▓▓▓                 ▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓     ',
  '        ▓▓▓▓▓                 ▓▓      ▓▓████████     ▓▓▓▓▓▓▓     ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▄▄▄▄▄▄▄▄  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓             ',
  '            ▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓            ',
  '           ▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓            ',
  '            ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓             ',
  '               ▀▀▄▄▀▀     ▀▀▄▄▀▀     ▀▀▄▄▀▀                    ',
];

const GHOST_BOO: string[] = [
  '                    ▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄                    ',
  '                ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                ',
  '             ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄             ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ████████▓▓      ▓▓████████     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░░░░██▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░██░██▓▓      ▓▓██░██░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ██░░░░██▓▓      ▓▓██░░░░██     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓     ████████▓▓      ▓▓████████     ▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓     ████████████     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓     ██░░░░░░░░░░██     ▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓     ██░░░░░░░░░░██     ▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '        ▓▓▓▓▓▓▓▓▓▓▓     ████████████     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ',
  '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓           ',
  '            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓             ',
  '            ▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓▓  ▀▄   ▓▓▓▓            ',
  '           ▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓▓ ▀    ▀▄  ▓▓            ',
  '            ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓▓ ▀▓▄  ▀▄  ▀▓             ',
  '               ▀▀▄▄▀▀     ▀▀▄▄▀▀     ▀▀▄▄▀▀                    ',
];

const POSES = [GHOST_A, GHOST_WINK, GHOST_A, GHOST_BOO];
const SPRITE_W = 65;

// ── Messages ────────────────────────────────────────────────────

const MESSAGES = [
  'hi i\'m chloe',
  'boo!',
  'did i scare you?',
  'probably not lol',
  'i\'m a friendly ghost',
  'chloe tv // always on',
];

// ── Overlay types ───────────────────────────────────────────────

type OverlayPos = 'right' | 'center-top' | 'center' | 'hidden';

interface OverlayState {
  line1: string;
  line2: string;
  pos: OverlayPos;
  big: boolean;
}

// ── Main component ──────────────────────────────────────────────

export function GhostAnimation() {
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

    const stamp = (spr: string[], px: number, py: number, fade = 1) => {
      for (let sy = 0; sy < spr.length; sy++) {
        const row = spr[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ' && Math.random() < fade) put(px + sx, py + sy, row[sx]!);
        }
      }
    };

    // ── Ethereal shimmer — floating particles ──────────────
    const shimmer = (intensity: number) => {
      const count = Math.floor(intensity * 40);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const t = (f * 0.05 + x * 0.01 + y * 0.02) % SHIMMER.length;
        const ch = SHIMMER[Math.floor(t)]!;
        if (ch !== ' ') put(x, y, ch);
      }
    };

    // ── Ghost trail — fading afterimage ────────────────────
    const ghostTrail = (spr: string[], px: number, py: number, age: number) => {
      const fade = Math.max(0, 1 - age * 0.3);
      const chars = ['▓', '▒', '░', '·'];
      const ci = Math.min(Math.floor(age), chars.length - 1);
      for (let sy = 0; sy < spr.length; sy++) {
        const row = spr[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ' && Math.random() < fade * 0.4) {
            put(px + sx, py + sy, chars[ci]!);
          }
        }
      }
    };

    // ── Screen static ──────────────────────────────────────
    const staticNoise = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (Math.random() < intensity) {
            g[y]![x] = GLITCH[Math.floor(Math.random() * GLITCH.length)]!;
          }
        }
      }
    };

    // ── Speed lines ────────────────────────────────────────
    const speedLines = (px: number, py: number, h: number, dir: number) => {
      for (let i = 0; i < 25; i++) {
        const lx = dir > 0 ? px - 4 - i * 4 : px + SPRITE_W + 4 + i * 4;
        const ly = py + 4 + Math.floor(Math.random() * Math.max(h - 8, 1));
        const ch = i < 5 ? '█' : i < 10 ? '▓' : i < 18 ? '▒' : '░';
        put(lx, ly, ch);
        if (i < 8) put(lx + (dir > 0 ? -1 : 1), ly, '░');
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
    // SCENES (40s loop)
    // ═══════════════════════════════════════════════════════════

    if (sec < 3) {
      // ── Ghost fades in from nothing ───────────────────────
      const p = sec / 3;
      shimmer(p * 0.3);
      const spr = GHOST_A;
      const px = Math.floor(W / 2 - SPRITE_W / 2);
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.08) * 2;
      stamp(spr, px, py, easeOut(p));
      // Scattered block chars coalescing
      for (let i = 0; i < Math.floor((1 - p) * 30); i++) {
        put(px + Math.random() * SPRITE_W, py + Math.random() * spr.length,
          BLOCK[Math.floor(Math.random() * BLOCK.length)]!);
      }
      if (p > 0.5) {
        const tp = Math.min((p - 0.5) / 0.4, 1);
        overlay.line1 = MESSAGES[0]!.slice(0, Math.floor(tp * MESSAGES[0]!.length));
        overlay.pos = 'center-top';
      }
    }

    else if (sec < 8) {
      // ── Ghost floats gently, winks ────────────────────────
      const p = (sec - 3) / 5;
      shimmer(0.2);
      const wink = Math.floor(sec * 2) % 8 === 0;
      const spr = wink ? GHOST_WINK : GHOST_A;
      const bx = Math.sin(f * 0.04) * 8;
      const by = Math.sin(f * 0.07) * 4;
      const px = Math.floor(W / 2 - SPRITE_W / 2) + bx;
      const py = Math.floor(H / 2 - spr.length / 2) + by;

      // Gentle trail
      if (f % 4 === 0) {
        ghostTrail(spr, px - bx * 0.5, py - by * 0.5, 2);
      }
      stamp(spr, px, py);

      // Floating chaos sparkles
      if (f % 10 === 0) {
        for (let i = 0; i < 3; i++)
          put(px + Math.random() * SPRITE_W, py - 2 + Math.random() * 4,
            CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }

      if (p > 0.6) {
        overlay.line1 = MESSAGES[4]!;
        overlay.pos = 'right';
      }
    }

    else if (sec < 10) {
      // ── Ghost rushes at screen ────────────────────────────
      const p = (sec - 8) / 2;
      const spr = GHOST_BOO;
      const scale = 1 + easeOut(p) * 0.3;
      const px = Math.floor(W / 2 - SPRITE_W / 2 * scale);
      const py = Math.floor(lerp(H / 2 - spr.length / 2, 2, easeOut(p)));
      stamp(spr, px, py);

      if (p > 0.3) staticNoise(p * 0.06);
      if (p > 0.5) shimmer(p * 0.5);
    }

    else if (sec < 13) {
      // ── BOO! screen takeover ──────────────────────────────
      const p = (sec - 10) / 3;
      const fadeIn = Math.min(p * 4, 1);
      const fadeOut = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
      const intensity = fadeIn * fadeOut;

      staticNoise(intensity * 0.15);
      shimmer(intensity * 0.8);

      // Big ghost face
      const spr = GHOST_BOO;
      const px = Math.floor(W / 2 - SPRITE_W / 2);
      const py = 2 + Math.sin(f * 0.15) * 2;
      for (let sy = 0; sy < spr.length; sy++) {
        const row = spr[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ') {
            put(px + sx, py + sy, Math.random() < 0.08
              ? CHAOS[Math.floor(Math.random() * CHAOS.length)]! : row[sx]!);
          }
        }
      }

      if (intensity > 0.5) border('▓░▒█');

      // Scattered chaos everywhere
      for (let i = 0; i < Math.floor(intensity * 20); i++) {
        put(Math.random() * W, Math.random() * H,
          CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }

      overlay.line1 = 'BOO!';
      overlay.pos = 'center';
      overlay.big = true;
    }

    else if (sec < 16) {
      // ── "did i scare you?" — ghost peeks from side ────────
      const p = (sec - 13) / 3;
      shimmer(0.15);
      const spr = GHOST_WINK;
      const px = lerp(W + 10, W - SPRITE_W - 10, easeOut(Math.min(p * 2, 1)));
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.1) * 3;
      stamp(spr, px, py);

      if (p > 0.3) {
        const tp = Math.min((p - 0.3) / 0.3, 1);
        overlay.line1 = MESSAGES[2]!.slice(0, Math.floor(tp * MESSAGES[2]!.length));
        overlay.pos = 'center-top';
      }
      if (p > 0.65) {
        const tp = Math.min((p - 0.65) / 0.25, 1);
        overlay.line2 = MESSAGES[3]!.slice(0, Math.floor(tp * MESSAGES[3]!.length));
      }
    }

    else if (sec < 19) {
      // ── Speed dash left-to-right ──────────────────────────
      const p = (sec - 16) / 3;
      const spr = GHOST_A;
      const px = lerp(-SPRITE_W - 20, W + 20, easeInOut(p));
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.3) * 3;
      stamp(spr, px, py);
      speedLines(px, py, spr.length, 1);
      // Trail fragments
      for (let i = 0; i < 6; i++) {
        ghostTrail(spr, px - 20 - i * 15, py, i + 1);
      }
    }

    else if (sec < 22) {
      // ── Speed dash right-to-left ──────────────────────────
      const p = (sec - 19) / 3;
      const spr = GHOST_A;
      const px = lerp(W + 20, -SPRITE_W - 20, easeInOut(p));
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.3) * 3;
      stamp(spr, px, py);
      speedLines(px, py, spr.length, -1);
      for (let i = 0; i < 6; i++) {
        ghostTrail(spr, px + 20 + i * 15, py, i + 1);
      }
    }

    else if (sec < 27) {
      // ── Ghost zigzags chaotically ─────────────────────────
      const p = (sec - 22) / 5;
      shimmer(0.3);
      const pi = Math.floor(f / 8) % POSES.length;
      const spr = POSES[pi]!;
      const zx = lerp(5, W - SPRITE_W - 5, p) + Math.sin(p * Math.PI * 8) * 20;
      const zy = H * 0.1 + Math.sin(p * Math.PI * 5) * (H * 0.3);
      stamp(spr, zx, zy);

      // Heavy trail during zigzag
      if (f % 2 === 0) ghostTrail(spr, zx, zy, 1);

      // Chaos particles fly off
      if (f % 5 === 0) {
        for (let i = 0; i < 5; i++)
          put(zx + SPRITE_W / 2 + (Math.random() - 0.5) * 40,
            zy + spr.length / 2 + (Math.random() - 0.5) * 20,
            CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }
    }

    else if (sec < 31) {
      // ── Multi-ghost party ─────────────────────────────────
      const p = (sec - 27) / 4;
      shimmer(0.4);

      const positions = [
        { x: 5, y: 3 },
        { x: W / 2 - SPRITE_W / 2, y: 5 },
        { x: W - SPRITE_W - 8, y: 2 },
        { x: W / 4 - SPRITE_W / 4, y: H / 2 - 8 },
        { x: W * 3 / 4 - SPRITE_W / 4, y: H / 2 - 6 },
      ];
      const pi = Math.floor(f / 6) % POSES.length;
      const fadeIn = Math.min(p * 3, 1);
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i]!;
        const delay = i * 0.15;
        if (p > delay) {
          const localFade = Math.min((p - delay) * 4, 1) * fadeIn;
          stamp(POSES[(pi + i) % POSES.length]!, pos.x + Math.sin(f * 0.05 + i) * 3,
            pos.y + Math.sin(f * 0.07 + i * 2) * 2, localFade * 0.85);
        }
      }

      border('░▒▓█');
      for (let i = 0; i < 10; i++) {
        put(Math.random() * W, Math.random() * H,
          CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }
    }

    else if (sec < 35) {
      // ── Ghost rises from bottom, happy ────────────────────
      const p = (sec - 31) / 4;
      shimmer(0.2);
      const spr = GHOST_A;
      const px = Math.floor(W / 2 - SPRITE_W / 2) + Math.sin(f * 0.06) * 5;
      const py = lerp(H + 10, Math.floor(H / 2 - spr.length / 2), easeOut(Math.min(p * 1.5, 1)));
      stamp(spr, px, py);

      // Floating sparkles above
      if (p > 0.4) {
        for (let i = 0; i < 4; i++)
          put(px + SPRITE_W / 2 + (Math.random() - 0.5) * 40,
            py - 2 - Math.random() * 6,
            ['★', '◊', '♦', '♪'][Math.floor(Math.random() * 4)]!);
      }

      if (p > 0.5) {
        overlay.line1 = MESSAGES[5]!;
        overlay.pos = 'center-top';
      }
    }

    else {
      // ── Ghost fades out with sparkles ─────────────────────
      const p = (sec - 35) / 5;
      const fade = 1 - easeOut(p);
      shimmer(fade * 0.3);
      const spr = GHOST_WINK;
      const px = Math.floor(W / 2 - SPRITE_W / 2) + Math.sin(f * 0.05) * 3;
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.08) * 2;
      stamp(spr, px, py, fade);

      // Dissolve into chaos chars
      if (p > 0.3) {
        for (let i = 0; i < Math.floor(p * 15); i++)
          put(px + Math.random() * SPRITE_W, py + Math.random() * spr.length,
            CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }
    }

    // ── Render ──────────────────────────────────────────────

    if (preRef.current) preRef.current.textContent = g.map(r => r.join('')).join('\n');

    if (overlayRef.current) {
      const el = overlayRef.current;
      if (overlay.pos === 'hidden' || (!overlay.line1 && !overlay.line2)) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
        if (overlay.pos === 'right') {
          el.style.left = 'auto';
          el.style.right = '8%';
          el.style.top = '45%';
          el.style.transform = 'translateY(-50%)';
          el.style.textAlign = 'left';
        } else if (overlay.pos === 'center-top') {
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.top = '6%';
          el.style.transform = 'translateX(-50%)';
          el.style.textAlign = 'center';
        } else {
          el.style.left = '50%';
          el.style.right = 'auto';
          el.style.top = '40%';
          el.style.transform = 'translateX(-50%)';
          el.style.textAlign = 'center';
        }
        el.style.fontSize = overlay.big ? '28px' : '20px';
        el.style.fontWeight = overlay.big ? '700' : '500';
        const line2Html = overlay.line2 ? `<br/><span style="margin-top:8px;display:inline-block">${overlay.line2}</span>` : '';
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
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
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
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
