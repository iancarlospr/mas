import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { GrainOverlay } from './GrainOverlay';

interface TextLine {
  text: string;
  size?: number;
  font?: 'display' | 'mono' | 'marker';
  color?: string;
  delay?: number;
}

interface Props {
  lines: TextLine[];
}

const FONT_MAP = {
  display: 'Barlow Condensed, sans-serif',
  mono: 'Geist Mono, monospace',
  marker: 'Permanent Marker, cursive',
};

const WEIGHT_MAP = {
  display: 300,
  mono: 700,
  marker: 400,
};

/**
 * Full-screen text card on dark background.
 * Each line fades in from below with optional delay.
 * Whole card fades in at start, fades out at end.
 */
export const TextCard: React.FC<Props> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Scene envelope
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const envelope = fadeIn * fadeOut;

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
          padding: '0 80px',
          gap: 16,
          opacity: envelope,
        }}
      >
        {lines.map((line, i) => {
          const delay = line.delay ?? 0;
          const lineOpacity = interpolate(frame, [delay, delay + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const lineY = interpolate(frame, [delay, delay + 22], [25, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const font = line.font ?? 'display';
          const letterSpacing = font === 'marker' ? '0.04em' : font === 'mono' ? '-0.02em' : '-0.01em';

          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                transform: `translateY(${lineY}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MAP[font],
                  fontSize: line.size ?? 48,
                  fontWeight: WEIGHT_MAP[font],
                  color: line.color ?? C.light,
                  letterSpacing,
                  textAlign: 'center',
                  display: 'block',
                  textShadow: line.color === C.base
                    ? '0 0 40px rgba(255,178,239,0.25)'
                    : 'none',
                }}
              >
                {line.text}
              </span>
            </div>
          );
        })}
      </div>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
