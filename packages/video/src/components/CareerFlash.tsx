import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { BC, CAREER } from '../lib/builder-reel';
import { GrainOverlay } from './GrainOverlay';

/**
 * CareerFlash — cycles through career entries with logos + stats.
 * Each entry gets equal time. Logo on left, stats on right.
 * Crossfade between entries.
 */
export const CareerFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const perEntry = Math.floor(durationInFrames / CAREER.length);

  // Scene fade out
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: BC.void, opacity: fadeOut }}>
      {CAREER.map((entry, i) => {
        const start = i * perEntry;
        const end = start + perEntry;

        // Fade in / out each entry
        const opacity = interpolate(
          frame,
          [start, start + 12, end - 10, end],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const localFrame = frame - start;
        if (localFrame < -15 || localFrame > perEntry + 15) return null;

        // Slide up on enter
        const slideY = interpolate(frame, [start, start + 15], [30, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Stat counter animation
        const statOpacity = interpolate(frame, [start + 8, start + 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 80,
              padding: '0 120px',
              opacity,
              transform: `translateY(${slideY}px)`,
            }}
          >
            {/* Logo */}
            <div
              style={{
                width: 320,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {entry.logo ? (
                <Img
                  src={staticFile(entry.logo)}
                  style={{
                    maxWidth: 280,
                    maxHeight: 160,
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 72,
                    fontWeight: 700,
                    color: BC.light,
                    letterSpacing: '0.05em',
                  }}
                >
                  {entry.logoText}
                </span>
              )}
            </div>

            {/* Stats */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 28,
                  fontWeight: 300,
                  color: BC.mid,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {entry.role}
              </div>
              <div
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 42,
                  fontWeight: 600,
                  color: BC.light,
                  marginBottom: 20,
                }}
              >
                {entry.company}
              </div>
              <div style={{ opacity: statOpacity }}>
                <span
                  style={{
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 80,
                    fontWeight: 700,
                    color: BC.base,
                    letterSpacing: '-0.03em',
                    textShadow: '0 0 40px rgba(255,178,239,0.3)',
                  }}
                >
                  {entry.stat}
                </span>
                <div
                  style={{
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 20,
                    color: BC.mid,
                    letterSpacing: '0.03em',
                    marginTop: 8,
                  }}
                >
                  {entry.statLabel}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <GrainOverlay />
    </AbsoluteFill>
  );
};
