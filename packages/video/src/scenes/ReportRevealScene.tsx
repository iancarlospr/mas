import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { COLOR, DEMO_DOMAIN, ASCII_BRAND } from '../lib/constants';

/**
 * Scene 4: Report Reveal (12s)
 * Title slide flies in → score ring animates → verdict slide plasma →
 * module cards cascade in from sides.
 */

const CATEGORIES = [
  { name: 'SEO & Content', score: 71, color: COLOR.terminal },
  { name: 'Paid Media', score: 69, color: COLOR.warning },
  { name: 'Market Intel', score: 69, color: COLOR.warning },
  { name: 'Analytics', score: 62, color: COLOR.warning },
  { name: 'MarTech', score: 62, color: COLOR.warning },
  { name: 'Security', score: 58, color: COLOR.warning },
  { name: 'Performance', score: 54, color: COLOR.warning },
  { name: 'Brand', score: 38, color: COLOR.critical },
];

const OVERALL_SCORE = 59;
const VERDICT = "Ryder's ad budget is the most generous donation Alphabet never asked for";

const MODULE_FINDINGS = [
  { title: '48 third-party scripts', severity: 'critical', desc: '338KB from 21 domains — massive performance drag across every page load' },
  { title: '5.2MB page weight', severity: 'critical', desc: '4.1MB images + 896KB scripts — users on mobile are waiting forever' },
  { title: 'Dual TMS conflict', severity: 'warning', desc: 'GTM + Adobe Experience Platform Launch both active — risking duplicate fires' },
  { title: '0% SRI coverage', severity: 'warning', desc: 'Zero subresource integrity on 5 cross-origin resources including Optimizely CDN' },
  { title: 'SPF record present', severity: 'good', desc: 'Email auth with soft-fail and low DNS lookup count — recommend tightening to hard-fail' },
  { title: 'DMARC quarantine active', severity: 'good', desc: 'Quarantine policy with reporting — recommend escalating to reject' },
];

export const ReportRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Phase 1: Title slide (0-120 frames / 4s) ──
  const titleScale = spring({ frame, fps, config: { damping: 100 } });
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Score ring animation
  const scoreProgress = interpolate(frame, [30, 100], [0, OVERALL_SCORE / 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Score number counter
  const scoreDisplay = Math.round(scoreProgress * 100);

  // ── Phase 2: Verdict slide (120-210 frames / 3s) ──
  const verdictPhaseStart = 120;
  const verdictOpacity = interpolate(frame, [verdictPhaseStart, verdictPhaseStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 3: Findings cascade (210-360 frames / 5s) ──
  const findingsStart = 210;

  // Which phase to show
  const showTitle = frame < verdictPhaseStart + 20;
  const showVerdict = frame >= verdictPhaseStart && frame < findingsStart + 20;
  const showFindings = frame >= findingsStart;

  return (
    <AbsoluteFill style={{ background: COLOR.void }}>
      {/* ── Title Slide ── */}
      {showTitle && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: frame >= verdictPhaseStart ? interpolate(frame, [verdictPhaseStart, verdictPhaseStart + 20], [1, 0], { extrapolateRight: 'clamp' }) : titleOpacity,
            transform: `scale(${0.08 + titleScale * 0.92})`,
          }}
        >
          <TitleSlideContent score={scoreDisplay} scoreProgress={scoreProgress} frame={frame} />
        </div>
      )}

      {/* ── Verdict Slide ── */}
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
          <VerdictSlideContent frame={frame - verdictPhaseStart} text={VERDICT} />
        </div>
      )}

      {/* ── Findings Cascade ── */}
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
          <FindingsContent frame={frame - findingsStart} fps={fps} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Title slide — ASCII brand + domain + score ring */
function TitleSlideContent({
  score,
  scoreProgress,
  frame,
}: {
  score: number;
  scoreProgress: number;
  frame: number;
}) {
  const scoreEndDeg = scoreProgress * 360;
  const scoreColor = score >= 70 ? COLOR.terminal : score >= 40 ? COLOR.warning : COLOR.critical;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 60px',
        background: COLOR.void,
      }}
    >
      {/* ASCII brand */}
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

      {/* Main content: domain + score */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {/* Left: domain */}
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 96,
              fontWeight: 600,
              color: COLOR.light,
              textTransform: 'uppercase',
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
            }}
          >
            {DEMO_DOMAIN}
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
            Developing
          </div>
        </div>

        {/* Right: score ring */}
        <div style={{ width: 360, height: 360, position: 'relative' }}>
          <svg viewBox="0 0 360 360" style={{ width: '100%', height: '100%' }}>
            {/* Track */}
            <circle cx="180" cy="180" r="140" fill="none" stroke="rgba(255,178,239,0.06)" strokeWidth="8" />
            {/* Score arc */}
            {scoreEndDeg > 0 && (
              <circle
                cx="180" cy="180" r="140"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(scoreEndDeg / 360) * 2 * Math.PI * 140} ${2 * Math.PI * 140}`}
                transform="rotate(-90 180 180)"
                style={{
                  filter: `drop-shadow(0 0 8px ${scoreColor}55)`,
                }}
              />
            )}
            {/* Category segments */}
            {CATEGORIES.map((cat, i) => {
              const segAngle = 360 / CATEGORIES.length;
              const startDeg = i * segAngle;
              const catProgress = interpolate(frame, [40 + i * 5, 80 + i * 5], [0, cat.score / 100], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <circle
                  key={cat.name}
                  cx="180" cy="180" r="158"
                  fill="none"
                  stroke={cat.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.7"
                  strokeDasharray={`${catProgress * segAngle * Math.PI * 158 / 180} ${2 * Math.PI * 158}`}
                  transform={`rotate(${startDeg - 90} 180 180)`}
                />
              );
            })}
          </svg>
          {/* Center number */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 80,
                fontWeight: 700,
                color: COLOR.light,
                lineHeight: 0.85,
                letterSpacing: '-0.04em',
              }}
            >
              {score}
            </div>
            <div
              style={{
                fontFamily: 'Geist Mono, monospace',
                fontSize: 11,
                color: COLOR.mid,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: 8,
              }}
            >
              MarketingIQ
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: meta pills */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          fontFamily: 'Geist Mono, monospace',
          fontSize: 13,
        }}
      >
        <MetaPill label="Date" value="March 20, 2026" />
        <MetaPill label="Modules" value="43 / 45" />
        <MetaPill label="Tier" value="Paid" accent />
      </div>
    </div>
  );
}

function MetaPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: COLOR.mid, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>
        {label}
      </span>
      <span style={{ color: accent ? COLOR.base : COLOR.light, fontWeight: accent ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}

/** Verdict slide — plasma background + big quote */
function VerdictSlideContent({ frame, text }: { frame: number; text: string }) {
  // Simplified plasma: gradient hue shifts over time
  const hue1 = 300 + Math.sin(frame * 0.04) * 40;
  const hue2 = 280 + Math.cos(frame * 0.03) * 30;

  const textOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Plasma gradient */}
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

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 0%, rgba(8,8,8,0.25) 55%, rgba(8,8,8,0.7) 100%)',
          zIndex: 2,
        }}
      />

      {/* Content */}
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
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#fff',
            textAlign: 'center',
            textShadow: '0 0 40px rgba(255,178,239,0.35), 0 2px 4px rgba(0,0,0,0.5)',
            maxWidth: '90%',
          }}
        >
          &ldquo;{text}&rdquo;
        </h2>
      </div>
    </div>
  );
}

/** Findings cascade — cards fly in */
function FindingsContent({ frame, fps }: { frame: number; fps: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 60px',
        gap: 16,
        background: COLOR.void,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: 40,
          fontWeight: 700,
          color: COLOR.light,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
          opacity: interpolate(frame, [0, 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        Key Findings
      </div>

      {/* Finding cards */}
      {MODULE_FINDINGS.map((finding, i) => {
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
            {/* Severity dot */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: severityColor,
                boxShadow: `0 0 8px ${severityColor}66`,
                flexShrink: 0,
              }}
            />
            {/* Content */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLOR.light,
                  marginBottom: 4,
                }}
              >
                {finding.title}
              </div>
              <div
                style={{
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 14,
                  color: COLOR.mid,
                  lineHeight: 1.4,
                }}
              >
                {finding.desc}
              </div>
            </div>
            {/* Severity badge */}
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
