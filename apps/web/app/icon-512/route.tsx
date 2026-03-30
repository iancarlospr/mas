import { ImageResponse } from 'next/og';

/**
 * Android Icon (512×512)
 *
 * Exact replica of icon.svg — same ghost body, outline, eyes,
 * highlights, mouth, tail, shading, blush, and glow.
 */

export const runtime = 'edge';

export async function GET() {
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
        {/* Radial bg glow (icon.svg bg-glow gradient) */}
        <div style={{ position: 'absolute', width: '512px', height: '512px', background: 'radial-gradient(ellipse at 50% 45%, #1A161A 0%, #080808 100%)' }} />

        {/* Glow halo (icon.svg ellipse) */}
        <div style={{ position: 'absolute', width: '320px', height: '350px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,178,239,0.08) 0%, transparent 70%)', top: '60px', left: '96px' }} />

        {/* Ghost — icon.svg viewBox="0 0 32 32" */}
        <svg width="380" height="400" viewBox="0 0 32 32" style={{ imageRendering: 'pixelated' as 'auto', position: 'relative' }}>
          {/* Body (#FFF0FA) */}
          <rect x="12" y="4" width="8" height="2" fill="#FFF0FA"/>
          <rect x="10" y="6" width="12" height="2" fill="#FFF0FA"/>
          <rect x="8" y="8" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="10" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="12" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="14" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="16" width="16" height="2" fill="#FFF0FA"/>
          <rect x="8" y="18" width="16" height="2" fill="#FFF0FA"/>
          {/* Eyes (#FFB2EF) */}
          <rect x="10" y="10" width="4" height="4" fill="#FFB2EF"/>
          <rect x="18" y="10" width="4" height="4" fill="#FFB2EF"/>
          <rect x="11" y="11" width="1" height="1" fill="#FFFFFF"/>
          <rect x="19" y="11" width="1" height="1" fill="#FFFFFF"/>
          {/* Mouth */}
          <rect x="13" y="16" width="6" height="1" fill="#1A161A" opacity="0.4"/>
          {/* Tail */}
          <rect x="8" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="14" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="20" y="20" width="4" height="4" fill="#FFF0FA"/>
          <rect x="12" y="20" width="2" height="2" fill="#FFF0FA"/>
          <rect x="18" y="20" width="2" height="2" fill="#FFF0FA"/>
          {/* Outline (#1A161A) */}
          <rect x="10" y="4" width="2" height="2" fill="#1A161A"/>
          <rect x="20" y="4" width="2" height="2" fill="#1A161A"/>
          <rect x="8" y="6" width="2" height="2" fill="#1A161A"/>
          <rect x="22" y="6" width="2" height="2" fill="#1A161A"/>
          <rect x="6" y="8" width="2" height="14" fill="#1A161A"/>
          <rect x="24" y="8" width="2" height="14" fill="#1A161A"/>
          <rect x="6" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="12" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="18" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="24" y="22" width="2" height="2" fill="#1A161A"/>
          <rect x="8" y="24" width="4" height="2" fill="#1A161A"/>
          <rect x="14" y="24" width="4" height="2" fill="#1A161A"/>
          <rect x="20" y="24" width="4" height="2" fill="#1A161A"/>
          {/* Shading */}
          <rect x="8" y="18" width="16" height="2" fill="#FFCAF3" opacity="0.5"/>
          {/* Blush */}
          <rect x="9" y="14" width="2" height="1" fill="#FFB2EF" opacity="0.3"/>
          <rect x="21" y="14" width="2" height="1" fill="#FFB2EF" opacity="0.3"/>
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
