'use client';

import { useCallback, useState, useMemo } from 'react';
import { useWindowManager } from '@/lib/window-manager';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';
import { BedroomIcon } from './bedroom-icons';

/* =================================================================
   Desktop Icon Grid — Two vertical columns, centered on anchor points
   ================================================================= */

interface DesktopIconDef {
  id: string;
  label: string;
  x: string;
  index: number;
}

/** Desktop icons in two vertical columns — left (primary), right (secondary).
 *  Sizing (gap, icon box, SVG, label) is driven by CSS variables set on the
 *  grid root so everything scales with viewport height while columns stay
 *  pinned to 5% / 95%. See DesktopIconGrid for the scale derivation. */
const LEFT_X = '5%';
const RIGHT_X = '95%';

/** Static icons — the last right-column slot is dynamic (see below) */
const STATIC_ICONS: DesktopIconDef[] = [
  // Left column — primary actions
  { id: 'history',       label: 'My Scans',    x: LEFT_X,  index: 0 },
  { id: 'chat-launcher', label: 'Chat',        x: LEFT_X,  index: 1 },
  { id: 'scan-input',    label: 'Scan.exe',    x: LEFT_X,  index: 2 },
  { id: 'products',      label: 'Products',    x: LEFT_X,  index: 3 },
  { id: 'pricing',       label: 'Pricing',     x: LEFT_X,  index: 4 },
  { id: 'features',      label: 'Features',    x: LEFT_X,  index: 5 },

  // Right column — secondary
  { id: 'about',         label: 'About',       x: RIGHT_X, index: 0 },
  { id: 'blog',          label: 'Blog',        x: RIGHT_X, index: 1 },
  { id: 'customers',     label: 'Reviews',     x: RIGHT_X, index: 2 },
  { id: 'chill',         label: 'Movies',      x: RIGHT_X, index: 3 },
  { id: 'games',         label: 'Mini-Games',  x: RIGHT_X, index: 4 },
  { id: 'brand',         label: 'Brand Book',  x: RIGHT_X, index: 5 },
  // Slot 6 (right column bottom) is dynamic — see DesktopIconGrid
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
      data-icon-id={def.id}
      className={cn(
        'absolute flex flex-col items-center p-2 outline-none rounded-lg transition-all group',
        'focus-visible:outline-2 focus-visible:outline-gs-base focus-visible:outline-offset-2',
        selected && 'bg-gs-base/10',
      )}
      style={{
        left: def.x,
        top: `calc(var(--desk-pad-top) + ${def.index} * var(--desk-gap))`,
        transform: 'translateX(-50%)',
        gap: 'var(--desk-label-gap)',
      }}
      onClick={() => {
        soundEffects.play('windowOpen');
        onOpen(def.id);
      }}
      onBlur={() => setSelected(false)}
    >
      <div
        className={cn(
          'flex items-center justify-center text-gs-base transition-all duration-200',
          'group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_var(--gs-base)]',
        )}
        style={{ width: 'var(--desk-icon-box)', height: 'var(--desk-icon-box)' }}
      >
        <BedroomIcon windowId={def.id} size={56} className="desk-icon-svg" />
      </div>
      <span
        className={cn(
          'font-system text-center leading-tight max-w-[96px] px-0.5 rounded transition-colors whitespace-nowrap',
          selected
            ? 'bg-gs-base/20 text-gs-base'
            : 'text-gs-light/40 group-hover:text-gs-light/70',
        )}
        style={{ fontSize: 'var(--desk-label-px)' }}
      >
        {def.label}
      </span>
    </button>
  );
}

export function DesktopIconGrid() {
  const { openWindow } = useWindowManager();
  const { isAuthenticated } = useAuth();

  const handleOpen = useCallback(
    (id: string) => {
      if (id === 'brand') {
        window.open('/brand', '_blank');
        return;
      }
      openWindow(id);
    },
    [openWindow],
  );

  // Dynamic bottom-right icon: Profile (logged in) or Log In (logged out)
  const icons = useMemo(() => {
    const dynamicIcon: DesktopIconDef = isAuthenticated
      ? { id: 'profile', label: 'Profile', x: RIGHT_X, index: 6 }
      : { id: 'auth',    label: 'Log In',  x: RIGHT_X, index: 6 };
    return [...STATIC_ICONS, dynamicIcon];
  }, [isAuthenticated]);

  // CSS-driven responsive scale: icons shrink on short viewports but cap at
  // their current max size on tall screens (scale <= 1). Columns stay at 5%/95%.
  // --desk-wanted = 24 top pad + 7 slots * 120px + ~90px for last icon+label.
  const gridStyle = {
    '--desk-rows': '7',
    '--desk-gap-max': '120px',
    '--desk-pad-top-max': '24px',
    '--desk-pad-bot': '16px',
    '--desk-avail': 'calc(100vh - var(--gs-taskbar-h) - var(--desk-pad-bot))',
    '--desk-wanted': 'calc(var(--desk-pad-top-max) + var(--desk-rows) * var(--desk-gap-max) + 90px)',
    '--desk-scale': 'min(1, calc(var(--desk-avail) / var(--desk-wanted)))',
    '--desk-gap': 'calc(var(--desk-gap-max) * var(--desk-scale))',
    '--desk-pad-top': 'calc(var(--desk-pad-top-max) * var(--desk-scale))',
    '--desk-icon-box': 'calc(60px * var(--desk-scale))',
    '--desk-icon-svg': 'calc(56px * var(--desk-scale))',
    '--desk-label-px': 'clamp(10px, calc(10px + 3px * var(--desk-scale)), 13px)',
    '--desk-label-gap': 'calc(8px * var(--desk-scale))',
  } as React.CSSProperties;

  return (
    <div className="absolute inset-0 z-icons" style={gridStyle}>
      {icons.map((def) => (
        <DesktopIconButton key={def.id} def={def} onOpen={handleOpen} />
      ))}
    </div>
  );
}
