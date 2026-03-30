import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { C } from '../lib/progression';

/**
 * Shia LaBeouf "JUST DO IT" clip.
 * Green screen background replaced with void black.
 * Video with audio, fades in/out.
 */
export const ShiaClip: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Volume: fade in, then boost the last 4 seconds (frames 460+) where Shia's voice is naturally quieter
  const baseVol = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const endBoost = frame >= 410 ? 7.0 : 1.0;
  const volume = baseVol * endBoost;

  return (
    <AbsoluteFill style={{ background: C.void, opacity: fadeIn }}>
      <AbsoluteFill
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <OffthreadVideo
          src={staticFile('shia-clip.mp4')}
          volume={volume}
          style={{
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
