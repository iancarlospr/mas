import { ImageResponse } from 'next/og';

/**
 * GhostScan OS — Apple Touch Icon (180×180)
 * ═══════════════════════════════════════════
 *
 * Dynamic generation via Next.js ImageResponse so we never need
 * an external PNG. Renders a pixel-art Chloé ghost on the dark
 * GhostScan background with cyan glow — looks great on iOS home screen.
 */

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1a17',
          position: 'relative',
        }}
      >
        {/* Cyan glow behind ghost */}
        <div
          style={{
            position: 'absolute',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,229,255,0.25) 0%, transparent 70%)',
            top: '30px',
            left: '30px',
          }}
        />

        {/* Ghost emoji as icon */}
        <div style={{ fontSize: '100px', lineHeight: 1 }}>
          👻
        </div>

        {/* Bottom gradient accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #00e5ff, #e040fb)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
