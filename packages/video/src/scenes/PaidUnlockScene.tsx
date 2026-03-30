import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { ChloeSprite } from '../components/ChloeSprite';
import { COLOR } from '../lib/constants';

/**
 * Scene 5: Paid Unlock (7s)
 * Frosted overlay on slide → lifts to reveal full data →
 * Synthesis slides appear → price tag.
 */

const SYNTHESIS_ITEMS = [
  { icon: '📋', title: 'Executive Brief', desc: 'AI-written strategic analysis' },
  { icon: '🗺️', title: '90-Day Roadmap', desc: 'Prioritized action plan' },
  { icon: '💰', title: 'ROI Projections', desc: 'Revenue impact modeling' },
  { icon: '✂️', title: 'Cost Cutter', desc: 'Redundant tool savings' },
];

export const PaidUnlockScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Frosted card (0-60 frames / 2s)
  const frostOpacity = interpolate(frame, [0, 15, 60, 80], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Frosted overlay lifts up
  const frostY = interpolate(frame, [60, 90], [0, -800], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 2: Synthesis cards cascade (80-180 frames / ~3.3s)
  const synthStart = 80;

  // Phase 3: Price reveal (160-210 frames / ~1.7s)
  const priceStart = 160;
  const priceScale = spring({
    frame: Math.max(0, frame - priceStart),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Chloé celebrating at end
  const chloeState = frame > 160 ? 'celebrating' : frame > 80 ? 'smug' : 'idle';

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* Background glow */}
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

      {/* Frosted overlay card (represents locked report) */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 80,
          right: 80,
          height: 700,
          opacity: frostOpacity,
          transform: `translateY(${frostY}px)`,
        }}
      >
        {/* Fake report content behind frost */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: COLOR.deep,
            borderRadius: 10,
            padding: 40,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Blurred content placeholder */}
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 16,
                width: `${40 + Math.sin(i * 2) * 30}%`,
                background: `${COLOR.mid}33`,
                borderRadius: 4,
                marginBottom: 12,
              }}
            />
          ))}

          {/* Frost overlay */}
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
            {/* Lock icon */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="22" width="32" height="22" rx="4" stroke={COLOR.base} strokeWidth="2" fill={`${COLOR.base}11`} />
              <path d="M14 22V16a10 10 0 0 1 20 0v6" stroke={COLOR.base} strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <div
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 16,
                color: COLOR.light,
                letterSpacing: '0.05em',
              }}
            >
              42 more modules available
            </div>
            <div
              style={{
                padding: '12px 32px',
                background: COLOR.base,
                borderRadius: 8,
                fontFamily: 'Geist Mono, monospace',
                fontSize: 15,
                fontWeight: 600,
                color: COLOR.void,
              }}
            >
              Declassify $24.99
            </div>
          </div>
        </div>
      </div>

      {/* Synthesis cards */}
      {frame >= synthStart && (
        <div
          style={{
            position: 'absolute',
            top: 280,
            left: 60,
            right: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 36,
              fontWeight: 700,
              color: COLOR.light,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
              opacity: interpolate(frame, [synthStart, synthStart + 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            AI Synthesis Unlocked
          </div>

          {SYNTHESIS_ITEMS.map((item, i) => {
            const cardDelay = synthStart + 10 + i * 15;
            const cardSpring = spring({
              frame: Math.max(0, frame - cardDelay),
              fps,
              config: { damping: 80, stiffness: 150 },
            });

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
                  <div
                    style={{
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 20,
                      fontWeight: 600,
                      color: COLOR.light,
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 14,
                      color: COLOR.mid,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Price tag reveal */}
      {frame >= priceStart && (
        <div
          style={{
            position: 'absolute',
            bottom: 260,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            transform: `scale(${priceScale})`,
          }}
        >
          <div
            style={{
              padding: '20px 48px',
              background: `linear-gradient(135deg, ${COLOR.base}, ${COLOR.bright})`,
              borderRadius: 12,
              boxShadow: `0 0 40px ${COLOR.base}44`,
            }}
          >
            <span
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: 36,
                fontWeight: 700,
                color: COLOR.void,
                letterSpacing: '-0.02em',
              }}
            >
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
          opacity: interpolate(frame, [synthStart, synthStart + 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <ChloeSprite
          state={chloeState}
          size={160}
          glowing
          frame={Math.floor(frame / 8)}
        />
      </div>
    </AbsoluteFill>
  );
};
