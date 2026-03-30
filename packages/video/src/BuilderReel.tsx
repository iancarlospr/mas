import React from 'react';
import {
  Sequence,
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { BUILDER_TIMELINE, B_TOTAL, BC } from './lib/builder-reel';
import { TextCard } from './components/TextCard';
import { ImageSlide } from './components/ImageSlide';
import { IntroCard } from './components/IntroCard';
import { CareerFlash } from './components/CareerFlash';
import { GitHubFlash } from './components/GitHubFlash';
import { BeforeAfter } from './components/BeforeAfter';
import { StatsReveal } from './components/StatsReveal';
import { GrainOverlay } from './components/GrainOverlay';
import { OutroParticles } from './components/OutroParticles';
import { OutroSignature } from './components/OutroSignature';
import { OutroTunnel } from './components/OutroTunnel';

/**
 * BuilderReel v2 — "The marketer who builds"
 *
 * ~64s landscape motivational showcase.
 * Main music: "Upbeat Happy Corporate" by kornevmusic (Pixabay)
 * Outro music: "Moody Dark Cinematic Sequence" by fooBarSounds (Pixabay)
 */

// Frame where the 3-scene outro begins (sum of all pre-outro entries)
const OUTRO_START = BUILDER_TIMELINE.slice(0, -3).reduce((s, e) => s + e.duration, 0);

/** Main upbeat track — fades out before the outro. */
const MusicTrack: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(
    frame,
    [0, 30, OUTRO_START - 30, OUTRO_START],
    [0, 0.55, 0.55, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <Audio src={staticFile('builder-music.mp3')} volume={vol} startFrom={0} />
  );
};

/** Dark cinematic outro track — cross-fades in as main track fades. */
const OutroMusicTrack: React.FC = () => {
  const frame = useCurrentFrame();
  const vol = interpolate(
    frame,
    [OUTRO_START - 10, OUTRO_START + 15, B_TOTAL - 30, B_TOTAL],
    [0, 0.5, 0.5, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <Audio src={staticFile('outro-powerful.mp3')} volume={vol} startFrom={0} />
  );
};

/** Beat — just black screen with grain. */
const Beat: React.FC = () => (
  <AbsoluteFill style={{ background: BC.void }}>
    <GrainOverlay />
  </AbsoluteFill>
);

function renderEntry(entry: typeof BUILDER_TIMELINE[number]): React.ReactNode {
  switch (entry.type) {
    case 'text':
      return <TextCard lines={entry.lines ?? []} />;

    case 'intro':
      return <IntroCard />;

    case 'career':
      return <CareerFlash />;

    case 'github-flash':
      return <GitHubFlash />;

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

    case 'beforeAfter':
      return (
        <BeforeAfter
          before={entry.before!}
          after={null}
          afterType={entry.afterType}
        />
      );

    case 'stats':
      return <StatsReveal stats={entry.stats ?? []} />;

    case 'outro-particles':
      return <OutroParticles />;

    case 'outro-signature':
      return <OutroSignature />;

    case 'outro-tunnel':
      return <OutroTunnel />;

    case 'beat':
      return <Beat />;

    default:
      return <Beat />;
  }
}

/** Progress bar — single glowing particle carving a living line across the top.
 *  Hot point at the leading edge with glow trail. The line behind it breathes
 *  with subtle sine wave undulation. Color shifts cool→warm across the journey.
 *  Line thickness increases subtly as confidence builds. Corner to corner. */
const ProgressBar: React.FC<{ starts: number[] }> = ({ starts: _starts }) => {
  const frame = useCurrentFrame();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const W = 1920;
  const BAR_Y = 6;
  const CANVAS_H = 20;

  // Detect bright scene (outro-tunnel)
  const outroTunnelStart = _starts[_starts.length - 1] ?? 0;
  const inBright = frame >= outroTunnelStart;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, CANVAS_H);

    const progress = frame / B_TOTAL;

    // Fade in after intro, fade out at end
    const opacity = interpolate(frame, [50, 80, B_TOTAL - 25, B_TOTAL], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    if (opacity < 0.01) return;

    ctx.globalAlpha = opacity;

    const headX = progress * W;

    // Line thickness increases subtly over time (0.8 → 1.8)
    const baseThick = 0.8 + progress * 1.0;

    // Color shift: cool steel → warm gold
    const r = Math.round(interpolate(progress, [0, 0.7, 1], [180, 220, 200], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    const g = Math.round(interpolate(progress, [0, 0.7, 1], [195, 195, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    const b = Math.round(interpolate(progress, [0, 0.7, 1], [220, 140, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

    // Adapt for bright scene
    const lineR = inBright ? Math.round(r * 0.25) : r;
    const lineG = inBright ? Math.round(g * 0.25) : g;
    const lineB = inBright ? Math.round(b * 0.25) : b;
    const lineAlpha = inBright ? 0.5 : 0.4;
    const headAlpha = inBright ? 0.8 : 0.9;

    // ── Trail line with breathing sine wave ──
    if (headX > 1) {
      ctx.beginPath();
      ctx.moveTo(0, BAR_Y);

      // Draw the trail as a path with subtle sine undulation
      for (let x = 0; x <= headX; x += 2) {
        const localProgress = x / W;
        // Breathing: gentle sine wave that varies along the line
        const breathAmp = 1.2 * (0.3 + localProgress * 0.7);
        const breathFreq = 0.08 + localProgress * 0.04;
        const breath = Math.sin(x * breathFreq + frame * 0.06) * breathAmp;
        // Fade the wave amplitude near the start
        const fadeIn = Math.min(x / 60, 1);
        ctx.lineTo(x, BAR_Y + breath * fadeIn);
      }

      // Trail stroke — gradient from dim at start to brighter near head
      const trailGrad = ctx.createLinearGradient(0, 0, headX, 0);
      trailGrad.addColorStop(0, `rgba(${lineR}, ${lineG}, ${lineB}, ${lineAlpha * 0.15})`);
      trailGrad.addColorStop(0.6, `rgba(${lineR}, ${lineG}, ${lineB}, ${lineAlpha * 0.5})`);
      trailGrad.addColorStop(1, `rgba(${lineR}, ${lineG}, ${lineB}, ${lineAlpha})`);

      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = baseThick;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // ── Hot point (leading edge) ──
    if (headX > 0) {
      // Outer glow
      const glowRadius = 8 + Math.sin(frame * 0.15) * 2;
      const glow = ctx.createRadialGradient(headX, BAR_Y, 0, headX, BAR_Y, glowRadius);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${headAlpha * 0.6})`);
      glow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${headAlpha * 0.15})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(headX - glowRadius, BAR_Y - glowRadius, glowRadius * 2, glowRadius * 2);

      // Bright core dot
      ctx.beginPath();
      ctx.arc(headX, BAR_Y, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = inBright
        ? `rgba(20, 18, 15, ${headAlpha})`
        : `rgba(255, 252, 245, ${headAlpha})`;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, [frame, inBright, _starts]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={CANVAS_H}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: CANVAS_H,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
};

export const BuilderReel: React.FC = () => {
  const starts: number[] = [];
  let accum = 0;
  for (const entry of BUILDER_TIMELINE) {
    starts.push(accum);
    accum += entry.duration;
  }

  return (
    <AbsoluteFill style={{ background: BC.void }}>
      <MusicTrack />
      <OutroMusicTrack />

      {BUILDER_TIMELINE.map((entry, i) => (
        <Sequence
          key={i}
          from={starts[i]!}
          durationInFrames={entry.duration}
          name={`${entry.type}-${i}`}
        >
          {renderEntry(entry)}
        </Sequence>
      ))}

      {/* Progress bar on top of everything */}
      <ProgressBar starts={starts} />
    </AbsoluteFill>
  );
};
