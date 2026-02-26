'use client';

/* =================================================================
   Chloe's Bedroom OS — SVG Bedroom Object Icons

   12 hand-crafted monochrome line-art icons.
   Each icon represents a bedroom object with personality.
   stroke="currentColor", strokeWidth="1.5", fill="none"
   Designed at 24x24 viewBox for crisp rendering at any size.
   ================================================================= */

interface IconProps {
  className?: string;
  size?: number;
}

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Vanity mirror — ornate oval mirror on elegant stand */
function MirrorIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      <ellipse cx="12" cy="9.5" rx="5.5" ry="7" />
      <ellipse cx="12" cy="9.5" rx="4" ry="5.5" strokeWidth={0.75} opacity={0.5} />
      {/* Highlight glint */}
      <path d="M9.5 5.5c1-1.5 3-2 4.5-1" strokeWidth={1} opacity={0.4} />
      {/* Stand */}
      <path d="M12 16.5v3" />
      <path d="M8.5 21c0-1.5 1.5-2 3.5-2s3.5 0.5 3.5 2" />
      <line x1="7" y1="21" x2="17" y2="21" strokeWidth={1.75} />
    </svg>
  );
}

/** Dresser drawer — three-drawer vintage dresser */
function DresserIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect x="3" y="3" width="18" height="17" rx="1.5" />
      {/* Drawers */}
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" />
      {/* Handles — elegant ovals */}
      <ellipse cx="12" cy="6" rx="2" ry="0.6" />
      <ellipse cx="12" cy="11.75" rx="2" ry="0.6" />
      <ellipse cx="12" cy="17.25" rx="2" ry="0.6" />
      {/* Legs */}
      <line x1="5" y1="20" x2="5" y2="22" strokeWidth={2} />
      <line x1="19" y1="20" x2="19" y2="22" strokeWidth={2} />
    </svg>
  );
}

/** Piggy bank — cute side-profile piggy with coin slot */
function PiggyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Body */}
      <ellipse cx="11.5" cy="13.5" rx="7.5" ry="5.5" />
      {/* Ear */}
      <path d="M16 9.5c1.5-2 3.5-1.5 3.5 0" />
      {/* Eye */}
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
      {/* Snout */}
      <ellipse cx="19.5" cy="14" rx="2" ry="1.5" />
      <circle cx="19" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="20" cy="13.5" r="0.4" fill="currentColor" stroke="none" />
      {/* Legs */}
      <path d="M7 18.5v2.5" strokeWidth={2} />
      <path d="M10 18.5v2.5" strokeWidth={2} />
      <path d="M14 18.5v2.5" strokeWidth={2} />
      <path d="M17 18.5v2.5" strokeWidth={2} />
      {/* Coin slot */}
      <path d="M9 8.5c0.5-2 2-3 3.5-3s2.5 1 2.5 2" />
      <line x1="11" y1="5.5" x2="11" y2="8" strokeWidth={2} />
      {/* Tail */}
      <path d="M4 12.5c-1 0-1.5 1-0.5 1.5" strokeWidth={1} />
    </svg>
  );
}

/** Photo frame — framed photo on kickstand with mountain scene */
function FrameIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Outer frame */}
      <rect x="3" y="2" width="18" height="15" rx="1" strokeWidth={1.75} />
      {/* Inner mat */}
      <rect x="5" y="4" width="14" height="11" rx="0.5" strokeWidth={0.75} />
      {/* Mountain scene */}
      <path d="M5 13l4-4 3 3 2-2 5 5" strokeWidth={1} opacity={0.6} />
      <circle cx="16" cy="7" r="1.5" strokeWidth={1} opacity={0.5} />
      {/* Kickstand */}
      <path d="M10 17l-3 5" />
      <path d="M14 17l3 5" />
    </svg>
  );
}

/** Retro TV with rabbit ear antenna and channel knobs */
function TVIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Body */}
      <rect x="2" y="8" width="20" height="14" rx="2.5" />
      {/* Screen */}
      <rect x="4" y="10" width="12.5" height="10" rx="1.5" />
      {/* Screen glint */}
      <path d="M6 12c2-1 4-0.5 5 0" strokeWidth={0.75} opacity={0.3} />
      {/* Knobs */}
      <circle cx="19" cy="13" r="1.2" />
      <circle cx="19" cy="16.5" r="1.2" />
      <line x1="19" y1="12" x2="19" y2="11.5" strokeWidth={0.75} />
      {/* Antenna */}
      <line x1="8" y1="8" x2="4" y2="2" />
      <line x1="14" y1="8" x2="18" y2="2" />
      <circle cx="4" cy="2" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="18" cy="2" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bookshelf — stacked books with varied sizes, one leaning */
function BookshelfIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Shelf frame */}
      <rect x="2" y="2" width="20" height="20" rx="1" />
      <line x1="2" y1="8.5" x2="22" y2="8.5" />
      <line x1="2" y1="15" x2="22" y2="15" />
      {/* Top shelf — varied books */}
      <rect x="4" y="3" width="2.5" height="5" rx="0.3" />
      <rect x="7" y="3.5" width="2" height="4.5" rx="0.3" />
      <rect x="9.5" y="3" width="3.5" height="5" rx="0.3" />
      {/* Leaning book */}
      <path d="M14.5 8l2.5-5h1.5l-2.5 5" />
      {/* Middle shelf */}
      <rect x="4" y="9.5" width="3" height="5" rx="0.3" />
      <rect x="7.5" y="10" width="2" height="4.5" rx="0.3" />
      <rect x="10" y="9.5" width="2.5" height="5" rx="0.3" />
      <rect x="13" y="10.5" width="2" height="4" rx="0.3" />
      {/* Bottom shelf — horizontal stack + mug */}
      <rect x="4" y="18" width="5" height="1.5" rx="0.3" />
      <rect x="4" y="16.5" width="4.5" height="1.5" rx="0.3" />
      <circle cx="17" cy="18" r="2" />
      <path d="M19 17c1 0 1 2 0 2" />
    </svg>
  );
}

/** Phone — cute rotary phone with handset */
function PhoneIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Base */}
      <rect x="4" y="14" width="16" height="8" rx="3" />
      {/* Rotary dial */}
      <circle cx="12" cy="18" r="2.5" />
      <circle cx="12" cy="18" r="1" strokeWidth={0.75} />
      {/* Dial holes */}
      <circle cx="12" cy="15.8" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="16.5" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="18.2" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="19.8" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="19.8" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="18.2" r="0.4" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="16.5" r="0.4" fill="currentColor" stroke="none" />
      {/* Handset — curved on top */}
      <path d="M5 14c0-5 3.5-10 7-10s7 5 7 10" strokeWidth={1.25} />
      {/* Earpiece + mouthpiece */}
      <rect x="3.5" y="4" width="4" height="2.5" rx="1" strokeWidth={1.25} />
      <rect x="16.5" y="4" width="4" height="2.5" rx="1" strokeWidth={1.25} />
    </svg>
  );
}

/** Magnifying glass — detective style with lens glint */
function MagnifyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="5" strokeWidth={0.75} opacity={0.5} />
      {/* Lens glint */}
      <path d="M7 7c1.5-2 4-2.5 5.5-1" strokeWidth={1} opacity={0.4} />
      {/* Handle */}
      <line x1="15.5" y1="15.5" x2="21" y2="21" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

/** Poster — wall poster with thumbtack and bold star */
function PosterIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Poster paper (slightly curled corner) */}
      <path d="M5 4h14v17H5V4z" />
      <path d="M19 4v3c0 0-3 0-3-3" strokeWidth={1} />
      {/* Thumbtack */}
      <circle cx="12" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
      <line x1="12" y1="4" x2="12" y2="5.5" strokeWidth={0.75} />
      {/* Star design on poster */}
      <path d="M12 8.5l1.5 3 3 0.5-2.2 2 0.5 3L12 15.5 9.2 17l0.5-3-2.2-2 3-0.5z" strokeWidth={1} />
      {/* Text lines */}
      <line x1="8" y1="19" x2="16" y2="19" strokeWidth={0.75} opacity={0.5} />
    </svg>
  );
}

/** Diary — open diary with ribbon bookmark */
function DiaryIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Left page */}
      <path d="M3 5a1 1 0 011-1h7v17H4a1 1 0 01-1-1V5z" />
      {/* Right page */}
      <path d="M11 4h9a1 1 0 011 1v15a1 1 0 01-1 1h-9V4z" />
      {/* Spine */}
      <line x1="11" y1="4" x2="11" y2="21" strokeWidth={2} />
      {/* Text lines left */}
      <line x1="5" y1="8" x2="9" y2="8" strokeWidth={0.75} opacity={0.4} />
      <line x1="5" y1="10.5" x2="8.5" y2="10.5" strokeWidth={0.75} opacity={0.4} />
      <line x1="5" y1="13" x2="9" y2="13" strokeWidth={0.75} opacity={0.4} />
      {/* Text lines right */}
      <line x1="13" y1="8" x2="19" y2="8" strokeWidth={0.75} opacity={0.4} />
      <line x1="13" y1="10.5" x2="18" y2="10.5" strokeWidth={0.75} opacity={0.4} />
      <line x1="13" y1="13" x2="17" y2="13" strokeWidth={0.75} opacity={0.4} />
      <line x1="13" y1="15.5" x2="18.5" y2="15.5" strokeWidth={0.75} opacity={0.4} />
      {/* Ribbon bookmark */}
      <path d="M11 4c2 0 2.5 2 2.5 4v14" stroke="currentColor" strokeWidth={1.25} opacity={0.7} />
      <path d="M13.5 22l-1.5-2-1.5 2" fill="currentColor" stroke="none" opacity={0.5} />
    </svg>
  );
}

/** Game controller — retro gamepad with buttons */
function ControllerIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Body */}
      <path d="M5 8h14a4 4 0 014 4v2a4 4 0 01-4 4H5a4 4 0 01-4-4v-2a4 4 0 014-4z" />
      {/* Grip bumps */}
      <path d="M5 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path d="M13 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
      {/* D-pad */}
      <line x1="7" y1="11" x2="7" y2="15" strokeWidth={2} />
      <line x1="5" y1="13" x2="9" y2="13" strokeWidth={2} />
      {/* Action buttons */}
      <circle cx="16" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.5" r="1" strokeWidth={0.75} />
      <circle cx="19" cy="11" r="1" strokeWidth={0.75} />
    </svg>
  );
}

/** Trash can — stylish bin with lid and crumpled paper */
function TrashIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...svgBase} width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Lid */}
      <path d="M3 6h18" strokeWidth={1.75} />
      <path d="M8 6V4.5a1 1 0 011-1h6a1 1 0 011 1V6" />
      {/* Handle */}
      <path d="M10 3.5c0-1 0.5-1.5 2-1.5s2 0.5 2 1.5" strokeWidth={1} />
      {/* Body */}
      <path d="M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14" />
      {/* Ribs */}
      <line x1="10" y1="10" x2="10" y2="18" strokeWidth={1} opacity={0.5} />
      <line x1="14" y1="10" x2="14" y2="18" strokeWidth={1} opacity={0.5} />
      {/* Crumpled paper peeking out */}
      <path d="M9 6c0-1 1-2 2-1.5 1 0.5 0.5 1.5 2 1" strokeWidth={0.75} opacity={0.6} />
    </svg>
  );
}

/* -- Icon Registry -------------------------------------------- */

const BEDROOM_ICONS: Record<string, React.FC<IconProps>> = {
  'about':         MirrorIcon,
  'products':      DresserIcon,
  'pricing':       PiggyIcon,
  'customers':     FrameIcon,
  'chill':         TVIcon,
  'history':       BookshelfIcon,
  'chat-launcher': PhoneIcon,
  'scan-input':    MagnifyIcon,
  'features':      PosterIcon,
  'blog':          DiaryIcon,
  'games':         ControllerIcon,
  'trash':         TrashIcon,
};

/**
 * Get the bedroom SVG icon component for a window ID.
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
  return <IconComponent size={size} className={className} />;
}

export { BEDROOM_ICONS };
