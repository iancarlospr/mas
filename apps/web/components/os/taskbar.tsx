'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager } from '@/lib/window-manager';
import { BedroomIcon } from './bedroom-icons';

/* =================================================================
   Taskbar — Bottom bar with Start menu, open programs, clock
   ================================================================= */

/** Start menu labels — match the desktop icon labels */
const START_MENU_LABELS: Record<string, string> = {
  'history':       'My Scans',
  'chat-launcher': 'Chat',
  'scan-input':    'Scan.exe',
  'products':      'Products',
  'pricing':       'Pricing',
  'features':      'Features',
  'about':         'About',
  'blog':          'Blog',
  'customers':     'Reviews',
  'chill':         'Movies',
  'games':         'Mini-Games',
};

/** Order for start menu (left column first, then right) */
const START_MENU_ORDER = [
  'history', 'chat-launcher', 'scan-input', 'products', 'pricing', 'features',
  'about', 'blog', 'customers', 'chill', 'games',
];

export function Taskbar() {
  const [startOpen, setStartOpen] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const wm = useWindowManager();

  const toggleStart = useCallback(() => {
    setStartOpen((prev) => !prev);
  }, []);

  // Close start menu on click outside
  useEffect(() => {
    if (!startOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) {
        setStartOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [startOpen]);

  const openPrograms = wm.taskbarWindows;

  return (
    <div className="gs-taskbar h-taskbar bg-gs-deep/90 backdrop-blur-md flex items-center z-taskbar relative dither-edge-top"
      style={{ borderTop: '1px solid var(--gs-mid)' }}
    >
      {/* Start Button + Menu wrapper (for click-outside detection) */}
      <div ref={startRef} className="relative">
        <button
          className={cn(
            'h-[32px] px-gs-3 mx-gs-2 flex items-center gap-gs-2 font-system text-os-base font-bold rounded-lg transition-all',
            startOpen
              ? 'bg-gs-base/20 text-gs-base'
              : 'text-gs-light/80 hover:bg-gs-base/10 hover:text-gs-light',
          )}
          onClick={toggleStart}
        >
          <span className="text-gs-base text-os-lg">A</span>
          <span>Start</span>
        </button>

        {/* Start Menu */}
        {startOpen && (
        <div className="absolute bottom-full left-gs-2 mb-1 bg-gs-deep/95 backdrop-blur-xl border border-gs-mid rounded-lg min-w-[240px] z-start-menu shadow-window-float animate-slide-up overflow-hidden">
          <div className="flex">
            {/* Vertical brand strip */}
            <div className="w-[32px] flex-shrink-0 flex items-end justify-center pb-gs-3 bg-gs-base">
              <span
                className="font-system text-os-xs text-gs-void font-bold"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  letterSpacing: '2px',
                }}
              >
                AlphaScan
              </span>
            </div>

            {/* Menu items */}
            <div className="flex-1 py-1">
              {START_MENU_ORDER.map((id, i) => {
                const label = START_MENU_LABELS[id];
                if (!label) return null;
                return (
                  <button
                    key={id}
                    className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                               flex items-center gap-gs-3 transition-colors
                               hover:bg-gs-base/15 hover:text-gs-base text-gs-light/80"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => {
                      wm.openWindow(id);
                      setStartOpen(false);
                    }}
                  >
                    <span className="text-gs-base"><BedroomIcon windowId={id} size={18} /></span>
                    <span>{label}</span>
                  </button>
                );
              })}

              <div className="mx-gs-2 my-1 h-px bg-gs-mid/40" />

              <button
                className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                           flex items-center gap-gs-3 transition-colors
                           hover:bg-gs-base/15 hover:text-gs-base text-gs-light/80"
                onClick={() => {
                  wm.openWindow('trash');
                  setStartOpen(false);
                }}
              >
                <span className="text-os-lg text-gs-base">{'>'}</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Separator */}
      <div className="w-px h-[24px] bg-gs-mid/40 mx-gs-1" />

      {/* Open Program Buttons */}
      <div className="flex-1 flex items-center gap-1.5 px-gs-2 overflow-hidden">
        {openPrograms.map((win) => (
          <button
            key={win.id}
            className={cn(
              'h-[28px] px-gs-3 flex items-center gap-1.5 font-system text-os-sm truncate max-w-[160px] rounded-md transition-all',
              wm.activeWindowId === win.id
                ? 'bg-gs-base/20 text-gs-base border border-gs-base/30'
                : 'text-gs-light/60 hover:text-gs-light hover:bg-gs-base/10',
            )}
            onClick={() => {
              if (win.isMinimized) {
                wm.focusWindow(win.id);
              } else if (wm.activeWindowId === win.id) {
                wm.minimizeWindow(win.id);
              } else {
                wm.focusWindow(win.id);
              }
            }}
          >
            <span className="text-gs-base"><BedroomIcon windowId={win.id} size={14} /></span>
            <span className="truncate">{START_MENU_LABELS[win.id] ?? win.title}</span>
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="flex items-center gap-gs-2 px-gs-3 h-[28px] mr-gs-2">
        <span className="font-data text-data-xs text-gs-mid">
          <TaskbarClock />
        </span>
      </div>
    </div>
  );
}

function TaskbarClock() {
  const [time, setTime] = useState('');

  useState(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  });

  return <>{time}</>;
}
