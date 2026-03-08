'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StackLayer,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M02 Slide — CMS & Infrastructure
 * ═════════════════════════════════
 *
 * Layout A: SlideShell with StackLayer visualization.
 * Viz: "Infrastructure Blueprint" — stacked layers bottom-up:
 *   Server → CDN → Framework → CMS → HTTP Version
 * Each layer shows confidence as opacity.
 */

function extractName(val: unknown): string | null {
  if (typeof val === 'string') return val || null;
  if (val && typeof val === 'object' && 'name' in val) {
    const n = (val as { name?: string }).name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}

function extractConfidence(val: unknown): number | undefined {
  if (val && typeof val === 'object' && 'confidence' in val) {
    const c = (val as { confidence?: number }).confidence;
    return typeof c === 'number' ? c : undefined;
  }
  return undefined;
}

export function M02Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M02');
  const mod = getModuleResult(scan, 'M02');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="CMS & Infrastructure" scan={scan} sourceLabel="Source: HTTP headers, DOM fingerprinting, script analysis" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Infrastructure stack analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data (values can be strings OR objects with .name) ──
  const cms = extractName(raw?.['cms']);
  const cmsConf = extractConfidence(raw?.['cms']);
  const cdn = extractName(raw?.['cdn']) ?? extractName(raw?.['headerCdn']);
  const cdnConf = extractConfidence(raw?.['cdn']);
  const framework = extractName(raw?.['framework']);
  const frameworkConf = extractConfidence(raw?.['framework']);
  const server = extractName(raw?.['server']);
  const serverConf = extractConfidence(raw?.['server']);
  const httpVersion = typeof raw?.['httpVersion'] === 'string' ? raw['httpVersion'] as string : null;

  // Detected technologies array
  const techRaw = (raw?.['detectedTechnologies'] as Array<string | { name?: string }> | undefined) ?? [];
  const technologies = techRaw
    .map((t) => (typeof t === 'string' ? t : (t as { name?: string })?.name ?? ''))
    .filter(Boolean);

  // Build stack layers bottom-up
  const layers: Array<{ label: string; value: string; confidence?: number }> = [];
  if (server) layers.push({ label: 'Server', value: server, confidence: serverConf });
  if (cdn) layers.push({ label: 'CDN', value: cdn, confidence: cdnConf });
  if (framework) layers.push({ label: 'Framework', value: framework, confidence: frameworkConf });
  if (cms) layers.push({ label: 'CMS', value: cms, confidence: cmsConf });
  if (httpVersion) layers.push({ label: 'Protocol', value: httpVersion, confidence: 0.95 });

  return (
    <SlideShell
      moduleName="CMS & Infrastructure"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: HTTP headers, DOM fingerprinting, script analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Infrastructure Blueprint ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Stack layers — left */}
          <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Infrastructure Blueprint
            </h4>
            {layers.length > 0 ? (
              layers.map((layer, i) => (
                <StackLayer key={i} label={layer.label} value={layer.value} confidence={layer.confidence} />
              ))
            ) : (
              <p className="font-data" style={{ fontSize: 'clamp(12px, 1.2cqi, 14px)', color: 'var(--gs-mid)' }}>
                No infrastructure components detected
              </p>
            )}
          </div>

          {/* Detected technologies — right */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
              Detected Technologies ({technologies.length})
            </h4>
            {technologies.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
                {technologies.map((tech, i) => (
                  <Pill key={i} text={tech} color="var(--gs-light)" />
                ))}
              </div>
            ) : (
              <p className="font-data" style={{ fontSize: 'clamp(12px, 1.2cqi, 14px)', color: 'var(--gs-mid)' }}>
                No additional technologies fingerprinted
              </p>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
