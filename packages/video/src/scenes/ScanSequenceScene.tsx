import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
} from 'remotion';
import { ChloeSprite } from '../components/ChloeSprite';
import { COLOR, DEMO_DOMAIN } from '../lib/constants';

/**
 * Scene 3: Scan Sequence (10s)
 * Matrix rain → terminal boot → module extraction cascade.
 * Hollywood Hack energy — fast, dramatic, satisfying.
 */

const BOOT_LINES = [
  { text: 'GhostScan OS v2.0.26 — Forensic Marketing Intelligence', type: 'info' },
  { text: `Target acquired: ${DEMO_DOMAIN}`, type: 'ok' },
  { text: 'DNS resolution complete', type: 'ok' },
  { text: 'Loading forensic module array (42 modules)', type: 'scan' },
  { text: 'Ghost detection array: ARMED', type: 'ghost' },
  { text: 'Stealth browser initialized (Chrome 134)', type: 'ok' },
  { text: `Rendering ${DEMO_DOMAIN}...`, type: 'scan' },
];

const MODULE_LINES = [
  'SEO Fundamentals: EXTRACTED',
  'MarTech Stack: EXTRACTED',
  'Analytics Coverage: EXTRACTED',
  'Performance Metrics: EXTRACTED',
  'Security Headers: EXTRACTED',
  'Paid Media Signals: EXTRACTED',
  'Content Quality: EXTRACTED',
  'Mobile Experience: EXTRACTED',
  'Accessibility: EXTRACTED',
  'Brand Presence: EXTRACTED',
  'Social Signals: EXTRACTED',
  'Competitor Intel: EXTRACTED',
];

function getTypeColor(type: string): string {
  switch (type) {
    case 'ok': return COLOR.terminal;
    case 'ghost': return COLOR.base;
    case 'scan': return COLOR.bright;
    case 'error': return COLOR.critical;
    default: return COLOR.mid;
  }
}

export const ScanSequenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Phase 1: Matrix rain (0-90 frames / 3s) ──
  const matrixPhase = frame < 90;

  // ── Phase 2: Terminal boot (90-180 frames / 3s) ──
  const bootStart = 90;
  const bootLinesVisible = Math.floor(
    interpolate(frame, [bootStart, bootStart + 80], [0, BOOT_LINES.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // ── Phase 3: Module extraction cascade (180-300 frames / 4s) ──
  const moduleStart = 180;
  const moduleLinesVisible = Math.floor(
    interpolate(frame, [moduleStart, moduleStart + 100], [0, MODULE_LINES.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Progress bar — smooth 0→100% across full scene (300 frames)
  const progress = interpolate(frame, [0, 295], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Chloé scanning state
  const chloeFrame = Math.floor(frame / 8);
  const chloeOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* Matrix rain background */}
      <MatrixRain frame={frame} opacity={matrixPhase ? 0.6 : 0.15} />

      {/* Terminal overlay */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 60,
          right: 60,
          bottom: 200,
          padding: '24px 28px',
          fontFamily: 'JetBrains Mono, Geist Mono, monospace',
          fontSize: 16,
          lineHeight: 1.8,
          overflow: 'hidden',
        }}
      >
        {/* Boot lines */}
        {frame >= bootStart && BOOT_LINES.slice(0, bootLinesVisible).map((line, i) => (
          <div
            key={i}
            style={{
              color: getTypeColor(line.type),
              opacity: interpolate(
                frame,
                [bootStart + i * (80 / BOOT_LINES.length), bootStart + i * (80 / BOOT_LINES.length) + 8],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
              textShadow: `0 0 8px ${getTypeColor(line.type)}44`,
            }}
          >
            <span style={{ color: COLOR.mid }}>{'> '}</span>
            {line.text}
          </div>
        ))}

        {/* Module extraction lines */}
        {frame >= moduleStart && (
          <div style={{ marginTop: 24 }}>
            {MODULE_LINES.slice(0, moduleLinesVisible).map((line, i) => {
              const lineFrame = moduleStart + i * (100 / MODULE_LINES.length);
              const lineOpacity = interpolate(
                frame,
                [lineFrame, lineFrame + 5],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              const flashIntensity = interpolate(
                frame,
                [lineFrame, lineFrame + 10],
                [0.8, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  key={i}
                  style={{
                    opacity: lineOpacity,
                    color: COLOR.terminal,
                    textShadow: `0 0 ${12 + flashIntensity * 20}px ${COLOR.terminal}${Math.round(flashIntensity * 80).toString(16).padStart(2, '0')}`,
                  }}
                >
                  <span style={{ color: COLOR.base }}>{'■ '}</span>
                  {line}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chloé (bottom right, scanning state) */}
      <div
        style={{
          position: 'absolute',
          bottom: 220,
          right: 80,
          opacity: chloeOpacity,
          transform: `translateY(${Math.sin(frame * 0.06) * 6}px)`,
        }}
      >
        <ChloeSprite state="scanning" size={128} glowing frame={chloeFrame} />
      </div>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: 60,
          right: 60,
          height: 4,
          background: `${COLOR.deep}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${COLOR.base}, ${COLOR.terminal})`,
            borderRadius: 2,
            boxShadow: `0 0 12px ${COLOR.base}66`,
          }}
        />
      </div>

      {/* Progress label */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Geist Mono, monospace',
          fontSize: 13,
          color: COLOR.mid,
          letterSpacing: '0.08em',
        }}
      >
        {Math.round(progress)}% — SCANNING {DEMO_DOMAIN.toUpperCase()}
      </div>

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.02) 2px, rgba(0,255,136,0.02) 4px)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Matrix rain — proper top-to-bottom falling columns.
 * Each column has a bright "head" that falls, with a fading green trail behind it.
 * Characters change randomly as they fall.
 */
function MatrixRain({ frame, opacity }: { frame: number; opacity: number }) {
  const cols = 45;
  const cellH = 24; // px per character cell
  const totalRows = Math.ceil(1920 / cellH) + 10; // enough to cover screen + trail
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZアイウエオカキクケコサシスセソ0123456789';

  // Deterministic pseudo-random from two ints
  const seed = (a: number, b: number) => {
    const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: cols }, (_, col) => {
        // Each column has its own speed and start offset
        const speed = 1.2 + seed(col, 0) * 2.5; // rows per frame
        const startOffset = seed(col, 1) * totalRows * 2; // stagger start
        const trailLen = 15 + Math.floor(seed(col, 2) * 15); // 15-30 chars
        const x = (col / cols) * 1080;

        // Head position (row index, wraps around)
        const headRow = (frame * speed + startOffset) % (totalRows + trailLen + 20);

        return (
          <div key={col} style={{ position: 'absolute', left: x, top: 0 }}>
            {Array.from({ length: totalRows }, (_, row) => {
              // Distance from head (0 = head, positive = trail behind)
              const dist = headRow - row;

              // Only render if this cell is in the trail or is the head
              if (dist < 0 || dist > trailLen) return null;

              // Brightness: head is white/bright, trail fades to dark
              const brightness = dist === 0 ? 1.0 : Math.max(0, 1 - dist / trailLen);

              // Pick a character — changes slowly over time for shimmer
              const charSeed = seed(col, row + Math.floor(frame * 0.15));
              const charIdx = Math.floor(charSeed * chars.length);
              const ch = chars[charIdx];

              const isHead = dist < 2;
              const color = isHead ? COLOR.light : COLOR.terminal;
              const alpha = brightness;

              return (
                <span
                  key={row}
                  style={{
                    position: 'absolute',
                    top: row * cellH,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 18,
                    lineHeight: `${cellH}px`,
                    width: 24,
                    textAlign: 'center',
                    display: 'block',
                    color,
                    opacity: alpha,
                    textShadow: isHead
                      ? `0 0 12px ${COLOR.terminal}, 0 0 4px #fff`
                      : `0 0 ${4 * brightness}px ${COLOR.terminal}66`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
