import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { WindowChrome } from '../components/WindowChrome';
import { COLOR, DEMO_DOMAIN, ASCII_BRAND } from '../lib/constants';

/**
 * Scene 2: Scan Input (5s)
 * scan.exe window flies in → URL types itself → button clicks.
 */

export const ScanInputScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window open animation (0-20 frames)
  const windowScale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  const windowOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // URL typewriter — starts at frame 40
  const typeStart = 40;
  const urlCharsVisible = Math.floor(
    interpolate(frame, [typeStart, typeStart + DEMO_DOMAIN.length * 4], [0, DEMO_DOMAIN.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const typedUrl = DEMO_DOMAIN.slice(0, urlCharsVisible);
  const cursorVisible = frame >= typeStart && frame % 16 < 10;
  const typingDone = urlCharsVisible >= DEMO_DOMAIN.length;

  // Button click flash — after typing completes
  const clickFrame = typeStart + DEMO_DOMAIN.length * 4 + 15;
  const isClicked = frame >= clickFrame;
  const clickFlash = isClicked
    ? interpolate(frame, [clickFrame, clickFrame + 6], [1, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  // Glow border sweep animation
  const glowAngle = (frame * 3) % 360;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* Desktop grid dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLOR.mid}22 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.4,
        }}
      />

      {/* Window */}
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
            {/* ASCII brand */}
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

            {/* Headline */}
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
                Your website is losing you money.
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
                Let&apos;s fix that.
              </div>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Nudge CTA */}
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

            {/* Arrow */}
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

            {/* Input row */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                width: '100%',
                maxWidth: 580,
              }}
            >
              {/* URL input with glow border */}
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
                  {typedUrl || (
                    <span style={{ color: COLOR.mid }}>Enter URL: nike.com</span>
                  )}
                  {cursorVisible && !typingDone && (
                    <span style={{ color: COLOR.base }}>|</span>
                  )}
                </div>
              </div>

              {/* Button */}
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
                  boxShadow: clickFlash > 0
                    ? `0 0 ${40 * clickFlash}px rgba(255,178,239,${0.6 * clickFlash})`
                    : 'none',
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
