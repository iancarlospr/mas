'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Desktop Icon

   Classic desktop icon: 48x48 pixel art icon + label underneath.
   Double-click to open the program.
   Single-click selects (highlight).
   ═══════════════════════════════════════════════════════════════ */

interface DesktopIconProps {
  label: string;
  icon: ReactNode;
  onDoubleClick: () => void;
  className?: string;
}

export function DesktopIcon({
  label,
  icon,
  onDoubleClick,
  className,
}: DesktopIconProps) {
  const [selected, setSelected] = useState(false);

  return (
    <button
      className={cn(
        'flex flex-col items-center gap-gs-1 p-gs-1 w-[72px] rounded-none',
        'outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-gs-ink',
        selected && 'bg-gs-red/20',
        className,
      )}
      onClick={() => setSelected(true)}
      onDoubleClick={onDoubleClick}
      onBlur={() => setSelected(false)}
    >
      {/* Icon (48x48 pixel art) */}
      <div className="w-12 h-12 flex items-center justify-center text-[32px]">
        {icon}
      </div>

      {/* Label */}
      <span
        className={cn(
          'font-system text-os-xs text-center leading-tight max-w-full px-gs-1',
          selected
            ? 'bg-gs-ink text-gs-paper'
            : 'text-gs-ink',
        )}
      >
        {label}
      </span>
    </button>
  );
}
