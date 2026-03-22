import { ImageResponse } from 'next/og';

/**
 * Apple Touch Icon (180×180)
 *
 * Uses the EXACT same Chloé ghost pixel art from icon.svg —
 * same body, outline, eyes, highlights, blush, tail, and glow.
 * Scaled up from the 32×32 grid to 180×180 for iOS home screen.
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
          borderRadius: '36px',
        }}
      >
        {/* Radial background glow (matches icon.svg bg-glow) */}
        <div
          style={{
            position: 'absolute',
            width: '180px',
            height: '180px',
            borderRadius: '36px',
            background: 'radial-gradient(ellipse at 50% 45%, #1A161A 0%, #080808 100%)',
          }}
        />

        {/* Outer glow halo (matches icon.svg) */}
        <div
          style={{
            position: 'absolute',
            width: '120px',
            height: '132px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,178,239,0.08) 0%, transparent 70%)',
            top: '20px',
            left: '30px',
          }}
        />

        {/* Ghost — exact replica of icon.svg pixel art, scaled to fill */}
        <svg width="140" height="160" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' as 'auto', position: 'relative' }}>
          {/* Ghost body (near-white pink #FFF0FA) */}
          <rect x="12" y="4" width="8" height="2" fill="#FFF0FA"/>
          <rect x="10" y="6" width="12" height="2" fill="#FFF0FA"/>
          <rect x="8" y="8" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="10" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="12" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="14" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="16" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="18" width="16" height="2" fill="#FFF0FA"/>

          {/* Eyes (bright pink #FFB2EF — THE color) */}
          <rect x="10" y="10" width="4" height="4" fill="#FFB2EF"/>
          <rect x="18" y="10" width="4" height="4" fill="#FFB2EF"/>
          {/* Eye highlights (white) */}
          <rect x="11" y="11" width="1" height="1" fill="#FFFFFF"/>
          <rect x="19" y="11" width="1" height="1" fill="#FFFFFF"/>

          {/* Mouth (subtle smile) */}
          <rect x="13" y="16" width="6" height="1" fill="#1A161A" opacity="0.4"/>

          {/* Ghost tail — wavy bottom */}
          <rect x="8" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="14" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="20" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="12" y="20" width="2" height="2" fill="#FFF0FA"/>
          <rect x="18" y="20" width="2" height="2" fill="#FFF0FA"/>

          {/* Outline (deep neutral #1A161A) */}
          <rect x="10" y="4" width="2" height="2" fill="#1A161A"/>
          <rect x="20" y="4" width="2" height="2" fill="#1A161A"/>
          <rect x="8" y="6" width="2" height="2" fill="#1A161A"/>
          <rect x="22" y="6" width="2" height="2" fill="#1A161A"/>
          <rect x="6" y="8" width="2" height="14" fill="#1A161A"/>
          <rect x="24" y="8" width="2" height="14" fill="#1A161A"/>

          {/* Bottom outline */}
          <rect x="6" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="12" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="18" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="24" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="8" y="24" width="4" height="2" fill="#1A161A"/>
          <rect x="14" y="24" width="4" height="2" fill="#1A161A"/>
          <rect x="20" y="24" width="4" height="2" fill="#1A161A"/>

          {/* Body shading */}
          <rect x="8" y="18" width="16" height="2" fill="#FFCAF3" opacity="0.5"/>

          {/* Blush marks */}
          <rect x="9" y="14" width="2" height="1" fill="#FFB2EF" opacity="0.3"/>
          <rect x="21" y="14" width="2" height="1" fill="#FFB2EF" opacity="0.3"/>
        </svg>
      </div>
    ),
    { ...size },
  );
}
