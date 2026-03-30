import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { BC } from '../lib/builder-reel';
import { GrainOverlay } from './GrainOverlay';

/**
 * IntroCard — Name + title only. No avatar, no logo.
 */
export const IntroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const nameOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameY = interpolate(frame, [5, 22], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: BC.void, opacity: fadeOut }}>
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          width: 600,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(255,178,239,0.06) 0%, transparent 70%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div
          style={{
            opacity: nameOpacity,
            transform: `translateY(${nameY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 72,
              fontWeight: 600,
              color: BC.light,
              letterSpacing: '-0.01em',
            }}
          >
            Ian Ramírez Rivera
          </span>
        </div>

        <div style={{ opacity: titleOpacity }}>
          <span
            style={{
              fontFamily: 'Geist Mono, monospace',
              fontSize: 22,
              color: BC.mid,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Marketing Manager & Revenue Operations
          </span>
        </div>
      </div>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
