import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  staticFile,
  OffthreadVideo,
  AbsoluteFill,
  interpolate,
} from 'remotion';

/* ── Source video properties ── */
const TRIM_START = 0.05; // seconds trimmed from the beginning
const SOURCE_DURATION = 8.0; // total source length in seconds

/* ── Timeline segments ──
 * Each segment defines:
 *   outDur   – how long this segment lasts in the OUTPUT timeline (seconds)
 *   srcStart – where to BEGIN reading from the SOURCE video (seconds)
 *   rate     – playback rate (source seconds per output second)
 *              0.3 = slow-mo, 1.0 = normal, >1 = fast, <0 = rewind, 0 = freeze
 */
interface Segment {
  outDur: number;
  srcStart: number;
  rate: number;
}

const SEGMENTS: Segment[] = [
  // ── Act 1: Dreamy slow reveal ──
  { outDur: 5.0, srcStart: TRIM_START, rate: 0.3 }, // slow intro → src reaches ~1.55s

  // ── Glitch 1: Rewind snap ──
  { outDur: 0.6, srcStart: 1.55, rate: -1.2 }, // quick rewind back to ~0.83s
  { outDur: 0.15, srcStart: 0.83, rate: 0.0 }, // freeze-frame stutter

  // ── Act 2: Resume slow ──
  { outDur: 4.0, srcStart: 0.83, rate: 0.3 }, // slow crawl → src reaches ~2.03s

  // ── Glitch 2: Speed burst + rewind ──
  { outDur: 1.0, srcStart: 2.03, rate: 1.2 }, // sudden speed-up → src reaches ~3.23s
  { outDur: 0.5, srcStart: 3.23, rate: -0.5 }, // gentle rewind → src back to ~2.98s

  // ── Act 3: Slow drift ──
  { outDur: 5.0, srcStart: 2.98, rate: 0.3 }, // slow → src reaches ~4.48s

  // ── Glitch 3: Freeze + fast-forward ──
  { outDur: 0.2, srcStart: 4.48, rate: 0.0 }, // freeze
  { outDur: 0.8, srcStart: 4.48, rate: 2.0 }, // rip forward → src reaches ~6.08s

  // ── Glitch 4: Rewind stutter ──
  { outDur: 0.4, srcStart: 6.08, rate: -1.0 }, // rewind → src back to ~5.68s
  { outDur: 0.3, srcStart: 5.68, rate: 0.0 }, // freeze-stutter hold

  // ── Act 4: Slow ride to the end ──
  {
    outDur: Math.ceil(((SOURCE_DURATION - 5.68) / 0.3) * 100) / 100, // ~7.73s
    srcStart: 5.68,
    rate: 0.3,
  },
];

const SINGLE_LOOP_SECONDS = SEGMENTS.reduce((s, seg) => s + seg.outDur, 0);
const LOOPS = 3;
const TOTAL_OUT_SECONDS = SINGLE_LOOP_SECONDS * LOOPS;

/* ── Exported constants for composition registration ── */
export const G_WIDTH = 1920;
export const G_HEIGHT = 1080;
export const G_FPS = 30;
export const G_TOTAL = Math.ceil(TOTAL_OUT_SECONDS * G_FPS);

/* ── Time-remapping engine ── */
type GlitchType = 'rewind' | 'freeze' | 'fast' | null;

interface TimeInfo {
  time: number;
  isGlitch: boolean;
  glitchType: GlitchType;
  segProgress: number; // 0-1 within current segment
}

function getSourceTime(outputFrame: number, fps: number): TimeInfo {
  const rawOutputTime = outputFrame / fps;
  // Wrap around for looping
  const outputTime = rawOutputTime % SINGLE_LOOP_SECONDS;
  // Detect loop-point transition (first 0.15s of each new loop after the first)
  const loopIndex = Math.floor(rawOutputTime / SINGLE_LOOP_SECONDS);
  const timeInLoop = rawOutputTime - loopIndex * SINGLE_LOOP_SECONDS;
  const isLoopTransition = loopIndex > 0 && timeInLoop < 0.15;

  let accumulated = 0;

  for (const seg of SEGMENTS) {
    if (outputTime < accumulated + seg.outDur) {
      const t = outputTime - accumulated;
      const sourceTime = seg.srcStart + t * seg.rate;
      const clamped = Math.max(0, Math.min(sourceTime, SOURCE_DURATION));

      let glitchType: GlitchType = null;
      if (seg.rate < 0) glitchType = 'rewind';
      else if (seg.rate === 0) glitchType = 'freeze';
      else if (seg.rate > 0.5) glitchType = 'fast';

      // Force glitch effect at loop transition
      if (isLoopTransition) {
        glitchType = 'rewind';
      }

      return {
        time: clamped,
        isGlitch: glitchType !== null || isLoopTransition,
        glitchType,
        segProgress: isLoopTransition ? timeInLoop / 0.15 : t / seg.outDur,
      };
    }
    accumulated += seg.outDur;
  }

  return { time: SOURCE_DURATION, isGlitch: false, glitchType: null, segProgress: 1 };
}

/* ── Pseudo-random from frame (deterministic) ── */
function rand(frame: number, seed: number): number {
  const x = Math.sin(frame * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── Main composition ── */
export const GlitchReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { time: sourceTime, isGlitch, glitchType, segProgress } = getSourceTime(frame, fps);
  const desiredLocalFrame = Math.round(sourceTime * fps);
  const seqFrom = frame - desiredLocalFrame;

  /* ── Visual effects per glitch type ── */
  const containerStyle: React.CSSProperties = {};

  if (glitchType === 'rewind') {
    const jitter = Math.sin(frame * 2.1) * 6 + Math.cos(frame * 3.7) * 4;
    const hueShift = Math.sin(frame * 0.8) * 20;
    containerStyle.transform = `translateX(${jitter}px)`;
    containerStyle.filter = `hue-rotate(${hueShift}deg) saturate(1.6) contrast(1.15)`;
  } else if (glitchType === 'freeze') {
    const pulse = 1 + Math.sin(frame * 0.4) * 0.015;
    containerStyle.transform = `scale(${pulse})`;
    containerStyle.filter = 'contrast(1.3) brightness(1.08) saturate(0.7)';
  } else if (glitchType === 'fast') {
    // Ease in/out the effect intensity over the segment
    const intensity = interpolate(segProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
    const sat = 1 + 0.8 * intensity;
    const blur = 0.5 * intensity;
    containerStyle.filter = `saturate(${sat}) contrast(${1 + 0.15 * intensity}) blur(${blur}px)`;
  }

  // Micro-glitches: tiny occasional jitter during normal playback
  if (!isGlitch && rand(frame, 0) > 0.96) {
    const microJitter = (rand(frame, 1) - 0.5) * 6;
    containerStyle.transform = `translateX(${microJitter}px)`;
  }

  /* ── Horizontal glitch bars (rewind only) ── */
  const glitchBars =
    glitchType === 'rewind'
      ? [0.12, 0.33, 0.58, 0.78].map((y, i) => {
          const barH = 6 + ((frame * (i + 1) * 7) % 24);
          const shift = Math.sin(frame * (1.5 + i * 0.4)) * 35;
          const alpha = 0.25 + Math.sin(frame * 2.3 + i * 1.1) * 0.15;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${y * 100}%`,
                left: 0,
                right: 0,
                height: barH,
                transform: `translateX(${shift}px)`,
                background: `rgba(255, 178, 239, ${alpha})`,
                mixBlendMode: 'overlay' as const,
              }}
            />
          );
        })
      : null;

  /* ── Scanline overlay (all glitch types) ── */
  const scanlineOpacity = isGlitch
    ? interpolate(
        glitchType === 'rewind' ? 1 : glitchType === 'fast' ? 0.5 : 0.3,
        [0, 1],
        [0, 0.15],
      )
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* ── Time-remapped video ── */}
      <Sequence from={seqFrom} layout="none">
        <AbsoluteFill style={containerStyle}>
          <OffthreadVideo
            src={staticFile('glitch-source.mp4')}
            volume={0}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── Scanlines ── */}
      {scanlineOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 3px,
              rgba(0, 0, 0, ${scanlineOpacity}) 3px,
              rgba(0, 0, 0, ${scanlineOpacity}) 4px
            )`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Glitch bars ── */}
      {glitchBars && (
        <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
          {glitchBars}
        </AbsoluteFill>
      )}

      {/* ── Brief white flash on glitch transitions ── */}
      {isGlitch && segProgress < 0.08 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255, 255, 255, ${interpolate(segProgress, [0, 0.08], [0.15, 0])})`,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
