import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Alpha Scan — Forensic Marketing Intelligence',
    short_name: 'Alpha Scan',
    description: 'Reverse-engineer any marketing stack in 90 seconds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080808',
    theme_color: '#FFB2EF',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
