import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { BC, IMG } from '../lib/builder-reel';
import { GrainOverlay } from './GrainOverlay';

/**
 * GitHubFlash — 4 GitHub contribution graphs.
 * Slow start → 2026 lingers longest. The payoff earns screen time.
 */

const GRAPHS = [
  { src: IMG.github2015, year: '2015', count: '2', color: BC.mid },
  { src: IMG.github2018, year: '2018', count: '11', color: BC.mid },
  { src: IMG.github2024, year: '2024', count: '76', color: BC.light },
  { src: IMG.github2026, year: '2026', count: '305', color: BC.base },
];

// Slow start → 2026 gets the most breathing room
const RATIOS = [0.18, 0.18, 0.22, 0.42]; // 2026 gets 42% of total time

export const GitHubFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Compute durations from ratios
  const durations = RATIOS.map(r => Math.round(r * durationInFrames));
  const starts: number[] = [];
  let accum = 0;
  for (const d of durations) {
    starts.push(accum);
    accum += d;
  }

  // Scene fade out
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: BC.void, opacity: fadeOut }}>
      {GRAPHS.map((graph, i) => {
        const start = starts[i]!;
        const dur = durations[i]!;
        const end = start + dur;
        const isLast = i === GRAPHS.length - 1;

        // Last graph: no fade-out (scene fadeOut handles it)
        const opacity = isLast
          ? interpolate(frame, [start, start + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : interpolate(
              frame,
              [start, start + 10, end - 8, end],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

        const localFrame = frame - start;
        if (localFrame < -10 || localFrame > dur + 15) return null;

        const scale = interpolate(frame, [start, start + 15], [0.96, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const countOpacity = interpolate(frame, [start + 5, start + 18], [0, 1], {
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
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                marginBottom: 28,
                opacity: countOpacity,
              }}
            >
              <span
                style={{
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 56,
                  fontWeight: 700,
                  color: graph.color,
                  letterSpacing: '-0.02em',
                }}
              >
                {graph.year}
              </span>
              <span
                style={{
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 36,
                  fontWeight: 400,
                  color: isLast ? BC.base : BC.mid,
                  letterSpacing: '0.02em',
                }}
              >
                {graph.count} contributions
              </span>
            </div>

            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: '36px 50px',
                boxShadow: isLast
                  ? `0 4px 40px rgba(255,178,239,0.15), 0 0 0 2px ${BC.base}33`
                  : '0 4px 40px rgba(255,178,239,0.06)',
                maxWidth: 1400,
              }}
            >
              <Img
                src={staticFile(graph.src)}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: 1280,
                  maxHeight: 350,
                  imageRendering: 'auto',
                }}
              />
            </div>
          </div>
        );
      })}

      <GrainOverlay />
    </AbsoluteFill>
  );
};
