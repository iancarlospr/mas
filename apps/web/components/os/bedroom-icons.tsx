'use client';

import {
  Info,
  ShieldCheck,
  CircleDollarSign,
  Popcorn,
  FolderDown,
  MessageCircleMore,
  Radar,
  SmilePlus,
  WandSparkles,
  BookOpenText,
  Gamepad2,
  Trash2,
  LogIn,
  UserCircle,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/* =================================================================
   Chloe's Bedroom OS — Desktop Icons (Lucide)
   ================================================================= */

const BEDROOM_ICONS: Record<string, React.FC<LucideProps>> = {
  'about':         Info,
  'products':      ShieldCheck,
  'pricing':       CircleDollarSign,
  'customers':     SmilePlus,
  'chill':         Popcorn,
  'history':       FolderDown,
  'chat-launcher': MessageCircleMore,
  'scan-input':    Radar,
  'features':      WandSparkles,
  'blog':          BookOpenText,
  'games':         Gamepad2,
  'trash':         Trash2,
  'auth':          LogIn,
  'profile':       UserCircle,
};

/**
 * Get the Lucide icon for a window ID.
 * Falls back to a generic dot if the ID isn't mapped.
 */
export function BedroomIcon({ windowId, size = 24, className }: { windowId: string; size?: number; className?: string }) {
  const IconComponent = BEDROOM_ICONS[windowId];
  if (!IconComponent) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return <IconComponent size={size} strokeWidth={1.5} className={className} />;
}

export { BEDROOM_ICONS };
