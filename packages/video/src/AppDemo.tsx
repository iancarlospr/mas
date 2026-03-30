import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { GrainOverlay } from './components/GrainOverlay';

/**
 * AppDemo — Screen recording showcase with music
 *
 * Screen recording of the desktop OS app: opening windows (products, blog,
 * about, etc.) then scanning hey.com with the matrix rain scan sequence.
 *
 * Music: "Creative Technology Showreel" by Pumpupthemind (Pixabay)
 * Trimmed to just under 56 seconds.
 */

export const AD_WIDTH = 3568;
export const AD_HEIGHT = 2328;
export const AD_FPS = 30;
export const AD_DURATION_S = 53; // trim at 0:53
export const AD_TOTAL = Math.round(AD_DURATION_S * AD_FPS); // 1590 frames

/** Music layer — fade in, steady, fade out */
const MusicTrack: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(
    frame,
    [0, 20, AD_TOTAL - 45, AD_TOTAL],
    [0, 0.5, 0.5, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <Audio src={staticFile('demo-music.mp3')} volume={vol} startFrom={0} />
  );
};

export const AppDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#080808' }}>
      {/* Screen recording — plays from frame 0, trimmed by composition duration */}
      <OffthreadVideo
        src={staticFile('app-demo-recording.mp4')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        muted
      />

      {/* Music */}
      <MusicTrack />

      {/* Subtle grain overlay for consistency with other reels */}
      <GrainOverlay opacity={0.03} />
    </AbsoluteFill>
  );
};
