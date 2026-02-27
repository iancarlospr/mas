'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Mean Girls — Animated Quote Reel

   Typewriter reveals, particle transitions between scenes,
   burn book with page-turn effect, floating sparkles, iconic quotes.
   120x30 grid, 15fps, ~60s loop.
   ================================================================= */

const W = 120;
const H = 30;
const INTERVAL = 67;

// ── Sparkle / particle system ──────────────────────────────────

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  char: string;
}

const SPARK_CHARS = ['*', '+', '.', '~', ':', '`'];
const HEART_CHARS = ['*', '+', '.'];

// ── Scene definitions ──────────────────────────────────────────

interface QuoteScene {
  lines: string[];
  attribution: string;
  art?: string[];    // optional ASCII art below quote
  artOffsetY?: number;
}

const SCENES: QuoteScene[] = [
  {
    lines: ['"On Wednesdays, we wear pink."'],
    attribution: '- Karen Smith',
    art: [
      '           .::::.           ',
      '          : .  . :          ',
      '          :  --  :          ',
      '          \':    :\'          ',
      '        .--\'::::\'--.       ',
      '       :   :    :   :      ',
      '       :   :    :   :      ',
    ],
    artOffsetY: 2,
  },
  {
    lines: ['"That is SO fetch."'],
    attribution: '- Gretchen Wieners',
  },
  {
    lines: ['"Stop trying to make fetch happen.', ' It\'s NOT going to happen."'],
    attribution: '- Regina George',
  },
  {
    lines: ['"YOU CAN\'T SIT WITH US!"'],
    attribution: '- Gretchen Wieners',
  },
  {
    lines: ['"Get in loser,', ' we\'re going scanning."'],
    attribution: '- Chloe George',
    art: [
      '        .---==========---.        ',
      '       / ::::::::::::::::: \\       ',
      ' _____/  :   ghostscan   : \\_____',
      '[_____]__\':::::::::::::::\'__[_____]',
      '  (O)                         (O) ',
    ],
    artOffsetY: 1,
  },
  {
    lines: ['"She doesn\'t even go here!"'],
    attribution: '- Damian (about your competitor)',
    art: [
      '         .::::.         ',
      '        : o  o :        ',
      '        :  <>  :        ',
      '         \'::::\'         ',
    ],
    artOffsetY: 2,
  },
  {
    lines: ['"I\'m not a regular ghost,', ' I\'m a cool ghost."'],
    attribution: '- Chloe (Mrs. George energy)',
    art: [
      '       .:::::::.       ',
      '     .::       ::.     ',
      '    ::           ::    ',
      '   ::  .##. .##.  ::   ',
      '   ::  # *# # *#  ::   ',
      '   ::  \'##\' \'##\'  ::   ',
      '   ::     ..      ::   ',
      '    ::           ::    ',
      '     ::  :  :  ::      ',
      '      \':  \'::\'  :\'     ',
    ],
    artOffsetY: 0,
  },
];

// ── Burn Book art ──────────────────────────────────────────────

const BURN_BOOK: string[] = [
  '     +=-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+     ',
  '     |                                               |     ',
  '     |        T H E   B U R N   B O O K             |     ',
  '     |                                               |     ',
  '     +=-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+-=+     ',
  '                                                           ',
  '              .:::::::::::::::::::::::.                     ',
  '             ::                       ::                    ',
  '             ::    ~*~  ~*~  ~*~      ::                    ',
  '             ::                       ::                    ',
  '             ::      s e c r e t s    ::                    ',
  '             ::                       ::                    ',
  '             ::    ~*~  ~*~  ~*~      ::                    ',
  '             ::                       ::                    ',
  '              \'::::::::::::::::::::::\'                      ',
  '                                                           ',
  '          property of chloe + regina                       ',
];

// ── "MEAN GIRLS" title letters ─────────────────────────────────

const TITLE_ART: string[] = [
  '#   # ##### .#.  #   #    .####. # ####. #     .####.',
  '## ## #     #   # ##  #   #      # #   # #    #      ',
  '# # # ####  ##### # # #   # .## # ####\' #     ####. ',
  '#   # #     #   # #  ##    \'#  # # # \'#  #         # ',
  '#   # ##### #   # #   #   .####\' # #  ## ##### ####\' ',
];

// ── The Limit box ──────────────────────────────────────────────

const LIMIT_BOX: string[] = [
  '.---------------------------------------------.',
  '|  THE LIMIT DOES NOT EXIST                    |',
  '|                                              |',
  '|  ...and neither does the number of           |',
  '|  tracking scripts on your website.           |',
  '|                                              |',
  '|  run a scan. find out.                       |',
  '\'---------------------------------------------\'',
];

// ── Main component ─────────────────────────────────────────────

export function MeanGirlsAnimation() {
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

  const drawTextAt = useCallback((text: string, x: number, y: number) => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== undefined) drawChar(x + i, y, text[i]!);
    }
  }, [drawChar]);

  const drawCentered = useCallback((text: string, y: number) => {
    drawTextAt(text, Math.round(W / 2 - text.length / 2), y);
  }, [drawTextAt]);

  const drawSprite = useCallback((sprite: string[], cx: number, cy: number) => {
    for (let sy = 0; sy < sprite.length; sy++) {
      const row = sprite[sy]!;
      const sx = Math.round(cx - row.length / 2);
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== ' ') drawChar(sx + i, cy + sy, row[i]!);
      }
    }
  }, [drawChar]);

  // Typewriter: reveals text char by char based on progress (0-1)
  const typewriter = useCallback((text: string, x: number, y: number, progress: number) => {
    const reveal = Math.floor(progress * text.length);
    for (let i = 0; i < reveal; i++) {
      if (text[i] !== undefined) drawChar(x + i, y, text[i]!);
    }
    // Blinking cursor at reveal position
    if (reveal < text.length && Math.floor(frameRef.current / 4) % 2 === 0) {
      drawChar(x + reveal, y, '_');
    }
  }, [drawChar]);

  const spawnSparks = useCallback((cx: number, cy: number, count: number, spread = 20) => {
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: cx + (Math.random() - 0.5) * spread,
        y: cy + (Math.random() - 0.5) * (spread * 0.4),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 0.8,
        life: Math.floor(Math.random() * 12) + 4,
        char: SPARK_CHARS[Math.floor(Math.random() * SPARK_CHARS.length)]!,
      });
    }
  }, []);

  const spawnHearts = useCallback((cx: number, cy: number, count: number) => {
    for (let i = 0; i < count; i++) {
      sparksRef.current.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.4 - 0.1,
        life: Math.floor(Math.random() * 18) + 8,
        char: HEART_CHARS[Math.floor(Math.random() * HEART_CHARS.length)]!,
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

  // Dissolve transition: scatter all non-space chars
  const dissolveGrid = useCallback((intensity: number) => {
    const g = gridRef.current;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y]![x] !== ' ' && Math.random() < intensity) {
          // Scatter into spark
          sparksRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 2,
            life: Math.floor(Math.random() * 6) + 2,
            char: g[y]![x]!,
          });
          g[y]![x] = ' ';
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
    const LOOP = 900; // 60 seconds at 15fps
    const localF = f % LOOP;
    const sec = (localF / LOOP) * 60;

    if (localF === 0) sparksRef.current = [];

    clearGrid();

    // ── Intro: Title (0–5s) ──────────────────────────────────
    if (sec < 5) {
      const p = sec / 5;
      if (p < 0.6) {
        // Typewriter the title
        const titleY = 10;
        for (let i = 0; i < TITLE_ART.length; i++) {
          const line = TITLE_ART[i]!;
          const reveal = Math.floor((p / 0.6) * line.length);
          const sx = Math.round(W / 2 - line.length / 2);
          for (let c = 0; c < reveal; c++) {
            if (line[c] !== ' ') drawChar(sx + c, titleY + i, line[c]!);
          }
        }
      } else {
        // Hold full title
        const titleY = 10;
        for (let i = 0; i < TITLE_ART.length; i++) {
          const line = TITLE_ART[i]!;
          const sx = Math.round(W / 2 - line.length / 2);
          for (let c = 0; c < line.length; c++) {
            if (line[c] !== ' ') {
              const shimmer = Math.random() < 0.03;
              drawChar(sx + c, titleY + i, shimmer ? '*' : line[c]!);
            }
          }
        }
        if (f % 15 === 0) spawnSparks(W / 2, 12, 4, 50);
      }
      // Dissolve at end
      if (p > 0.88) dissolveGrid((p - 0.88) / 0.12 * 0.3);
      updateSparks();
    }

    // ── Burn Book (5–10s) ────────────────────────────────────
    else if (sec < 10) {
      const p = (sec - 5) / 5;
      // Book "opens" — reveal line by line
      const revealLines = Math.floor(easeOut(Math.min(p * 1.5, 1)) * BURN_BOOK.length);
      const bookY = Math.round(H / 2 - BURN_BOOK.length / 2);
      for (let i = 0; i < revealLines; i++) {
        const line = BURN_BOOK[i]!;
        const sx = Math.round(W / 2 - line.length / 2);
        for (let c = 0; c < line.length; c++) {
          if (line[c] !== ' ') drawChar(sx + c, bookY + i, line[c]!);
        }
      }
      if (f % 20 === 0 && p > 0.3) spawnHearts(W / 2, H / 2, 3);
      if (p > 0.88) dissolveGrid((p - 0.88) / 0.12 * 0.3);
      updateSparks();
    }

    // ── Quote scenes (10–52s) — 7 quotes, ~6s each ───────────
    else if (sec < 52) {
      const quoteTime = sec - 10;
      const QUOTE_DUR = 6;
      const sceneIdx = Math.min(Math.floor(quoteTime / QUOTE_DUR), SCENES.length - 1);
      const scene = SCENES[sceneIdx]!;
      const sceneP = (quoteTime - sceneIdx * QUOTE_DUR) / QUOTE_DUR;

      // Typewriter the quote lines
      const quoteStartY = scene.art ? 6 : Math.round(H / 2 - scene.lines.length);
      const typeP = Math.min(sceneP / 0.5, 1); // first 50% of scene for typing

      for (let li = 0; li < scene.lines.length; li++) {
        const line = scene.lines[li]!;
        const lineDelay = li * 0.15;
        const lineP = Math.max(0, Math.min((typeP - lineDelay) / (1 - lineDelay), 1));
        const x = 8;
        typewriter(line, x, quoteStartY + li * 2, lineP);
      }

      // Attribution fades in after quote
      if (sceneP > 0.5) {
        const attrP = (sceneP - 0.5) / 0.2;
        const text = scene.attribution;
        const ax = W - text.length - 6;
        const ay = quoteStartY + scene.lines.length * 2 + (scene.art ? scene.art.length + (scene.artOffsetY ?? 0) + 2 : 2);
        if (attrP >= 1) {
          drawTextAt(text, ax, Math.min(ay, H - 2));
        } else {
          const reveal = Math.floor(attrP * text.length);
          for (let i = 0; i < reveal; i++) drawChar(ax + i, Math.min(ay, H - 2), text[i]!);
        }
      }

      // Draw art if present
      if (scene.art && sceneP > 0.35) {
        const artP = Math.min((sceneP - 0.35) / 0.3, 1);
        const artY = quoteStartY + scene.lines.length * 2 + (scene.artOffsetY ?? 0);
        for (let i = 0; i < scene.art.length; i++) {
          const line = scene.art[i]!;
          const reveal = Math.floor(artP * line.length);
          const sx = Math.round(W / 2 - line.length / 2);
          for (let c = 0; c < reveal; c++) {
            if (line[c] !== ' ') drawChar(sx + c, artY + i, line[c]!);
          }
        }
      }

      // Sparkles on each scene
      if (f % 25 === 0) spawnSparks(W / 2, H / 2, 2, 60);

      // Dissolve transition between scenes
      if (sceneP > 0.9) dissolveGrid((sceneP - 0.9) / 0.1 * 0.4);

      updateSparks();
    }

    // ── "The Limit Does Not Exist" box (52–58s) ──────────────
    else if (sec < 58) {
      const p = (sec - 52) / 6;
      const boxY = Math.round(H / 2 - LIMIT_BOX.length / 2);

      if (p < 0.4) {
        // Build box line by line
        const revealLines = Math.floor(easeOut(p / 0.4) * LIMIT_BOX.length);
        for (let i = 0; i < revealLines; i++) {
          const line = LIMIT_BOX[i]!;
          drawCentered(line, boxY + i);
        }
      } else if (p < 0.85) {
        // Hold
        for (let i = 0; i < LIMIT_BOX.length; i++) {
          drawCentered(LIMIT_BOX[i]!, boxY + i);
        }
        // Shimmer on the border chars
        const g = gridRef.current;
        for (let y = boxY; y < boxY + LIMIT_BOX.length; y++) {
          for (let x = 0; x < W; x++) {
            if ((g[y]![x] === '.' || g[y]![x] === '-' || g[y]![x] === '|' || g[y]![x] === '\'') && Math.random() < 0.04) {
              g[y]![x] = '*';
            }
          }
        }
        if (f % 18 === 0) spawnSparks(W / 2, boxY + 4, 3, 40);
      } else {
        dissolveGrid((p - 0.85) / 0.15 * 0.5);
      }
      updateSparks();
    }

    // ── Fade to black (58–60s) ───────────────────────────────
    else {
      updateSparks();
    }

    if (preRef.current) {
      preRef.current.textContent = renderGrid();
    }

    frameRef.current = f + 1;
  }, [createGrid, clearGrid, drawChar, drawTextAt, drawCentered, drawSprite,
      typewriter, spawnSparks, spawnHearts, updateSparks, dissolveGrid, renderGrid]);

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
