import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../lib/progression';

/**
 * Animated mini scan sequence — terminal text typing out module names.
 * Shows the app "in action", not a static screenshot.
 */

const MODULES = [
  'DNS Security',
  'CMS Infrastructure',
  'Page Metadata',
  'Performance Audit',
  'Accessibility',
  'Core Web Vitals',
  'Ad Tech Detection',
  'PR & Media Coverage',
  'Careers & HR',
  'E-Commerce & SaaS',
];

const BOOT_LINES = [
  '> INITIATING GHOSTSCAN™ PROTOCOL...',
  '> CONNECTING TO TARGET...',
  '> STEALTH PROFILE LOADED',
  '> BROWSER CONTEXT READY',
  '',
];

export const ScanSequenceAfter: React.FC = () => {
  const frame = useCurrentFrame();

  // Boot lines appear first (0-15f)
  const bootProgress = Math.floor(interpolate(frame, [0, 18], [0, BOOT_LINES.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));

  // Module extraction starts at frame 18
  const moduleStart = 20;
  const moduleProgress = Math.floor(interpolate(
    frame,
    [moduleStart, moduleStart + MODULES.length * 4],
    [0, MODULES.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ));

  // Progress bar
  const totalModules = MODULES.length;
  const progressPct = Math.min(Math.floor((moduleProgress / totalModules) * 100), 100);
  const barWidth = Math.floor((moduleProgress / totalModules) * 30);

  // Cursor blink
  const cursorVisible = frame % 12 < 8;

  // Scan complete flash
  const scanComplete = moduleProgress >= totalModules;
  const completeOpacity = scanComplete
    ? interpolate(frame, [moduleStart + totalModules * 4, moduleStart + totalModules * 4 + 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill
      style={{
        background: C.void,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 140px',
      }}
    >
      {/* Terminal window chrome */}
      <div
        style={{
          background: '#111',
          borderRadius: 12,
          border: `1px solid ${C.deep}`,
          padding: '24px 32px',
          fontFamily: 'JetBrains Mono, Geist Mono, monospace',
          fontSize: 15,
          lineHeight: 1.8,
          maxWidth: 900,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Title bar dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F56' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27C93F' }} />
          <span style={{ marginLeft: 12, fontSize: 11, color: C.mid, letterSpacing: '0.1em' }}>
            GHOSTSCAN™ ENGINE v4.2
          </span>
        </div>

        {/* Boot lines */}
        {BOOT_LINES.slice(0, bootProgress).map((line, i) => (
          <div key={`boot-${i}`} style={{ color: line ? C.terminal : 'transparent', minHeight: 14 }}>
            {line || '\u00A0'}
          </div>
        ))}

        {/* Module extraction lines */}
        {MODULES.slice(0, moduleProgress).map((mod, i) => (
          <div key={`mod-${i}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.light }}>  {mod}</span>
            <span style={{ color: C.terminal, fontWeight: 700 }}>EXTRACTED</span>
          </div>
        ))}

        {/* Progress bar */}
        {moduleProgress > 0 && (
          <div style={{ marginTop: 12, color: C.base }}>
            [{'\u2588'.repeat(barWidth)}{'\u2591'.repeat(30 - barWidth)}] {progressPct}%
          </div>
        )}

        {/* Scan complete */}
        {scanComplete && (
          <div style={{ marginTop: 8, color: C.base, fontWeight: 700, opacity: completeOpacity }}>
            {'>'} SCAN COMPLETE — MarketingIQ CALCULATED
          </div>
        )}

        {/* Cursor */}
        {!scanComplete && cursorVisible && (
          <span style={{ color: C.terminal }}>▊</span>
        )}
      </div>
    </AbsoluteFill>
  );
};
