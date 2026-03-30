import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C } from '../lib/progression';
import { GrainOverlay } from './GrainOverlay';

/**
 * The Watershed Moment — 12 years compressed into seconds.
 *
 * 2014 through 2025 flash by (accelerating, dim, fading) →
 * brief black beat →
 * 2026 SLAMS in pink with glow burst →
 * "Refusing to let the dream die."
 */

const YEARS: { year: number; word: string }[] = [
  { year: 2014, word: 'the idea' },
  { year: 2015, word: 'first code' },
  { year: 2016, word: 'nothing' },
  { year: 2017, word: 'nothing' },
  { year: 2018, word: 'a spark' },
  { year: 2019, word: 'nothing' },
  { year: 2020, word: 'nothing' },
  { year: 2021, word: 'nothing' },
  { year: 2022, word: 'nothing' },
  { year: 2023, word: 'nothing' },
  { year: 2024, word: 'tried again' },
  { year: 2025, word: 'nothing' },
];

export const WatershedMoment: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Phase 1: Years flashing (0 to ~140f) — accelerating
  const yearsEnd = 140;
  const beatEnd = 158; // black beat
  const revealStart = 158;

  // Accelerating year distribution using exponential curve
  // Early years get more frames, later years flash faster
  const yearDurations: number[] = [];
  const totalYears = YEARS.length;
  let totalWeight = 0;
  for (let i = 0; i < totalYears; i++) {
    // Exponential decay: first year gets ~18f, last gets ~6f
    const weight = Math.pow(0.85, i);
    yearDurations.push(weight);
    totalWeight += weight;
  }
  // Scale to fit in yearsEnd frames
  const scaledDurations = yearDurations.map((w) => Math.max(5, Math.round((w / totalWeight) * yearsEnd)));

  // Compute which year is showing
  let yearIdx = -1;
  let yearLocalFrame = 0;
  let accumulated = 0;
  for (let i = 0; i < totalYears; i++) {
    if (frame >= accumulated && frame < accumulated + scaledDurations[i]!) {
      yearIdx = i;
      yearLocalFrame = frame - accumulated;
      break;
    }
    accumulated += scaledDurations[i]!;
  }

  // If past all years, we're in the beat or reveal
  const inYearsPhase = yearIdx >= 0 && frame < yearsEnd;
  const inBeat = frame >= yearsEnd && frame < revealStart;
  const inReveal = frame >= revealStart;

  // Year display
  const currentYear = inYearsPhase ? YEARS[yearIdx]! : null;
  const currentDuration = inYearsPhase ? scaledDurations[yearIdx]! : 0;
  const yearProgress = inYearsPhase ? yearLocalFrame / currentDuration : 0;

  // Year opacity: flash in, hold briefly, fade
  const yearOpacity = inYearsPhase
    ? interpolate(yearProgress, [0, 0.15, 0.7, 1], [0, 1, 1, 0.2])
    : 0;

  // Year brightness — "nothing" years are dimmer
  const isNothing = currentYear?.word === 'nothing';
  const isActive = currentYear?.word !== 'nothing';
  const yearColor = isNothing ? C.mid : isActive ? C.light : C.mid;
  const wordColor = isNothing ? `${C.mid}88` : C.base;

  // Overall progress through years (0-1)
  const overallProgress = frame / yearsEnd;

  // 2026 REVEAL
  const revealOpacity = inReveal
    ? interpolate(frame, [revealStart, revealStart + 6], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const revealScale = inReveal
    ? interpolate(frame, [revealStart, revealStart + 10], [1.3, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // Glow burst on 2026
  const glowSize = inReveal
    ? interpolate(frame, [revealStart, revealStart + 20], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Tagline
  const taglineStart = revealStart + 25;
  const taglineOpacity = interpolate(frame, [taglineStart, taglineStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineY = interpolate(frame, [taglineStart, taglineStart + 18], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: C.void, opacity: fadeOut }}>
      {/* ── Years flashing ── */}
      {inYearsPhase && currentYear && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: yearOpacity,
          }}
        >
          <span
            style={{
              fontFamily: 'Geist Mono, monospace',
              fontSize: 160,
              fontWeight: 700,
              color: yearColor,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {currentYear.year}
          </span>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 28,
              fontWeight: 300,
              color: wordColor,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 16,
            }}
          >
            {currentYear.word}
          </span>
        </div>
      )}

      {/* ── 2026 REVEAL ── */}
      {inReveal && (
        <>
          {/* Glow burst */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 800,
              height: 800,
              transform: `translate(-50%, -50%) scale(${glowSize * 1.5})`,
              background: `radial-gradient(ellipse,
                rgba(255,178,239,0.15) 0%,
                rgba(255,178,239,0.08) 25%,
                rgba(255,178,239,0.03) 50%,
                transparent 75%
              )`,
              opacity: revealOpacity,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: revealOpacity,
              transform: `scale(${revealScale})`,
            }}
          >
            <span
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 200,
                fontWeight: 700,
                color: C.base,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                textShadow: '0 0 80px rgba(255,178,239,0.4), 0 0 160px rgba(255,178,239,0.15)',
              }}
            >
              2026
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              position: 'absolute',
              bottom: 260,
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: taglineOpacity,
              transform: `translateY(${taglineY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: 'Permanent Marker, cursive',
                fontSize: 42,
                color: C.base,
                letterSpacing: '0.04em',
                textShadow: '0 0 30px rgba(255,178,239,0.3)',
              }}
            >
              Refusing to let the dream die.
            </span>
          </div>
        </>
      )}

      <GrainOverlay />
    </AbsoluteFill>
  );
};
