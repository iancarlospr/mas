'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager } from '@/lib/window-manager';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Taskbar

   Win95 bottom taskbar. Connected to WindowManagerProvider.
   Left: Start button → opens start menu
   Center: Open program buttons (shows active windows)
   Right: System tray (clock)
   ═══════════════════════════════════════════════════════════════ */

export function Taskbar() {
  const [startOpen, setStartOpen] = useState(false);
  const wm = useWindowManager();

  const toggleStart = useCallback(() => {
    setStartOpen((prev) => !prev);
  }, []);

  // All registered windows for the start menu
  const allWindows = Object.values(wm.windows);
  const openPrograms = wm.taskbarWindows;

  return (
    <div className="gs-taskbar h-taskbar bg-gs-chrome bevel-raised flex items-center z-taskbar relative">
      {/* Start Button */}
      <button
        className={cn(
          'h-[30px] px-gs-3 mx-gs-1 flex items-center gap-gs-1 font-system text-os-base font-bold',
          startOpen
            ? 'bevel-sunken bg-gs-chrome-dark'
            : 'bevel-raised bg-gs-chrome hover:bg-gs-chrome-dark/30',
        )}
        onClick={toggleStart}
      >
        <span className="text-os-lg">👻</span>
        <span>Start</span>
      </button>

      {/* Start Menu */}
      {startOpen && (
        <div className="absolute bottom-full left-gs-1 mb-0 bg-gs-chrome bevel-raised min-w-[220px] z-start-menu shadow-window">
          <div className="flex">
            {/* Vertical brand strip — solid red */}
            <div
              className="w-[28px] flex-shrink-0 flex items-end justify-center pb-gs-2 bg-gs-red"
            >
              <span
                className="font-system text-os-xs text-white font-bold"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  letterSpacing: '2px',
                }}
              >
                GhostScan OS
              </span>
            </div>

            {/* Menu items */}
            <div className="flex-1 py-gs-1">
              {allWindows.map((win) => (
                <button
                  key={win.id}
                  className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                             flex items-center gap-gs-3
                             hover:bg-gs-ink hover:text-gs-paper"
                  onClick={() => {
                    wm.openWindow(win.id);
                    setStartOpen(false);
                  }}
                >
                  <span className="text-os-lg">{win.icon}</span>
                  <span>{win.title}</span>
                </button>
              ))}

              <div
                className="mx-gs-2 my-gs-1 border-t"
                style={{ borderColor: 'var(--gs-chrome-dark)' }}
              />

              <button
                className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                           flex items-center gap-gs-3
                           hover:bg-gs-ink hover:text-gs-paper"
                onClick={() => setStartOpen(false)}
              >
                <span className="text-os-lg">🚪</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Separator */}
      <div className="w-px h-[24px] bg-gs-chrome-dark mx-gs-1" />

      {/* Open Program Buttons */}
      <div className="flex-1 flex items-center gap-gs-1 px-gs-1 overflow-hidden">
        {openPrograms.map((win) => (
          <button
            key={win.id}
            className={cn(
              'h-[26px] px-gs-3 flex items-center gap-gs-1 font-system text-os-sm truncate max-w-[160px]',
              wm.activeWindowId === win.id
                ? 'bevel-sunken bg-gs-paper'
                : 'bevel-raised bg-gs-chrome',
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
            <span className="text-os-sm">{win.icon}</span>
            <span className="truncate">{win.title}</span>
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="bevel-sunken flex items-center gap-gs-2 px-gs-2 h-[26px] mr-gs-1">
        <span className="font-data text-data-xs text-gs-muted">
          <TaskbarClock />
        </span>
      </div>
    </div>
  );
}

function TaskbarClock() {
  const [time, setTime] = useState('');

  // Hydration-safe: only set time on client
  useState(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  });

  return <>{time}</>;
}
