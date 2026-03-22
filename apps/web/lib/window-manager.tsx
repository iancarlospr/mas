'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Window Manager Provider

   Global context for window lifecycle, position, size, z-ordering.
   Every window on the desktop reads its state from here.
   Uses useReducer for predictable updates at drag/resize 60fps.
   ═══════════════════════════════════════════════════════════════ */

export interface WindowState {
  id: string;
  title: string;
  icon: ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  variant: 'default' | 'terminal' | 'ghost' | 'dialog';
  isRouteWindow?: boolean;
  /** Window floats above normal windows (e.g., chat panels) */
  alwaysOnTop?: boolean;
  /** Component type for dynamic windows (e.g., 'scan-report', 'payment') */
  componentType?: string;
  /** Data passed when opening — consumed by window content, cleared on close */
  openData?: Record<string, unknown>;
}

export interface WindowConfig {
  title?: string;
  icon?: ReactNode;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  variant?: WindowState['variant'];
  isRouteWindow?: boolean;
  /** Start open instead of closed */
  startOpen?: boolean;
  /** Component type for dynamic windows — tells renderer which component to use */
  componentType?: string;
  /** Window floats above normal windows (e.g., chat panels) */
  alwaysOnTop?: boolean;
}

interface WindowManagerState {
  windows: Record<string, WindowState>;
  activeWindowId: string | null;
  nextZIndex: number;
  openCount: number;
}

type WindowAction =
  | { type: 'REGISTER'; id: string; config: WindowConfig }
  | { type: 'UNREGISTER'; id: string }
  | { type: 'OPEN'; id: string; data?: Record<string, unknown> }
  | { type: 'CLOSE'; id: string }
  | { type: 'MINIMIZE'; id: string }
  | { type: 'MAXIMIZE'; id: string }
  | { type: 'FOCUS'; id: string }
  | { type: 'MOVE'; id: string; x: number; y: number }
  | { type: 'RESIZE'; id: string; width: number; height: number }
  | { type: 'MOVE_RESIZE'; id: string; x: number; y: number; width: number; height: number }
  | { type: 'UPDATE_WINDOW'; id: string; updates: Partial<Pick<WindowState, 'title' | 'icon'>> };

const INITIAL_Z_INDEX = 100;

/**
 * Random position in the safe zone between icon columns.
 * Accounts for window width so the right edge never overlaps right icons,
 * and the window never goes off-screen.
 *
 * Icon columns: left ~0-10%, right ~88-100%
 * Safe zone for window left edge: 10% to (88% - windowWidth)
 * Vertical: 4% to (65% - rough window height estimate)
 */
function randomWindowPosition(winWidth: number): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const taskbarH = 44; // --gs-taskbar-h (40px) + 4px dither edge
  const maxWindowH = Math.floor((vh - taskbarH) * 0.85);

  const leftBound = Math.floor(vw * 0.10);
  const rightBound = Math.floor(vw * 0.88) - winWidth;
  const topBound = Math.floor(vh * 0.04);
  // Bottom bound: ensure even a tall window (maxWindowH) stays above taskbar
  const bottomBound = Math.max(topBound, vh - taskbarH - maxWindowH);

  // Clamp so we always have a valid range
  const minX = leftBound;
  const maxX = Math.max(minX, rightBound);
  const minY = topBound;
  const maxY = Math.max(minY, bottomBound);

  const x = Math.floor(minX + Math.random() * (maxX - minX));
  const y = Math.floor(minY + Math.random() * (maxY - minY));
  return { x, y };
}

function windowReducer(state: WindowManagerState, action: WindowAction): WindowManagerState {
  switch (action.type) {
    case 'REGISTER': {
      if (state.windows[action.id]) return state;
      const { config } = action;
      const w = config.width ?? 600;
      const pos = randomWindowPosition(w);
      const win: WindowState = {
        id: action.id,
        title: config.title ?? action.id,
        icon: config.icon ?? '📄',
        isOpen: config.startOpen ?? false,
        isMinimized: false,
        isMaximized: false,
        x: pos.x,
        y: pos.y,
        width: config.width ?? 600,
        height: config.height ?? 400,
        minWidth: config.minWidth ?? 300,
        minHeight: config.minHeight ?? 200,
        zIndex: INITIAL_Z_INDEX,
        variant: config.variant ?? 'default',
        isRouteWindow: config.isRouteWindow,
        componentType: config.componentType,
        alwaysOnTop: config.alwaysOnTop,
      };
      return {
        ...state,
        windows: { ...state.windows, [action.id]: win },
      };
    }

    case 'UNREGISTER': {
      const { [action.id]: _, ...rest } = state.windows;
      return {
        ...state,
        windows: rest,
        activeWindowId: state.activeWindowId === action.id ? null : state.activeWindowId,
      };
    }

    case 'OPEN': {
      const existing = state.windows[action.id];
      if (!existing) return state;
      const nextZ = state.nextZIndex;
      const openPos = randomWindowPosition(existing.width);
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...existing,
            isOpen: true,
            isMinimized: false,
            x: existing.isOpen ? existing.x : openPos.x,
            y: existing.isOpen ? existing.y : openPos.y,
            zIndex: nextZ,
            openData: action.data ?? existing.openData,
          },
        },
        activeWindowId: action.id,
        nextZIndex: nextZ + 1,
        openCount: existing.isOpen ? state.openCount : state.openCount + 1,
      };
    }

    case 'CLOSE': {
      const win = state.windows[action.id];
      if (!win) return state;
      // Dynamic windows (those with componentType) are fully unregistered on close
      // to prevent memory leaks from accumulating scan-{uuid} entries
      if (win.componentType) {
        const { [action.id]: _, ...rest } = state.windows;
        return {
          ...state,
          windows: rest,
          activeWindowId: state.activeWindowId === action.id ? null : state.activeWindowId,
          openCount: Math.max(0, state.openCount - 1),
        };
      }
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...win,
            isOpen: false,
            isMinimized: false,
            isMaximized: false,
            openData: undefined,
          },
        },
        activeWindowId: state.activeWindowId === action.id ? null : state.activeWindowId,
        openCount: Math.max(0, state.openCount - 1),
      };
    }

    case 'MINIMIZE': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...win, isMinimized: true },
        },
        activeWindowId: state.activeWindowId === action.id ? null : state.activeWindowId,
      };
    }

    case 'MAXIMIZE': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...win, isMaximized: !win.isMaximized },
        },
      };
    }

    case 'FOCUS': {
      const win = state.windows[action.id];
      if (!win || state.activeWindowId === action.id) return state;
      const nextZ = state.nextZIndex;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...win,
            zIndex: nextZ,
            isMinimized: false,
          },
        },
        activeWindowId: action.id,
        nextZIndex: nextZ + 1,
      };
    }

    case 'MOVE': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: { ...win, x: action.x, y: action.y },
        },
      };
    }

    case 'RESIZE': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...win,
            width: Math.max(win.minWidth, action.width),
            height: Math.max(win.minHeight, action.height),
          },
        },
      };
    }

    case 'MOVE_RESIZE': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...win,
            x: action.x,
            y: action.y,
            width: Math.max(win.minWidth, action.width),
            height: Math.max(win.minHeight, action.height),
          },
        },
      };
    }

    case 'UPDATE_WINDOW': {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [action.id]: {
            ...win,
            ...action.updates,
          },
        },
      };
    }

    default:
      return state;
  }
}

/* ── Context ──────────────────────────────────────────────── */

interface WindowManagerContextValue {
  windows: Record<string, WindowState>;
  activeWindowId: string | null;

  registerWindow(id: string, config: WindowConfig): void;
  unregisterWindow(id: string): void;
  openWindow(id: string, data?: Record<string, unknown>): void;
  closeWindow(id: string): void;
  minimizeWindow(id: string): void;
  maximizeWindow(id: string): void;
  focusWindow(id: string): void;
  moveWindow(id: string, x: number, y: number): void;
  resizeWindow(id: string, width: number, height: number): void;
  moveResizeWindow(id: string, x: number, y: number, width: number, height: number): void;
  updateWindow(id: string, updates: Partial<Pick<WindowState, 'title' | 'icon'>>): void;

  visibleWindows: WindowState[];
  openWindows: WindowState[];
  taskbarWindows: WindowState[];
  /** True when any scan-report window is open (used to suppress ghost) */
  hasOpenScanReport: boolean;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, {
    windows: {},
    activeWindowId: null,
    nextZIndex: INITIAL_Z_INDEX,
    openCount: 0,
  });

  const registerWindow = useCallback((id: string, config: WindowConfig) => {
    dispatch({ type: 'REGISTER', id, config });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    dispatch({ type: 'UNREGISTER', id });
  }, []);

  const openWindow = useCallback((id: string, data?: Record<string, unknown>) => {
    dispatch({ type: 'OPEN', id, data });
    // Lazy import to avoid circular deps (analytics imports posthog-js, not this module)
    import('@/lib/analytics').then(({ analytics }) => analytics.windowOpened(id)).catch(() => {});
  }, []);

  const closeWindow = useCallback((id: string) => {
    dispatch({ type: 'CLOSE', id });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    dispatch({ type: 'MINIMIZE', id });
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    dispatch({ type: 'MAXIMIZE', id });
  }, []);

  const focusWindow = useCallback((id: string) => {
    dispatch({ type: 'FOCUS', id });
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE', id, x, y });
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number) => {
    dispatch({ type: 'RESIZE', id, width, height });
  }, []);

  const moveResizeWindow = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      dispatch({ type: 'MOVE_RESIZE', id, x, y, width, height });
    },
    [],
  );

  const updateWindow = useCallback(
    (id: string, updates: Partial<Pick<WindowState, 'title' | 'icon'>>) => {
      dispatch({ type: 'UPDATE_WINDOW', id, updates });
    },
    [],
  );

  const visibleWindows = useMemo(
    () =>
      Object.values(state.windows)
        .filter((w) => w.isOpen && !w.isMinimized)
        .sort((a, b) => a.zIndex - b.zIndex),
    [state.windows],
  );

  const openWindows = useMemo(
    () => Object.values(state.windows).filter((w) => w.isOpen),
    [state.windows],
  );

  const taskbarWindows = useMemo(
    () =>
      Object.values(state.windows)
        .filter((w) => w.isOpen)
        .sort((a, b) => a.zIndex - b.zIndex),
    [state.windows],
  );

  const hasOpenScanReport = useMemo(
    () => Object.values(state.windows).some((w) => w.isOpen && w.componentType === 'scan-report'),
    [state.windows],
  );

  const value = useMemo<WindowManagerContextValue>(
    () => ({
      windows: state.windows,
      activeWindowId: state.activeWindowId,
      registerWindow,
      unregisterWindow,
      openWindow,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      focusWindow,
      moveWindow,
      resizeWindow,
      moveResizeWindow,
      updateWindow,
      visibleWindows,
      openWindows,
      taskbarWindows,
      hasOpenScanReport,
    }),
    [
      state.windows,
      state.activeWindowId,
      registerWindow,
      unregisterWindow,
      openWindow,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      focusWindow,
      moveWindow,
      resizeWindow,
      moveResizeWindow,
      updateWindow,
      visibleWindows,
      openWindows,
      taskbarWindows,
      hasOpenScanReport,
    ],
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager(): WindowManagerContextValue {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return ctx;
}

/** Hook for a single window's state — memoized to avoid re-renders of other windows */
export function useWindowState(id: string): WindowState | undefined {
  const { windows } = useWindowManager();
  return windows[id];
}
