'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWindowManager } from '@/lib/window-manager';

/* =================================================================
   Chloé's Bedroom OS — Menu Bar

   Frosted glass top bar. Connected to WindowManagerProvider.
   Left: Logo + menu items (File, View, Help)
   Right: Clock
   Dither bottom edge.
   ================================================================= */

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
        { label: 'Ask Chloé', onClick: () => wm.openWindow('chat-launcher') },
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
      className="gs-menubar h-menubar flex items-center bg-gs-deep/90 backdrop-blur-md z-menubar relative dither-edge"
      style={{ borderBottom: '1px solid var(--gs-mid)' }}
    >
      <button
        className="h-full px-gs-3 flex items-center gap-gs-2 font-system text-os-base font-bold
                   hover:bg-gs-base/10 transition-colors"
        onClick={() => wm.openWindow('scan-input')}
      >
        <span className="text-gs-base text-os-lg">A</span>
        <span className="text-gs-base">AlphaScan</span>
      </button>

      <div className="flex items-center h-full">
        {menus.map((menu) => (
          <div key={menu.label} className="relative h-full">
            <button
              className={`h-full px-gs-3 font-system text-os-base transition-colors
                ${openMenu === menu.label
                  ? 'bg-gs-base/20 text-gs-base'
                  : 'text-gs-light/70 hover:text-gs-light hover:bg-gs-base/10'
                }`}
              onClick={() => handleMenuClick(menu.label)}
              onMouseEnter={() => handleMenuHover(menu.label)}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <div className="absolute top-full left-0 mt-px bg-gs-deep/95 backdrop-blur-xl border border-gs-mid rounded-lg min-w-[220px] py-1 z-start-menu shadow-window-float animate-fade-in">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div
                      key={`sep-${i}`}
                      className="mx-2 my-1 h-px bg-gs-mid/40"
                    />
                  ) : (
                    <button
                      key={item.label}
                      className={`w-full text-left px-4 py-1.5 font-system text-os-base flex items-center justify-between rounded-md mx-1 transition-colors
                        ${item.disabled
                          ? 'text-gs-mid cursor-default'
                          : 'hover:bg-gs-base/15 hover:text-gs-base'
                        }`}
                      style={{ width: 'calc(100% - 8px)' }}
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
                        <span className="text-os-xs text-gs-mid ml-gs-6">
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
      <div className="flex items-center h-full gap-gs-1 pr-gs-3">
        <div className="px-gs-2 py-1 font-data text-data-xs text-gs-mid">
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
