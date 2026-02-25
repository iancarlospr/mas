'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWindowManager } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Menu Bar

   Mac OS 9 style top menu bar. Connected to WindowManagerProvider.
   Left: Logo + menu items (File, View, Help)
   Right: Clock
   ═══════════════════════════════════════════════════════════════ */

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wm = useWindowManager();

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New Scan...', shortcut: '⌘N', onClick: () => wm.openWindow('scan-input') },
        { label: 'Open Scan...', shortcut: '⌘O', onClick: () => wm.openWindow('history') },
        { separator: true, label: '' },
        { label: 'Export as PDF', shortcut: '⌘P', disabled: true },
        { separator: true, label: '' },
        { label: 'Quit', shortcut: '⌘Q', onClick: () => wm.openWindow('trash') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Scan History', onClick: () => wm.openWindow('history') },
        { label: 'Products', onClick: () => wm.openWindow('products') },
        { separator: true, label: '' },
        { label: 'Pricing', onClick: () => wm.openWindow('pricing') },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Ask Chloe', onClick: () => wm.openWindow('chat-launcher') },
        { label: 'Why AlphaScan?', onClick: () => wm.openWindow('features') },
        { separator: true, label: '' },
        { label: 'About GhostScan OS', onClick: () => wm.openWindow('about') },
      ],
    },
  ];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openMenu]);

  const handleMenuClick = useCallback((label: string) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  }, []);

  const handleMenuHover = useCallback((label: string) => {
    if (openMenu) setOpenMenu(label);
  }, [openMenu]);

  return (
    <div
      ref={menuRef}
      className="gs-menubar h-menubar flex items-center bg-gs-chrome border-b-2 z-menubar relative"
      style={{ borderBottomColor: 'var(--gs-chrome-dark)' }}
    >
      <button
        className="h-full px-gs-3 flex items-center gap-gs-1 font-system text-os-base font-bold
                   hover:bg-gs-chrome-dark/30"
        onClick={() => wm.openWindow('scan-input')}
      >
        <span className="text-os-lg">👻</span>
        <span className="text-gs-red">AlphaScan</span>
      </button>

      <div className="flex items-center h-full">
        {menus.map((menu) => (
          <div key={menu.label} className="relative h-full">
            <button
              className={`h-full px-gs-3 font-system text-os-base
                ${openMenu === menu.label
                  ? 'bg-gs-ink text-gs-paper'
                  : 'hover:bg-gs-chrome-dark/30'
                }`}
              onClick={() => handleMenuClick(menu.label)}
              onMouseEnter={() => handleMenuHover(menu.label)}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <div className="absolute top-full left-0 bg-gs-chrome bevel-raised min-w-[200px] py-gs-1 z-start-menu shadow-window">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div
                      key={`sep-${i}`}
                      className="mx-gs-1 my-gs-1 border-t"
                      style={{ borderColor: 'var(--gs-chrome-dark)' }}
                    />
                  ) : (
                    <button
                      key={item.label}
                      className={`w-full text-left px-gs-6 py-gs-1 font-system text-os-base flex items-center justify-between
                        ${item.disabled
                          ? 'text-gs-muted cursor-default'
                          : 'hover:bg-gs-ink hover:text-gs-paper'
                        }`}
                      onClick={() => {
                        if (!item.disabled) {
                          item.onClick?.();
                          setOpenMenu(null);
                        }
                      }}
                      disabled={item.disabled}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-os-xs text-gs-muted ml-gs-6">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-1" />
      <div className="flex items-center h-full gap-gs-1 pr-gs-2">
        <div className="bevel-sunken px-gs-2 py-px font-data text-data-xs text-gs-muted">
          <ClockDisplay />
        </div>
      </div>
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return <>{time}</>;
}
