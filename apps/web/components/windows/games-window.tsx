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

const NUMBER_COLORS: Record<number, string> = {
  1: '#0000FF',
  2: '#008000',
  3: '#FF0000',
  4: '#000080',
  5: '#800000',
  6: '#008080',
  7: '#000000',
  8: '#808080',
};

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

  const smiley = gameState === 'won' ? '😎' : gameState === 'lost' ? '😵' : '🙂';

  return (
    <div className="p-gs-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-gs-2 bevel-sunken p-gs-1">
        {/* Ghost counter */}
        <div className="font-data text-data-sm font-bold text-gs-red bg-[#0A0A0A] px-gs-2 py-px min-w-[40px] text-center">
          {MINES - flagCount}
        </div>

        {/* Reset button */}
        <button
          className="bevel-raised w-8 h-8 flex items-center justify-center text-[18px]"
          onClick={reset}
        >
          {smiley}
        </button>

        {/* Timer */}
        <div className="font-data text-data-sm font-bold text-gs-red bg-[#0A0A0A] px-gs-2 py-px min-w-[40px] text-center">
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
                  'w-7 h-7 flex items-center justify-center text-[14px] font-bold font-data',
                  cell.isRevealed
                    ? 'bg-gs-chrome-light border border-gs-chrome-dark/30'
                    : 'bevel-raised bg-gs-chrome',
                )}
                onClick={() => handleClick(r, c)}
                onContextMenu={(e) => handleRightClick(r, c, e)}
              >
                {cell.isRevealed
                  ? cell.isMine
                    ? '👻'
                    : cell.adjacentMines > 0
                      ? <span style={{ color: NUMBER_COLORS[cell.adjacentMines] }}>{cell.adjacentMines}</span>
                      : null
                  : cell.isFlagged
                    ? '🚩'
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
