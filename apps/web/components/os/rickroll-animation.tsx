'use client';

import { useEffect, useRef, useCallback } from 'react';

/* =================================================================
   Rick Roll — Chaotic psychedelic ASCII experience.
   200×55 grid, 6.5px font — fills ~800×500 of screen space.
   Block chars (░▒▓█▀▄▐▌) + chaos symbols for max density.
   ================================================================= */

const W = 200;
const H = 55;
const FPS = 15;
const MS = Math.round(1000 / FPS);
const LOOP = 90;

// ── Character palettes ──────────────────────────────────────────

const BLOCK = ['░', '▒', '▓', '█'];
const HALF = ['▀', '▄', '▐', '▌'];
const DENSE = ['░', '▒', '▓', '█', '▀', '▄', '▐', '▌', '╔', '╗', '╚', '╝', '═', '║'];
const CHAOS = ['$', 'Ñ', '≈', '∞', '◊', '★', '♦', '♪', '◆', '●', '○', '▲', '▼', '◀', '▶'];
const GLITCH = ['█', '▓', '░', '▒', '║', '═', '╬', '╠', '╣', '╦', '╩', '▌', '▐'];
const WAVE_FULL = [' ', '·', ':', '░', '▒', '▓', '█', '▓', '▒', '░', ':', '·'];

// ── Rick Astley — BIG sprites for 200-wide canvas ───────────────
// Each ~70 wide × 34 tall

const RICK_1: string[] = [
  '                    ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄                    ',
  '                 ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                 ',
  '               ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄               ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ░▒░                                ░▒░              ',
  '             ░▒░                                  ░▒░             ',
  '            ░▒░    ████▓▓▀▀      ████▓▓▀▀         ░▒░            ',
  '            ░▒░    ████▓▓▄▄      ████▓▓▄▄         ░▒░            ',
  '            ░▒░                                    ░▒░            ',
  '            ░▒░                                    ░▒░            ',
  '            ░▒░        ▀▀▄▄▄▄▄▄▄▄▀▀               ░▒░            ',
  '             ░▒░                                  ░▒░             ',
  '              ░▒░░▒▒░░▒▒▓▓▓▓▓▓▓▓▓▓▒▒░░▒▒░░▒░                    ',
  '               ░▒░                          ░▒░                   ',
  '             ▄▄▓▒░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▒░▓▄▄                ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '             ▀▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▀                ',
  '              ░▒░                            ░▒░                  ',
  '             ░▒░░                            ░░▒░                 ',
  '            ▄▓▓▓▓▄                          ▄▓▓▓▓▄               ',
  '           ▓▓▓▓▓▓▓▓                        ▓▓▓▓▓▓▓▓              ',
  '           ▓▓▓▓▓▓▓▓                        ▓▓▓▓▓▓▓▓              ',
  '           ▀▀▀▀▀▀▀▀                        ▀▀▀▀▀▀▀▀              ',
];

const RICK_2: string[] = [
  '                    ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄                    ',
  '                 ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                 ',
  '               ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄               ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ░▒░                                ░▒░      ▄█▌     ',
  '             ░▒░                                  ░▒░    ▐█▌      ',
  '            ░▒░    ████▓▓▀▀      ████▓▓▀▀         ░▒░  ▐█▌       ',
  '            ░▒░    ████▓▓▄▄      ████▓▓▄▄         ░▒░ █▌         ',
  '            ░▒░                                    ░▒▐█▌          ',
  '            ░▒░                                    ░█▌            ',
  '            ░▒░         ▄▀▀▀▀▀▀▀▀▄                ░▒░            ',
  '             ░▒░                                  ░▒░             ',
  '              ░▒░░▒▒░░▒▒▓▓▓▓▓▓▓▓▓▓▒▒░░▒▒░░▒░                    ',
  '             ▄▓▒░                              ░▒▓▄               ',
  '            █▓▓▒░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▒░▓▓█              ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█             ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█             ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█             ',
  '            ▀▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▀              ',
  '              ░▒░                              ░▒░                ',
  '             ░▒▓▓▄                          ▓▓▓▓▓▓▓              ',
  '            ▓▓▓▓▓▓▓▓                        ▀▀▀▀▀▀▀▀             ',
  '            ▀▀▀▀▀▀▀▀                                              ',
];

const RICK_3: string[] = [
  '                    ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄                    ',
  '                 ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                 ',
  '               ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄               ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '     ▐█▄      ░▒░                                ░▒░             ',
  '      ▐█▌    ░▒░                                  ░▒░            ',
  '       ▐█▌  ░▒░    ████▓▓▀▀      ████▓▓▀▀         ░▒░           ',
  '         █▌ ░▒░    ████▓▓▄▄      ████▓▓▄▄         ░▒░           ',
  '          ▐█░▒░                                    ░▒░           ',
  '            ▐▒░                                    ░▒░           ',
  '            ░▒░        ▀▀▄▄▄▄▄▄▄▄▀▀               ░▒░           ',
  '             ░▒░                                  ░▒░            ',
  '              ░▒░░▒▒░░▒▒▓▓▓▓▓▓▓▓▓▓▒▒░░▒▒░░▒░                   ',
  '             ▄▓▒░                              ░▒▓▄              ',
  '            █▓▓▒░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▒░▓▓█             ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█            ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█            ',
  '           █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█            ',
  '            ▀▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▀             ',
  '              ░▒░                              ░▒░               ',
  '            ▓▓▓▓▓▓▓                          ▄▓▓░▒░              ',
  '            ▀▀▀▀▀▀▀▀                        ▓▓▓▓▓▓▓▓             ',
  '                                             ▀▀▀▀▀▀▀▀            ',
];

const RICK_POINT: string[] = [
  '                    ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄                    ',
  '                 ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                 ',
  '               ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄               ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ░▒░    ▀▀▀▀          ▀▀▀▀      ░▒░                  ',
  '             ░▒░                                  ░▒░  ▄▄▄▄▄▄▄▄  ',
  '            ░▒░    ████▓▓▀▀      ████▓▓▀▀    ░▒░▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ',
  '            ░▒░    ████▓▓▄▄      ████▓▓▄▄    ░▒▓▓▓▓▓▓▓▓▓▓▀▀▀▀▀▀ ',
  '            ░▒░                              ▒▓▓▓▀▀▀▀            ',
  '            ░▒░                             ▒▓▀                   ',
  '            ░▒░         ▀▄▄▄▄▄▄▄▄▀         ░▒░                   ',
  '             ░▒░                                  ░▒░             ',
  '              ░▒░░▒▒░░▒▒▓▓▓▓▓▓▓▓▓▓▒▒░░▒▒░░▒░                    ',
  '               ░▒░                          ░▒░                   ',
  '             ▄▄▓▒░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▒░▓▄▄                ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█               ',
  '             ▀▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▀                ',
  '              ░▒░                            ░▒░                  ',
  '            ▄▓▓▓▓▄                          ▄▓▓▓▓▄               ',
  '           ▓▓▓▓▓▓▓▓                        ▓▓▓▓▓▓▓▓              ',
  '           ▓▓▓▓▓▓▓▓                        ▓▓▓▓▓▓▓▓              ',
  '           ▀▀▀▀▀▀▀▀                        ▀▀▀▀▀▀▀▀              ',
];

const RICK_MIC: string[] = [
  '                    ▄▄▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄▄▄                    ',
  '                 ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄                 ',
  '               ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄               ',
  '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓             ',
  '              ░▒░                                ░▒░              ',
  '             ░▒░                                  ░▒░             ',
  '            ░▒░    ████▓▓▀▀      ████▓▓▀▀         ░▒░            ',
  '  ▄▄        ░▒░    ████▓▓▄▄      ████▓▓▄▄         ░▒░            ',
  '  █▌        ░▒░                                    ░▒░            ',
  '  █▌        ░▒░                                    ░▒░            ',
  '  ▐█▌       ░▒░       ▄▄████████▄▄                ░▒░            ',
  '   ██        ░▒░                                  ░▒░             ',
  '    ▀▀▄       ░▒░░▒▒░░▒▒▓▓▓▓▓▓▓▓▓▓▒▒░░▒▒░░▒░                   ',
  '       ▀▄      ░▒░                          ░▒░                  ',
  '             ▄▄▓▒░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▒░▓▄▄                  ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█                  ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█                  ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█                  ',
  '            █▓▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▓█                  ',
  '             ▀▓▓▒░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░▓▓▀                   ',
  '              ░▒░                          ░▒░                    ',
  '            ▄▓▓▓▓▄                       ▄▓▓▓▓▄                  ',
  '           ▓▓▓▓▓▓▓▓                     ▓▓▓▓▓▓▓▓                 ',
  '           ▓▓▓▓▓▓▓▓                     ▓▓▓▓▓▓▓▓                 ',
  '           ▀▀▀▀▀▀▀▀                     ▀▀▀▀▀▀▀▀                 ',
];

const POSES = [RICK_1, RICK_2, RICK_1, RICK_3, RICK_POINT, RICK_MIC];
const SPRITE_W = 70; // approx width of each sprite

// ── Lyrics ──────────────────────────────────────────────────────

const LYRICS = [
  { t: "We're no strangers to love", d: 4 },
  { t: "You know the rules and so do I", d: 4 },
  { t: "A full commitment's what I'm thinking of", d: 4 },
  { t: "You wouldn't get this from any other guy", d: 4 },
  { t: "NEVER GONNA GIVE YOU UP", d: 3.5 },
  { t: "NEVER GONNA LET YOU DOWN", d: 3.5 },
  { t: "NEVER GONNA RUN AROUND AND DESERT YOU", d: 3.5 },
  { t: "NEVER GONNA MAKE YOU CRY", d: 3.5 },
  { t: "NEVER GONNA SAY GOODBYE", d: 3.5 },
  { t: "NEVER GONNA TELL A LIE AND HURT YOU", d: 4 },
  { t: "We've known each other for so long", d: 4 },
  { t: "Your heart's been aching but you're too shy", d: 4.5 },
  { t: "Inside we both know what's been going on", d: 4 },
  { t: "NEVER GONNA GIVE YOU UP", d: 3.5 },
  { t: "NEVER GONNA LET YOU DOWN", d: 3.5 },
  { t: "NEVER GONNA RUN AROUND AND DESERT YOU", d: 3.5 },
  { t: "NEVER GONNA MAKE YOU CRY", d: 3.5 },
  { t: "NEVER GONNA SAY GOODBYE", d: 3.5 },
  { t: "NEVER GONNA TELL A LIE AND HURT YOU", d: 4 },
];
const LYRIC_TOTAL = LYRICS.reduce((s, l) => s + l.d, 0);

// ── Core renderer ───────────────────────────────────────────────

export function RickRollAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const fRef = useRef(0);

  const render = useCallback(() => {
    const f = fRef.current;
    const g: string[][] = Array.from({ length: H }, () => Array(W).fill(' '));
    const sec = (f / FPS) % LOOP;

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

    const text = (s: string, cx: number, cy: number, reveal = 1) => {
      const n = Math.floor(s.length * Math.min(reveal, 1));
      const sx = Math.round(cx - s.length / 2);
      for (let i = 0; i < n; i++) if (s[i] !== ' ') put(sx + i, cy, s[i]!);
    };

    const lyric = (offset: number): { t: string; p: number } | null => {
      if (sec < offset) return null;
      let rem = (sec - offset) % LYRIC_TOTAL;
      for (const l of LYRICS) {
        if (rem < l.d) return { t: l.t, p: Math.min(rem / (l.d * 0.55), 1) };
        rem -= l.d;
      }
      return null;
    };

    // ── Effects ────────────────────────────────────────────────

    const vhsGlitch = (intensity: number) => {
      for (let y = 0; y < H; y++) {
        if (Math.random() < intensity * 0.12) {
          const shift = Math.floor((Math.random() - 0.5) * 16);
          const row = [...g[y]!];
          for (let x = 0; x < W; x++) {
            const sx = x - shift;
            g[y]![x] = (sx >= 0 && sx < W) ? row[sx]! : GLITCH[Math.floor(Math.random() * GLITCH.length)]!;
          }
        }
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
          const idx = Math.floor(val * (WAVE_FULL.length - 1));
          let ch = WAVE_FULL[Math.max(0, Math.min(idx, WAVE_FULL.length - 1))]!;
          if (Math.random() < 0.08) ch = CHAOS[Math.floor(Math.random() * CHAOS.length)]!;
          if (Math.random() < 0.05) ch = HALF[Math.floor(Math.random() * HALF.length)]!;
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
            const ci = Math.floor((1 - v) * BLOCK.length);
            g[y]![x] = BLOCK[Math.max(0, Math.min(ci, BLOCK.length - 1))]!;
          }
        }
      }
    };

    const speedLines = (px: number, py: number, h: number, dir: number) => {
      for (let i = 0; i < 30; i++) {
        const lx = dir > 0 ? px - 4 - i * 4 : px + SPRITE_W + 4 + i * 4;
        const ly = py + 4 + Math.floor(Math.random() * Math.max(h - 8, 1));
        const ch = i < 6 ? '█' : i < 12 ? '▓' : i < 20 ? '▒' : '░';
        put(lx, ly, ch);
        if (i < 10) put(lx + (dir > 0 ? -1 : 1), ly, '░');
        if (i < 5) put(lx + (dir > 0 ? -2 : 2), ly, '·');
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
    // SCENES
    // ═══════════════════════════════════════════════════════════

    if (sec < 2) {
      // ── Static noise coalescing ───────────────────────────
      const p = sec / 2;
      const n = Math.floor(p * 80);
      const spread = 60 * (1 - p * 0.7);
      for (let i = 0; i < n; i++) {
        put(W / 2 + (Math.random() - 0.5) * spread, H / 2 + (Math.random() - 0.5) * spread * 0.3,
          DENSE[Math.floor(Math.random() * DENSE.length)]!);
      }
      if (p > 0.3) {
        for (let y = 0; y < H; y++) {
          if (Math.random() < 0.08) for (let x = 0; x < W; x++) put(x, y, '░');
        }
      }
    }

    else if (sec < 6) {
      // ── Rick materializes with scanline reveal ────────────
      const p = (sec - 2) / 4;
      const spr = RICK_1;
      const px = Math.floor(W / 2 - SPRITE_W / 2);
      const py = Math.floor(H / 2 - spr.length / 2);
      const revealY = Math.floor(easeOut(p) * spr.length);
      for (let sy = 0; sy < revealY; sy++) {
        const row = spr[sy]!;
        for (let sx = 0; sx < row.length; sx++) {
          if (row[sx] !== ' ') {
            if (sy >= revealY - 2 && Math.random() < 0.4)
              put(px + sx, py + sy, BLOCK[Math.floor(Math.random() * BLOCK.length)]!);
            else put(px + sx, py + sy, row[sx]!);
          }
        }
      }
      if (revealY < spr.length) {
        for (let x = 0; x < W; x++) {
          if (Math.random() < 0.5) put(x, py + revealY, '░');
          if (Math.random() < 0.15) put(x, py + revealY + 1, '·');
        }
      }
    }

    else if (sec < 28) {
      // ── Verse 1: Rick dances left, lyrics right ──────────
      const pi = Math.floor(f / 11) % POSES.length;
      const spr = POSES[pi]!;
      const bx = Math.sin(f * 0.05) * 6;
      const by = Math.sin(f * 0.08) * 3;
      const px = 5 + bx;
      const py = Math.floor(H / 2 - spr.length / 2) + by;
      stamp(spr, px, py);

      const l = lyric(6);
      if (l) {
        const chorus = l.t.startsWith('NEVER');
        const n = Math.floor(l.p * l.t.length);
        const tx = 90;
        const ty = Math.floor(H / 2);
        for (let i = 0; i < Math.min(n, W - tx - 2); i++) {
          if (l.t[i] !== ' ') put(tx + i, ty, l.t[i]!);
        }
        if (n < l.t.length && f % 10 < 5) put(tx + n, ty, '█');
        if (chorus) {
          if (f % 8 < 4) border('▓░▒░');
          for (let i = 0; i < 8; i++) {
            put(tx + Math.random() * 50, ty + (Math.random() - 0.5) * 10,
              CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
          }
        }
      }
    }

    else if (sec < 31) {
      // ── Dash right ────────────────────────────────────────
      const p = (sec - 28) / 3;
      const spr = RICK_2;
      const px = lerp(-SPRITE_W - 10, W + 20, easeInOut(p));
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.3) * 3;
      stamp(spr, px, py);
      speedLines(px, py, spr.length, 1);
      for (let i = 0; i < 8; i++) {
        const tx = px - 20 - i * 10;
        const ty = py + Math.floor(Math.random() * spr.length);
        if (Math.random() < 0.5) put(tx, ty, BLOCK[Math.floor(Math.random() * BLOCK.length)]!);
      }
    }

    else if (sec < 44) {
      // ── PSYCHEDELIC TAKEOVER ──────────────────────────────
      const p = (sec - 31) / 13;
      const fadeIn = Math.min(p * 3, 1);
      const fadeOut = p > 0.88 ? 1 - (p - 0.88) / 0.12 : 1;
      const intensity = fadeIn * fadeOut;

      psycheFill(intensity * 0.95);
      if (p > 0.1 && p < 0.8) starburst(W / 2, H / 2, intensity * 0.45);
      if (intensity > 0.5) border('█▓▒░▀▄▐▌');
      vhsGlitch(intensity * 0.7);

      for (let i = 0; i < Math.floor(intensity * 25); i++) {
        put(Math.random() * W, Math.random() * H,
          CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }

      // Big Rick rises
      if (p > 0.15 && p < 0.8) {
        const bigP = p < 0.3 ? (p - 0.15) / 0.15 : p > 0.65 ? 1 - (p - 0.65) / 0.15 : 1;
        const spr = RICK_1;
        const spx = Math.floor(W / 2 - SPRITE_W / 2);
        const spy = Math.floor(lerp(H + 5, Math.floor(H / 2 - spr.length / 2), easeOut(Math.min(bigP, 1))));
        for (let sy = 0; sy < spr.length; sy++) {
          const row = spr[sy]!;
          for (let sx = 0; sx < row.length; sx++) {
            if (row[sx] !== ' ') {
              put(spx + sx, spy + sy, Math.random() < 0.1
                ? DENSE[Math.floor(Math.random() * DENSE.length)]! : row[sx]!);
            }
          }
        }
      }

      const l = lyric(6);
      if (l) text(l.t, W / 2, 2, l.p);
    }

    else if (sec < 47) {
      // ── Dash left ─────────────────────────────────────────
      const p = (sec - 44) / 3;
      const spr = RICK_3;
      const px = lerp(W + 20, -SPRITE_W - 10, easeInOut(p));
      const py = Math.floor(H / 2 - spr.length / 2) + Math.sin(f * 0.3) * 3;
      stamp(spr, px, py);
      speedLines(px, py, spr.length, -1);
    }

    else if (sec < 68) {
      // ── Verse 2 — faster, more chaotic ────────────────────
      const pi = Math.floor(f / 7) % POSES.length;
      const spr = POSES[pi]!;
      const bx = Math.sin(f * 0.09) * 10;
      const by = Math.sin(f * 0.13) * 4;
      stamp(spr, 5 + bx, Math.floor(H / 2 - spr.length / 2) + by);

      const l = lyric(6);
      if (l) {
        const chorus = l.t.startsWith('NEVER');
        const n = Math.floor(l.p * l.t.length);
        const tx = 90;
        const ty = Math.floor(H / 2);
        for (let i = 0; i < Math.min(n, W - tx - 2); i++) {
          if (l.t[i] !== ' ') put(tx + i, ty, l.t[i]!);
        }
        if (n < l.t.length && f % 10 < 5) put(tx + n, ty, '█');
        if (chorus) {
          border('█▓▒░▀▄');
          for (let i = 0; i < 12; i++) {
            put(Math.random() * W, Math.random() * H,
              [...CHAOS, ...BLOCK][Math.floor(Math.random() * (CHAOS.length + BLOCK.length))]!);
          }
          vhsGlitch(0.4);
        }
      }
    }

    else if (sec < 78) {
      // ── Multi-Rick chaos + psychedelic ────────────────────
      const p = (sec - 68) / 10;
      const fadeIn = Math.min(p * 2.5, 1);
      const fadeOut = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
      const intensity = fadeIn * fadeOut;

      psycheFill(intensity * 0.7);
      starburst(W / 2, H / 2, intensity * 0.35);
      vhsGlitch(intensity * 0.5);

      const positions = [
        { x: 2, y: 2 },
        { x: W / 2 - SPRITE_W / 2, y: 3 },
        { x: W - SPRITE_W - 5, y: 2 },
        { x: W / 4 - SPRITE_W / 4, y: H / 2 - 10 },
        { x: W * 3 / 4 - SPRITE_W / 4, y: H / 2 - 8 },
      ];
      const poseI = Math.floor(f / 5) % POSES.length;
      for (const pos of positions) {
        if (Math.random() < intensity * 0.85) stamp(POSES[poseI]!, pos.x, pos.y, 0.8);
      }
      border('█▓▒░' + CHAOS.slice(0, 4).join(''));
    }

    else if (sec < 87) {
      // ── Rickrolled message ────────────────────────────────
      const p = (sec - 78) / 9;
      if (p < 0.35) {
        const wp = p / 0.35;
        const spr = RICK_2;
        stamp(spr, lerp(W / 2 - SPRITE_W / 2, W + 20, easeInOut(wp)),
          Math.floor(H / 2 - spr.length / 2));
        speedLines(lerp(W / 2 - SPRITE_W / 2, W + 20, easeInOut(wp)),
          Math.floor(H / 2 - spr.length / 2), spr.length, 1);
      }
      if (p > 0.3) text('you just got rickrolled', W / 2, Math.floor(H * 0.38),
        Math.min((p - 0.3) / 0.25, 1));
      if (p > 0.5) text('by chloe, with love  <3', W / 2, Math.floor(H * 0.38) + 4,
        Math.min((p - 0.5) / 0.2, 1));
      if (p > 0.55) border('░▒▓█');
      if (p > 0.6 && f % 5 === 0) {
        for (let i = 0; i < 8; i++)
          put(Math.random() * W, Math.random() * H,
            CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }
      if (p > 0.9) {
        const fade = (p - 0.9) / 0.1;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (g[y]![x] !== ' ' && Math.random() < fade * 0.6) g[y]![x] = ' ';
      }
    }

    else {
      // ── Pulsing heart ────────────────────────────────────
      const heart = [
        '        ▄▄▓▓▓▓▓▓▓▄▄         ▄▄▓▓▓▓▓▓▓▄▄        ',
        '     ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄   ▄▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▄     ',
        '   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ',
        '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
        '  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ',
        '   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ',
        '    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ',
        '      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ',
        '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ',
        '          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          ',
        '            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ',
        '              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ',
        '                ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                ',
        '                  ▓▓▓▓▓▓▓▓▓▓▓                  ',
        '                    ▓▓▓▓▓▓▓                    ',
        '                      ▓▓▓                      ',
        '                       ▓                       ',
      ];
      const pulse = Math.sin(f * 0.25);
      if (pulse > 0.15) stamp(heart, Math.floor(W / 2 - 26), Math.floor(H / 2 - 10));
      if (pulse > 0.6 && f % 3 === 0) {
        for (let i = 0; i < 10; i++)
          put(W / 2 + (Math.random() - 0.5) * 60, H / 2 + (Math.random() - 0.5) * 20,
            CHAOS[Math.floor(Math.random() * CHAOS.length)]!);
      }
    }

    if (preRef.current) preRef.current.textContent = g.map(r => r.join('')).join('\n');
    fRef.current = f + 1;
  }, []);

  useEffect(() => {
    const id = setInterval(render, MS);
    return () => clearInterval(id);
  }, [render]);

  return (
    <pre
      ref={preRef}
      className="font-data leading-none whitespace-pre select-none"
      style={{
        fontSize: '6.5px',
        color: 'var(--gs-base)',
        textShadow: '0 0 5px var(--gs-base), 0 0 15px oklch(0.82 0.15 340 / 0.25)',
        lineHeight: '1.1',
      }}
    />
  );
}

function easeOut(t: number): number { return 1 - (1 - t) ** 3; }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * Math.max(0, Math.min(1, t)); }
