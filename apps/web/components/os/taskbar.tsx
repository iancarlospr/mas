'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useWindowManager } from '@/lib/window-manager';

/* =================================================================
   Chloe's Bedroom OS — Taskbar

   Frosted glass bottom bar. Connected to WindowManagerProvider.
   Left: Start button → opens start menu
   Center: Open program buttons (pill style)
   Right: System tray (clock)
   Dither top edge.
   ================================================================= */

export function Taskbar() {
  const [startOpen, setStartOpen] = useState(false);
  const wm = useWindowManager();

  const toggleStart = useCallback(() => {
    setStartOpen((prev) => !prev);
  }, []);

  const allWindows = Object.values(wm.windows);
  const openPrograms = wm.taskbarWindows;

  return (
    <div className="gs-taskbar h-taskbar bg-gs-deep/90 backdrop-blur-md flex items-center z-taskbar relative dither-edge-top"
      style={{ borderTop: '1px solid var(--gs-mid)' }}
    >
      {/* Start Button */}
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
            {/* Vertical brand strip — solid pink */}
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
              {allWindows.map((win, i) => (
                <button
                  key={win.id}
                  className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                             flex items-center gap-gs-3 transition-colors
                             hover:bg-gs-base/15 hover:text-gs-base text-gs-light/80"
                  style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => {
                    wm.openWindow(win.id);
                    setStartOpen(false);
                  }}
                >
                  <span className="text-os-lg text-gs-base">{win.icon}</span>
                  <span>{win.title}</span>
                </button>
              ))}

              <div className="mx-gs-2 my-1 h-px bg-gs-mid/40" />

              <button
                className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                           flex items-center gap-gs-3 transition-colors
                           hover:bg-gs-base/15 hover:text-gs-base text-gs-light/80"
                onClick={() => setStartOpen(false)}
              >
                <span className="text-os-lg text-gs-base">{'>'}</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Separator */}
      <div className="w-px h-[24px] bg-gs-mid/40 mx-gs-1" />

      {/* Open Program Buttons — pill style */}
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
            <span className="text-os-sm text-gs-base">{win.icon}</span>
            <span className="truncate">{win.title}</span>
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
