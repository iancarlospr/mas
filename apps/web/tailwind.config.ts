import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A1A2E',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#16213E',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#0F3460',
          foreground: '#FFFFFF',
        },
        highlight: {
          DEFAULT: '#E94560',
          foreground: '#FFFFFF',
        },
        success: '#06D6A0',
        warning: '#FFD166',
        error: '#EF476F',
        background: '#FAFBFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        muted: {
          DEFAULT: '#94A3B8',
          foreground: '#64748B',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Plus Jakarta Sans', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['4rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'h1': ['4rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'h2': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'h3': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h4': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        'micro': ['0.75rem', { lineHeight: '1.5' }],
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'lg': '0 10px 15px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05)',
        'xl': '0 20px 25px rgba(0,0,0,0.06), 0 8px 10px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        DEFAULT: '1rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-up': 'count-up 2s ease-out forwards',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
