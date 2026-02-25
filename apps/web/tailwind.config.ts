import type { Config } from 'tailwindcss';

/**
 * GhostScan OS — Tailwind Configuration
 *
 * Palette: "Classified File on Gallery Paper"
 * Kruger × MSCHF × Valentino red on warm cream
 *
 * Colors are hex CSS variables (no OKLCH for Tailwind compat).
 * Functional colors (terminal/critical/warning) remain OKLCH in globals.css.
 */

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* ── Colors ──────────────────────────────────────────── */
      colors: {
        gs: {
          paper:        'var(--gs-paper)',
          ink:          'var(--gs-ink)',
          red:          'var(--gs-red)',
          'red-dark':   'var(--gs-red-dark)',
          chrome:       'var(--gs-chrome)',
          'chrome-dark':'var(--gs-chrome-dark)',
          'chrome-light':'var(--gs-chrome-light)',
          muted:        'var(--gs-muted)',
          ghost:        'var(--gs-ghost)',
          terminal:     'var(--gs-terminal)',
          critical:     'var(--gs-critical)',
          warning:      'var(--gs-warning)',
        },
        /* Semantic aliases */
        background: 'var(--gs-paper)',
        surface:    'var(--gs-paper)',
        border:     'var(--gs-chrome-dark)',
      },

      /* ── Font Families ──────────────────────────────────── */
      fontFamily: {
        display:     ['var(--font-display)', 'Instrument Serif', 'Georgia', 'serif'],
        system:      ['var(--font-system)', 'Pixelify Sans', 'monospace'],
        data:        ['var(--font-data)', 'JetBrains Mono', 'monospace'],
        personality: ['var(--font-personality)', 'Permanent Marker', 'cursive'],
        mono:        ['var(--font-data)', 'JetBrains Mono', 'monospace'],
      },

      /* ── Font Sizes ─────────────────────────────────────── */
      fontSize: {
        /* Display (Instrument Serif) */
        'display-sm':  ['24px', { lineHeight: '1.1', fontWeight: '400' }],
        'display-base':['32px', { lineHeight: '1.1', fontWeight: '400' }],
        'display-lg':  ['48px', { lineHeight: '1.0', fontWeight: '400' }],
        'display-xl':  ['64px', { lineHeight: '1.0', fontWeight: '400' }],
        'display-hero':['80px', { lineHeight: '0.95', fontWeight: '400' }],

        /* OS Chrome (Pixelify Sans) */
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

        /* Personality (Chloe) */
        'chloe':      ['16px', { lineHeight: '1.4' }],
        'chloe-lg':   ['20px', { lineHeight: '1.3' }],
        'chloe-xl':   ['28px', { lineHeight: '1.2' }],
      },

      /* ── Spacing ────────────────────────────────────────── */
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
        'titlebar': '24px',
        'menubar':  '28px',
        'taskbar':  '36px',
        'statusbar': '22px',
      },

      /* ── Shadows ────────────────────────────────────────── */
      boxShadow: {
        'bevel': 'inset 1px 1px 0 var(--gs-chrome-light), inset -1px -1px 0 var(--gs-muted)',
        'bevel-sunken': 'inset 1px 1px 0 var(--gs-muted), inset -1px -1px 0 var(--gs-chrome-light)',
        'window': 'inset 1px 1px 0 var(--gs-chrome-light), inset -1px -1px 0 var(--gs-muted), 4px 4px 0 rgba(0,0,0,0.08)',
        'window-float': '4px 4px 0 rgba(0,0,0,0.08), 8px 8px 24px rgba(0,0,0,0.06)',
        'ghost-glow': '0 0 16px rgba(224, 240, 255, 0.2)',
      },

      /* ── Border Radius ──────────────────────────────────── */
      borderRadius: {
        'none': '0px',
        'gs':   '0px',
        'pill': '9999px',
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
          '0%, 100%': { filter: 'drop-shadow(0 0 8px var(--gs-ghost))' },
          '50%': { filter: 'drop-shadow(0 0 16px var(--gs-ghost)) drop-shadow(0 0 32px rgba(224,240,255,0.2))' },
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

      /* ── Z-Index Scale ──────────────────────────────────── */
      zIndex: {
        'desktop':    '0',
        'icons':      '10',
        'window':     '100',
        'window-max': '500',
        'dialog':     '600',
        'chloe':      '700',
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
