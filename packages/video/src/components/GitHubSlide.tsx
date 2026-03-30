import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';

interface Props {
  src: string;
}

/**
 * GitHub contribution screenshot on white card.
 * Just "GitHub" label — the image already shows year + contribution count.
 */
export const GitHubSlide: React.FC<Props> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, 25], [0.96, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelOp = interpolate(frame, [8, 22], [0, 1], {
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
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${scale})`,
        }}
      >
        {/* "GitHub" label */}
        <div
          style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 28,
            color: C.light,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 24,
            opacity: labelOp * 0.9,
          }}
        >
          GitHub
        </div>

        {/* White card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '40px 60px',
            boxShadow: '0 4px 40px rgba(255,178,239,0.08), 0 0 0 1px rgba(255,255,255,0.1)',
            maxWidth: 1400,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: 1280,
              maxHeight: 400,
              imageRendering: 'auto',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
