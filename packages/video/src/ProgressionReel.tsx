import React from 'react';
import {
  Sequence,
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { TIMELINE, P_TOTAL, C } from './lib/progression';
import { TextCard } from './components/TextCard';
import { ImageSlide } from './components/ImageSlide';
import { GitHubSlide } from './components/GitHubSlide';
import { YearCounter } from './components/YearCounter';
import { BeforeAfter } from './components/BeforeAfter';
import { StatsReveal } from './components/StatsReveal';
import { GrainOverlay } from './components/GrainOverlay';
import { WatershedMoment } from './components/WatershedMoment';
import { ShiaClip } from './components/ShiaClip';

/**
 * ProgressionReel v2 — ~2:22 landscape motivational montage
 *
 * 2015 → silence → 2018 spark → NYC → 5yr silence → 2024 AI false start → 2026 SHIPS
 * Arnold Schwarzenegger energy: quiet start, emotional build, triumphant peak.
 *
 * Music: Pixabay royalty-free (see public/progression-music.mp3)
 */

/**
 * Music split into two Audio elements:
 * 1) Before Shia — plays from start, ends when Shia starts
 * 2) After Shia — resumes where it left off, no gap in the song
 * Zero music during Shia. Song doesn't skip ahead.
 */
const MusicBefore: React.FC<{ shiaStart: number }> = ({ shiaStart }) => {
  const frame = useCurrentFrame();
  const vol = interpolate(frame, [0, 60, shiaStart - 15, shiaStart], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <Sequence from={0} durationInFrames={shiaStart}>
      <Audio src={staticFile('progression-music.mp3')} volume={vol} startFrom={0} />
    </Sequence>
  );
};

const MusicAfterInner: React.FC<{ shiaStart: number; remaining: number }> = ({ shiaStart, remaining }) => {
  const frame = useCurrentFrame(); // local frame (0 = when this Sequence starts)
  const vol = interpolate(frame, [0, 5, remaining - 90, remaining], [0.7, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <Audio src={staticFile('progression-music.mp3')} volume={vol} startFrom={shiaStart} />
  );
};

const MusicAfter: React.FC<{ shiaStart: number; shiaDur: number }> = ({ shiaStart, shiaDur }) => {
  const afterStart = shiaStart + shiaDur;
  const remaining = P_TOTAL - afterStart;
  return (
    <Sequence from={afterStart} durationInFrames={remaining}>
      <MusicAfterInner shiaStart={shiaStart} remaining={remaining} />
    </Sequence>
  );
};

/** Beat — just black screen with grain. Breathing room. */
const Beat: React.FC = () => (
  <AbsoluteFill style={{ background: C.void }}>
    <GrainOverlay />
  </AbsoluteFill>
);

/** Render a timeline entry into a React component */
function renderEntry(entry: typeof TIMELINE[number]): React.ReactNode {
  switch (entry.type) {
    case 'text':
      return <TextCard lines={entry.lines ?? []} />;

    case 'image':
      return (
        <ImageSlide
          src={entry.src!}
          label={entry.label}
          date={entry.date}
          zoom={entry.zoom}
          pan={entry.pan}
          fit={entry.fit}
        />
      );

    case 'github':
      return <GitHubSlide src={entry.src!} />;

    case 'years':
      return <YearCounter startYear={entry.yearStart} endYear={entry.yearEnd} />;

    case 'beat':
      return <Beat />;

    case 'beforeAfter':
      return (
        <BeforeAfter
          before={entry.before!}
          after={entry.after ?? null}
          afterType={entry.afterType}
        />
      );

    case 'stats':
      return <StatsReveal stats={entry.stats ?? []} />;

    case 'watershed':
      return <WatershedMoment />;

    case 'shia':
      return <ShiaClip />;

    default:
      return <Beat />;
  }
}

export const ProgressionReel: React.FC = () => {
  const frame = useCurrentFrame();

  // Compute cumulative start frames + find Shia position
  const starts: number[] = [];
  let accum = 0;
  let shiaStart = 0;
  let shiaDur = 0;
  for (const entry of TIMELINE) {
    starts.push(accum);
    if (entry.type === 'shia') {
      shiaStart = accum;
      shiaDur = entry.duration;
    }
    accum += entry.duration;
  }

  return (
    <AbsoluteFill style={{ background: C.void }}>
      {/* Music — split around Shia clip, zero music during Shia, song resumes where it left off */}
      <MusicBefore shiaStart={shiaStart} />
      <MusicAfter shiaStart={shiaStart} shiaDur={shiaDur} />

      {/* Timeline entries as Sequences */}
      {TIMELINE.map((entry, i) => (
        <Sequence
          key={i}
          from={starts[i]!}
          durationInFrames={entry.duration}
          name={`${entry.type}-${i}`}
        >
          {renderEntry(entry)}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
