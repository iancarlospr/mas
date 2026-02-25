'use client';

import { useEffect, useRef, useState } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — Easter Eggs
 * ═══════════════════════════════
 *
 * WHAT: Hidden interactions that make the product MSCHF-level memorable.
 * WHY:  These are what separate a good product from an unforgettable one
 *       (Plan Section 8).
 * HOW:
 *   1. Konami code (↑↑↓↓←→←→BA) → Chloe celebration + screen flash
 *   2. Console ASCII art + hiring message (on mount)
 *   3. Provider component to wire into layout
 */

const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

function useKonamiCode(callback: () => void) {
  const indexRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const expected = KONAMI_SEQUENCE[indexRef.current];
      if (e.key === expected) {
        indexRef.current++;
        if (indexRef.current === KONAMI_SEQUENCE.length) {
          indexRef.current = 0;
          callback();
        }
      } else {
        indexRef.current = 0;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback]);
}

function logConsoleArt() {
  if (typeof window === 'undefined') return;

  const ghost = `
%c    ████████
  ██        ██
██  ██  ██    ██
██            ██
██    ████    ██
  ██        ██
    ██  ██  ██
`;

  const message = `%c
╔══════════════════════════════════════╗
║  👻 GhostScan OS v2.0              ║
║                                      ║
║  Looking under the hood? Smart.      ║
║  We're hiring.                       ║
║                                      ║
║  jobs@marketingalphascan.com         ║
╚══════════════════════════════════════╝
`;

  console.log(
    ghost,
    'color: #00e5ff; font-size: 10px; font-family: monospace; line-height: 1.2;',
  );
  console.log(
    message,
    'color: #e040fb; font-size: 12px; font-family: monospace;',
  );
}

export function EasterEggs() {
  const [konamiActive, setKonamiActive] = useState(false);

  // Console ASCII art on mount
  useEffect(() => {
    logConsoleArt();
  }, []);

  // Konami code handler
  useKonamiCode(() => {
    setKonamiActive(true);
    setTimeout(() => setKonamiActive(false), 3000);
  });

  if (!konamiActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      {/* Screen flash */}
      <div className="absolute inset-0 bg-gs-cyan/20 animate-pulse" />

      {/* Chloe celebrating */}
      <div className="relative animate-bounce">
        <ChloeSprite state="celebrating" size={256} glowing />
        <div className="absolute -bottom-[40px] left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="font-personality text-[24px] text-gs-fuchsia">
            You found the secret!
          </span>
        </div>
      </div>
    </div>
  );
}
