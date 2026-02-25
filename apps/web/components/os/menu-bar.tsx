'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Menu Bar

   Mac OS 9 style top menu bar.
   Left: Logo + menu items (File, Edit, View, Scan, Help)
   Right: Volume, Settings, Clock
   Fixed at top, 28px height, system font.
   ═══════════════════════════════════════════════════════════════ */

interface MenuBarProps {
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
  onNewScan?: () => void;
  onViewHistory?: () => void;
  onSettings?: () => void;
  currentTime?: string;
}

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

export function MenuBar({
  audioEnabled = false,
  onToggleAudio,
  onNewScan,
  onViewHistory,
  onSettings,
  currentTime,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New Scan...', shortcut: '⌘N', onClick: onNewScan },
        { label: 'Open Scan...', shortcut: '⌘O' },
        { separator: true, label: '' },
        { label: 'Export as PDF', shortcut: '⌘P', disabled: true },
        { separator: true, label: '' },
        { label: 'Quit', shortcut: '⌘Q' },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Copy', shortcut: '⌘C' },
        { label: 'Select All', shortcut: '⌘A' },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Dashboard', onClick: () => {} },
        { label: 'Full Report', disabled: true },
        { separator: true, label: '' },
        { label: 'Scan History', onClick: onViewHistory },
      ],
    },
    {
      label: 'Scan',
      items: [
        { label: 'New Scan...', shortcut: '⌘N', onClick: onNewScan },
        { label: 'Re-run Scan', disabled: true },
        { separator: true, label: '' },
        { label: 'Declassify (Unlock)', disabled: true },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Ask Chloé' },
        { label: 'Documentation' },
        { separator: true, label: '' },
        { label: 'About GhostScan OS' },
      ],
    },
  ];

  // Close menu on outside click
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
      className="gs-menubar h-menubar flex items-center bg-gs-light border-b-2 z-menubar relative"
      style={{ borderBottomColor: 'var(--gs-mid)' }}
    >
      {/* Logo */}
      <button
        className="h-full px-gs-3 flex items-center gap-gs-1 font-system text-os-base font-bold
                   hover:bg-gs-mid-light/50 active:bg-gs-mid/30"
        onClick={onNewScan}
      >
        <span className="text-os-lg">👻</span>
        <span className="text-ghost-gradient">AlphaScan</span>
      </button>

      {/* Menu Items */}
      <div className="flex items-center h-full">
        {menus.map((menu) => (
          <div key={menu.label} className="relative h-full">
            <button
              className={`h-full px-gs-3 font-system text-os-base
                ${openMenu === menu.label
                  ? 'bg-gs-mid-dark text-gs-white'
                  : 'hover:bg-gs-mid-light/50'
                }`}
              onClick={() => handleMenuClick(menu.label)}
              onMouseEnter={() => handleMenuHover(menu.label)}
            >
              {menu.label}
            </button>

            {/* Dropdown */}
            {openMenu === menu.label && (
              <div className="absolute top-full left-0 bg-gs-light bevel-raised min-w-[200px] py-gs-1 z-start-menu shadow-window">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div
                      key={`sep-${i}`}
                      className="mx-gs-1 my-gs-1 border-t"
                      style={{ borderColor: 'var(--gs-mid)' }}
                    />
                  ) : (
                    <button
                      key={item.label}
                      className={`w-full text-left px-gs-6 py-gs-1 font-system text-os-base flex items-center justify-between
                        ${item.disabled
                          ? 'text-gs-mid cursor-default'
                          : 'hover:bg-gs-mid-dark hover:text-gs-white'
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
                        <span className="text-os-xs text-gs-mid-light ml-gs-6">
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

      {/* Right side: system tray */}
      <div className="flex-1" />
      <div className="flex items-center h-full gap-gs-1 pr-gs-2">
        {/* Volume */}
        <button
          className="h-6 w-6 flex items-center justify-center font-system text-os-sm
                     hover:bg-gs-mid-light/50 active:bg-gs-mid/30"
          onClick={onToggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
          aria-label={audioEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>

        {/* Settings */}
        <button
          className="h-6 w-6 flex items-center justify-center font-system text-os-sm
                     hover:bg-gs-mid-light/50 active:bg-gs-mid/30"
          onClick={onSettings}
          title="Settings"
        >
          ⚙
        </button>

        {/* Clock */}
        <div className="bevel-sunken px-gs-2 py-px font-data text-data-xs text-gs-mid-dark">
          {currentTime ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
