/**
 * GhostScan OS — Component Library
 *
 * The operating system shell that IS the app.
 * Everything is a window. Every interaction is a program.
 */

// Core window system
export { Window, ModulePanel, DialogWindow } from './window';
export type { WindowProps, ModulePanelProps, DialogWindowProps } from './window';

// Desktop environment
export { Desktop } from './desktop';
export type { DesktopProps, DesktopProgram } from './desktop';

// OS chrome
export { MenuBar } from './menu-bar';
export { Taskbar } from './taskbar';
export { DesktopIcon } from './desktop-icon';
export { ContextMenu } from './context-menu';
export type { ContextMenuItem } from './context-menu';

// Primitives
export { BevelInput } from './bevel-input';
export { ProgressBar } from './progress-bar';

// Easter eggs & extras
export { EasterEggs } from './easter-eggs';
export { RadioPlayer } from './radio-player';
export { MobileGate } from './mobile-gate';
