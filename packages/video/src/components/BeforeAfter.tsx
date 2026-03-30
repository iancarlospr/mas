import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { ScanSequenceAfter } from './ScanSequenceAfter';
import { ChloeLaserAfter } from './ChloeLaserAfter';
import { GrainOverlay } from './GrainOverlay';

interface Props {
  before: string;
  after: string | null;
  afterType?: 'chloe' | 'scanSequence';
}

/**
 * Before/after with flash transition.
 * "Before" = inspiration image (slightly desaturated).
 * "After" = animated live component (scan sequence, Chloé w/ lasers) — NOT static screenshots.
 */
export const BeforeAfter: React.FC<Props> = ({ before, after, afterType }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const mid = Math.floor(durationInFrames * 0.4);
  const flashDur = 8;

  // Before phase
  const beforeOpacity = interpolate(
    frame,
    [0, 15, mid - 4, mid],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Flash
  const flashOpacity = interpolate(
    frame,
    [mid - 2, mid + 2, mid + flashDur - 2, mid + flashDur],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // After phase
  const afterOpacity = interpolate(
    frame,
    [mid + flashDur - 3, mid + flashDur + 8, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Labels
  const beforeLabelOp = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const afterLabelOp = interpolate(frame, [mid + flashDur + 3, mid + flashDur + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isBeforePhase = frame < mid;

  return (
    <AbsoluteFill style={{ background: C.void }}>
      {/* ── BEFORE ── */}
      <AbsoluteFill style={{ opacity: beforeOpacity, overflow: 'hidden' }}>
        <Img
          src={staticFile(before)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'saturate(0.5) brightness(0.85)',
          }}
        />
      </AbsoluteFill>

      {/* ── AFTER — animated components ── */}
      {afterType === 'scanSequence' && (
        <AbsoluteFill style={{ opacity: afterOpacity }}>
          <ScanSequenceAfter />
        </AbsoluteFill>
      )}

      {afterType === 'chloe' && (
        <AbsoluteFill style={{ opacity: afterOpacity }}>
          <ChloeLaserAfter />
        </AbsoluteFill>
      )}

      {/* After — static image fallback */}
      {after && !afterType && (
        <AbsoluteFill style={{ opacity: afterOpacity, overflow: 'hidden' }}>
          <Img
            src={staticFile(after)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Labels — big, bold, unmissable */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: isBeforePhase ? beforeLabelOp * beforeOpacity : afterLabelOp * afterOpacity,
        }}
      >
        <span
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 44,
            fontWeight: 700,
            color: isBeforePhase ? C.light : C.base,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            padding: '10px 32px',
            border: `2px solid ${isBeforePhase ? C.light + '60' : C.base}`,
            borderRadius: 6,
            background: isBeforePhase ? 'rgba(10,10,10,0.7)' : 'rgba(10,10,10,0.8)',
            textShadow: isBeforePhase
              ? '0 2px 8px rgba(0,0,0,0.9)'
              : '0 0 20px rgba(255,178,239,0.4), 0 2px 8px rgba(0,0,0,0.9)',
            boxShadow: isBeforePhase
              ? 'none'
              : '0 0 30px rgba(255,178,239,0.15)',
          }}
        >
          {isBeforePhase ? 'INSPIRATION' : 'REALITY'}
        </span>
      </div>

      {/* FLASH */}
      <AbsoluteFill
        style={{
          background: C.white,
          opacity: flashOpacity,
          pointerEvents: 'none',
        }}
      />

      <GrainOverlay opacity={0.03} />
    </AbsoluteFill>
  );
};
