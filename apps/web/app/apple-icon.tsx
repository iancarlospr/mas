import { ImageResponse } from 'next/og';

/**
 * Chloe's Bedroom OS — Apple Touch Icon (180x180)
 *
 * Pink monochrome Chloe ghost with glow on void background.
 * Pixel art rendered at high resolution for crisp iOS home screen icon.
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
          backgroundColor: '#080808',
          position: 'relative',
        }}
      >
        {/* Pink glow behind ghost */}
        <div
          style={{
            position: 'absolute',
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,178,239,0.2) 0%, transparent 70%)',
            top: '25px',
            left: '25px',
          }}
        />

        {/* Pixel art ghost — rendered as stacked divs for crisp edges */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: 'scale(1)',
          }}
        >
          {/* Ghost body — simplified pixel art */}
          <svg width="100" height="120" viewBox="0 0 16 20" style={{ imageRendering: 'pixelated' as 'auto' }}>
            {/* Body */}
            <rect x="4" y="0" width="8" height="2" fill="#FFF0FA"/>
            <rect x="2" y="2" width="12" height="2" fill="#FFF0FA"/>
            <rect x="1" y="4" width="14" height="2" fill="#FFF0FA"/>
            <rect x="1" y="6" width="14" height="2" fill="#FFF0FA"/>
            <rect x="1" y="8" width="14" height="2" fill="#FFF0FA"/>
            <rect x="1" y="10" width="14" height="2" fill="#FFF0FA"/>
            <rect x="1" y="12" width="14" height="2" fill="#FFF0FA"/>
            {/* Wave bottom */}
            <rect x="1" y="14" width="3" height="3" fill="#FFF0FA"/>
            <rect x="6" y="14" width="4" height="3" fill="#FFF0FA"/>
            <rect x="12" y="14" width="3" height="3" fill="#FFF0FA"/>
            {/* Eyes */}
            <rect x="3" y="6" width="3" height="3" fill="#FFB2EF"/>
            <rect x="10" y="6" width="3" height="3" fill="#FFB2EF"/>
            {/* Eye highlights */}
            <rect x="4" y="7" width="1" height="1" fill="white"/>
            <rect x="11" y="7" width="1" height="1" fill="white"/>
            {/* Mouth */}
            <rect x="6" y="10" width="4" height="1" fill="#1A161A" opacity="0.3"/>
          </svg>
        </div>

        {/* Bottom pink accent strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #1A161A, #FFB2EF, #1A161A)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
