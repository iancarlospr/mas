'use client';

import { useCallback, useState } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';
import { BedroomIcon } from './bedroom-icons';

/* =================================================================
   Chloe's Bedroom OS — Desktop Icon Grid

   Icons positioned as objects in a bedroom — forced perspective.
   Each icon has a fixed position that corresponds to where
   that object would be in the room:
   - Wall objects (posters, shelf, mirror) → upper zone
   - Desk/surface objects (phone, diary, magnifier) → middle zone
   - Floor objects (TV, games, trash) → lower zone
   - Bed area objects → right side
   ================================================================= */

interface DesktopIconDef {
  id: string;
  label: string;
  /** Position as percentage from top-left */
  x: string;
  y: string;
  /** Scale factor — objects closer (lower) appear larger */
  scale?: number;
}

/** Icons positioned as bedroom objects in forced perspective */
const ROOM_ICONS: DesktopIconDef[] = [
  // Wall zone — upper area
  { id: 'about',         label: 'Mirror',      x: '8%',  y: '8%',  scale: 0.85 },
  { id: 'features',      label: 'Poster',      x: '22%', y: '5%',  scale: 0.8 },
  { id: 'blog',          label: 'Diary',       x: '38%', y: '10%', scale: 0.85 },

  // Shelf / mid-wall zone
  { id: 'history',       label: 'Bookshelf',   x: '5%',  y: '28%', scale: 0.9 },
  { id: 'customers',     label: 'Photos',      x: '20%', y: '25%', scale: 0.85 },

  // Desk / surface zone — middle area
  { id: 'scan-input',    label: 'Scan.exe',    x: '15%', y: '48%', scale: 1.0 },
  { id: 'chat-launcher', label: 'Phone',       x: '35%', y: '50%', scale: 0.95 },
  { id: 'products',      label: 'Dresser',     x: '55%', y: '42%', scale: 0.9 },
  { id: 'pricing',       label: 'Piggy Bank',  x: '50%', y: '55%', scale: 0.95 },

  // Floor zone — bottom, larger (closer to "camera")
  { id: 'chill',         label: 'TV',          x: '8%',  y: '68%', scale: 1.1 },
  { id: 'games',         label: 'Games',       x: '28%', y: '72%', scale: 1.05 },
  { id: 'trash',         label: 'Trash',       x: '48%', y: '75%', scale: 1.0 },
];

function DesktopIconButton({
  def,
  onOpen,
}: {
  def: DesktopIconDef;
  onOpen: (id: string) => void;
}) {
  const [selected, setSelected] = useState(false);
  const scale = def.scale ?? 1;

  return (
    <button
      className={cn(
        'absolute flex flex-col items-center gap-1 p-1.5 outline-none rounded-lg transition-all group',
        'focus-visible:outline-2 focus-visible:outline-gs-base focus-visible:outline-offset-2',
        selected && 'bg-gs-base/10',
      )}
      style={{
        left: def.x,
        top: def.y,
        transform: `scale(${scale})`,
        transformOrigin: 'center bottom',
      }}
      onClick={() => setSelected(true)}
      onDoubleClick={() => {
        soundEffects.play('windowOpen');
        onOpen(def.id);
      }}
      onBlur={() => setSelected(false)}
    >
      <div className={cn(
        'w-11 h-11 flex items-center justify-center text-gs-base transition-all duration-200',
        'group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_var(--gs-base)]',
      )}>
        <BedroomIcon windowId={def.id} size={30} />
      </div>
      <span
        className={cn(
          'font-system text-[9px] text-center leading-tight max-w-[64px] px-0.5 rounded transition-colors whitespace-nowrap',
          selected
            ? 'bg-gs-base/20 text-gs-base'
            : 'text-gs-light/40 group-hover:text-gs-light/70',
        )}
      >
        {def.label}
      </span>
    </button>
  );
}

export function DesktopIconGrid() {
  const { openWindow } = useWindowManager();

  const handleOpen = useCallback(
    (id: string) => openWindow(id),
    [openWindow],
  );

  return (
    <div className="absolute inset-0 z-icons">
      {ROOM_ICONS.map((def) => (
        <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
      ))}
    </div>
  );
}
