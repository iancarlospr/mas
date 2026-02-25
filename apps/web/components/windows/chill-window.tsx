'use client';

import { AsciiPlayer } from '@/components/scan/ascii-player';

/* ═══════════════════════════════════════════════════════════════
   chill.mov — ASCII Theater Window

   Wraps the existing AsciiPlayer in a terminal-styled window.
   ═══════════════════════════════════════════════════════════════ */

export default function ChillWindow() {
  return (
    <div className="h-full bg-[#0A0A0A] text-gs-terminal font-data text-data-sm p-gs-2">
      <AsciiPlayer
        moviePath="/ascii/starwars.json"
        autoPlay
        loop
        showSshHint={false}
      />
    </div>
  );
}
