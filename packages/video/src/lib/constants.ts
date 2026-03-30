/** Video dimensions — 1080p vertical (Instagram Reels / TikTok) */
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

/** Scene durations in frames (at 30fps) */
export const SCENE = {
  /** Scene 1: Chloé appears + hook text */
  hook: 4 * FPS,            // 4s (120 frames)
  /** Scene 2: URL typed into scan.exe window */
  scanInput: 5 * FPS,       // 5s (150 frames)
  /** Scene 3: Matrix rain + terminal boot + module extraction */
  scanSequence: 10 * FPS,   // 10s (300 frames)
  /** Scene 4: Report slides reveal — title, verdict, module cards */
  reportReveal: 12 * FPS,   // 12s (360 frames)
  /** Scene 5: Paid unlock — frosted overlay lifts, synthesis slides */
  paidUnlock: 7 * FPS,      // 7s (210 frames)
  /** Scene 6: CTA — domain + tagline */
  cta: 5 * FPS,             // 5s (150 frames)
} as const;

export const TOTAL_DURATION =
  SCENE.hook +
  SCENE.scanInput +
  SCENE.scanSequence +
  SCENE.reportReveal +
  SCENE.paidUnlock +
  SCENE.cta;

/** Brand colors — resolved hex for canvas/SVG (no CSS vars in Remotion render) */
export const COLOR = {
  void: '#080808',
  deep: '#2A1F27',
  mid: '#4A3844',
  base: '#FFB2EF',
  bright: '#FFC8F4',
  light: '#FFF0FA',
  terminal: '#00FF88',
  critical: '#FF5050',
  warning: '#FFC800',
  white: '#FFFFFF',
} as const;

/** Domain used throughout the video */
export const DEMO_DOMAIN = 'ryder.com';
export const DEMO_URL = `https://${DEMO_DOMAIN}`;

/** ASCII brand banner */
export const ASCII_BRAND = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;
