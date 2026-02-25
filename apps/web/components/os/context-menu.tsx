'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Context Menu

   Right-click popup menu. Win95 style with bevel border,
   separators, and keyboard shortcut hints.
   ═══════════════════════════════════════════════════════════════ */

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

  // Adjust position to stay within viewport
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

  // Close on Escape
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
      className="fixed bg-gs-light bevel-raised py-gs-1 min-w-[180px] z-context-menu shadow-window"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={`sep-${i}`}
              className="mx-gs-1 my-gs-1 h-px"
              style={{
                borderTop: '1px solid var(--gs-mid)',
                borderBottom: '1px solid var(--gs-white)',
              }}
            />
          );
        }
        return (
          <button
            key={item.label}
            role="menuitem"
            className={`w-full text-left px-gs-6 py-gs-1 font-system text-os-base
                       flex items-center justify-between
              ${item.disabled
                ? 'text-gs-mid cursor-default'
                : 'hover:bg-gs-mid-dark hover:text-gs-white'
              }`}
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
              <span className="text-os-xs text-gs-mid-light ml-gs-8">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
