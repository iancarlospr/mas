import type { Config } from 'tailwindcss';

/**
 * GhostScan OS — Tailwind Configuration
 *
 * Color space: OKLCH (defined in globals.css as CSS variables)
 * Aesthetic: Win95 × PostHog × MSCHF
 *
 * Colors are referenced via CSS variables for OKLCH support.
 * Tailwind doesn't natively support OKLCH, so we bridge with var() references.
 */

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* ── Colors (mapped to OKLCH CSS variables) ──────────── */
      colors: {
        gs: {
          black:      'var(--gs-black)',
          dark:       'var(--gs-dark)',
          'mid-dark': 'var(--gs-mid-dark)',
          mid:        'var(--gs-mid)',
          'mid-light':'var(--gs-mid-light)',
          light:      'var(--gs-light)',
          'near-white':'var(--gs-near-white)',
          white:      'var(--gs-white)',
          cyan:       'var(--gs-cyan)',
          fuchsia:    'var(--gs-fuchsia)',
          terminal:   'var(--gs-terminal)',
          critical:   'var(--gs-critical)',
          warning:    'var(--gs-warning)',
        },
        /* Legacy aliases for gradual migration */
        background: 'var(--gs-near-white)',
        surface:    'var(--gs-white)',
        border:     'var(--gs-mid)',
      },

      /* ── Font Families ──────────────────────────────────── */
      fontFamily: {
        system:      ['var(--font-system)', 'Pixelify Sans', 'monospace'],
        data:        ['var(--font-data)', 'JetBrains Mono', 'monospace'],
        personality: ['var(--font-personality)', 'Permanent Marker', 'cursive'],
        /* Legacy aliases */
        mono:        ['var(--font-data)', 'JetBrains Mono', 'monospace'],
      },

      /* ── Font Sizes (Retro OS Scale) ────────────────────── */
      fontSize: {
        /* OS Chrome (pixel font) */
        'os-xs':      ['10px', { lineHeight: '1.0' }],
        'os-sm':      ['12px', { lineHeight: '1.2' }],
        'os-base':    ['14px', { lineHeight: '1.0' }],
        'os-lg':      ['16px', { lineHeight: '1.0' }],
        'os-xl':      ['24px', { lineHeight: '1.0' }],

        /* Data (JetBrains Mono) */
        'data-xs':    ['11px', { lineHeight: '1.4' }],
        'data-sm':    ['13px', { lineHeight: '1.4' }],
        'data-base':  ['14px', { lineHeight: '1.5' }],
        'data-lg':    ['15px', { lineHeight: '1.7' }],
        'data-xl':    ['18px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'data-2xl':   ['24px', { lineHeight: '1.0', letterSpacing: '-0.01em', fontWeight: '700' }],
        'data-hero':  ['48px', { lineHeight: '1.0', letterSpacing: '-0.02em', fontWeight: '800' }],

        /* Personality (Chloé's font) */
        'chloe':      ['16px', { lineHeight: '1.4' }],
        'chloe-lg':   ['20px', { lineHeight: '1.3' }],
        'chloe-xl':   ['28px', { lineHeight: '1.2' }],
      },

      /* ── Spacing (Pixel-perfect multiples of 4) ─────────── */
      spacing: {
        'gs-1': '4px',
        'gs-2': '8px',
        'gs-3': '12px',
        'gs-4': '16px',
        'gs-5': '20px',
        'gs-6': '24px',
        'gs-8': '32px',
        'gs-10': '40px',
        'gs-12': '48px',
        'gs-16': '64px',
        /* OS component heights */
        'titlebar': '24px',
        'menubar':  '28px',
        'taskbar':  '36px',
        'statusbar': '22px',
      },

      /* ── Shadows (Retro + Ghost) ────────────────────────── */
      boxShadow: {
        'bevel': 'inset 1px 1px 0 var(--gs-white), inset -1px -1px 0 var(--gs-mid)',
        'bevel-sunken': 'inset 1px 1px 0 var(--gs-mid), inset -1px -1px 0 var(--gs-white)',
        'window': 'inset 1px 1px 0 var(--gs-white), inset -1px -1px 0 var(--gs-mid), 3px 3px 12px oklch(0 0 0 / 0.08)',
        'ghost-glow': '0 0 20px oklch(0.82 0.12 192 / 0.15), 3px 3px 12px oklch(0 0 0 / 0.08)',
        'ghost-glow-strong': '0 0 30px oklch(0.82 0.18 192 / 0.25), 0 0 60px oklch(0.82 0.12 192 / 0.1)',
        'fuchsia-glow': '0 0 20px oklch(0.65 0.18 350 / 0.2)',
      },

      /* ── Border Radius (Retro = no radius, mostly) ──────── */
      borderRadius: {
        'none': '0px',
        'gs':   '0px',      /* Default for OS chrome */
        'pill': '9999px',   /* For traffic dots */
        DEFAULT: '0px',
      },

      /* ── Animations ─────────────────────────────────────── */
      animation: {
        'blink': 'blink 1s step-end infinite',
        'ghost-float': 'ghost-float 3s ease-in-out infinite',
        'ghost-pulse': 'ghost-pulse 2s ease-in-out infinite',
        'scan-bar': 'scan-bar 2s linear infinite',
        'terminal-type': 'terminal-type 0.05s steps(1) forwards',
        'window-open': 'window-open 0.15s ease-out forwards',
        'shake': 'shake 0.3s ease-in-out',
        'laser': 'laser 0.5s ease-out forwards',
      },
      keyframes: {
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'ghost-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'ghost-pulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px var(--gs-cyan))' },
          '50%': { filter: 'drop-shadow(0 0 20px var(--gs-cyan)) drop-shadow(0 0 40px oklch(0.82 0.12 192 / 0.3))' },
        },
        'scan-bar': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'window-open': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'laser': {
          '0%': { width: '0', opacity: '0.8' },
          '100%': { width: '100%', opacity: '0' },
        },
      },

      /* ── Z-Index Scale (Window Manager) ─────────────────── */
      zIndex: {
        'desktop':    '0',
        'icons':      '10',
        'window':     '100',      /* Windows start here, increment per focus */
        'window-max': '500',      /* Maximized window */
        'dialog':     '600',      /* Modal dialogs */
        'chloe':      '700',      /* Chloé always above windows */
        'menubar':    '800',
        'start-menu': '850',
        'taskbar':    '800',
        'context-menu': '900',
        'tooltip':    '950',
        'noise':      '9997',
        'vignette':   '9998',
        'scanlines':  '9999',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
