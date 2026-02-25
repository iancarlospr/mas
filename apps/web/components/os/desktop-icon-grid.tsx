'use client';

import { useCallback, useState } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Desktop Icon Grid

   Two columns of icons — left column on the left edge,
   right column on the right edge. Center is empty desktop space.
   Double-click opens the window. Single-click selects.
   ═══════════════════════════════════════════════════════════════ */

interface DesktopIconDef {
  id: string;
  label: string;
  icon: string;
}

const LEFT_ICONS: DesktopIconDef[] = [
  { id: 'about',         label: 'about us',     icon: '📋' },
  { id: 'products',      label: 'Products',     icon: '📁' },
  { id: 'pricing',       label: 'Pricing',      icon: '🧮' },
  { id: 'customers',     label: 'customers',    icon: '👥' },
  { id: 'chill',         label: 'chill',        icon: '🎬' },
  { id: 'history',       label: 'MyDocs',       icon: '📚' },
  { id: 'chat-launcher', label: 'GhostChat',    icon: '💬' },
  { id: 'scan-input',    label: 'Scan.exe',     icon: '🔗' },
];

const RIGHT_ICONS: DesktopIconDef[] = [
  { id: 'features', label: 'Why MAS?',   icon: '❓' },
  { id: 'blog',     label: 'Blog',       icon: '📖' },
  { id: 'games',    label: 'Games.exe',  icon: '🏆' },
  { id: 'trash',    label: 'Trash',      icon: '🗑️' },
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
        'flex flex-col items-center gap-gs-1 p-gs-1 w-[72px] outline-none',
        'focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-gs-ink',
        selected && 'bg-gs-red/15',
      )}
      onClick={() => setSelected(true)}
      onDoubleClick={() => {
        soundEffects.play('windowOpen');
        onOpen(def.id);
      }}
      onBlur={() => setSelected(false)}
    >
      <div className="w-12 h-12 flex items-center justify-center text-[32px]">
        {def.icon}
      </div>
      <span
        className={cn(
          'font-system text-os-xs text-center leading-tight max-w-full px-gs-1',
          selected
            ? 'bg-gs-red text-white'
            : 'text-gs-ink',
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
      {/* Left column — 16px from left edge, 16px from top */}
      <div className="absolute left-gs-4 top-gs-4 flex flex-col gap-gs-2 z-icons">
        {LEFT_ICONS.map((def) => (
          <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
        ))}
      </div>

      {/* Right column — 16px from right edge, 16px from top */}
      <div className="absolute right-gs-4 top-gs-4 flex flex-col gap-gs-2 z-icons">
        {RIGHT_ICONS.map((def) => (
          <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
        ))}
      </div>
    </>
  );
}
