import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { GrainOverlay } from './GrainOverlay';

interface Props {
  src: string;
  label?: string;
  date?: string;
  zoom?: 'in' | 'out';
  pan?: 'left' | 'right' | 'up' | 'down' | 'none';
  /** 'cover' crops to fill (default). 'contain' shows the full image on dark bg. */
  fit?: 'cover' | 'contain';
}

/**
 * Full-screen image with subtle Ken Burns, vignette, and optional label.
 * Fades in/out gracefully. Image held long enough to appreciate.
 */
export const ImageSlide: React.FC<Props> = ({
  src,
  label,
  date,
  zoom = 'in',
  pan = 'none',
  fit = 'cover',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;

  // Scene fade
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns — very subtle
  const zoomAmt = 0.06;
  const s0 = zoom === 'in' ? 1.02 : 1.02 + zoomAmt;
  const s1 = zoom === 'in' ? 1.02 + zoomAmt : 1.02;
  const scale = interpolate(progress, [0, 1], [s0, s1]);

  const panAmt = 1.5;
  let tx = 0;
  let ty = 0;
  if (pan === 'left') tx = interpolate(progress, [0, 1], [panAmt, -panAmt]);
  if (pan === 'right') tx = interpolate(progress, [0, 1], [-panAmt, panAmt]);
  if (pan === 'up') ty = interpolate(progress, [0, 1], [panAmt, -panAmt]);
  if (pan === 'down') ty = interpolate(progress, [0, 1], [-panAmt, panAmt]);

  // Label fade
  const labelOpacity = label
    ? interpolate(frame, [15, 30, durationInFrames - 20, durationInFrames - 8], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{ background: C.void, opacity: fadeIn * fadeOut }}>
      {/* Image */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
            transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
          }}
        />
      </AbsoluteFill>

      {/* Dark vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, ${C.void}99 85%, ${C.void} 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Date stamp — top right */}
      {date && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 50,
            fontFamily: 'Geist Mono, monospace',
            fontSize: 24,
            color: C.base,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            opacity: labelOpacity * 0.9,
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          {date}
        </div>
      )}

      {/* Label — bottom center, big and visible */}
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: labelOpacity,
          }}
        >
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 44,
              fontWeight: 600,
              color: C.white,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '12px 36px',
              background: 'rgba(10,10,10,0.85)',
              borderRadius: 8,
              border: `1px solid ${C.base}40`,
              textShadow: '0 2px 8px rgba(0,0,0,1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {label}
          </span>
        </div>
      )}

      <GrainOverlay opacity={0.04} />
    </AbsoluteFill>
  );
};
