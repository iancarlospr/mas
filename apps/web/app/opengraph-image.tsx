import { ImageResponse } from 'next/og';

/**
 * GhostScan OS — Dynamic OG Image
 * ═══════════════════════════════════════
 *
 * WHAT: Social share image generated at build time via Next.js ImageResponse.
 * WHY:  Every shared link should look like a GhostScan OS screenshot — dark
 *       background, Chloé ghost, brand typography, cyan/fuchsia accent.
 * HOW:  Edge runtime ImageResponse with inline styles (Satori doesn't
 *       support CSS variables, so we use resolved OKLCH/hex values).
 */

export const runtime = 'edge';
export const alt = 'AlphaScan — Forensic Marketing Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1a17',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* Gradient accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #00e5ff, #e040fb)',
          }}
        />

        {/* Ghost emoji as placeholder for Chloé */}
        <div style={{ fontSize: '96px', marginBottom: '24px' }}>
          👻
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #00e5ff, #e040fb)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '16px',
          }}
        >
          AlphaScan
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: '#a8a49b',
            letterSpacing: '0.05em',
          }}
        >
          Forensic Marketing Intelligence
        </div>

        {/* Bottom details */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            display: 'flex',
            gap: '32px',
            fontSize: '16px',
            color: '#6b6760',
          }}
        >
          <span>42 Forensic Modules</span>
          <span>•</span>
          <span>GhostScan™ Detection</span>
          <span>•</span>
          <span>AI Synthesis</span>
        </div>

        {/* Gradient accent line at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #e040fb, #00e5ff)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
