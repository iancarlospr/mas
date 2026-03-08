'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M09 Slide — Behavioral Intelligence
 * ════════════════════════════════════
 *
 * Layout B: SlideShellAlt — left panel shows a "Behavioral Maturity Model"
 * feature checklist with detected tools, right panel has findings/recs.
 */

export function M09Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M09');
  const mod = getModuleResult(scan, 'M09');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Behavioral Intelligence" scan={scan} sourceLabel="Source: A/B testing detection, session recording, push notifications" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Behavioral analytics and experimentation maturity';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const behavioral = (raw?.['behavioral'] as Record<string, unknown> | undefined) ?? null;
  const experiments = (behavioral?.['experiments'] as string[] | undefined) ?? [];
  const sessionRecording = (behavioral?.['sessionRecording'] as string[] | undefined) ?? [];
  const heatmaps = (behavioral?.['heatmaps'] as string[] | undefined) ?? [];
  const personalization = (behavioral?.['personalization'] as string[] | undefined) ?? [];

  const storageExperiments = (raw?.['storageExperiments'] as Array<Record<string, unknown>> | undefined) ?? [];
  const overlays = (raw?.['overlays'] as Array<Record<string, unknown>> | undefined) ?? [];
  const pushNotifications = (raw?.['pushNotifications'] as Record<string, unknown> | undefined) ?? null;
  const contentGating = (raw?.['contentGating'] as Record<string, unknown> | undefined) ?? null;
  const hasScrollTracking = raw?.['hasScrollTracking'] === true;
  const hasClickTracking = raw?.['hasClickTracking'] === true;

  // Push data
  const pushDetected = pushNotifications?.['sdkDetected'] === true;
  const pushSdkName = typeof pushNotifications?.['sdkName'] === 'string' ? pushNotifications['sdkName'] as string : null;

  // Content gating
  const isGated = contentGating?.['isGated'] === true;
  const gatingType = typeof contentGating?.['gatingType'] === 'string' ? contentGating['gatingType'] as string : null;
  const paywallProvider = typeof contentGating?.['paywallProvider'] === 'string' ? contentGating['paywallProvider'] as string : null;

  // Maturity score calculation
  const capabilities = [
    { detected: experiments.length > 0, label: 'A/B Testing' },
    { detected: sessionRecording.length > 0, label: 'Session Recording' },
    { detected: heatmaps.length > 0, label: 'Heatmap Tracking' },
    { detected: personalization.length > 0, label: 'Personalization' },
    { detected: hasScrollTracking, label: 'Scroll Tracking' },
    { detected: hasClickTracking, label: 'Click Tracking' },
    { detected: pushDetected, label: 'Push Notifications' },
    { detected: isGated, label: 'Content Gating' },
  ];
  const detectedCount = capabilities.filter(c => c.detected).length;

  // Maturity label
  const maturityLabel = detectedCount >= 6 ? 'Advanced' : detectedCount >= 4 ? 'Intermediate' : detectedCount >= 2 ? 'Basic' : 'Minimal';
  const maturityColor = detectedCount >= 6 ? 'var(--gs-terminal)' : detectedCount >= 4 ? 'var(--gs-warning)' : detectedCount >= 2 ? 'var(--gs-base)' : 'var(--gs-critical)';

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
      {/* Maturity header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15em' }}>
        <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
          Behavioral Maturity Model
        </h4>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3em' }}>
          <span className="font-data tabular-nums" style={{ fontSize: 'clamp(18px, 2.2cqi, 26px)', fontWeight: 700, color: maturityColor, lineHeight: 1 }}>
            {detectedCount}/{capabilities.length}
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: maturityColor }}>
            {maturityLabel}
          </span>
        </div>
      </div>

      {/* Maturity bar */}
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.2em' }}>
        <div style={{ width: `${(detectedCount / capabilities.length) * 100}%`, height: '100%', background: maturityColor, borderRadius: '3px' }} />
      </div>

      {/* Feature grid — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25em 0.8em' }}>
        {capabilities.map((cap, i) => (
          <CheckItem
            key={i}
            status={cap.detected ? 'pass' : 'fail'}
            label={cap.label}
          />
        ))}
      </div>

      {/* Detected tools section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em', marginTop: '0.3em' }}>
        {experiments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', marginRight: '0.3em', letterSpacing: '0.05em' }}>
              A/B:
            </span>
            {experiments.map((t, i) => <Pill key={i} text={t} color="var(--gs-terminal)" />)}
          </div>
        )}
        {sessionRecording.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', marginRight: '0.3em', letterSpacing: '0.05em' }}>
              Session:
            </span>
            {sessionRecording.map((t, i) => <Pill key={i} text={t} color="var(--gs-base)" />)}
          </div>
        )}
        {personalization.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', marginRight: '0.3em', letterSpacing: '0.05em' }}>
              Personalization:
            </span>
            {personalization.map((t, i) => <Pill key={i} text={t} color="var(--gs-warning)" />)}
          </div>
        )}
        {pushDetected && pushSdkName && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', marginRight: '0.3em', letterSpacing: '0.05em' }}>
              Push:
            </span>
            <Pill text={pushSdkName} color="var(--gs-terminal)" />
          </div>
        )}
        {isGated && (gatingType || paywallProvider) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1cqi, 12px)', color: 'var(--gs-mid)', marginRight: '0.3em', letterSpacing: '0.05em' }}>
              Gating:
            </span>
            {paywallProvider && <Pill text={paywallProvider} color="var(--gs-warning)" />}
            {gatingType && <Pill text={gatingType} color="var(--gs-mid)" />}
          </div>
        )}
      </div>

      {/* Overlays indicator */}
      {overlays.length > 0 && (
        <div style={{ marginTop: '0.15em' }}>
          <span className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-warning)' }}>
            {overlays.length} overlay(s) detected: {[...new Set(overlays.map(o => typeof o.type === 'string' ? o.type : 'other'))].join(', ')}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Behavioral Intelligence"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: A/B testing detection, session recording, push notifications"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
