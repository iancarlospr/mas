'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StackLayer,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M05 Slide — Analytics Architecture
 * ═══════════════════════════════════
 *
 * Layout A: SlideShell with children (measurement stack diagram).
 * Viz: Layered architecture diagram showing Tag Managers → Analytics → Data Layer,
 * with side flags for Consent Mode v2 and Server-Side tracking.
 */

interface AnalyticsTool {
  name: string;
  type?: string;
  category?: string;
  id?: string;
  containerId?: string;
  confidence?: number;
}

export function M05Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M05');
  const mod = getModuleResult(scan, 'M05');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Analytics Architecture" scan={scan} sourceLabel="Source: DOM globals, data layer inspection, GTM containers" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Analytics measurement stack analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const rawTools = (raw?.['tools'] as AnalyticsTool[] | undefined) ?? [];
  const consent = (raw?.['consent'] as Record<string, unknown> | undefined) ?? null;
  const hasConsentMode = consent?.['hasConsentMode'] === true;
  const consentPlatform = (consent?.['consentPlatform'] as string | null) ?? null;
  const serverSideTracking = raw?.['serverSideTracking'] === true;
  const networkMeasurementIds = (raw?.['networkMeasurementIds'] as string[] | undefined) ?? [];
  const toolCount = typeof raw?.['toolCount'] === 'number' ? raw['toolCount'] as number : rawTools.length;

  // Categorize tools
  const tagManagers = rawTools.filter(t =>
    t.type === 'tag_manager' || t.category === 'tag_manager' ||
    (typeof t.name === 'string' && /tag manager|tealium|launch/i.test(t.name))
  );
  const analyticsTools = rawTools.filter(t =>
    t.type === 'analytics' || t.category === 'analytics' ||
    (typeof t.name === 'string' && /analytics|ga4|google analytics|matomo|plausible|fathom|amplitude|mixpanel|heap|segment/i.test(t.name))
  );
  const otherTools = rawTools.filter(t =>
    !tagManagers.includes(t) && !analyticsTools.includes(t)
  );

  // Data layer info
  const dataLayer = (raw?.['dataLayer'] as Record<string, unknown> | undefined) ?? null;
  const dlLength = typeof dataLayer?.['length'] === 'number' ? dataLayer['length'] as number : null;
  const dlEvents = (dataLayer?.['events'] as string[] | undefined) ?? [];

  return (
    <SlideShell
      moduleName="Analytics Architecture"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: DOM globals, data layer inspection, GTM containers"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Measurement Stack Viz ═══ */}
      <div style={{ marginBottom: '0.6em', flexShrink: 0, padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)' }}>
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Stack layers — left side */}
          <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Measurement Stack
            </h4>

            {/* Layer 3 (top): Data Layer */}
            {dlLength != null && dlLength > 0 && (
              <StackLayer
                label="Data Layer"
                value={`${dlLength} entries${dlEvents.length > 0 ? ` · ${dlEvents.length} events` : ''}`}
                confidence={0.9}
              />
            )}

            {/* Layer 2: Analytics tools */}
            {analyticsTools.length > 0 ? (
              analyticsTools.map((tool, i) => (
                <StackLayer
                  key={`analytics-${i}`}
                  label="Analytics"
                  value={`${typeof tool.name === 'string' ? tool.name : 'Unknown'}${tool.id ? ` (${tool.id})` : ''}`}
                  confidence={typeof tool.confidence === 'number' ? tool.confidence : 0.8}
                />
              ))
            ) : (
              <StackLayer label="Analytics" value="No analytics detected" confidence={0.3} />
            )}

            {/* Layer 1 (bottom): Tag Managers */}
            {tagManagers.length > 0 ? (
              tagManagers.map((tool, i) => (
                <StackLayer
                  key={`tm-${i}`}
                  label="Tag Manager"
                  value={`${typeof tool.name === 'string' ? tool.name : 'Unknown'}${tool.containerId ? ` (${tool.containerId})` : tool.id ? ` (${tool.id})` : ''}`}
                  confidence={typeof tool.confidence === 'number' ? tool.confidence : 0.9}
                />
              ))
            ) : (
              <StackLayer label="Tag Manager" value="No TMS detected" confidence={0.3} />
            )}

            {/* Other tools (session replay, heatmap, marketing, advertising) */}
            {otherTools.slice(0, 3).map((tool, i) => (
              <StackLayer
                key={`other-${i}`}
                label={typeof tool.type === 'string' ? tool.type.replace(/_/g, ' ') : 'Other'}
                value={typeof tool.name === 'string' ? tool.name : 'Unknown'}
                confidence={typeof tool.confidence === 'number' ? tool.confidence : 0.7}
              />
            ))}
          </div>

          {/* Side flags — right side */}
          <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', gap: '0.4em', justifyContent: 'flex-start' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Capabilities
            </h4>
            <CheckItem
              status={hasConsentMode ? 'pass' : 'fail'}
              label="Consent Mode v2"
              detail={consentPlatform ? `via ${consentPlatform}` : undefined}
            />
            <CheckItem
              status={serverSideTracking ? 'pass' : 'fail'}
              label="Server-Side Tracking"
            />
            <div style={{ marginTop: '0.3em' }}>
              <p className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-mid)', marginBottom: '0.2em' }}>
                Tool Count
              </p>
              <p className="font-data tabular-nums" style={{ fontSize: 'clamp(16px, 2cqi, 22px)', fontWeight: 700, color: 'var(--gs-light)', lineHeight: 1 }}>
                {toolCount}
              </p>
            </div>
            {networkMeasurementIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em', marginTop: '0.2em' }}>
                {networkMeasurementIds.slice(0, 4).map((id, i) => (
                  <Pill key={i} text={id} color="var(--gs-terminal)" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
