'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Rick Roll — Rick dances across the screen, psychedelic takeover,
   pulsing patterns, lyrics cycling. The longest channel (~90s loop).
   120x30 grid, 15fps.
   ================================================================= */

const W = 120;
const H = 30;
const INTERVAL = 67;

// ── Rick sprite — suit, big hair, arms at side ─────────────────

const RICK_STAND: string[] = [
  '     .########.     ',
  '    ###########     ',
  '    ###########     ',
  '     :       :      ',
  '     : o   o :      ',
  '     :   >   :      ',
  '     :  ---  :      ',
  '      \'::::\'        ',
  '      :    :        ',
  '     .:....:        ',
  '    ::      ::      ',
  '   ::        ::     ',
  '   ::        ::     ',
  '    ##      ##      ',
];

const RICK_ARM_UP: string[] = [
  '     .########.     ',
  '    ###########     ',
  '    ###########     ',
  '     :       :  /   ',
  '     : ^   ^ : /    ',
  '     :   >   :/     ',
  '     :  \\-/  :      ',
  '      \'::::\'        ',
  '     /:    :\\       ',
  '    / :....: \\      ',
  '   :  :      :  :   ',
  '   ::        ::     ',
  '   ::        ::     ',
  '    ##      ##      ',
];

const RICK_LEAN_R: string[] = [
  '        .########.  ',
  '       ###########  ',
  '       ###########  ',
  '        :       :   ',
  '        : o   - :   ',
  '        :   >   :   ',
  '        :  ---  :   ',
  '         \'::::\'     ',
  '         :    :     ',
  '        .:....:     ',
  '       ::      ::   ',
  '      ::        ::  ',
  '     ::          :: ',
  '    ##          ##  ',
];

const RICK_LEAN_L: string[] = [
  '  .########.        ',
  '  ###########       ',
  '  ###########       ',
  '   :       :        ',
  '   : -   o :        ',
  '   :   >   :        ',
  '   :  ---  :        ',
  '     \'::::\'         ',
  '     :    :         ',
  '     :....:         ',
  '   ::      ::       ',
  '  ::        ::      ',
  ' ::          ::     ',
  '  ##          ##    ',
];

const RICK_DANCE_1: string[] = [
  '     .########.     ',
  '    ###########     ',
  '    ###########     ',
  '  \\  :       :  /   ',
  '   \\ : ^   ^ : /    ',
  '    \\:   >   :/     ',
  '     :  \\-/  :      ',
  '      \'::::\'        ',
  '     /:    :\\       ',
  '    / :....: \\      ',
  '      :      :      ',
  '     ::      ::     ',
  '    ::   ::   ::    ',
  '   ##         ##    ',
];

const RICK_DANCE_2: string[] = [
  '     .########.     ',
  '    ###########     ',
  '    ###########     ',
  '     :       :      ',
  '     : o   o :      ',
  '     :   >   :      ',
  '     :  ---  :      ',
  '      \'::::\'        ',
  '   \\  :    :  /     ',
  '    \\ :....: /      ',
  '     ::    ::       ',
  '      ::  ::        ',
  '     ::    ::       ',
  '    ##      ##      ',
];

const RICK_BIG: string[] = [
  '              .################.              ',
  '           #######################            ',
  '          #######################             ',
  '          #######################             ',
  '           :                   :              ',
  '           :                   :              ',
  '           :   .##.     .##.   :              ',
  '           :   #  #     #  #   :              ',
  '           :   \'##\'     \'##\'   :              ',
  '           :        .>.        :              ',
  '           :       \'---\'       :              ',
  '           :                   :              ',
  '            \':::::::::::::::::\'               ',
  '              :             :                 ',
  '             .:.............:                 ',
  '            ::               ::               ',
  '           ::                 ::              ',
  '          ::                   ::             ',
  '          ::                   ::             ',
  '           ##                 ##              ',
];

// All poses for cycling
const POSES = [RICK_STAND, RICK_ARM_UP, RICK_DANCE_1, RICK_DANCE_2, RICK_LEAN_R, RICK_LEAN_L];
const SPRITE_W = 21;

// ── Lyrics ─────────────────────────────────────────────────────

const LYRICS = [
  { text: "We're no strangers to love", dur: 4 },
  { text: "You know the rules and so do I", dur: 4 },
  { text: "A full commitment's what I'm thinking of", dur: 4 },
  { text: "You wouldn't get this from any other guy", dur: 4 },
  { text: "NEVER GONNA GIVE YOU UP", dur: 3.5 },
  { text: "NEVER GONNA LET YOU DOWN", dur: 3.5 },
  { text: "NEVER GONNA RUN AROUND AND DESERT YOU", dur: 3.5 },
  { text: "NEVER GONNA MAKE YOU CRY", dur: 3.5 },
  { text: "NEVER GONNA SAY GOODBYE", dur: 3.5 },
  { text: "NEVER GONNA TELL A LIE AND HURT YOU", dur: 4 },
  { text: "We've known each other for so long", dur: 4 },
  { text: "Your heart's been aching but you're too shy to say it", dur: 4.5 },
  { text: "Inside we both know what's been going on", dur: 4 },
  { text: "NEVER GONNA GIVE YOU UP", dur: 3.5 },
  { text: "NEVER GONNA LET YOU DOWN", dur: 3.5 },
  { text: "NEVER GONNA RUN AROUND AND DESERT YOU", dur: 3.5 },
  { text: "NEVER GONNA MAKE YOU CRY", dur: 3.5 },
  { text: "NEVER GONNA SAY GOODBYE", dur: 3.5 },
  { text: "NEVER GONNA TELL A LIE AND HURT YOU", dur: 4 },
];

// ── Particle / effects ─────────────────────────────────────────

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  char: string;
}

const SPARK_CHARS = ['*', '+', '.', ':', '~', '#'];

// ── Main component ─────────────────────────────────────────────

export function RickRollAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);
  const gridRef = useRef<string[][]>([]);
  const sparksRef = useRef<Spark[]>([]);

  const createGrid = useCallback((): string[][] => {
    return Array.from({ length: H }, () => Array(W).fill(' '));
  }, []);

  const clearGrid = useCallback(() => {
    const g = gridRef.current;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y]![x] = ' ';
  }, []);

  const drawChar = useCallback((x: number, y: number, ch: string) => {
    const gx = Math.round(x);
    const gy = Math.round(y);
    if (gx >= 0 && gx < W && gy >= 0 && gy < H) gridRef.current[gy]![gx] = ch;
  }, []);

  const drawSprite = useCallback((sprite: string[], px: number, py: number) => {
    for (let sy = 0; sy < sprite.length; sy++) {
      const row = sprite[sy]!;
      for (let sx = 0; sx < row.length; sx++) {
        if (row[sx] !== ' ') drawChar(px + sx, py + sy, row[sx]!);
      }
    }
  }, [drawChar]);

  const drawText = useCallback((text: string, cx: number, cy: number) => {
    const sx = Math.round(cx - text.length / 2);
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== ' ') drawChar(sx + i, cy, text[i]!);
    }
  }, [drawChar]);

  const typewriter = useCallback((text: string, cx: number, cy: number, progress: number) => {
    const sx = Math.round(cx - text.length / 2);
    const reveal = Math.floor(progress * text.length);
    for (let i = 0; i < reveal; i++) drawChar(sx + i, cy, text[i]!);
  }, [drawChar]);

  const spawnSparks = useCallback((cx: number, cy: number, count: number, spread = 25) => {
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: cx + (Math.random() - 0.5) * spread,
        y: cy + (Math.random() - 0.5) * (spread * 0.4),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 1.2,
        life: Math.floor(Math.random() * 10) + 4,
        char: SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!,
      });
    }
  }, []);

  const updateSparks = useCallback(() => {
    const parts = sparksRef.current;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      drawChar(p.x, p.y, p.char);
    }
  }, [drawChar]);

  // Psychedelic pulse rings expanding from center
  const drawPulseRing = useCallback((cx: number, cy: number, radius: number, char: string) => {
    const steps = Math.floor(radius * 6);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const rx = cx + Math.cos(angle) * radius * 2; // 2x because chars are taller than wide
      const ry = cy + Math.sin(angle) * radius;
      drawChar(rx, ry, char);
    }
  }, [drawChar]);

  // Concentric expanding pattern
  const drawPsychedelic = useCallback((f: number, intensity: number) => {
    const cx = W / 2;
    const cy = H / 2;
    const chars = ['#', '*', '+', ':', '.'];
    const numRings = Math.floor(intensity * 8);
    for (let r = 0; r < numRings; r++) {
      const baseRadius = ((f * 0.3 + r * 4) % 25);
      const charIdx = r % chars.length;
      drawPulseRing(cx, cy, baseRadius, chars[charIdx]!);
    }
  }, [drawPulseRing]);

  // Speed trail behind Rick
  const drawSpeedLines = useCallback((px: number, py: number, h: number, dir: number) => {
    for (let i = 0; i < 15; i++) {
      const tx = dir > 0 ? px - 2 - i * 2 : px + SPRITE_W + 2 + i * 2;
      const ty = py + 2 + Math.floor(Math.random() * (h - 4));
      const ch = i < 5 ? '-' : i < 10 ? '~' : '.';
      drawChar(tx, ty, ch);
    }
  }, [drawChar]);

  // Get current lyric based on time
  const getLyric = useCallback((sec: number, offset: number): { text: string; progress: number } | null => {
    let t = sec - offset;
    if (t < 0) return null;
    for (const lyric of LYRICS) {
      if (t < lyric.dur) {
        return { text: lyric.text, progress: Math.min(t / (lyric.dur * 0.6), 1) };
      }
      t -= lyric.dur;
    }
    return null;
  }, []);

  const renderGrid = useCallback((): string => {
    return gridRef.current.map(row => row.join('')).join('\n');
  }, []);

  // ── Animation loop ─────────────────────────────────────────

  const animate = useCallback(() => {
    if (!gridRef.current.length) gridRef.current = createGrid();

    const f = frameRef.current;
    const LOOP = 1350; // 90 seconds at 15fps
    const localF = f % LOOP;
    const sec = (localF / LOOP) * 90;

    if (localF === 0) sparksRef.current = [];

    clearGrid();

    // ── Phase 0: Dark, dots appear (0–2s) ────────────────────
    if (sec < 2) {
      const count = Math.floor((sec / 2) * 6);
      for (let i = 0; i < count; i++) {
        drawChar(W / 2 + (Math.random() - 0.5) * 10, H / 2 + (Math.random() - 0.5) * 4, '.');
      }
    }

    // ── Phase 1: Rick builds up piece by piece (2–6s) ────────
    else if (sec < 6) {
      const p = (sec - 2) / 4;
      const sprite = RICK_STAND;
      const px = W / 2 - SPRITE_W / 2;
      const py = H / 2 - sprite.length / 2;
      const totalChars = sprite.reduce((sum, row) => sum + row.replace(/ /g, '').length, 0);
      const revealCount = Math.floor(easeOut(p) * totalChars);
      let count = 0;
      for (let sy = 0; sy < sprite.length; sy++) {
        const row = sprite[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ') {
            count++;
            if (count <= revealCount) {
              drawChar(px + sx, py + sy, row[sx]!);
            } else if (count <= revealCount + 3) {
              drawChar(px + sx, py + sy, '*');
            }
          }
        }
      }
      if (f % 12 === 0 && p > 0.3) spawnSparks(W / 2, H / 2, 3);
      updateSparks();
    }

    // ── Phase 2: Rick at center, lyrics start (6–30s) ────────
    else if (sec < 30) {
      const p = (sec - 6) / 24;
      // Rick sways gently, pose changes
      const poseIdx = Math.floor(f / 20) % 3; // cycle stand, arm_up, dance
      const pose = [RICK_STAND, RICK_ARM_UP, RICK_DANCE_1][poseIdx]!;
      const px = W * 0.2 + Math.sin(f * 0.04) * 5;
      const py = H * 0.3 + Math.sin(f * 0.06) * 2;
      drawSprite(pose, px, py);

      // Lyrics on the right
      const lyric = getLyric(sec, 6);
      if (lyric) {
        const isChorus = lyric.text.startsWith('NEVER');
        const lx = W * 0.6;
        const ly = H * 0.4;
        typewriter(lyric.text, lx, ly, lyric.progress);
        if (isChorus && f % 8 === 0) spawnSparks(lx, ly, 2, 30);
      }

      if (f % 30 === 0) spawnSparks(px + SPRITE_W / 2, py, 2);
      updateSparks();
    }

    // ── Phase 3: Rick dashes across screen L→R (30–34s) ──────
    else if (sec < 34) {
      const p = (sec - 30) / 4;
      const pose = p < 0.5 ? RICK_LEAN_R : RICK_DANCE_2;
      const px = lerp(-SPRITE_W, W + 10, easeInOut(p));
      const py = H * 0.35 + Math.sin(f * 0.2) * 2;
      drawSprite(pose, px, py);
      drawSpeedLines(px, py, pose.length, 1);
      updateSparks();
    }

    // ── Phase 4: PSYCHEDELIC TAKEOVER (34–42s) ───────────────
    else if (sec < 42) {
      const p = (sec - 34) / 8;

      // Expanding pulse rings
      const ringIntensity = p < 0.2 ? easeOut(p / 0.2) : p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      drawPsychedelic(localF, ringIntensity);

      // Rick big in center
      if (p > 0.15 && p < 0.85) {
        const bigP = p < 0.3 ? (p - 0.15) / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.15 : 1;
        const sprite = RICK_BIG;
        const px = W / 2 - 22;
        const py = lerp(H + 5, H / 2 - sprite.length / 2, easeOut(Math.min(bigP, 1)));
        // Draw with random character swaps for psychedelic effect
        for (let sy = 0; sy < sprite.length; sy++) {
          const row = sprite[sy]!;
          for (let sx = 0; sx < row.length; sx++) {
            if (row[sx] !== ' ') {
              const psychChar = Math.random() < 0.1
                ? SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!
                : row[sx]!;
              drawChar(px + sx, py + sy, psychChar);
            }
          }
        }
      }

      // Lyrics overlay during takeover
      const lyric = getLyric(sec, 6);
      if (lyric) {
        drawText(lyric.text, W / 2, 2);
      }

      if (f % 6 === 0) spawnSparks(W / 2, H / 2, 5, 50);
      updateSparks();
    }

    // ── Phase 5: Rick dashes R→L (42–46s) ────────────────────
    else if (sec < 46) {
      const p = (sec - 42) / 4;
      const pose = p < 0.5 ? RICK_LEAN_L : RICK_DANCE_1;
      const px = lerp(W + 10, -SPRITE_W, easeInOut(p));
      const py = H * 0.3 + Math.sin(f * 0.2) * 2;
      drawSprite(pose, px, py);
      drawSpeedLines(px, py, pose.length, -1);
      updateSparks();
    }

    // ── Phase 6: Rick dancing center, second verse (46–70s) ──
    else if (sec < 70) {
      const p = (sec - 46) / 24;
      // More energetic dance — faster pose switching
      const poseIdx = Math.floor(f / 12) % POSES.length;
      const pose = POSES[poseIdx]!;
      const px = W * 0.25 + Math.sin(f * 0.05) * 8;
      const py = H * 0.25 + Math.sin(f * 0.08) * 3;
      drawSprite(pose, px, py);

      // Lyrics continue
      const lyric = getLyric(sec, 6);
      if (lyric) {
        const isChorus = lyric.text.startsWith('NEVER');
        typewriter(lyric.text, W * 0.63, H * 0.4, lyric.progress);
        if (isChorus) {
          // Chorus gets extra sparkles and emphasis
          if (f % 5 === 0) spawnSparks(W * 0.63, H * 0.4, 3, 35);
        }
      }

      if (f % 20 === 0) spawnSparks(px + SPRITE_W / 2, py - 1, 2);
      updateSparks();
    }

    // ── Phase 7: Second psychedelic burst (70–76s) ───────────
    else if (sec < 76) {
      const p = (sec - 70) / 6;
      const ringIntensity = p < 0.2 ? easeOut(p / 0.2) : p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
      drawPsychedelic(localF, ringIntensity * 0.8);

      // Multiple small Ricks at different positions
      const positions = [
        { x: W * 0.15, y: H * 0.1 },
        { x: W * 0.55, y: H * 0.15 },
        { x: W * 0.35, y: H * 0.5 },
        { x: W * 0.75, y: H * 0.45 },
      ];
      const poseIdx = Math.floor(f / 8) % POSES.length;
      for (const pos of positions) {
        if (Math.random() < ringIntensity) {
          drawSprite(POSES[poseIdx]!, pos.x, pos.y);
        }
      }

      if (f % 4 === 0) spawnSparks(W / 2, H / 2, 4, 60);
      updateSparks();
    }

    // ── Phase 8: Rick walks off, "you just got rickrolled" (76–85s) ─
    else if (sec < 85) {
      const p = (sec - 76) / 9;

      if (p < 0.4) {
        // Rick walks off right
        const walkP = p / 0.4;
        const px = lerp(W * 0.4, W + 15, easeInOut(walkP));
        const py = H * 0.3;
        const poseIdx = Math.floor(f / 10) % 2;
        drawSprite([RICK_STAND, RICK_DANCE_2][poseIdx]!, px, py);
        drawSpeedLines(px, py, RICK_STAND.length, 1);
      }

      if (p > 0.35) {
        const textP = Math.min((p - 0.35) / 0.25, 1);
        typewriter('you just got rickrolled', W / 2, H * 0.35, textP);
      }

      if (p > 0.55) {
        const textP = Math.min((p - 0.55) / 0.2, 1);
        typewriter('by chloe, with love  <3', W / 2, H * 0.35 + 3, textP);
      }

      if (p > 0.7 && f % 10 === 0) spawnSparks(W / 2, H * 0.35 + 1, 3, 40);

      // Fade out at end
      if (p > 0.88) {
        const fade = (p - 0.88) / 0.12;
        const g = gridRef.current;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (g[y]![x] !== ' ' && Math.random() < fade * 0.4) g[y]![x] = ' ';
          }
        }
      }

      updateSparks();
    }

    // ── Phase 9: Hold black (85–90s) ─────────────────────────
    else {
      // Single <3 pulses
      if (Math.sin(f * 0.2) > 0.5) {
        drawText('<3', W / 2, H / 2);
      }
      updateSparks();
    }

    if (preRef.current) {
      preRef.current.textContent = renderGrid();
    }

    frameRef.current = f + 1;
  }, [createGrid, clearGrid, drawChar, drawSprite, drawText, typewriter,
      spawnSparks, updateSparks, drawPsychedelic, drawSpeedLines, getLyric, renderGrid]);

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

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
