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
  x: string;
  y: string;
}

/** Desktop icons in two vertical columns — left (primary), right (secondary) */
const ICON_SPACING = 120; // px between icon centers vertically
const LEFT_X = '3%';
const RIGHT_X = '93%';
const START_Y = 24; // px from top

const ROOM_ICONS: DesktopIconDef[] = [
  // Left column — primary actions
  { id: 'history',       label: 'My Scans',    x: LEFT_X,  y: `${START_Y + ICON_SPACING * 0}px` },
  { id: 'chat-launcher', label: 'Chat',        x: LEFT_X,  y: `${START_Y + ICON_SPACING * 1}px` },
  { id: 'scan-input',    label: 'Scan.exe',    x: LEFT_X,  y: `${START_Y + ICON_SPACING * 2}px` },
  { id: 'products',      label: 'Products',    x: LEFT_X,  y: `${START_Y + ICON_SPACING * 3}px` },
  { id: 'pricing',       label: 'Pricing',     x: LEFT_X,  y: `${START_Y + ICON_SPACING * 4}px` },
  { id: 'features',      label: 'Features',    x: LEFT_X,  y: `${START_Y + ICON_SPACING * 5}px` },

  // Right column — secondary
  { id: 'about',         label: 'About',       x: RIGHT_X, y: `${START_Y + ICON_SPACING * 0}px` },
  { id: 'blog',          label: 'Blog',        x: RIGHT_X, y: `${START_Y + ICON_SPACING * 1}px` },
  { id: 'customers',     label: 'Reviews',     x: RIGHT_X, y: `${START_Y + ICON_SPACING * 2}px` },
  { id: 'chill',         label: 'Movies',      x: RIGHT_X, y: `${START_Y + ICON_SPACING * 3}px` },
  { id: 'games',         label: 'Mini-Games',  x: RIGHT_X, y: `${START_Y + ICON_SPACING * 4}px` },
  { id: 'trash',         label: 'Log Out',     x: RIGHT_X, y: `${START_Y + ICON_SPACING * 5}px` },
];

function DesktopIconButton({
  def,
  onOpen,
}: {
  def: DesktopIconDef;
  onOpen: (id: string) => void;
}) {
  const [selected, setSelected] = useState(false);

  return (
    <button
      className={cn(
        'absolute flex flex-col items-center gap-2 p-2 outline-none rounded-lg transition-all group',
        'focus-visible:outline-2 focus-visible:outline-gs-base focus-visible:outline-offset-2',
        selected && 'bg-gs-base/10',
      )}
      style={{
        left: def.x,
        top: def.y,
      }}
      onClick={() => setSelected(true)}
      onDoubleClick={() => {
        soundEffects.play('windowOpen');
        onOpen(def.id);
      }}
      onBlur={() => setSelected(false)}
    >
      <div className={cn(
        'w-[60px] h-[60px] flex items-center justify-center text-gs-base transition-all duration-200',
        'group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_var(--gs-base)]',
      )}>
        <BedroomIcon windowId={def.id} size={56} />
      </div>
      <span
        className={cn(
          'font-system text-[13px] text-center leading-tight max-w-[96px] px-0.5 rounded transition-colors whitespace-nowrap',
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
