import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,

  transpilePackages: ['@marketing-alpha/types'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // PostHog reverse proxy
  rewrites: async () => ({
    beforeFiles: [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ],
    afterFiles: [],
    fallback: [],
  }),

  // Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '0' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com",
            "style-src 'self' 'unsafe-inline'",
            "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://api.stripe.com",
            "frame-src https://challenges.cloudflare.com https://js.stripe.com",
            "img-src 'self' data: blob: https://*.supabase.co",
            "font-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://checkout.stripe.com",
            "object-src 'none'",
          ].join('; '),
        },
      ],
    },
    // Static marketing pages — edge + CDN caching (1 day, stale for 7 days)
    {
      source: '/(about|pricing|privacy|terms)',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=604800' },
        { key: 'CDN-Cache-Control', value: 'public, max-age=86400' },
      ],
    },
    // API routes — no caching
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
      ],
    },
  ],
};

export default nextConfig;
