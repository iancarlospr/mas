import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { GrainOverlay } from './GrainOverlay';

interface Props {
  stats: string[];
}

/**
 * Stats appearing one by one on dark background.
 * Each stat fades in from below with staggered timing.
 * Final stat ("Shipped.") hits harder — larger, pink.
 */
export const StatsReveal: React.FC<Props> = ({ stats }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const staggerDelay = 22; // frames between each stat

  // Scene envelope
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: C.void }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 28,
          padding: '0 60px',
          opacity: fadeOut,
        }}
      >
        {stats.map((stat, i) => {
          const startFrame = 10 + i * staggerDelay;
          const isLast = i === stats.length - 1;

          const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const y = interpolate(frame, [startFrame, startFrame + 18], [20, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: isLast ? 'Barlow Condensed, sans-serif' : 'Geist Mono, monospace',
                  fontSize: isLast ? 60 : 40,
                  fontWeight: isLast ? 700 : 400,
                  color: isLast ? C.base : C.light,
                  letterSpacing: isLast ? '0.02em' : '0.05em',
                  textTransform: 'uppercase',
                  textShadow: isLast ? '0 0 30px rgba(255,178,239,0.3)' : 'none',
                }}
              >
                {stat}
              </span>
            </div>
          );
        })}
      </div>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
