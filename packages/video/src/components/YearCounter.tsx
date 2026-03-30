import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { GrainOverlay } from './GrainOverlay';

interface Props {
  startYear?: number;
  endYear?: number;
}

/**
 * Rapid year counter that accelerates.
 * Conveys years slipping away — the passage of time.
 */
export const YearCounter: React.FC<Props> = ({
  startYear = 2019,
  endYear = 2023,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const progress = frame / durationInFrames;
  // Ease-in: slow start, fast end — years accelerate
  const eased = progress * progress;
  const yearIndex = Math.min(Math.floor(eased * years.length), years.length - 1);
  const year = years[yearIndex]!;

  const flashIntensity = interpolate(progress, [0, 1], [0.3, 0.7]);

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: C.void, opacity: fadeIn * fadeOut }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 200,
            fontWeight: 700,
            color: `rgba(255,178,239,${flashIntensity})`,
            letterSpacing: '-0.03em',
            textShadow: `0 0 ${30 + progress * 40}px rgba(255,178,239,${flashIntensity * 0.3})`,
          }}
        >
          {year}
        </span>
      </div>
      <GrainOverlay />
    </AbsoluteFill>
  );
};
