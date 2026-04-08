import React from 'react';
import {
  Sequence,
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { ChloeSprite } from './components/ChloeSprite';
import { WindowChrome } from './components/WindowChrome';
import { GrainOverlay } from './components/GrainOverlay';
import { COLOR, WIDTH, HEIGHT, FPS, ASCII_BRAND, SCENE, TOTAL_DURATION } from './lib/constants';
import {
  ER_DOMAIN,
  ER_SCORE,
  ER_LABEL,
  ER_DATE,
  ER_MODULES_RAN,
  ER_VERDICT,
  ER_HOOK_LINE,
  ER_SUBLINE,
  ER_CATEGORIES,
  ER_FINDINGS,
  ER_BOOT_LINES,
  ER_MODULE_LINES,
  ER_WINS,
  ER_TOP_ISSUES,
} from './lib/expertradiology';

// ═══════════════════════════════════════════════════════════════════
// SCENE 1 — Hook (4s)
// Chloé floats in → laser eyes → hook text types
// ═══════════════════════════════════════════════════════════════════

function rainbowColor(t: number): string {
  const hue = (t * 360) % 360;
  return `hsl(${hue}, 100%, 65%)`;
}

const ERHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chloeY = interpolate(
    spring({ frame, fps, config: { damping: 80, stiffness: 120 } }),
    [0, 1],
    [400, 0],
  );
  const chloeOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const floatY = Math.sin(frame * 0.08) * 8;
  const glowScale = 1 + Math.sin(frame * 0.1) * 0.05;
  const pxScale = 256 / 32;
  const chloeTopY = 520 + chloeY + floatY;
  const eyeY = chloeTopY + 14.5 * pxScale;

  // Laser eyes
  const laserStart = 25;
  const laserEnd = 65;
  const laserActive = frame >= laserStart && frame < laserEnd;
  const laserProgress = interpolate(frame, [laserStart, laserEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const beamWidth = 28 + Math.sin(frame * 0.3) * 4;
  const beamTargetWidth = 60 + Math.sin(frame * 0.2) * 8;
  const beamTargetX = interpolate(laserProgress, [0, 0.4, 0.6, 1], [540, WIDTH + 50, -50, 540], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const laserOpacity = laserActive
    ? interpolate(frame, [laserStart, laserStart + 5, laserEnd - 8, laserEnd], [0, 0.9, 0.9, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const hueShift = frame * 8;

  // Typewriter
  const typeStart = 30;
  const charsVisible = Math.floor(
    interpolate(frame, [typeStart, typeStart + ER_HOOK_LINE.length * 2], [0, ER_HOOK_LINE.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const hookText = ER_HOOK_LINE.slice(0, charsVisible);
  const showCursor = frame >= typeStart && frame % 16 < 10;

  const sublineStart = typeStart + ER_HOOK_LINE.length * 2 + 10;
  const sublineOpacity = interpolate(frame, [sublineStart, sublineStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sublineY = interpolate(frame, [sublineStart, sublineStart + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chloeState = laserActive ? 'scanning' : frame > 65 ? 'smug' : 'idle';

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
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

      {/* Laser beams */}
      {laserActive && (
        <svg
          width={WIDTH}
          height={HEIGHT}
          style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', opacity: laserOpacity }}
        >
          <defs>
            <linearGradient id="er-laser-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              {Array.from({ length: 8 }, (_, i) => (
                <stop key={i} offset={`${(i / 7) * 100}%`} stopColor={rainbowColor(i / 7 + hueShift / 360)} />
              ))}
            </linearGradient>
            <filter id="er-laser-glow">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="er-beam-glow">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {(() => {
            const spriteLeft = 540 - 128;
            const leftEyeX = spriteLeft + 9.5 * pxScale;
            const rightEyeX = spriteLeft + 21.5 * pxScale;
            return (
              <>
                <LaserBeam eyeX={leftEyeX} eyeY={eyeY} targetX={beamTargetX} targetY={eyeY + (beamTargetX - 540) * 0.12} widthAtEye={beamWidth} widthAtTarget={beamTargetWidth} />
                <LaserBeam eyeX={rightEyeX} eyeY={eyeY} targetX={beamTargetX} targetY={eyeY + (beamTargetX - 540) * 0.12} widthAtEye={beamWidth} widthAtTarget={beamTargetWidth} />
                <circle cx={leftEyeX} cy={eyeY} r={16 + Math.sin(frame * 0.3) * 4} fill={COLOR.base} opacity={0.95} filter="url(#er-laser-glow)" />
                <circle cx={rightEyeX} cy={eyeY} r={16 + Math.sin(frame * 0.3) * 4} fill={COLOR.base} opacity={0.95} filter="url(#er-laser-glow)" />
              </>
            );
          })()}
        </svg>
      )}

      {/* Chloé */}
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
        <ChloeSprite state={chloeState} size={256} glowing frame={laserActive ? 0 : Math.floor(frame / 8)} />
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
          {showCursor && <span style={{ color: COLOR.base }}>|</span>}
        </h1>
        <div style={{ opacity: sublineOpacity, transform: `translateY(${sublineY}px)` }}>
          <span
            style={{
              fontFamily: 'Permanent Marker, cursive',
              fontSize: 72,
              color: COLOR.base,
              letterSpacing: '-0.06em',
              textShadow: '0 0 40px rgba(255,178,239,0.3)',
            }}
          >
            {ER_SUBLINE}
          </span>
        </div>
      </div>

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,178,239,0.015) 2px, rgba(255,178,239,0.015) 4px)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SCENE 2 — Scan Input (5s)
// scan.exe window → URL types → button clicks
// ═══════════════════════════════════════════════════════════════════

const ERScanInputScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowScale = spring({ frame, fps, config: { damping: 100, stiffness: 200 } });
  const windowOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  const typeStart = 40;
  const urlCharsVisible = Math.floor(
    interpolate(frame, [typeStart, typeStart + ER_DOMAIN.length * 4], [0, ER_DOMAIN.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const typedUrl = ER_DOMAIN.slice(0, urlCharsVisible);
  const cursorVisible = frame >= typeStart && frame % 16 < 10;
  const typingDone = urlCharsVisible >= ER_DOMAIN.length;

  const clickFrame = typeStart + ER_DOMAIN.length * 4 + 15;
  const isClicked = frame >= clickFrame;
  const clickFlash = isClicked
    ? interpolate(frame, [clickFrame, clickFrame + 6], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  const glowAngle = (frame * 3) % 360;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLOR.mid}22 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.4,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${0.08 + windowScale * 0.92})`,
          opacity: windowOpacity,
        }}
      >
        <WindowChrome title="scan.exe" width={860} height={680}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '32px 48px',
              height: '100%',
            }}
          >
            <pre
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 8,
                lineHeight: 1.1,
                color: COLOR.base,
                textShadow: '0 0 12px rgba(255,178,239,0.25)',
                textAlign: 'center',
                marginBottom: 16,
                whiteSpace: 'pre',
              }}
            >
              {ASCII_BRAND}
            </pre>

            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 38,
                  fontWeight: 300,
                  color: COLOR.light,
                  lineHeight: 1.2,
                }}
              >
                {ER_HOOK_LINE}
              </div>
              <div
                style={{
                  fontFamily: 'Permanent Marker, cursive',
                  fontSize: 46,
                  color: COLOR.base,
                  letterSpacing: '0.04em',
                  marginTop: 4,
                }}
              >
                {ER_SUBLINE}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <div
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 14,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: COLOR.mid,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              MarTech breakdown. Strategic insights. Actionable recommendations.
            </div>

            <div
              style={{
                fontFamily: 'Permanent Marker, cursive',
                fontSize: 52,
                color: COLOR.base,
                marginBottom: 20,
                transform: `translateY(${Math.sin(frame * 0.15) * 4}px)`,
              }}
            >
              ↓
            </div>

            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 580 }}>
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  borderRadius: 7,
                  padding: 2,
                  background: `conic-gradient(from ${glowAngle}deg, ${COLOR.base}00, ${COLOR.base}88, ${COLOR.base}00)`,
                }}
              >
                <div
                  style={{
                    height: 44,
                    background: `${COLOR.light}ee`,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 18,
                    color: COLOR.void,
                  }}
                >
                  {typedUrl || <span style={{ color: COLOR.mid }}>Enter URL: nike.com</span>}
                  {cursorVisible && !typingDone && <span style={{ color: COLOR.base }}>|</span>}
                </div>
              </div>
              <div
                style={{
                  height: 48,
                  padding: '0 28px',
                  borderRadius: 7,
                  background: isClicked
                    ? `linear-gradient(135deg, ${COLOR.bright}, ${COLOR.base})`
                    : `linear-gradient(135deg, ${COLOR.base}, ${COLOR.bright})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 17,
                  fontWeight: 600,
                  color: COLOR.void,
                  boxShadow: clickFlash > 0 ? `0 0 ${40 * clickFlash}px rgba(255,178,239,${0.6 * clickFlash})` : 'none',
                  transform: isClicked ? 'scale(0.96)' : 'scale(1)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isClicked ? 'Scanning...' : 'Start GhostScan™'}
              </div>
            </div>
          </div>
        </WindowChrome>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SCENE 3 — Scan Sequence (10s)
// Matrix rain → terminal boot → module extraction
// ═══════════════════════════════════════════════════════════════════

function getTypeColor(type: string): string {
  switch (type) {
    case 'ok': return COLOR.terminal;
    case 'ghost': return COLOR.base;
    case 'scan': return COLOR.bright;
    case 'error': return COLOR.critical;
    default: return COLOR.mid;
  }
}

const ERScanSequenceScene: React.FC = () => {
  const frame = useCurrentFrame();

  const matrixPhase = frame < 90;
  const bootStart = 90;
  const bootLinesVisible = Math.floor(
    interpolate(frame, [bootStart, bootStart + 80], [0, ER_BOOT_LINES.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  const moduleStart = 180;
  const moduleLinesVisible = Math.floor(
    interpolate(frame, [moduleStart, moduleStart + 100], [0, ER_MODULE_LINES.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  const progress = interpolate(frame, [0, 295], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chloeFrame = Math.floor(frame / 8);
  const chloeOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      <MatrixRain frame={frame} opacity={matrixPhase ? 0.6 : 0.15} />

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
        {frame >= bootStart &&
          ER_BOOT_LINES.slice(0, bootLinesVisible).map((line, i) => (
            <div
              key={i}
              style={{
                color: getTypeColor(line.type),
                opacity: interpolate(
                  frame,
                  [bootStart + i * (80 / ER_BOOT_LINES.length), bootStart + i * (80 / ER_BOOT_LINES.length) + 8],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                ),
                textShadow: `0 0 8px ${getTypeColor(line.type)}44`,
              }}
            >
              <span style={{ color: COLOR.mid }}>{'> '}</span>
              {line.text}
            </div>
          ))}

        {frame >= moduleStart && (
          <div style={{ marginTop: 24 }}>
            {ER_MODULE_LINES.slice(0, moduleLinesVisible).map((line, i) => {
              const lineFrame = moduleStart + i * (100 / ER_MODULE_LINES.length);
              const lineOpacity = interpolate(frame, [lineFrame, lineFrame + 5], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const flashIntensity = interpolate(frame, [lineFrame, lineFrame + 10], [0.8, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
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

      <div
        style={{
          position: 'absolute',
          bottom: 140,
          left: 60,
          right: 60,
          height: 4,
          background: COLOR.deep,
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
        {Math.round(progress)}% — SCANNING {ER_DOMAIN.toUpperCase()}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.02) 2px, rgba(0,255,136,0.02) 4px)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SCENE 4 — Report Reveal (12s)
// Title slide → score ring → verdict → findings cascade
// ═══════════════════════════════════════════════════════════════════

const ERReportRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 100 } });
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  const scoreProgress = interpolate(frame, [30, 100], [0, ER_SCORE / 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scoreDisplay = Math.round(scoreProgress * 100);

  const verdictPhaseStart = 120;
  const verdictOpacity = interpolate(frame, [verdictPhaseStart, verdictPhaseStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const findingsStart = 210;

  const showTitle = frame < verdictPhaseStart + 20;
  const showVerdict = frame >= verdictPhaseStart && frame < findingsStart + 20;
  const showFindings = frame >= findingsStart;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {showTitle && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: frame >= verdictPhaseStart
              ? interpolate(frame, [verdictPhaseStart, verdictPhaseStart + 20], [1, 0], { extrapolateRight: 'clamp' })
              : titleOpacity,
            transform: `scale(${0.08 + titleScale * 0.92})`,
          }}
        >
          <ERTitleSlide score={scoreDisplay} scoreProgress={scoreProgress} frame={frame} />
        </div>
      )}

      {showVerdict && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: frame >= findingsStart
              ? interpolate(frame, [findingsStart, findingsStart + 20], [1, 0], { extrapolateRight: 'clamp' })
              : verdictOpacity,
          }}
        >
          <ERVerdictSlide frame={frame - verdictPhaseStart} />
        </div>
      )}

      {showFindings && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: interpolate(frame, [findingsStart, findingsStart + 15], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <ERFindingsSlide frame={frame - findingsStart} fps={fps} />
        </div>
      )}

      <GrainOverlay opacity={0.04} />
    </AbsoluteFill>
  );
};

function ERTitleSlide({ score, scoreProgress, frame }: { score: number; scoreProgress: number; frame: number }) {
  const scoreEndDeg = scoreProgress * 360;
  const scoreColor = score >= 70 ? COLOR.terminal : score >= 40 ? COLOR.warning : COLOR.critical;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '80px 60px', background: COLOR.void }}>
      <pre
        style={{
          fontFamily: 'Geist Mono, monospace',
          fontSize: 7,
          lineHeight: 1.1,
          color: COLOR.base,
          textShadow: '0 0 12px rgba(255,178,239,0.25)',
          marginBottom: 8,
          whiteSpace: 'pre',
        }}
      >
        {ASCII_BRAND}
      </pre>
      <div
        style={{
          fontFamily: 'Geist Mono, monospace',
          fontSize: 14,
          letterSpacing: '0.2em',
          color: COLOR.mid,
          textTransform: 'uppercase',
          marginBottom: 60,
        }}
      >
        Marketing Technology Audit
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 80,
              fontWeight: 600,
              color: COLOR.light,
              textTransform: 'uppercase',
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
            }}
          >
            {ER_DOMAIN}
          </h1>
          <div
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 42,
              fontWeight: 300,
              color: scoreColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: 16,
            }}
          >
            {ER_LABEL}
          </div>
        </div>

        <div style={{ width: 360, height: 360, position: 'relative' }}>
          <svg viewBox="0 0 360 360" style={{ width: '100%', height: '100%' }}>
            <circle cx="180" cy="180" r="140" fill="none" stroke="rgba(255,178,239,0.06)" strokeWidth="8" />
            {scoreEndDeg > 0 && (
              <circle
                cx="180" cy="180" r="140"
                fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(scoreEndDeg / 360) * 2 * Math.PI * 140} ${2 * Math.PI * 140}`}
                transform="rotate(-90 180 180)"
                style={{ filter: `drop-shadow(0 0 8px ${scoreColor}55)` }}
              />
            )}
            {ER_CATEGORIES.map((cat, i) => {
              const segAngle = 360 / ER_CATEGORIES.length;
              const startDeg = i * segAngle;
              const catProgress = interpolate(frame, [40 + i * 5, 80 + i * 5], [0, cat.score / 100], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <circle
                  key={cat.name}
                  cx="180" cy="180" r="158"
                  fill="none" stroke={cat.color} strokeWidth="4" strokeLinecap="round" opacity="0.7"
                  strokeDasharray={`${catProgress * segAngle * Math.PI * 158 / 180} ${2 * Math.PI * 158}`}
                  transform={`rotate(${startDeg - 90} 180 180)`}
                />
              );
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 80, fontWeight: 700, color: COLOR.light, lineHeight: 0.85, letterSpacing: '-0.04em' }}>
              {score}
            </div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: COLOR.mid, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 8 }}>
              MarketingIQ
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, fontFamily: 'Geist Mono, monospace', fontSize: 13 }}>
        <MetaPill label="Date" value={ER_DATE} />
        <MetaPill label="Modules" value={ER_MODULES_RAN} />
        <MetaPill label="Tier" value="Paid" accent />
      </div>
    </div>
  );
}

function MetaPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: COLOR.mid, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>{label}</span>
      <span style={{ color: accent ? COLOR.base : COLOR.light, fontWeight: accent ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function ERVerdictSlide({ frame }: { frame: number }) {
  const hue1 = 300 + Math.sin(frame * 0.04) * 40;
  const hue2 = 280 + Math.cos(frame * 0.03) * 30;
  const textOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: -50,
          background: `
            radial-gradient(ellipse 80% 60% at 30% 40%, hsl(${hue1}, 65%, 18%) 0%, transparent 70%),
            radial-gradient(ellipse 60% 80% at 70% 60%, hsl(${hue2}, 70%, 15%) 0%, transparent 70%),
            radial-gradient(ellipse 90% 90% at 50% 50%, hsl(310, 60%, 12%) 0%, ${COLOR.void} 100%)
          `,
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 0%, rgba(8,8,8,0.25) 55%, rgba(8,8,8,0.7) 100%)',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 80px',
          zIndex: 3,
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.3em',
            color: COLOR.base,
            textTransform: 'uppercase',
            textShadow: '0 0 20px rgba(255,178,239,0.4)',
            marginBottom: 24,
          }}
        >
          AlphaScan Verdict
        </p>
        <h2
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#fff',
            textAlign: 'center',
            textShadow: '0 0 40px rgba(255,178,239,0.35), 0 2px 4px rgba(0,0,0,0.5)',
            maxWidth: '90%',
          }}
        >
          &ldquo;{ER_VERDICT}&rdquo;
        </h2>
      </div>
    </div>
  );
}

function ERFindingsSlide({ frame, fps }: { frame: number; fps: number }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '80px 60px', gap: 16, background: COLOR.void }}>
      <div
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: 40,
          fontWeight: 700,
          color: COLOR.light,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        Key Findings
      </div>

      {ER_FINDINGS.map((finding, i) => {
        const cardStart = 10 + i * 12;
        const slideIn = spring({
          frame: Math.max(0, frame - cardStart),
          fps,
          config: { damping: 80, stiffness: 150 },
        });
        const x = i % 2 === 0 ? -200 : 200;
        const severityColor =
          finding.severity === 'critical' ? COLOR.critical :
          finding.severity === 'warning' ? COLOR.warning :
          finding.severity === 'good' ? COLOR.terminal :
          COLOR.mid;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '20px 24px',
              background: `${COLOR.deep}cc`,
              borderRadius: 8,
              borderLeft: `3px solid ${severityColor}`,
              opacity: slideIn,
              transform: `translateX(${x * (1 - slideIn)}px)`,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: severityColor, boxShadow: `0 0 8px ${severityColor}66`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 600, color: COLOR.light, marginBottom: 4 }}>
                {finding.title}
              </div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: COLOR.mid, lineHeight: 1.4 }}>
                {finding.desc}
              </div>
            </div>
            <div
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 11,
                fontWeight: 600,
                color: severityColor,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '4px 10px',
                borderRadius: 4,
                background: `${severityColor}15`,
                flexShrink: 0,
              }}
            >
              {finding.severity}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 5 — Paid Unlock (7s)
// Frosted overlay lifts → synthesis cards → price
// ═══════════════════════════════════════════════════════════════════

const SYNTHESIS_ITEMS = [
  { icon: '📋', title: 'Executive Brief', desc: 'AI-written strategic analysis' },
  { icon: '🗺️', title: '90-Day Roadmap', desc: 'Prioritized action plan' },
  { icon: '🔧', title: 'Stack Analyzer', desc: 'Redundant tool identification' },
  { icon: '👔', title: 'Boss Deck', desc: 'Board-ready presentation' },
];

const ERPaidUnlockScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frostOpacity = interpolate(frame, [0, 15, 60, 80], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const frostY = interpolate(frame, [60, 90], [0, -800], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const synthStart = 80;
  const priceStart = 160;
  const priceScale = spring({ frame: Math.max(0, frame - priceStart), fps, config: { damping: 80, stiffness: 200 } });

  const chloeState = frame > 160 ? 'celebrating' : frame > 80 ? 'smug' : 'idle';

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          width: 600,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(255,178,239,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Frosted locked card */}
      <div style={{ position: 'absolute', top: 200, left: 80, right: 80, height: 700, opacity: frostOpacity, transform: `translateY(${frostY}px)` }}>
        <div style={{ width: '100%', height: '100%', background: COLOR.deep, borderRadius: 10, padding: 40, position: 'relative', overflow: 'hidden' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ height: 16, width: `${40 + Math.sin(i * 2) * 30}%`, background: `${COLOR.mid}33`, borderRadius: 4, marginBottom: 12 }} />
          ))}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '55%',
              background: `linear-gradient(to bottom, transparent, ${COLOR.void}dd 20%, ${COLOR.void}ee)`,
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="22" width="32" height="22" rx="4" stroke={COLOR.base} strokeWidth="2" fill={`${COLOR.base}11`} />
              <path d="M14 22V16a10 10 0 0 1 20 0v6" stroke={COLOR.base} strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 16, color: COLOR.light, letterSpacing: '0.05em' }}>
              42 more modules available
            </div>
            <div style={{ padding: '12px 32px', background: COLOR.base, borderRadius: 8, fontFamily: 'Geist Mono, monospace', fontSize: 15, fontWeight: 600, color: COLOR.void }}>
              Declassify $24.99
            </div>
          </div>
        </div>
      </div>

      {/* Synthesis cards */}
      {frame >= synthStart && (
        <div style={{ position: 'absolute', top: 280, left: 60, right: 60, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 36,
              fontWeight: 700,
              color: COLOR.light,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
              opacity: interpolate(frame, [synthStart, synthStart + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            AI Synthesis Unlocked
          </div>
          {SYNTHESIS_ITEMS.map((item, i) => {
            const cardDelay = synthStart + 10 + i * 15;
            const cardSpring = spring({ frame: Math.max(0, frame - cardDelay), fps, config: { damping: 80, stiffness: 150 } });
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '24px 28px',
                  background: `${COLOR.deep}dd`,
                  borderRadius: 10,
                  border: `1px solid ${COLOR.base}22`,
                  opacity: cardSpring,
                  transform: `translateY(${30 * (1 - cardSpring)}px)`,
                }}
              >
                <div style={{ fontSize: 40, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 20, fontWeight: 600, color: COLOR.light, marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: COLOR.mid }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Price */}
      {frame >= priceStart && (
        <div style={{ position: 'absolute', bottom: 260, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${priceScale})` }}>
          <div style={{ padding: '20px 48px', background: `linear-gradient(135deg, ${COLOR.base}, ${COLOR.bright})`, borderRadius: 12, boxShadow: `0 0 40px ${COLOR.base}44` }}>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 700, color: COLOR.void, letterSpacing: '-0.02em' }}>
              Starting at $24.99
            </span>
          </div>
        </div>
      )}

      {/* Chloé */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          right: 80,
          transform: `translateY(${Math.sin(frame * 0.08) * 6}px)`,
          opacity: interpolate(frame, [synthStart, synthStart + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        <ChloeSprite state={chloeState} size={160} glowing frame={Math.floor(frame / 8)} />
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SCENE 6 — CTA (5s)
// Brand + tagline + URL
// ═══════════════════════════════════════════════════════════════════

const ERCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 80, stiffness: 180 } });

  const tagline = 'Stop guessing. Start scanning.';
  const taglineStart = 30;
  const taglineChars = Math.floor(
    interpolate(frame, [taglineStart, taglineStart + tagline.length * 2], [0, tagline.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  const urlStart = taglineStart + tagline.length * 2 + 15;
  const urlOpacity = interpolate(frame, [urlStart, urlStart + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const urlY = interpolate(frame, [urlStart, urlStart + 15], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const chloeFrame = Math.floor(frame / 8);
  const glowPulse = 1 + Math.sin(frame * 0.06) * 0.3;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          width: 800,
          height: 800,
          transform: `translate(-50%, -50%) scale(${glowPulse})`,
          background: 'radial-gradient(ellipse, rgba(255,178,239,0.08) 0%, transparent 60%)',
        }}
      />

      <div style={{ position: 'absolute', top: 540, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${logoSpring})` }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 80, fontWeight: 800, color: COLOR.light, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.95, textAlign: 'center' }}>
          ALPHA<br /><span style={{ color: COLOR.base }}>SCAN</span>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 360, left: '50%', transform: `translateX(-50%) translateY(${Math.sin(frame * 0.08) * 6}px)`, opacity: logoSpring }}>
        <ChloeSprite state="smug" size={160} glowing frame={chloeFrame} />
      </div>

      <div style={{ position: 'absolute', top: 830, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: 'Permanent Marker, cursive', fontSize: 44, color: COLOR.base, letterSpacing: '0.04em', textShadow: '0 0 30px rgba(255,178,239,0.3)' }}>
          {tagline.slice(0, taglineChars)}
          {taglineChars < tagline.length && frame >= taglineStart && frame % 16 < 10 && <span style={{ color: COLOR.light }}>|</span>}
        </span>
      </div>

      <div style={{ position: 'absolute', top: 940, left: 0, right: 0, textAlign: 'center', opacity: urlOpacity, transform: `translateY(${urlY}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 36px', background: `${COLOR.deep}dd`, borderRadius: 10, border: `1px solid ${COLOR.base}33` }}>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, color: COLOR.light, letterSpacing: '0.02em' }}>
            marketingalphascan.com
          </span>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 160, left: 0, right: 0, textAlign: 'center', opacity: urlOpacity }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: COLOR.mid, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          42 modules. AI-powered. Your full MarTech audit.
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,178,239,0.01) 2px, rgba(255,178,239,0.01) 4px)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHARED — Matrix Rain + Laser Beam
// ═══════════════════════════════════════════════════════════════════

function MatrixRain({ frame, opacity }: { frame: number; opacity: number }) {
  const cols = 45;
  const cellH = 24;
  const totalRows = Math.ceil(1920 / cellH) + 10;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZアイウエオカキクケコサシスセソ0123456789';

  const seed = (a: number, b: number) => {
    const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity, overflow: 'hidden' }}>
      {Array.from({ length: cols }, (_, col) => {
        const speed = 1.2 + seed(col, 0) * 2.5;
        const startOffset = seed(col, 1) * totalRows * 2;
        const trailLen = 15 + Math.floor(seed(col, 2) * 15);
        const x = (col / cols) * 1080;
        const headRow = (frame * speed + startOffset) % (totalRows + trailLen + 20);

        return (
          <div key={col} style={{ position: 'absolute', left: x, top: 0 }}>
            {Array.from({ length: totalRows }, (_, row) => {
              const dist = headRow - row;
              if (dist < 0 || dist > trailLen) return null;
              const brightness = dist === 0 ? 1.0 : Math.max(0, 1 - dist / trailLen);
              const charSeed = seed(col, row + Math.floor(frame * 0.15));
              const charIdx = Math.floor(charSeed * chars.length);
              const ch = chars[charIdx];
              const isHead = dist < 2;
              const color = isHead ? COLOR.light : COLOR.terminal;

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
                    opacity: brightness,
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

function LaserBeam({
  eyeX, eyeY, targetX, targetY, widthAtEye, widthAtTarget,
}: {
  eyeX: number; eyeY: number;
  targetX: number; targetY: number;
  widthAtEye: number; widthAtTarget: number;
}) {
  const dx = targetX - eyeX;
  const dy = targetY - eyeY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

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
      <polygon points={points} fill="url(#er-laser-rainbow)" opacity={0.25} filter="url(#er-laser-glow)" />
      <polygon points={points} fill="url(#er-laser-rainbow)" opacity={0.5} filter="url(#er-beam-glow)" />
      <polygon points={points} fill="url(#er-laser-rainbow)" opacity={0.9} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MUSIC & COMPOSITION
// ═══════════════════════════════════════════════════════════════════

const TYPING_START = 153;
const TYPING_END = 210;
const TYPING_DURATION = TYPING_END - TYPING_START;
const DUCK_RAMP = 10;

function useERMusicVolume(): number {
  const frame = useCurrentFrame();
  const base = interpolate(
    frame,
    [0, 15, TOTAL_DURATION - 45, TOTAL_DURATION],
    [0, 0.85, 0.85, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const duck = interpolate(
    frame,
    [TYPING_START - DUCK_RAMP, TYPING_START, TYPING_END, TYPING_END + DUCK_RAMP],
    [1, 0.1, 0.1, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return base * duck;
}

const ERMusicTrack: React.FC = () => {
  const volume = useERMusicVolume();
  return <Audio src={staticFile('music.mp3')} volume={volume} startFrom={0} />;
};

export const ExpertRadiologyReel: React.FC = () => {
  let offset = 0;

  const scenes = [
    { Component: ERHookScene, duration: SCENE.hook },
    { Component: ERScanInputScene, duration: SCENE.scanInput },
    { Component: ERScanSequenceScene, duration: SCENE.scanSequence },
    { Component: ERReportRevealScene, duration: SCENE.reportReveal },
    { Component: ERPaidUnlockScene, duration: SCENE.paidUnlock },
    { Component: ERCTAScene, duration: SCENE.cta },
  ];

  return (
    <AbsoluteFill style={{ background: '#080808' }}>
      <ERMusicTrack />

      <Sequence from={TYPING_START} durationInFrames={TYPING_DURATION} name="SFX: Typing">
        <Audio src={staticFile('sfx-typing.mp3')} volume={1.0} />
      </Sequence>

      {scenes.map(({ Component, duration }, i) => {
        const from = offset;
        offset += duration;
        return (
          <Sequence key={i} from={from} durationInFrames={duration} name={Component.name || `Scene ${i + 1}`}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
