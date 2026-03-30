import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

/**
 * Film grain + scanline overlay.
 * Animated noise via SVG filter with shifting seed each frame.
 */
export const GrainOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const seed = frame % 100; // cycle seed for animated noise

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay' }}>
      {/* SVG noise grain */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>

      {/* Subtle scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,178,239,0.008) 3px, rgba(255,178,239,0.008) 6px)',
        }}
      />
    </AbsoluteFill>
  );
};
