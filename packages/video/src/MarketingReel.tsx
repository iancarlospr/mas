import React from 'react';
import {
  Sequence,
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { HookScene } from './scenes/HookScene';
import { ScanInputScene } from './scenes/ScanInputScene';
import { ScanSequenceScene } from './scenes/ScanSequenceScene';
import { ReportRevealScene } from './scenes/ReportRevealScene';
import { PaidUnlockScene } from './scenes/PaidUnlockScene';
import { CTAScene } from './scenes/CTAScene';
import { SCENE, TOTAL_DURATION, FPS } from './lib/constants';

/**
 * MarketingReel — Main composition
 *
 * Audio layers:
 *   - Background music: "Brain Implant" by VasilYatsevich (Pixabay)
 *     Ducks to 25% during typing SFX, then back to 85%
 *   - SFX: Keyboard typing (Scan Input scene, synced to URL typing)
 */

// ── Scene start frames (cumulative) ──
const SCAN_INPUT_START = SCENE.hook;

// ── Typing SFX window (absolute frames) ──
// Starts at 00:05.10 (frame 153), ends at 00:07.00 (frame 210)
const TYPING_START = 153;
const TYPING_END = 210;
const TYPING_DURATION = TYPING_END - TYPING_START;
// Duck ramp: 10 frames to fade down, 10 frames to fade back up
const DUCK_RAMP = 10;

/** Music volume — ducks during typing SFX so it doesn't compete */
function useMusicVolume(): number {
  const frame = useCurrentFrame();

  // Base envelope: fade in at start, fade out at end
  const base = interpolate(
    frame,
    [0, 15, TOTAL_DURATION - 45, TOTAL_DURATION],
    [0, 0.85, 0.85, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Duck during typing: drop to 10% so typing SFX is clearly heard
  const duck = interpolate(
    frame,
    [TYPING_START - DUCK_RAMP, TYPING_START, TYPING_END, TYPING_END + DUCK_RAMP],
    [1, 0.1, 0.1, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return base * duck;
}

const MusicTrack: React.FC = () => {
  const volume = useMusicVolume();
  return (
    <Audio
      src={staticFile('music.mp3')}
      volume={volume}
      startFrom={0}
    />
  );
};

export const MarketingReel: React.FC = () => {
  let offset = 0;

  const scenes = [
    { Component: HookScene, duration: SCENE.hook },
    { Component: ScanInputScene, duration: SCENE.scanInput },
    { Component: ScanSequenceScene, duration: SCENE.scanSequence },
    { Component: ReportRevealScene, duration: SCENE.reportReveal },
    { Component: PaidUnlockScene, duration: SCENE.paidUnlock },
    { Component: CTAScene, duration: SCENE.cta },
  ];

  return (
    <AbsoluteFill style={{ background: '#080808' }}>
      {/* ── Background music (ducks during typing) ── */}
      <MusicTrack />

      {/* ── SFX: Keyboard typing (Scan Input scene) ──
          Synced to URL typing animation. Music ducks to let it shine. */}
      <Sequence from={TYPING_START} durationInFrames={TYPING_DURATION} name="SFX: Typing">
        <Audio
          src={staticFile('sfx-typing.mp3')}
          volume={1.0}
        />
      </Sequence>

      {/* ── Visual scenes ── */}
      {scenes.map(({ Component, duration }, i) => {
        const from = offset;
        offset += duration;
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={duration}
            name={Component.name || `Scene ${i + 1}`}
          >
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
