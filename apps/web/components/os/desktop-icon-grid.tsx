'use client';

import { useCallback, useState } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';
import { BedroomIcon } from './bedroom-icons';

/* =================================================================
   Chloe's Bedroom OS — Desktop Icon Grid

   Two columns of SVG bedroom object icons.
   Double-click opens the window. Single-click selects.
   Hover: glow + scale spring animation.
   ================================================================= */

interface DesktopIconDef {
  id: string;
  label: string;
}

const LEFT_ICONS: DesktopIconDef[] = [
  { id: 'about',         label: 'about us' },
  { id: 'products',      label: 'Products' },
  { id: 'pricing',       label: 'Pricing' },
  { id: 'customers',     label: 'customers' },
  { id: 'chill',         label: 'chill' },
  { id: 'history',       label: 'MyDocs' },
  { id: 'chat-launcher', label: 'GhostChat' },
  { id: 'scan-input',    label: 'Scan.exe' },
];

const RIGHT_ICONS: DesktopIconDef[] = [
  { id: 'features', label: 'Why MAS?' },
  { id: 'blog',     label: 'Blog' },
  { id: 'games',    label: 'Games.exe' },
  { id: 'trash',    label: 'Trash' },
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
        'flex flex-col items-center gap-1.5 p-gs-2 w-[76px] outline-none rounded-lg transition-all group',
        'focus-visible:outline-2 focus-visible:outline-gs-base focus-visible:outline-offset-2',
        selected && 'bg-gs-base/10',
      )}
      onClick={() => setSelected(true)}
      onDoubleClick={() => {
        soundEffects.play('windowOpen');
        onOpen(def.id);
      }}
      onBlur={() => setSelected(false)}
    >
      <div className={cn(
        'w-12 h-12 flex items-center justify-center text-gs-base transition-all duration-200',
        'group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_var(--gs-base)]',
      )}>
        <BedroomIcon windowId={def.id} size={32} />
      </div>
      <span
        className={cn(
          'font-system text-os-xs text-center leading-tight max-w-full px-1 rounded transition-colors',
          selected
            ? 'bg-gs-base/20 text-gs-base'
            : 'text-gs-light/60 group-hover:text-gs-light/80',
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
    <>
      {/* Left column */}
      <div className="absolute left-gs-4 top-gs-4 flex flex-col gap-1 z-icons">
        {LEFT_ICONS.map((def) => (
          <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
        ))}
      </div>

      {/* Right column */}
      <div className="absolute right-gs-4 top-gs-4 flex flex-col gap-1 z-icons">
        {RIGHT_ICONS.map((def) => (
          <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
        ))}
      </div>
    </>
  );
}
