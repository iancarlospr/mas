'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Ghost Sweeper — Minesweeper Clone

   9×9 beginner grid, 10 mines. Left-click reveal, right-click flag.
   First click never hits a mine. Flood fill on zero-adjacents.
   ═══════════════════════════════════════════════════════════════ */

const ROWS = 9;
const COLS = 9;
const MINES = 10;

/* Pink palette number colors — dim → bright as danger increases */
const NUMBER_COLORS: Record<number, string> = {
  1: 'oklch(0.75 0.08 340)',   // soft pink
  2: 'oklch(0.70 0.12 340)',   // medium pink
  3: 'oklch(0.65 0.16 340)',   // hot pink
  4: 'oklch(0.60 0.20 340)',   // deep pink
  5: 'oklch(0.55 0.18 340)',   // magenta
  6: 'oklch(0.50 0.15 340)',   // dark magenta
  7: 'oklch(0.45 0.12 340)',   // deep rose
  8: 'oklch(0.90 0.05 340)',   // near-white pink
};

/* ── Inline SVG Components ──────────────────────────────────── */

function GhostMine({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1C4.7 1 2 3.5 2 6.5V13l1.5-1.5L5 13l1.5-1.5L8 13l1.5-1.5L11 13l1.5-1.5L14 13V6.5C14 3.5 11.3 1 8 1Z"
        fill="var(--gs-base)"
      />
      <circle cx="6" cy="6.5" r="1.2" fill="var(--gs-void)" />
      <circle cx="10" cy="6.5" r="1.2" fill="var(--gs-void)" />
      <ellipse cx="8" cy="9" rx="1" ry="0.6" fill="var(--gs-void)" />
    </svg>
  );
}

function GhostFace({ state }: { state: 'playing' | 'won' | 'lost' }) {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1C4.7 1 2 3.5 2 6.5V13l1.5-1.5L5 13l1.5-1.5L8 13l1.5-1.5L11 13l1.5-1.5L14 13V6.5C14 3.5 11.3 1 8 1Z"
        fill="var(--gs-base)"
      />
      {state === 'playing' && (
        <>
          <circle cx="6" cy="6.5" r="1.2" fill="var(--gs-void)" />
          <circle cx="10" cy="6.5" r="1.2" fill="var(--gs-void)" />
        </>
      )}
      {state === 'won' && (
        <>
          {/* Happy curved eyes ^_^ */}
          <path d="M4.8 6.5 Q6 5 7.2 6.5" stroke="var(--gs-void)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M8.8 6.5 Q10 5 11.2 6.5" stroke="var(--gs-void)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M6.5 9 Q8 10.5 9.5 9" stroke="var(--gs-void)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </>
      )}
      {state === 'lost' && (
        <>
          {/* X eyes */}
          <path d="M5 5.5 L7 7.5 M7 5.5 L5 7.5" stroke="var(--gs-void)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9 5.5 L11 7.5 M11 5.5 L9 7.5" stroke="var(--gs-void)" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="8" cy="9.5" rx="1.2" ry="0.8" fill="var(--gs-void)" />
        </>
      )}
    </svg>
  );
}

function FlagIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <line x1="3" y1="2" x2="3" y2="10" stroke="var(--gs-base)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.5 2 L9 4 L3.5 6Z" fill="var(--gs-base)" />
    </svg>
  );
}

/* ── Game Logic ──────────────────────────────────────────────── */

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

type GameState = 'playing' | 'won' | 'lost';

function createEmptyGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  );
}

function placeMines(grid: Cell[][], excludeR: number, excludeC: number): Cell[][] {
  const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;

  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (newGrid[r]![c]!.isMine) continue;
    if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) continue;
    newGrid[r]![c]!.isMine = true;
    placed++;
  }

  // Calculate adjacents
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (newGrid[r]![c]!.isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newGrid[nr]![nc]!.isMine) {
            count++;
          }
        }
      }
      newGrid[r]![c]!.adjacentMines = count;
    }
  }

  return newGrid;
}

function floodReveal(grid: Cell[][], r: number, c: number): Cell[][] {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return grid;
  const cell = grid[r]![c]!;
  if (cell.isRevealed || cell.isFlagged || cell.isMine) return grid;

  grid[r]![c] = { ...cell, isRevealed: true };

  if (cell.adjacentMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        floodReveal(grid, r + dr, c + dc);
      }
    }
  }

  return grid;
}

function checkWin(grid: Cell[][]): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r]![c]!;
      if (!cell.isMine && !cell.isRevealed) return false;
    }
  }
  return true;
}

/* ── Component ───────────────────────────────────────────────── */

export default function GamesWindow() {
  const [grid, setGrid] = useState(createEmptyGrid);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [firstClick, setFirstClick] = useState(true);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flagCount = grid.flat().filter((c) => c.isFlagged).length;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    setGrid(createEmptyGrid());
    setGameState('playing');
    setFirstClick(true);
    setTimer(0);
  }, [stopTimer]);

  const handleClick = useCallback(
    (r: number, c: number) => {
      if (gameState !== 'playing') return;
      const cell = grid[r]![c]!;
      if (cell.isRevealed || cell.isFlagged) return;

      let newGrid: Cell[][];

      if (firstClick) {
        newGrid = placeMines(grid, r, c);
        setFirstClick(false);
        startTimer();
      } else {
        newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
      }

      if (newGrid[r]![c]!.isMine) {
        // Game over — reveal all mines
        for (let i = 0; i < ROWS; i++) {
          for (let j = 0; j < COLS; j++) {
            if (newGrid[i]![j]!.isMine) {
              newGrid[i]![j] = { ...newGrid[i]![j]!, isRevealed: true };
            }
          }
        }
        setGrid(newGrid);
        setGameState('lost');
        stopTimer();
        return;
      }

      floodReveal(newGrid, r, c);
      setGrid([...newGrid]);

      if (checkWin(newGrid)) {
        setGameState('won');
        stopTimer();
      }
    },
    [grid, gameState, firstClick, startTimer, stopTimer],
  );

  const handleRightClick = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      e.preventDefault();
      if (gameState !== 'playing') return;
      const cell = grid[r]![c]!;
      if (cell.isRevealed) return;

      const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
      newGrid[r]![c] = { ...cell, isFlagged: !cell.isFlagged };
      setGrid(newGrid);
    },
    [grid, gameState],
  );

  return (
    <div className="p-gs-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-gs-2 bevel-sunken p-gs-1">
        {/* Ghost counter */}
        <div className="font-data text-data-sm font-bold text-gs-base bg-[#0A0A0A] px-gs-2 py-px min-w-[40px] text-center rounded-md">
          {MINES - flagCount}
        </div>

        {/* Reset button */}
        <button
          className="bevel-raised w-8 h-8 flex items-center justify-center"
          onClick={reset}
        >
          <GhostFace state={gameState} />
        </button>

        {/* Timer */}
        <div className="font-data text-data-sm font-bold text-gs-base bg-[#0A0A0A] px-gs-2 py-px min-w-[40px] text-center rounded-md">
          {String(timer).padStart(3, '0')}
        </div>
      </div>

      {/* Grid */}
      <div className="bevel-sunken p-px inline-block">
        {grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => (
              <button
                key={c}
                className={cn(
                  'w-7 h-7 flex items-center justify-center text-[14px] font-bold font-data rounded-lg',
                  cell.isRevealed
                    ? 'bg-gs-chrome-light border border-gs-chrome-dark/30'
                    : 'bevel-raised bg-gs-chrome',
                )}
                onClick={() => handleClick(r, c)}
                onContextMenu={(e) => handleRightClick(r, c, e)}
              >
                {cell.isRevealed
                  ? cell.isMine
                    ? <GhostMine />
                    : cell.adjacentMines > 0
                      ? <span style={{ color: NUMBER_COLORS[cell.adjacentMines] }}>{cell.adjacentMines}</span>
                      : null
                  : cell.isFlagged
                    ? <FlagIcon />
                    : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Game state message */}
      {gameState !== 'playing' && (
        <div className="mt-gs-2 text-center font-system text-os-base font-bold">
          {gameState === 'won' ? (
            <span className="text-gs-terminal">You found all the ghosts!</span>
          ) : (
            <span className="text-gs-critical">Busted by a ghost!</span>
          )}
        </div>
      )}
    </div>
  );
}
