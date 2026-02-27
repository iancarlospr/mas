import type { Config } from 'tailwindcss';

/**
 * Chloe's Bedroom OS — Tailwind Configuration
 *
 * Palette: Monochromatic Pink (OKLCH hue 340)
 * Anchored on #080808 (void) and #FFB2EF (base)
 */

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* -- Colors -------------------------------------------- */
      colors: {
        gs: {
          void:         'var(--gs-void)',
          deep:         'var(--gs-deep)',
          mid:          'var(--gs-mid)',
          base:         'var(--gs-base)',
          bright:       'var(--gs-bright)',
          light:        'var(--gs-light)',
          /* Backward-compatible aliases */
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
        background: 'var(--gs-void)',
        surface:    'var(--gs-deep)',
        border:     'var(--gs-mid)',
      },

      /* -- Font Families ------------------------------------ */
      fontFamily: {
        display:     ['var(--font-display)', 'Barlow Condensed', 'sans-serif'],
        system:      ['var(--font-system)', 'Geist Mono', 'monospace'],
        data:        ['var(--font-data)', 'Geist Mono', 'monospace'],
        personality: ['var(--font-personality)', 'Permanent Marker', 'cursive'],
        mono:        ['var(--font-data)', 'Geist Mono', 'monospace'],
      },

      /* -- Font Sizes --------------------------------------- */
      fontSize: {
        /* Display (Barlow Condensed — viewport-scaled headlines) */
        'display-sm':  ['clamp(20px, 3vw, 28px)', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.03em' }],
        'display-base':['clamp(28px, 4vw, 36px)', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.03em' }],
        'display-lg':  ['clamp(36px, 5vw, 52px)', { lineHeight: '1.0', fontWeight: '700', letterSpacing: '-0.03em' }],
        'display-xl':  ['clamp(48px, 6vw, 72px)', { lineHeight: '1.0', fontWeight: '800', letterSpacing: '-0.03em' }],
        'display-hero':['clamp(56px, 8vw, 96px)', { lineHeight: '0.95', fontWeight: '800', letterSpacing: '-0.03em' }],

        /* OS Chrome (Geist Mono) */
        'os-xs':      ['10px', { lineHeight: '1.2' }],
        'os-sm':      ['12px', { lineHeight: '1.3' }],
        'os-base':    ['13px', { lineHeight: '1.3' }],
        'os-lg':      ['15px', { lineHeight: '1.2' }],
        'os-xl':      ['24px', { lineHeight: '1.1' }],

        /* Data (Geist Mono) */
        'data-xs':    ['11px', { lineHeight: '1.5' }],
        'data-sm':    ['12px', { lineHeight: '1.5' }],
        'data-base':  ['13px', { lineHeight: '1.6' }],
        'data-lg':    ['15px', { lineHeight: '1.6' }],
        'data-xl':    ['18px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'data-2xl':   ['24px', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '700' }],
        'data-hero':  ['48px', { lineHeight: '1.0', letterSpacing: '-0.02em', fontWeight: '800' }],

        /* Personality (Chloe) */
        'chloe':      ['16px', { lineHeight: '1.4' }],
        'chloe-lg':   ['20px', { lineHeight: '1.3' }],
        'chloe-xl':   ['28px', { lineHeight: '1.2' }],
      },

      /* -- Spacing ------------------------------------------ */
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
        'titlebar': '32px',
        'menubar':  '32px',
        'taskbar':  '40px',
        'statusbar': '24px',
      },

      /* -- Shadows ------------------------------------------ */
      boxShadow: {
        'window':      '0 4px 24px oklch(0.08 0.01 340 / 0.4), 0 1px 4px oklch(0.08 0.01 340 / 0.3)',
        'window-active': '0 0 0 1px oklch(0.82 0.15 340 / 0.15), 0 4px 24px oklch(0.08 0.01 340 / 0.5), 0 0 32px oklch(0.82 0.15 340 / 0.08)',
        'window-float': '0 8px 32px oklch(0.08 0.01 340 / 0.5)',
        'ghost-glow':   '0 0 16px oklch(0.82 0.15 340 / 0.2)',
        'pink-glow':    '0 0 16px oklch(0.82 0.15 340 / 0.3)',
        'bevel':        '0 1px 3px oklch(0.08 0.01 340 / 0.3)',
        'bevel-sunken': 'inset 0 1px 3px oklch(0.08 0.01 340 / 0.3)',
      },

      /* -- Border Radius ------------------------------------ */
      borderRadius: {
        'none':    '0px',
        'gs':      '8px',
        'gs-lg':   '12px',
        'pill':    '9999px',
        DEFAULT:   '8px',
      },

      /* -- Animations --------------------------------------- */
      animation: {
        'blink':           'blink 1s step-end infinite',
        'ghost-float':     'ghost-float 3s ease-in-out infinite',
        'ghost-pulse':     'ghost-pulse 2s ease-in-out infinite',
        'scan-bar':        'scan-bar 2s linear infinite',
        'terminal-type':   'terminal-type 0.05s steps(1) forwards',
        'window-open':     'window-open 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'window-close':    'window-close 0.15s ease-in forwards',
        'shake':           'shake 0.3s ease-in-out',
        'laser':           'laser 0.5s ease-out forwards',
        'slide-up':        'slide-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in':         'fade-in 0.2s ease-out forwards',
        'pink-pulse':      'pink-pulse 2s ease-in-out infinite',
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
          '0%, 100%': { filter: 'drop-shadow(0 0 8px var(--gs-base))' },
          '50%': { filter: 'drop-shadow(0 0 16px var(--gs-base)) drop-shadow(0 0 32px oklch(0.82 0.15 340 / 0.3))' },
        },
        'scan-bar': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'window-open': {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'window-close': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
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
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pink-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px oklch(0.82 0.15 340 / 0.1)' },
          '50%': { boxShadow: '0 0 24px oklch(0.82 0.15 340 / 0.25)' },
        },
      },

      /* -- Z-Index Scale ------------------------------------ */
      zIndex: {
        'desktop':      '0',
        'icons':        '10',
        'window':       '100',
        'window-max':   '500',
        'dialog':       '600',
        'chloe':        '700',
        'menubar':      '800',
        'start-menu':   '850',
        'taskbar':      '800',
        'context-menu': '900',
        'tooltip':      '950',
        'noise':        '9997',
        'vignette':     '9998',
        'scanlines':    '9999',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
