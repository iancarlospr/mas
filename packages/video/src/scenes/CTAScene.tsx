import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { ChloeSprite } from '../components/ChloeSprite';
import { COLOR, DEMO_URL } from '../lib/constants';

/**
 * Scene 6: CTA (5s)
 * Domain + tagline + Chloé wink.
 * "Stop guessing. Start scanning."
 */

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo / brand appears
  const logoSpring = spring({ frame, fps, config: { damping: 80, stiffness: 180 } });

  // Tagline types in
  const tagline = 'Stop guessing. Start scanning.';
  const taglineStart = 30;
  const taglineChars = Math.floor(
    interpolate(frame, [taglineStart, taglineStart + tagline.length * 2], [0, tagline.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // URL appears
  const urlStart = taglineStart + tagline.length * 2 + 15;
  const urlOpacity = interpolate(frame, [urlStart, urlStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlY = interpolate(frame, [urlStart, urlStart + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Chloé winks
  const chloeFrame = Math.floor(frame / 8);

  // Pulsing glow behind brand
  const glowPulse = 1 + Math.sin(frame * 0.06) * 0.3;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* Center radial glow */}
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

      {/* Brand mark */}
      <div
        style={{
          position: 'absolute',
          top: 540,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${logoSpring})`,
        }}
      >
        {/* ALPHA SCAN text mark */}
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 80,
            fontWeight: 800,
            color: COLOR.light,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            textAlign: 'center',
          }}
        >
          ALPHA
          <br />
          <span style={{ color: COLOR.base }}>SCAN</span>
        </div>
      </div>

      {/* Chloé above brand */}
      <div
        style={{
          position: 'absolute',
          top: 360,
          left: '50%',
          transform: `translateX(-50%) translateY(${Math.sin(frame * 0.08) * 6}px)`,
          opacity: logoSpring,
        }}
      >
        <ChloeSprite
          state="smug"
          size={160}
          glowing
          frame={chloeFrame}
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          top: 830,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'Permanent Marker, cursive',
            fontSize: 44,
            color: COLOR.base,
            letterSpacing: '0.04em',
            textShadow: '0 0 30px rgba(255,178,239,0.3)',
          }}
        >
          {tagline.slice(0, taglineChars)}
          {taglineChars < tagline.length && frame >= taglineStart && frame % 16 < 10 && (
            <span style={{ color: COLOR.light }}>|</span>
          )}
        </span>
      </div>

      {/* URL */}
      <div
        style={{
          position: 'absolute',
          top: 940,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: urlOpacity,
          transform: `translateY(${urlY}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 36px',
            background: `${COLOR.deep}dd`,
            borderRadius: 10,
            border: `1px solid ${COLOR.base}33`,
          }}
        >
          <span
            style={{
              fontFamily: 'Geist Mono, monospace',
              fontSize: 22,
              color: COLOR.light,
              letterSpacing: '0.02em',
            }}
          >
            marketingalphascan.com
          </span>
        </div>
      </div>

      {/* Bottom text */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: urlOpacity,
        }}
      >
        <span
          style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 14,
            color: COLOR.mid,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          42 modules. AI-powered. Your full MarTech audit.
        </span>
      </div>

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,178,239,0.01) 2px, rgba(255,178,239,0.01) 4px)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
