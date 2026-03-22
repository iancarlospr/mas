import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { ChloeSprite } from '../components/ChloeSprite';
import { COLOR, WIDTH, HEIGHT } from '../lib/constants';

/**
 * Scene 1: Hook (4s)
 * Chloé floats in from bottom → laser eyes fire across screen →
 * hook text types in.
 * "Your website is losing you money."
 */

const HOOK_LINE = "Your website is losing you money.";
const SUBLINE = "Let's fix that.";

/** Rainbow HSL colors for laser beam gradient */
function rainbowColor(t: number): string {
  const hue = (t * 360) % 360;
  return `hsl(${hue}, 100%, 65%)`;
}

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Chloé enters from bottom (0-30 frames)
  const chloeY = interpolate(
    spring({ frame, fps, config: { damping: 80, stiffness: 120 } }),
    [0, 1],
    [400, 0],
  );

  const chloeOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Ghost float — gentle sine bob
  const floatY = Math.sin(frame * 0.08) * 8;

  // Chloé glow pulse
  const glowScale = 1 + Math.sin(frame * 0.1) * 0.05;

  // ── Laser eyes ──
  // Fire at frame 25 (right as Chloé settles), sweep across for ~40 frames
  const laserStart = 25;
  const laserEnd = 65;
  const laserActive = frame >= laserStart && frame < laserEnd;
  const laserProgress = interpolate(frame, [laserStart, laserEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Beam width tapers: wide at target, narrow at eyes (like the frontend)
  const beamWidth = 28 + Math.sin(frame * 0.3) * 4; // pulsing girth at eyes
  const beamTargetWidth = 60 + Math.sin(frame * 0.2) * 8; // wide at far end
  // Beam X sweep: from center to right edge, then wraps left
  const beamTargetX = interpolate(laserProgress, [0, 0.4, 0.6, 1], [540, WIDTH + 50, -50, 540], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Chloé's eye Y position
  // Sprite: 32x42 grid rendered at 256px wide → each pixel = 256/32 = 8px
  // Eyes span rows 12-16, center at row 14. Canvas height = 42 * 8 = 336px
  // Eye center Y within sprite = 14 * 8 + 4 = 116px from sprite top
  const pxScale = 256 / 32; // 8px per grid cell
  const chloeTopY = 520 + chloeY + floatY;
  const eyeY = chloeTopY + 14.5 * pxScale; // row 14.5 = center of eye rows 12-16

  // Laser opacity — fade in/out
  const laserOpacity = laserActive
    ? interpolate(frame, [laserStart, laserStart + 5, laserEnd - 8, laserEnd], [0, 0.9, 0.9, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // Rainbow hue shift
  const hueShift = frame * 8;

  // Text typewriter — starts at frame 30
  const typeStart = 30;
  const charsVisible = Math.floor(
    interpolate(frame, [typeStart, typeStart + HOOK_LINE.length * 2], [0, HOOK_LINE.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const hookText = HOOK_LINE.slice(0, charsVisible);
  const showCursor = frame >= typeStart && frame % 16 < 10;

  // Subline fades in after hook finishes
  const sublineStart = typeStart + HOOK_LINE.length * 2 + 10;
  const sublineOpacity = interpolate(frame, [sublineStart, sublineStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sublineY = interpolate(frame, [sublineStart, sublineStart + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Chloé state: scanning during laser, then smug
  const chloeState = laserActive ? 'scanning' : frame > 65 ? 'smug' : 'idle';

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: 800,
          height: 800,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(255,178,239,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Laser beams ── */}
      {laserActive && (
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            opacity: laserOpacity,
          }}
        >
          <defs>
            <linearGradient id="laser-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              {Array.from({ length: 8 }, (_, i) => (
                <stop
                  key={i}
                  offset={`${(i / 7) * 100}%`}
                  stopColor={rainbowColor((i / 7) + hueShift / 360)}
                />
              ))}
            </linearGradient>
            <filter id="laser-glow">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="beam-glow">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Eye positions: left eye cols 7-11 center=9, right eye cols 19-23 center=21
             Sprite is 256px wide centered at x=540, so left edge = 540 - 128 = 412
             Left eye X = 412 + 9 * pxScale = 412 + 72 = 484
             Right eye X = 412 + 21 * pxScale = 412 + 168 = 580 */}
          {(() => {
            const spriteLeft = 540 - 128; // 256/2
            const leftEyeX = spriteLeft + 9.5 * pxScale;
            const rightEyeX = spriteLeft + 21.5 * pxScale;
            return (
              <>
                {/* Left eye beam */}
                <LaserBeam
                  eyeX={leftEyeX}
                  eyeY={eyeY}
                  targetX={beamTargetX}
                  targetY={eyeY + (beamTargetX - 540) * 0.12}
                  widthAtEye={beamWidth}
                  widthAtTarget={beamTargetWidth}
                />
                {/* Right eye beam */}
                <LaserBeam
                  eyeX={rightEyeX}
                  eyeY={eyeY}
                  targetX={beamTargetX}
                  targetY={eyeY + (beamTargetX - 540) * 0.12}
                  widthAtEye={beamWidth}
                  widthAtTarget={beamTargetWidth}
                />
                {/* Eye orbs — big pulsing glow */}
                <circle
                  cx={leftEyeX}
                  cy={eyeY}
                  r={16 + Math.sin(frame * 0.3) * 4}
                  fill={COLOR.base}
                  opacity={0.95}
                  filter="url(#laser-glow)"
                />
                <circle
                  cx={rightEyeX}
                  cy={eyeY}
                  r={16 + Math.sin(frame * 0.3) * 4}
                  fill={COLOR.base}
                  opacity={0.95}
                  filter="url(#laser-glow)"
                />
              </>
            );
          })()}
        </svg>
      )}

      {/* Chloé sprite */}
      <div
        style={{
          position: 'absolute',
          top: chloeTopY,
          left: '50%',
          transform: `translateX(-50%) scale(${glowScale})`,
          opacity: chloeOpacity,
          zIndex: 5,
        }}
      >
        <ChloeSprite
          state={chloeState}
          size={256}
          glowing
          frame={laserActive ? 0 : Math.floor(frame / 8)}
        />
      </div>

      {/* Hook text */}
      <div
        style={{
          position: 'absolute',
          top: 960,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 80px',
          zIndex: 15,
        }}
      >
        <h1
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 64,
            fontWeight: 300,
            color: COLOR.light,
            textAlign: 'center',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            minHeight: 160,
          }}
        >
          {hookText}
          {showCursor && (
            <span style={{ color: COLOR.base }}>|</span>
          )}
        </h1>

        <div
          style={{
            opacity: sublineOpacity,
            transform: `translateY(${sublineY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: 'Permanent Marker, cursive',
              fontSize: 72,
              color: COLOR.base,
              letterSpacing: '-0.06em',
              textShadow: '0 0 40px rgba(255,178,239,0.3)',
            }}
          >
            {SUBLINE}
          </span>
        </div>
      </div>

      {/* Scan line overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,178,239,0.015) 2px,
            rgba(255,178,239,0.015) 4px
          )`,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />
    </AbsoluteFill>
  );
};

/** Tapered laser beam polygon from eye to target */
function LaserBeam({
  eyeX, eyeY, targetX, targetY, widthAtEye, widthAtTarget,
}: {
  eyeX: number; eyeY: number;
  targetX: number; targetY: number;
  widthAtEye: number; widthAtTarget: number;
}) {
  // Direction vector
  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  // Perpendicular unit vector
  const px = -dy / len;
  const py = dx / len;

  const halfEye = widthAtEye / 2;
  const halfTarget = widthAtTarget / 2;

  const points = [
    `${eyeX + px * halfEye},${eyeY + py * halfEye}`,
    `${targetX + px * halfTarget},${targetY + py * halfTarget}`,
    `${targetX - px * halfTarget},${targetY - py * halfTarget}`,
    `${eyeX - px * halfEye},${eyeY - py * halfEye}`,
  ].join(' ');

  return (
    <>
      {/* Wide outer glow */}
      <polygon
        points={points}
        fill="url(#laser-rainbow)"
        opacity={0.25}
        filter="url(#laser-glow)"
      />
      {/* Mid glow layer */}
      <polygon
        points={points}
        fill="url(#laser-rainbow)"
        opacity={0.5}
        filter="url(#beam-glow)"
      />
      {/* Inner bright beam */}
      <polygon
        points={points}
        fill="url(#laser-rainbow)"
        opacity={0.9}
      />
    </>
  );
}
