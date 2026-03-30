import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { ChloeSprite } from './ChloeSprite';
import { C, P_WIDTH, P_HEIGHT } from '../lib/progression';

/**
 * Animated Chloé with rainbow laser eyes on smooth gradient background.
 * No static screenshots — this is the live mascot.
 */

function rainbowColor(t: number): string {
  const hue = (t * 360) % 360;
  return `hsl(${hue}, 100%, 65%)`;
}

export const ChloeLaserAfter: React.FC = () => {
  const frame = useCurrentFrame();

  // Chloé position
  const floatY = Math.sin(frame * 0.08) * 8;
  const chloeSize = 320;
  const pxScale = chloeSize / 32;

  // Chloé center position
  const chloeCenterX = P_WIDTH / 2;
  const chloeCenterY = P_HEIGHT / 2 - 40;
  const chloeTop = chloeCenterY - (42 * pxScale) / 2;

  // Eye positions relative to sprite
  const spriteLeft = chloeCenterX - chloeSize / 2;
  const leftEyeX = spriteLeft + 9.5 * pxScale;
  const rightEyeX = spriteLeft + 21.5 * pxScale;
  const eyeY = chloeTop + floatY + 14.5 * pxScale;

  // Laser target — sweeps across
  const laserActive = frame >= 8;
  const laserProgress = interpolate(frame, [8, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const targetX = interpolate(laserProgress, [0, 0.3, 0.7, 1], [200, P_WIDTH - 200, P_WIDTH - 300, P_WIDTH / 2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const targetY = interpolate(laserProgress, [0, 0.5, 1], [eyeY - 50, eyeY + 100, eyeY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const laserOpacity = laserActive
    ? interpolate(frame, [8, 14, 48, 55], [0, 0.85, 0.85, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Rainbow shift
  const hueShift = frame * 10;

  // Beam dimensions
  const beamWidthEye = 12 + Math.sin(frame * 0.3) * 3;
  const beamWidthTarget = 28 + Math.sin(frame * 0.2) * 5;

  // Background glow pulse
  const glowPulse = 1 + Math.sin(frame * 0.06) * 0.15;

  const chloeFrame = Math.floor(frame / 8);

  return (
    <AbsoluteFill style={{ background: C.void }}>
      {/* Smooth background gradient — many stops to prevent banding */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 45%,
              rgba(255,178,239,0.10) 0%,
              rgba(255,178,239,0.08) 10%,
              rgba(255,178,239,0.06) 20%,
              rgba(255,178,239,0.04) 30%,
              rgba(255,178,239,0.02) 45%,
              rgba(255,178,239,0.01) 60%,
              transparent 80%
            )
          `,
          transform: `scale(${glowPulse})`,
        }}
      />

      {/* SVG laser beams */}
      {laserActive && (
        <svg
          width={P_WIDTH}
          height={P_HEIGHT}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            opacity: laserOpacity,
          }}
        >
          <defs>
            <linearGradient id="prog-laser-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              {Array.from({ length: 10 }, (_, i) => (
                <stop
                  key={i}
                  offset={`${(i / 9) * 100}%`}
                  stopColor={rainbowColor(i / 9 + hueShift / 360)}
                />
              ))}
            </linearGradient>
            <filter id="prog-laser-glow">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Left eye beam */}
          <LaserBeam
            eyeX={leftEyeX} eyeY={eyeY}
            targetX={targetX} targetY={targetY}
            widthEye={beamWidthEye} widthTarget={beamWidthTarget}
          />
          {/* Right eye beam */}
          <LaserBeam
            eyeX={rightEyeX} eyeY={eyeY}
            targetX={targetX} targetY={targetY}
            widthEye={beamWidthEye} widthTarget={beamWidthTarget}
          />

          {/* Eye orbs */}
          <circle cx={leftEyeX} cy={eyeY} r={14 + Math.sin(frame * 0.3) * 3}
            fill={C.base} opacity={0.9} filter="url(#prog-laser-glow)" />
          <circle cx={rightEyeX} cy={eyeY} r={14 + Math.sin(frame * 0.3) * 3}
            fill={C.base} opacity={0.9} filter="url(#prog-laser-glow)" />
        </svg>
      )}

      {/* Chloé sprite */}
      <div
        style={{
          position: 'absolute',
          top: chloeTop + floatY,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}
      >
        <ChloeSprite
          state={laserActive && laserOpacity > 0.3 ? 'scanning' : 'smug'}
          size={chloeSize}
          glowing={false}
          frame={laserActive ? 0 : chloeFrame}
        />
      </div>

      {/* Dither noise for anti-banding */}
      <svg width={P_WIDTH} height={P_HEIGHT} style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none', mixBlendMode: 'overlay' }}>
        <filter id="prog-dither">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed={frame % 60} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#prog-dither)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Tapered laser beam polygon */
function LaserBeam({ eyeX, eyeY, targetX, targetY, widthEye, widthTarget }: {
  eyeX: number; eyeY: number; targetX: number; targetY: number;
  widthEye: number; widthTarget: number;
}) {
  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  const px = -dy / len;
  const py = dx / len;
  const he = widthEye / 2;
  const ht = widthTarget / 2;

  const points = [
    `${eyeX + px * he},${eyeY + py * he}`,
    `${targetX + px * ht},${targetY + py * ht}`,
    `${targetX - px * ht},${targetY - py * ht}`,
    `${eyeX - px * he},${eyeY - py * he}`,
  ].join(' ');

  return (
    <>
      <polygon points={points} fill="url(#prog-laser-rainbow)" opacity={0.2} filter="url(#prog-laser-glow)" />
      <polygon points={points} fill="url(#prog-laser-rainbow)" opacity={0.6} />
    </>
  );
}
