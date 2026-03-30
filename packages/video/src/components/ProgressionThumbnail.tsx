import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { ChloeSprite } from './ChloeSprite';
import { C, P_WIDTH, P_HEIGHT } from '../lib/progression';

/**
 * LinkedIn video cover image — 1920×1080
 * Chloé with laser eyes + journey text + brand
 */

function rainbowColor(t: number): string {
  return `hsl(${(t * 360) % 360}, 100%, 65%)`;
}

export const ProgressionThumbnail: React.FC = () => {
  const frame = useCurrentFrame();

  const chloeSize = 360;
  const pxScale = chloeSize / 32;
  const chloeCenterX = P_WIDTH * 0.3;
  const chloeCenterY = P_HEIGHT * 0.48;
  const spriteLeft = chloeCenterX - chloeSize / 2;
  const leftEyeX = spriteLeft + 9.5 * pxScale;
  const rightEyeX = spriteLeft + 21.5 * pxScale;
  const eyeY = chloeCenterY - (42 * pxScale) / 2 + 14.5 * pxScale;

  // Laser target — off to the right
  const targetX = P_WIDTH * 0.85;
  const targetY = eyeY - 30;

  return (
    <AbsoluteFill style={{ background: C.void }}>
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 50%,
              rgba(255,178,239,0.08) 0%,
              rgba(255,178,239,0.04) 25%,
              rgba(255,178,239,0.01) 50%,
              transparent 75%
            )
          `,
        }}
      />

      {/* Laser beams */}
      <svg
        width={P_WIDTH}
        height={P_HEIGHT}
        style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="thumb-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
            {Array.from({ length: 10 }, (_, i) => (
              <stop key={i} offset={`${(i / 9) * 100}%`} stopColor={rainbowColor(i / 9)} />
            ))}
          </linearGradient>
          <filter id="thumb-glow">
            <feGaussianBlur stdDeviation="14" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[leftEyeX, rightEyeX].map((ex, i) => {
          const dx = targetX - ex;
          const dy = targetY - eyeY;
          const len = Math.sqrt(dx * dx + dy * dy);
          const px = -dy / len;
          const py = dx / len;
          const he = 7;
          const ht = 30;
          const points = [
            `${ex + px * he},${eyeY + py * he}`,
            `${targetX + px * ht},${targetY + py * ht}`,
            `${targetX - px * ht},${targetY - py * ht}`,
            `${ex - px * he},${eyeY - py * he}`,
          ].join(' ');
          return (
            <React.Fragment key={i}>
              <polygon points={points} fill="url(#thumb-rainbow)" opacity={0.15} filter="url(#thumb-glow)" />
              <polygon points={points} fill="url(#thumb-rainbow)" opacity={0.5} />
            </React.Fragment>
          );
        })}

        {/* Eye orbs */}
        <circle cx={leftEyeX} cy={eyeY} r={16} fill={C.base} opacity={0.9} filter="url(#thumb-glow)" />
        <circle cx={rightEyeX} cy={eyeY} r={16} fill={C.base} opacity={0.9} filter="url(#thumb-glow)" />
      </svg>

      {/* Chloé */}
      <div
        style={{
          position: 'absolute',
          top: chloeCenterY - (42 * pxScale) / 2,
          left: chloeCenterX - chloeSize / 2,
          zIndex: 5,
        }}
      >
        <ChloeSprite state="scanning" size={chloeSize} glowing={false} frame={0} />
      </div>

      {/* Right side — text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '55%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: 80,
          paddingRight: 100,
          zIndex: 15,
        }}
      >
        {/* Years */}
        <div
          style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 28,
            color: C.mid,
            letterSpacing: '0.1em',
            marginBottom: 16,
          }}
        >
          2014 → 2026
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 82,
            fontWeight: 700,
            color: C.light,
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            marginBottom: 24,
          }}
        >
          12 YEARS
          <br />
          <span style={{ color: C.base }}>ONE APP</span>
        </div>

        {/* Subline */}
        <div
          style={{
            fontFamily: 'Permanent Marker, cursive',
            fontSize: 36,
            color: C.base,
            letterSpacing: '0.04em',
            textShadow: '0 0 30px rgba(255,178,239,0.3)',
            marginBottom: 32,
          }}
        >
          A marketer who refused to quit.
        </div>

      </div>

      {/* Grain */}
      <svg width={P_WIDTH} height={P_HEIGHT} style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none', mixBlendMode: 'overlay' }}>
        <filter id="thumb-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed={42} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#thumb-grain)" />
      </svg>

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,178,239,0.008) 3px,rgba(255,178,239,0.008) 6px)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
