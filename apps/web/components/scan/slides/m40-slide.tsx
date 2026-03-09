'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * M40 Slide — Attack Surface & Subdomains
 * ========================================
 *
 * Layout:
 *   Row 1: Module name + AI score
 *   Row 2: Headline (first finding)
 *   Row 3: Executive Summary
 *   Row 4: Subdomain stats — total, alive, critical, warning
 *   Row 5: Findings | Recs | Score Breakdown — 3 columns
 *   Row 6: Footnote
 *
 * Falls back gracefully when module is skipped/errored.
 */

interface M41Summary {
  executive_summary?: string;
  analysis?: string;
  module_score?: number;
  key_findings?: Array<{ finding: string; severity: string; evidence: string }>;
  recommendations?: Array<{ action: string; priority: string }>;
  score_breakdown?: Array<{ criterion: string; score: number; weight: number }>;
}

interface SubdomainEntry {
  subdomain: string;
  isAlive: boolean;
  classification: string;
  securitySeverity: 'critical' | 'warning' | 'info';
}

function severityColor(s: string) {
  return s === 'critical' ? 'var(--gs-critical)' : s === 'warning' ? 'var(--gs-warning)' : s === 'positive' ? 'var(--gs-terminal)' : 'var(--gs-mid)';
}
function severityLabel(s: string) {
  return s === 'critical' ? 'CRIT' : s === 'warning' ? 'WARN' : s === 'positive' ? 'GOOD' : 'INFO';
}
function scoreC(n: number) { return n >= 70 ? 'var(--gs-terminal)' : n >= 40 ? 'var(--gs-warning)' : 'var(--gs-critical)'; }

export function M40Slide({ scan }: { scan: ScanWithResults }) {
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m41 = rm.get('M41');
  const sums = (m41?.data?.['moduleSummaries'] as Record<string, M41Summary> | undefined) ?? {};
  const syn = sums['M40'];
  const m40 = rm.get('M40');
  const raw = (m40?.data as Record<string, unknown> | undefined) ?? null;
  const isSkipped = !m40 || m40.status === 'skipped' || m40.status === 'error';

  // If module didn't run and no AI synthesis, show unavailable state
  if (isSkipped && !syn) {
    return (
      <div
        className="slide-card relative overflow-hidden select-none"
        style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
      >
        <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
            <span className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.4cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
              Attack Surface
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: '1em' }}>
            <span className="font-display" style={{ fontSize: 'clamp(18px, 5cqi, 60px)', opacity: 0.15, color: 'var(--gs-base)' }}>
              M40
            </span>
            <p className="font-data" style={{ fontSize: 'clamp(8px, 1.6cqi, 18px)', color: 'var(--gs-mid)', textAlign: 'center', maxWidth: '70%' }}>
              Subdomain &amp; attack surface analysis was not available for this scan. This module discovers exposed subdomains (dev, staging, admin, CI/CD) via Certificate Transparency logs and DNS resolution.
            </p>
            <p className="font-data" style={{ fontSize: 'clamp(7px, 1.3cqi, 15px)', color: 'var(--gs-mid)', opacity: 0.6, textAlign: 'center' }}>
              Re-run the scan to generate this analysis.
            </p>
          </div>
          <div style={{ padding: '0.6em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span className="font-data" style={{ fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
              Source: Certificate Transparency logs, DNS resolution
            </span>
            <span className="font-data" style={{ fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
              {scan.domain} — AlphaScan
            </span>
          </div>
        </div>
      </div>
    );
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? m40?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Attack surface analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw subdomain data
  const subdomains = (raw?.['subdomains'] as SubdomainEntry[] | undefined) ?? [];
  const totalDiscovered = (raw?.['totalDiscovered'] as number | undefined) ?? 0;
  const hasWildcard = (raw?.['wildcardDns'] as boolean | undefined) ?? false;
  const alive = subdomains.filter((s) => s.isAlive);
  const critical = subdomains.filter((s) => s.securitySeverity === 'critical' && s.isAlive);
  const warning = subdomains.filter((s) => s.securitySeverity === 'warning' && s.isAlive);

  // Stats for the visual bar
  const stats = [
    { label: 'Discovered', value: totalDiscovered, color: 'var(--gs-light)' },
    { label: 'Alive', value: alive.length, color: 'var(--gs-terminal)' },
    { label: 'Critical', value: critical.length, color: 'var(--gs-critical)' },
    { label: 'Warning', value: warning.length, color: 'var(--gs-warning)' },
    { label: 'Wildcard DNS', value: hasWildcard ? 'Yes' : 'No', color: hasWildcard ? 'var(--gs-warning)' : 'var(--gs-terminal)' },
  ];

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>

        {/* Module bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.4cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            Attack Surface
          </span>
          {modScore != null && (
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(7px, 1.5cqi, 17px)', fontWeight: 700, color: scoreC(modScore) }}>
              {modScore}<span style={{ fontWeight: 400, color: 'var(--gs-mid)', fontSize: '0.75em' }}>/100</span>
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 className="font-display" style={{ fontSize: 'clamp(10px, 2.8cqi, 32px)', fontWeight: 700, lineHeight: 1.15, color: 'var(--gs-light)', marginBottom: '0.5em', flexShrink: 0, borderLeft: '3px solid var(--gs-base)', paddingLeft: '0.6em' }}>
          {headline}
        </h2>

        {/* Executive Summary */}
        {execSummary && (
          <div style={{ marginBottom: '0.7em', flexShrink: 0 }}>
            <p className="font-data" style={{ fontSize: 'clamp(7px, 1.35cqi, 15px)', lineHeight: 1.6, color: 'var(--gs-light)', opacity: 0.85 }}>
              {execSummary}
            </p>
          </div>
        )}

        {/* Subdomain Stats — tiles */}
        {subdomains.length > 0 && (
          <div style={{
            display: 'flex', gap: '0.5em', marginBottom: '0.7em', flexShrink: 0,
            padding: '0.6em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
          }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                flex: 1, padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
                background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
              }}>
                <p className="font-data tabular-nums" style={{ fontSize: 'clamp(10px, 2.2cqi, 26px)', fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </p>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(7px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Three columns: Findings | Recs | Score Breakdown */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, gap: '3%', borderTop: '1px solid rgba(255,178,239,0.06)', paddingTop: '0.6em' }}>

          {/* Findings */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.3cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Key Findings
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {findings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(7px, 1.3cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: `color-mix(in srgb, ${severityColor(f.severity)} 15%, transparent)`, color: severityColor(f.severity),
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {severityLabel(f.severity)}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(7px, 1.35cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
                    {f.finding}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Recommendations */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.3cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Recommendations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {recs.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(7px, 1.3cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)',
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {r.priority}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(7px, 1.35cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
                    {r.action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Score Breakdown */}
          {scores.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.3cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Score Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                {scores.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <span className="font-data" style={{ fontSize: 'clamp(7px, 1.35cqi, 15px)', color: 'var(--gs-light)', flex: 1 }}>
                      {s.criterion}
                    </span>
                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${s.score}%`, height: '100%', background: scoreC(s.score), borderRadius: '2px' }} />
                    </div>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(7px, 1.35cqi, 15px)', fontWeight: 600, color: scoreC(s.score), minWidth: '2em', textAlign: 'right' }}>
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footnote */}
        <div style={{ padding: '0.6em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="font-data" style={{ fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            Source: Certificate Transparency logs (crt.sh), DNS resolution
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(7px, 1.2cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {scan.domain} — AlphaScan
          </span>
        </div>
      </div>
    </div>
  );
}
