import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/about', '/blog', '/privacy', '/terms'],
        disallow: [
          '/scan/',
          '/report/',
          '/chat/',
          '/history',
          '/login',
          '/register',
          '/verify',
          '/api/',
          '/auth/',
          '/ingest/',
        ],
      },
    ],
    sitemap: 'https://marketingalphascan.com/sitemap.xml',
  };
}
