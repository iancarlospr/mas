'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Rick Roll — Big Rick, full-screen psychedelic takeover,
   dancing, lyrics. 90s loop. 120x30, 15fps.
   ================================================================= */

const W = 120;
const H = 30;
const INTERVAL = 67;

// ── Rick sprites — BIG, detailed, matching Chloe quality ───────

const RICK_A: string[] = [
  '       .##############.       ',
  '      ##################      ',
  '     ####################     ',
  '     ####################     ',
  '      .:            :.        ',
  '     ::              ::       ',
  '     ::  .##.  .##.  ::       ',
  '     ::  #  #  #  #  ::       ',
  '     ::  \'##\'  \'##\'  ::       ',
  '     ::      <>      ::       ',
  '     ::    \'----\'    ::       ',
  '      ::            ::        ',
  '       \'::::::::::::::\'       ',
  '        ::          ::        ',
  '       .::..........::        ',
  '      ::              ::      ',
  '     ::                ::     ',
  '    ::                  ::    ',
  '    ::                  ::    ',
  '     ##                ##     ',
];

const RICK_B: string[] = [
  '       .##############.       ',
  '      ##################      ',
  '     ####################     ',
  '     ####################     ',
  '      .:            :.    /   ',
  '     ::              ::  /    ',
  '     ::  .##.  .##.  :: /     ',
  '     ::  #  #  #  #  ::/      ',
  '     ::  \'##\'  \'##\'  ::       ',
  '     ::      <>      ::       ',
  '     ::    \'\\--/\'    ::       ',
  '      ::            ::        ',
  '      /\'::::::::::::\'\\       ',
  '     /  ::          ::  \\     ',
  '    :   ::..........::   :    ',
  '        ::          ::        ',
  '       ::            ::       ',
  '      ::    ::::      ::      ',
  '     ##                ##     ',
  '                              ',
];

const RICK_C: string[] = [
  '  .##############.            ',
  ' ##################           ',
  '####################          ',
  '####################          ',
  ' .:            :.             ',
  '::              ::            ',
  '::  .##.  .##.  ::           ',
  '::  #  #  #  #  ::           ',
  '::  \'##\'  \'##\'  ::           ',
  '::      <>      ::           ',
  '::    \'----\'    ::           ',
  ' ::            ::             ',
  '  \'::::::::::::::\'            ',
  '   ::          ::             ',
  '  .::..........::             ',
  ' ::              ::           ',
  '::                ::          ',
  ':                  ::         ',
  '##                  ##        ',
  '                              ',
];

const RICK_D: string[] = [
  '            .##############.  ',
  '           ################## ',
  '          ####################',
  '          ####################',
  '             .:            :. ',
  '            ::              ::',
  '           ::  .##.  .##.  ::',
  '           ::  #  #  #  #  ::',
  '           ::  \'##\'  \'##\'  ::',
  '           ::      <>      ::',
  '           ::    \'----\'    ::',
  '             ::            :: ',
  '            \'::::::::::::::\'  ',
  '             ::          ::   ',
  '             ::..........::   ',
  '           ::              :: ',
  '          ::                ::',
  '         ::                  :',
  '        ##                  ##',
  '                              ',
];

const RICK_DANCE: string[] = [
  '       .##############.       ',
  '      ##################      ',
  '     ####################     ',
  '     ####################     ',
  '   \\  .:            :.  /     ',
  '    \\::              ::/ /    ',
  '     ::  .##.  .##.  ::/      ',
  '     ::  #  #  #  #  ::       ',
  '     ::  \'##\'  \'##\'  ::       ',
  '     ::      <>      ::       ',
  '     ::    \'\\--/\'    ::       ',
  '      ::            ::        ',
  '      /\'::::::::::::\'\\       ',
  '     /  ::          ::  \\     ',
  '        ::..........::        ',
  '       ::            ::       ',
  '      ::     ::::     ::      ',
  '     ##                ##     ',
  '                              ',
  '                              ',
];

const RICK_HUGE: string[] = [
  '                .############################.                ',
  '             ################################## .             ',
  '           ######################################             ',
  '          ########################################            ',
  '          ########################################            ',
  '           .:                                :.               ',
  '          ::                                  ::              ',
  '         ::                                    ::             ',
  '         ::     .######.        .######.       ::             ',
  '         ::     #      #        #      #       ::             ',
  '         ::     #  **  #        #  **  #       ::             ',
  '         ::     #      #        #      #       ::             ',
  '         ::     \'######\'        \'######\'       ::             ',
  '         ::                                    ::             ',
  '         ::              .<>.                  ::             ',
  '         ::            \'------\'                ::             ',
  '         ::                                    ::             ',
  '          ::                                  ::              ',
  '           \'::                              ::\'               ',
  '             \'::::::::::::::::::::::::::::::::\'               ',
  '               ::                          ::                 ',
  '              .::..........................::                  ',
  '             ::                              ::               ',
  '            ::                                ::              ',
  '           ::                                  ::             ',
  '          ##                                    ##            ',
];

const POSES = [RICK_A, RICK_B, RICK_DANCE, RICK_A, RICK_C, RICK_D, RICK_DANCE, RICK_B];
const SPRITE_W = 30;

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
  { text: "Your heart's been aching but you're too shy", dur: 4.5 },
  { text: "Inside we both know what's been going on", dur: 4 },
  { text: "NEVER GONNA GIVE YOU UP", dur: 3.5 },
  { text: "NEVER GONNA LET YOU DOWN", dur: 3.5 },
  { text: "NEVER GONNA RUN AROUND AND DESERT YOU", dur: 3.5 },
  { text: "NEVER GONNA MAKE YOU CRY", dur: 3.5 },
  { text: "NEVER GONNA SAY GOODBYE", dur: 3.5 },
  { text: "NEVER GONNA TELL A LIE AND HURT YOU", dur: 4 },
];

// ── Effects ────────────────────────────────────────────────────

interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; char: string;
}

const SPARK_CHARS = ['*', '+', '.', ':', '~', '#'];
const WAVE_CHARS = [' ', '.', ':', '+', '*', '#', '@', '#', '*', '+', ':', '.'];

// ── Main component ─────────────────────────────────────────────

export function RickRollAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);
  const gridRef = useRef<string[][]>([]);
  const sparksRef = useRef<Spark[]>([]);

  const createGrid = useCallback((): string[][] =>
    Array.from({ length: H }, () => Array(W).fill(' ')), []);

  const clearGrid = useCallback(() => {
    const g = gridRef.current;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y]![x] = ' ';
  }, []);

  const drawChar = useCallback((x: number, y: number, ch: string) => {
    const gx = Math.round(x); const gy = Math.round(y);
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
    for (let i = 0; i < text.length; i++) if (text[i] !== ' ') drawChar(sx + i, cy, text[i]!);
  }, [drawChar]);

  const typewriter = useCallback((text: string, cx: number, cy: number, p: number) => {
    const sx = Math.round(cx - text.length / 2);
    const n = Math.floor(p * text.length);
    for (let i = 0; i < n; i++) drawChar(sx + i, cy, text[i]!);
  }, [drawChar]);

  const spawnSparks = useCallback((cx: number, cy: number, count: number, spread = 25) => {
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: cx + (Math.random() - 0.5) * spread,
        y: cy + (Math.random() - 0.5) * spread * 0.4,
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

  // FULL SCREEN psychedelic — fills every cell with wave patterns
  const drawPsychedelic = useCallback((f: number, intensity: number) => {
    const g = gridRef.current;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Multiple overlapping sine waves create moiré patterns
        const wave1 = Math.sin(x * 0.15 + f * 0.12) * 3;
        const wave2 = Math.cos(y * 0.3 + f * 0.08) * 2;
        const wave3 = Math.sin((x + y) * 0.1 - f * 0.15) * 2;
        const wave4 = Math.cos(Math.sqrt((x - W / 2) ** 2 + (y - H / 2) ** 2) * 0.2 - f * 0.2) * 3;
        const val = (wave1 + wave2 + wave3 + wave4) / 4;
        const idx = Math.floor((val + 1) / 2 * (WAVE_CHARS.length - 1));
        const charIdx = Math.max(0, Math.min(WAVE_CHARS.length - 1, idx));
        if (Math.random() < intensity) {
          g[y]![x] = WAVE_CHARS[charIdx]!;
        }
      }
    }
  }, []);

  // Radiating starburst from center
  const drawStarburst = useCallback((f: number, cx: number, cy: number, intensity: number) => {
    const g = gridRef.current;
    const chars = ['@', '#', '*', '+', ':', '.'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) * 0.5; // aspect ratio correction
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        // Pulsing radial pattern
        const radial = Math.sin(dist * 0.5 - f * 0.25) * Math.cos(angle * 8 + f * 0.1);
        if (radial > 0.3 && Math.random() < intensity) {
          const ci = Math.floor((1 - radial) * chars.length);
          g[y]![x] = chars[Math.max(0, Math.min(ci, chars.length - 1))]!;
        }
      }
    }
  }, []);

  // Speed lines
  const drawSpeedLines = useCallback((px: number, py: number, h: number, dir: number) => {
    for (let i = 0; i < 20; i++) {
      const tx = dir > 0 ? px - 2 - i * 2 : px + SPRITE_W + 2 + i * 2;
      const ty = py + 2 + Math.floor(Math.random() * (h - 4));
      drawChar(tx, ty, i < 6 ? '=' : i < 12 ? '-' : '~');
    }
  }, [drawChar]);

  const getLyric = useCallback((sec: number, offset: number): { text: string; progress: number } | null => {
    let t = sec - offset;
    if (t < 0) return null;
    for (const lyric of LYRICS) {
      if (t < lyric.dur) return { text: lyric.text, progress: Math.min(t / (lyric.dur * 0.6), 1) };
      t -= lyric.dur;
    }
    return null;
  }, []);

  const renderGrid = useCallback((): string =>
    gridRef.current.map(row => row.join('')).join('\n'), []);

  // ── Animation loop ─────────────────────────────────────────

  const animate = useCallback(() => {
    if (!gridRef.current.length) gridRef.current = createGrid();

    const f = frameRef.current;
    const LOOP = 1350; // 90s
    const lf = f % LOOP;
    const sec = (lf / LOOP) * 90;
    if (lf === 0) sparksRef.current = [];

    clearGrid();

    // ── Phase 0: Darkness → dots (0–2s) ──────────────────────
    if (sec < 2) {
      const n = Math.floor((sec / 2) * 8);
      for (let i = 0; i < n; i++)
        drawChar(W / 2 + (Math.random() - 0.5) * 12, H / 2 + (Math.random() - 0.5) * 5, '.');
    }

    // ── Phase 1: Rick builds up (2–6s) ───────────────────────
    else if (sec < 6) {
      const p = (sec - 2) / 4;
      const sprite = RICK_A;
      const px = W / 2 - SPRITE_W / 2;
      const py = H / 2 - sprite.length / 2;
      const total = sprite.reduce((s, r) => s + r.replace(/ /g, '').length, 0);
      const reveal = Math.floor(easeOut(p) * total);
      let count = 0;
      for (let sy = 0; sy < sprite.length; sy++) {
        const row = sprite[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ') {
            count++;
            if (count <= reveal) drawChar(px + sx, py + sy, row[sx]!);
            else if (count <= reveal + 4) drawChar(px + sx, py + sy, '*');
          }
        }
      }
      if (f % 10 === 0 && p > 0.3) spawnSparks(W / 2, H / 2, 4);
      updateSparks();
    }

    // ── Phase 2: Rick center-left, first verse + chorus (6–30s)
    else if (sec < 30) {
      const poseIdx = Math.floor(f / 18) % 4;
      const pose = [RICK_A, RICK_B, RICK_DANCE, RICK_A][poseIdx]!;
      const px = W * 0.12 + Math.sin(f * 0.04) * 6;
      const py = H * 0.2 + Math.sin(f * 0.06) * 2.5;
      drawSprite(pose, px, py);

      const lyric = getLyric(sec, 6);
      if (lyric) {
        const isChorus = lyric.text.startsWith('NEVER');
        typewriter(lyric.text, W * 0.62, H * 0.42, lyric.progress);
        if (isChorus && f % 6 === 0) spawnSparks(W * 0.62, H * 0.42, 3, 35);
      }
      if (f % 25 === 0) spawnSparks(px + SPRITE_W / 2, py, 2);
      updateSparks();
    }

    // ── Phase 3: Rick dashes L→R (30–33s) ────────────────────
    else if (sec < 33) {
      const p = (sec - 30) / 3;
      const pose = RICK_D;
      const px = lerp(-SPRITE_W, W + 10, easeInOut(p));
      const py = H * 0.25 + Math.sin(f * 0.2) * 2;
      drawSprite(pose, px, py);
      drawSpeedLines(px, py, pose.length, 1);
      updateSparks();
    }

    // ── Phase 4: PSYCHEDELIC TAKEOVER (33–44s) ───────────────
    else if (sec < 44) {
      const p = (sec - 33) / 11;
      const fadeIn = Math.min(p * 4, 1);
      const fadeOut = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      const intensity = fadeIn * fadeOut;

      // Full-screen wave patterns
      drawPsychedelic(lf, intensity * 0.9);

      // Starburst overlay
      if (p > 0.15 && p < 0.75) {
        drawStarburst(lf, W / 2, H / 2, intensity * 0.5);
      }

      // Big Rick rises from below
      if (p > 0.1 && p < 0.85) {
        const bigP = p < 0.25 ? (p - 0.1) / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.15 : 1;
        const sprite = RICK_HUGE;
        const px = W / 2 - 29;
        const py = lerp(H + 5, H / 2 - sprite.length / 2, easeOut(Math.min(bigP, 1)));
        for (let sy = 0; sy < sprite.length; sy++) {
          const row = sprite[sy]!;
          for (let sx = 0; sx < row.length; sx++) {
            if (row[sx] !== ' ') {
              const glitch = Math.random() < 0.08
                ? SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!
                : row[sx]!;
              drawChar(px + sx, py + sy, glitch);
            }
          }
        }
      }

      // Lyrics overlay
      const lyric = getLyric(sec, 6);
      if (lyric) drawText(lyric.text, W / 2, 1);

      if (f % 4 === 0) spawnSparks(W / 2, H / 2, 6, 60);
      updateSparks();
    }

    // ── Phase 5: Rick dashes R→L (44–47s) ────────────────────
    else if (sec < 47) {
      const p = (sec - 44) / 3;
      const pose = RICK_C;
      const px = lerp(W + 10, -SPRITE_W, easeInOut(p));
      const py = H * 0.25 + Math.sin(f * 0.2) * 2;
      drawSprite(pose, px, py);
      drawSpeedLines(px, py, pose.length, -1);
      updateSparks();
    }

    // ── Phase 6: Energetic dance, second verse (47–70s) ──────
    else if (sec < 70) {
      const poseIdx = Math.floor(f / 10) % POSES.length;
      const pose = POSES[poseIdx]!;
      const px = W * 0.15 + Math.sin(f * 0.06) * 10;
      const py = H * 0.15 + Math.sin(f * 0.08) * 4;
      drawSprite(pose, px, py);

      const lyric = getLyric(sec, 6);
      if (lyric) {
        const isChorus = lyric.text.startsWith('NEVER');
        typewriter(lyric.text, W * 0.62, H * 0.4, lyric.progress);
        if (isChorus && f % 4 === 0) spawnSparks(W * 0.62, H * 0.4, 4, 40);
      }
      if (f % 15 === 0) spawnSparks(px + SPRITE_W / 2, py - 1, 3);
      updateSparks();
    }

    // ── Phase 7: Second psychedelic + multi-Rick (70–78s) ────
    else if (sec < 78) {
      const p = (sec - 70) / 8;
      const fadeIn = Math.min(p * 3, 1);
      const fadeOut = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
      const intensity = fadeIn * fadeOut;

      drawPsychedelic(lf, intensity * 0.7);
      drawStarburst(lf, W / 2, H / 2, intensity * 0.4);

      // 4 Ricks at different positions
      const positions = [
        { x: W * 0.05, y: H * 0.05 },
        { x: W * 0.55, y: H * 0.02 },
        { x: W * 0.30, y: H * 0.35 },
        { x: W * 0.70, y: H * 0.30 },
      ];
      const pi = Math.floor(f / 8) % POSES.length;
      for (const pos of positions) {
        if (Math.random() < intensity) drawSprite(POSES[pi]!, pos.x, pos.y);
      }

      if (f % 3 === 0) spawnSparks(W / 2, H / 2, 5, 70);
      updateSparks();
    }

    // ── Phase 8: Rick exits, rickrolled message (78–87s) ─────
    else if (sec < 87) {
      const p = (sec - 78) / 9;

      if (p < 0.35) {
        const walkP = p / 0.35;
        const px = lerp(W * 0.4, W + 15, easeInOut(walkP));
        const py = H * 0.2;
        const pi = Math.floor(f / 10) % 2;
        drawSprite([RICK_A, RICK_DANCE][pi]!, px, py);
        drawSpeedLines(px, py, RICK_A.length, 1);
      }

      if (p > 0.3) {
        const tp = Math.min((p - 0.3) / 0.25, 1);
        typewriter('you just got rickrolled', W / 2, H * 0.35, tp);
      }
      if (p > 0.5) {
        const tp = Math.min((p - 0.5) / 0.2, 1);
        typewriter('by chloe, with love  <3', W / 2, H * 0.35 + 3, tp);
      }
      if (p > 0.65 && f % 8 === 0) spawnSparks(W / 2, H * 0.35 + 1, 4, 45);

      if (p > 0.88) {
        const fade = (p - 0.88) / 0.12;
        const g = gridRef.current;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (g[y]![x] !== ' ' && Math.random() < fade * 0.5) g[y]![x] = ' ';
      }
      updateSparks();
    }

    // ── Phase 9: Pulsing <3 (87–90s) ─────────────────────────
    else {
      if (Math.sin(f * 0.2) > 0.3) drawText('<3', W / 2, H / 2);
      updateSparks();
    }

    if (preRef.current) preRef.current.textContent = renderGrid();
    frameRef.current = f + 1;
  }, [createGrid, clearGrid, drawChar, drawSprite, drawText, typewriter,
      spawnSparks, updateSparks, drawPsychedelic, drawStarburst, drawSpeedLines, getLyric, renderGrid]);

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

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
