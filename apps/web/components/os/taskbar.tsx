'use client';

import { useState, useCallback } from 'react';
import type { DesktopProgram } from './desktop';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Taskbar

   Win95 bottom taskbar.
   Left: Start button → opens start menu
   Center: Open program buttons (shows active windows)
   Right: System tray (clock, volume, notifications)
   Fixed at bottom, 36px height.
   ═══════════════════════════════════════════════════════════════ */

interface TaskbarProps {
  programs: DesktopProgram[];
  currentTime?: string;
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
}

export function Taskbar({
  programs,
  currentTime,
  audioEnabled = false,
  onToggleAudio,
}: TaskbarProps) {
  const [startOpen, setStartOpen] = useState(false);

  const toggleStart = useCallback(() => {
    setStartOpen((prev) => !prev);
  }, []);

  const openPrograms = programs.filter((p) => p.isOpen);

  return (
    <div className="gs-taskbar h-taskbar bg-gs-light bevel-raised flex items-center z-taskbar relative">
      {/* ── Start Button ─────────────────────────────────── */}
      <button
        className={cn(
          'h-[30px] px-gs-3 mx-gs-1 flex items-center gap-gs-1 font-system text-os-base font-bold',
          startOpen
            ? 'bevel-sunken bg-gs-mid-light'
            : 'bevel-raised bg-gs-light hover:bg-gs-mid-light/30',
        )}
        onClick={toggleStart}
      >
        <span className="text-os-lg">👻</span>
        <span>Start</span>
      </button>

      {/* ── Start Menu (popup) ───────────────────────────── */}
      {startOpen && (
        <div className="absolute bottom-full left-gs-1 mb-0 bg-gs-light bevel-raised min-w-[220px] z-start-menu shadow-window">
          {/* Vertical brand strip on left */}
          <div className="flex">
            <div
              className="w-[28px] flex-shrink-0 flex items-end justify-center pb-gs-2"
              style={{ background: 'var(--gs-gradient)' }}
            >
              <span
                className="font-system text-os-xs text-gs-white font-bold"
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
              {programs.map((program) => (
                <button
                  key={program.id}
                  className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                             flex items-center gap-gs-3
                             hover:bg-gs-mid-dark hover:text-gs-white"
                  onClick={() => {
                    program.onOpen();
                    setStartOpen(false);
                  }}
                >
                  <span className="text-os-lg">{program.icon}</span>
                  <span>{program.label}</span>
                </button>
              ))}

              <div
                className="mx-gs-2 my-gs-1 border-t"
                style={{ borderColor: 'var(--gs-mid)' }}
              />

              <button
                className="w-full text-left px-gs-4 py-gs-2 font-system text-os-base
                           flex items-center gap-gs-3
                           hover:bg-gs-mid-dark hover:text-gs-white"
                onClick={() => setStartOpen(false)}
              >
                <span className="text-os-lg">🚪</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Separator ────────────────────────────────────── */}
      <div className="w-px h-[24px] bg-gs-mid mx-gs-1" />

      {/* ── Open Program Buttons ─────────────────────────── */}
      <div className="flex-1 flex items-center gap-gs-1 px-gs-1 overflow-hidden">
        {openPrograms.map((program) => (
          <button
            key={program.id}
            className="bevel-sunken bg-gs-white h-[26px] px-gs-3 flex items-center gap-gs-1
                       font-system text-os-sm truncate max-w-[160px]"
            onClick={program.onOpen}
          >
            <span className="text-os-sm">{program.icon}</span>
            <span className="truncate">{program.label}</span>
          </button>
        ))}
      </div>

      {/* ── System Tray ──────────────────────────────────── */}
      <div className="bevel-sunken flex items-center gap-gs-2 px-gs-2 h-[26px] mr-gs-1">
        <button
          className="text-os-xs hover:brightness-125"
          onClick={onToggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>
        <span className="font-data text-data-xs text-gs-mid-dark">
          {currentTime ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
