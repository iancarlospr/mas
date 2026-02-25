/**
 * GhostScan OS — Window Manager State
 *
 * Manages window z-index ordering, active window tracking,
 * and open/minimized/maximized state for all windows.
 *
 * Uses React state via a custom hook. No external state library needed.
 */

import { useState, useCallback, useMemo } from 'react';

export interface WindowState {
  id: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

export interface WindowManagerState {
  windows: Record<string, WindowState>;
  activeWindowId: string | null;
  nextZIndex: number;
}

const INITIAL_Z_INDEX = 100;

export function useWindowManager(initialWindows: string[] = []) {
  const [state, setState] = useState<WindowManagerState>(() => {
    const windows: Record<string, WindowState> = {};
    initialWindows.forEach((id, i) => {
      windows[id] = {
        id,
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        zIndex: INITIAL_Z_INDEX + i,
      };
    });
    return {
      windows,
      activeWindowId: null,
      nextZIndex: INITIAL_Z_INDEX + initialWindows.length,
    };
  });

  /** Open a window and bring it to front */
  const openWindow = useCallback((id: string) => {
    setState((prev) => {
      const nextZ = prev.nextZIndex;
      const existing = prev.windows[id];
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: {
            id,
            isOpen: true,
            isMinimized: false,
            isMaximized: existing?.isMaximized ?? false,
            zIndex: nextZ,
          },
        },
        activeWindowId: id,
        nextZIndex: nextZ + 1,
      };
    });
  }, []);

  /** Close a window */
  const closeWindow = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      windows: {
        ...prev.windows,
        [id]: {
          ...prev.windows[id]!,
          isOpen: false,
          isMinimized: false,
          isMaximized: false,
        },
      },
      activeWindowId: prev.activeWindowId === id ? null : prev.activeWindowId,
    }));
  }, []);

  /** Minimize a window (hide from desktop, keep in taskbar) */
  const minimizeWindow = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      windows: {
        ...prev.windows,
        [id]: {
          ...prev.windows[id]!,
          isMinimized: true,
        },
      },
      activeWindowId: prev.activeWindowId === id ? null : prev.activeWindowId,
    }));
  }, []);

  /** Toggle maximize (fill desktop or restore) */
  const maximizeWindow = useCallback((id: string) => {
    setState((prev) => {
      const win = prev.windows[id];
      if (!win) return prev;
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: {
            ...win,
            isMaximized: !win.isMaximized,
          },
        },
      };
    });
  }, []);

  /** Focus a window (bring to front) */
  const focusWindow = useCallback((id: string) => {
    setState((prev) => {
      const win = prev.windows[id];
      if (!win || prev.activeWindowId === id) return prev;
      const nextZ = prev.nextZIndex;
      return {
        ...prev,
        windows: {
          ...prev.windows,
          [id]: {
            ...win,
            zIndex: nextZ,
            isMinimized: false, // Restore if clicking from taskbar
          },
        },
        activeWindowId: id,
        nextZIndex: nextZ + 1,
      };
    });
  }, []);

  /** Get a specific window's state */
  const getWindow = useCallback(
    (id: string): WindowState | undefined => state.windows[id],
    [state.windows],
  );

  /** List all open (non-minimized) windows sorted by z-index */
  const visibleWindows = useMemo(
    () =>
      Object.values(state.windows)
        .filter((w) => w.isOpen && !w.isMinimized)
        .sort((a, b) => a.zIndex - b.zIndex),
    [state.windows],
  );

  /** List all open windows (including minimized, for taskbar) */
  const openWindows = useMemo(
    () => Object.values(state.windows).filter((w) => w.isOpen),
    [state.windows],
  );

  return {
    state,
    openWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    getWindow,
    visibleWindows,
    openWindows,
    activeWindowId: state.activeWindowId,
  };
}
