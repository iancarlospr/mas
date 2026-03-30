import type { Config } from 'tailwindcss';

/**
 * Video package Tailwind config — mirrors the web app's pink monochrome palette
 * so rendered scenes match the real product exactly.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gs: {
          void: '#080808',
          deep: '#2A1F27',
          mid: '#4A3844',
          base: '#FFB2EF',
          bright: '#FFC8F4',
          light: '#FFF0FA',
          terminal: '#00FF88',
          critical: '#FF5050',
          warning: '#FFC800',
        },
      },
      fontFamily: {
        display: ['Barlow Condensed', 'sans-serif'],
        system: ['Geist Mono', 'monospace'],
        data: ['Geist Mono', 'monospace'],
        personality: ['Permanent Marker', 'cursive'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
