'use client';

import { useEffect, useRef } from 'react';

/* =================================================================
   Chloe's Bedroom OS — Context Menu

   Frosted glass right-click popup with rounded corners,
   pink hover tint, and stagger animation.
   ================================================================= */

export type ContextMenuItem =
  | { type: 'separator' }
  | {
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      type?: undefined;
      shortcut?: string;
    };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;

    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gs-deep/95 backdrop-blur-xl border border-gs-mid rounded-lg py-1 min-w-[200px] z-context-menu shadow-window-float animate-fade-in"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={`sep-${i}`}
              className="mx-2 my-1 h-px bg-gs-mid/40"
            />
          );
        }
        return (
          <button
            key={item.label}
            role="menuitem"
            className={`w-full text-left px-4 py-1.5 font-system text-os-base
                       flex items-center justify-between rounded-md mx-1 transition-colors
              ${item.disabled
                ? 'text-gs-mid cursor-default'
                : 'hover:bg-gs-base/15 hover:text-gs-base text-gs-light/80'
              }`}
            style={{ width: 'calc(100% - 8px)' }}
            onClick={() => {
              if (!item.disabled) {
                item.onClick?.();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-os-xs text-gs-mid ml-gs-8">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
