'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  StatBlock,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M08 Slide — Tag Governance
 * ══════════════════════════
 *
 * Layout C: SlideShell with StatBlock hero row at top,
 * TMS badges and SST indicator below.
 */

interface TMSInfo {
  name?: string;
  containers?: string[];
  containerId?: string;
  confidence?: number;
}

export function M08Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M08');
  const mod = getModuleResult(scan, 'M08');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Tag Governance" scan={scan} sourceLabel="Source: GTM containers, network profiling, third-party script analysis" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Tag management and governance posture';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const tmsArr = (raw?.['tms'] as TMSInfo[] | undefined) ?? [];
  const tagAudit = (raw?.['tagAudit'] as Record<string, unknown> | undefined) ?? null;
  const thirdPartyDomains = raw?.['thirdPartyDomains'];
  const thirdPartyDomainCount = Array.isArray(thirdPartyDomains) ? thirdPartyDomains.length : (typeof thirdPartyDomains === 'number' ? thirdPartyDomains : 0);
  const piggybackEstimate = typeof raw?.['piggybackEstimate'] === 'number' ? raw['piggybackEstimate'] as number : 0;
  const serverSideIndicators = raw?.['serverSideIndicators'] === true;
  const sstSources = (raw?.['sstSources'] as string[] | undefined) ?? [];
  const containerCount = typeof raw?.['containerCount'] === 'number' ? raw['containerCount'] as number : 0;
  const tmsCount = typeof raw?.['tmsCount'] === 'number' ? raw['tmsCount'] as number : tmsArr.length;
  const thirdPartyScriptCount = typeof raw?.['thirdPartyScriptCount'] === 'number' ? raw['thirdPartyScriptCount'] as number : 0;

  // Tag audit details
  const totalScripts = typeof tagAudit?.['totalTagRequests'] === 'number' ? tagAudit['totalTagRequests'] as number : thirdPartyScriptCount;
  const blockingScripts = typeof tagAudit?.['blockingScripts'] === 'number' ? tagAudit['blockingScripts'] as number : 0;
  const asyncScripts = typeof tagAudit?.['asyncScripts'] === 'number' ? tagAudit['asyncScripts'] as number : 0;

  // Third-party summary
  const tpSummary = (raw?.['thirdPartySummary'] as Record<string, unknown> | undefined) ?? null;
  const tpTotalBytes = typeof tpSummary?.['totalBytes'] === 'number' ? tpSummary['totalBytes'] as number : 0;

  return (
    <SlideShell
      moduleName="Tag Governance"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: GTM containers, network profiling, third-party script analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Hero Stats Row ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0',
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.5em' }}>
          {[
            { value: totalScripts, label: 'Tag Requests', color: totalScripts > 50 ? 'var(--gs-warning)' : 'var(--gs-light)', show: true },
            { value: thirdPartyDomainCount, label: '3P Domains', color: thirdPartyDomainCount > 30 ? 'var(--gs-warning)' : 'var(--gs-light)', show: true },
            { value: piggybackEstimate, label: 'Piggyback Est.', color: piggybackEstimate > 5 ? 'var(--gs-warning)' : 'var(--gs-terminal)', show: true },
            { value: containerCount, label: 'Containers', color: containerCount > 2 ? 'var(--gs-warning)' : 'var(--gs-light)', show: true },
            { value: `${Math.round(tpTotalBytes / 1024)}KB`, label: '3P Weight', color: tpTotalBytes > 500000 ? 'var(--gs-warning)' : 'var(--gs-light)', show: tpTotalBytes > 0 },
          ].filter(s => s.show).map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
            }}>
              <p className="font-data tabular-nums" style={{ fontSize: 'clamp(16px, 1.8cqi, 22px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
                {s.value}
              </p>
              <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* TMS + SST + Script loading — equal tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(blockingScripts > 0 || asyncScripts > 0) ? 3 : 2}, 1fr)`, gap: '0.5em' }}>
          {/* TMS tile */}
          <div style={{
            padding: '0.5em 0.6em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <p className="font-data" style={{ fontSize: 'clamp(13px, 1.3cqi, 16px)', fontWeight: 700, lineHeight: 1.2, color: tmsArr.length > 0 ? 'var(--gs-light)' : 'var(--gs-critical)' }}>
              {tmsArr.length > 0 ? tmsArr.map(t => {
                const name = typeof t.name === 'string' ? t.name : 'Unknown';
                const containers = Array.isArray(t.containers) ? t.containers : [];
                return containers.length > 0 ? `${name} (${containers.join(', ')})` : name;
              }).join(', ') : 'No TMS'}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
              Tag Manager
            </p>
            {tmsCount > 1 && (
              <p className="font-data" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-critical)', marginTop: '0.1em' }}>
                {tmsCount} TMS — Conflict Risk
              </p>
            )}
          </div>

          {/* SST tile */}
          <div style={{
            padding: '0.5em 0.6em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}>
            <p className="font-display" style={{ fontSize: 'clamp(20px, 2.4cqi, 28px)', fontWeight: 700, lineHeight: 1, color: serverSideIndicators ? 'var(--gs-terminal)' : 'var(--gs-critical)' }}>
              {serverSideIndicators ? '✓' : '✗'}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
              Server-Side Tagging
            </p>
            {sstSources.length > 0 && (
              <p className="font-data" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-mid)', marginTop: '0.1em' }}>
                {sstSources[0]}
              </p>
            )}
          </div>

          {/* Render-blocking tile */}
          {(blockingScripts > 0 || asyncScripts > 0) && (
            <div style={{
              padding: '0.5em 0.6em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <p className="font-data tabular-nums" style={{ fontSize: 'clamp(18px, 2cqi, 24px)', fontWeight: 700, lineHeight: 1, color: blockingScripts > 5 ? 'var(--gs-critical)' : blockingScripts > 0 ? 'var(--gs-warning)' : 'var(--gs-terminal)' }}>
                {blockingScripts}
              </p>
              <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                Render-Blocking
              </p>
              {asyncScripts > 0 && (
                <p className="font-data" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-mid)', marginTop: '0.1em' }}>
                  {asyncScripts} async
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </SlideShell>
  );
}
