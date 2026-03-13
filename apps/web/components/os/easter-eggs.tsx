'use client';

import { useEffect, useRef, useState } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * Chloe's Bedroom OS — Easter Eggs
 *
 * 1. Konami code (up up down down left right left right B A) → Chloe celebration
 * 2. Console ASCII art + hiring message (on mount)
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
║  AlphaScan OS v3.0                  ║
║                                      ║
║  Looking under the hood? Smart.      ║
║  We're hiring.                       ║
║                                      ║
║  jobs@marketingalphascan.com         ║
╚══════════════════════════════════════╝
`;

  console.log(
    ghost,
    'color: #FFB2EF; font-size: 10px; font-family: monospace; line-height: 1.2;',
  );
  console.log(
    message,
    'color: #FFCAF3; font-size: 12px; font-family: monospace;',
  );
}

export function EasterEggs() {
  const [konamiActive, setKonamiActive] = useState(false);

  useEffect(() => {
    logConsoleArt();
  }, []);

  useKonamiCode(() => {
    setKonamiActive(true);
    setTimeout(() => setKonamiActive(false), 3000);
  });

  if (!konamiActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      {/* Screen flash — pink pulse */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{ background: 'oklch(0.82 0.15 340 / 0.12)' }}
      />

      {/* Chloe celebrating */}
      <div className="relative animate-bounce">
        <ChloeSprite state="celebrating" size={256} glowing />
        <div className="absolute -bottom-[40px] left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="font-personality text-[24px] text-gs-base drop-shadow-[0_0_12px_var(--gs-base)]">
            You found the secret!
          </span>
        </div>
      </div>
    </div>
  );
}
