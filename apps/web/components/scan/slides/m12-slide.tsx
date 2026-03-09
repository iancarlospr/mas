'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * M12 Slide — Compliance & Privacy
 * =================================
 *
 * Layout:
 *   Row 1: Module name + AI score
 *   Row 2: Headline (first finding)
 *   Row 3: Executive Summary
 *   Row 4: Compliance checklist (visual) — CCPA, GDPR, Consent, SRI, Cookies
 *   Row 5: Findings | Recs | Score Breakdown — 3 columns
 *   Row 6: Footnote
 */

interface M41Summary {
  executive_summary?: string;
  analysis?: string;
  module_score?: number;
  key_findings?: Array<{ finding: string; severity: string; evidence: string }>;
  recommendations?: Array<{ action: string; priority: string }>;
  score_breakdown?: Array<{ criterion: string; score: number; weight: number }>;
}

function severityColor(s: string) {
  return s === 'critical' ? 'var(--gs-critical)' : s === 'warning' ? 'var(--gs-warning)' : s === 'positive' ? 'var(--gs-terminal)' : 'var(--gs-mid)';
}
function severityLabel(s: string) {
  return s === 'critical' ? 'CRIT' : s === 'warning' ? 'WARN' : s === 'positive' ? 'GOOD' : 'INFO';
}
function scoreC(n: number) { return n >= 70 ? 'var(--gs-terminal)' : n >= 40 ? 'var(--gs-warning)' : 'var(--gs-critical)'; }

// ── Component ─────────────────────────────────────────────────────────

export function M12Slide({ scan }: { scan: ScanWithResults }) {
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m41 = rm.get('M41');
  const sums = (m41?.data?.['moduleSummaries'] as Record<string, M41Summary> | undefined) ?? {};
  const syn = sums['M12'];
  const m12 = rm.get('M12');
  const raw = (m12?.data as Record<string, unknown> | undefined) ?? null;
  if (!syn && !raw) return null;

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? m12?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Compliance posture requires review';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // Raw data for compliance checklist
  const legal = (raw?.['legal'] as Record<string, unknown> | undefined) ?? {};
  const cookies = (raw?.['cookies'] as { total?: number; secure?: number; httpOnly?: number } | undefined);
  const sri = (raw?.['sri'] as { withSri?: number; thirdPartyScripts?: number } | undefined);
  const preConsent = (raw?.['preConsentTracking'] as string[] | undefined) ?? [];
  const consentBanner = (legal?.['consentBanner'] as { found?: boolean; provider?: string } | undefined);
  const privacyPolicy = (legal?.['privacyPolicy'] as { found?: boolean } | undefined);
  const ccpaOptOut = (legal?.['ccpaOptOut'] as { found?: boolean } | undefined);
  const tos = (legal?.['termsOfService'] as { found?: boolean } | undefined);
  const hasTcf = (raw?.['hasTcf'] as boolean | undefined) ?? false;

  // Build checklist items
  const checklist = [
    {
      label: 'Privacy Policy',
      status: privacyPolicy?.found ? 'pass' as const : 'fail' as const,
      detail: privacyPolicy?.found ? 'Found' : 'Missing',
    },
    {
      label: 'Terms of Service',
      status: tos?.found ? 'pass' as const : 'fail' as const,
      detail: tos?.found ? 'Found' : 'Missing',
    },
    {
      label: 'CCPA Opt-Out',
      status: ccpaOptOut?.found ? 'pass' as const : 'fail' as const,
      detail: ccpaOptOut?.found ? 'Found' : 'Missing',
    },
    {
      label: 'Consent Banner',
      status: consentBanner?.found ? 'pass' as const : 'fail' as const,
      detail: consentBanner?.found ? (consentBanner.provider ?? 'Detected') : 'Not detected',
    },
    {
      label: 'TCF v2.0',
      status: hasTcf ? 'pass' as const : 'warn' as const,
      detail: hasTcf ? 'Active' : 'Not found',
    },
    {
      label: 'Pre-Consent Tracking',
      status: preConsent.length === 0 ? 'pass' as const : 'fail' as const,
      detail: preConsent.length === 0 ? 'None detected' : `${preConsent.length} scripts fire before consent`,
    },
    {
      label: 'SRI Protection',
      status: sri?.withSri && sri.withSri > 0 ? 'pass' as const : 'fail' as const,
      detail: sri ? `${sri.withSri ?? 0}/${sri.thirdPartyScripts ?? 0} scripts protected` : 'Unknown',
    },
    {
      label: 'Cookie Security',
      status: cookies && cookies.total && cookies.secure === cookies.total ? 'pass' as const
        : cookies && cookies.secure && cookies.total && cookies.secure / cookies.total > 0.5 ? 'warn' as const
        : 'fail' as const,
      detail: cookies ? `${cookies.secure ?? 0}/${cookies.total ?? 0} secure, ${cookies.httpOnly ?? 0} httpOnly` : 'Unknown',
    },
  ];

  const CHECKLIST_STYLE = {
    pass: { color: 'var(--gs-terminal)', symbol: '✓' },
    warn: { color: 'var(--gs-warning)', symbol: '~' },
    fail: { color: 'var(--gs-critical)', symbol: '✗' },
  } as const;

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id="Accessibility"
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '1.5% 3.5% 1%' }}>

        {/* Module bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em', flexShrink: 0 }}>
          <span className="font-display uppercase" style={{ fontSize: 'clamp(1px, 1.05cqi, 15px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            Compliance &amp; Privacy
          </span>
          {modScore != null && (
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.12cqi, 17px)', fontWeight: 700, color: scoreC(modScore) }}>
              {modScore}<span style={{ fontWeight: 400, color: 'var(--gs-mid)', fontSize: '0.75em' }}>/100</span>
            </span>
          )}
        </div>

        {/* Headline */}
        <h2 className="font-display" style={{ fontSize: 'clamp(1px, 2.10cqi, 32px)', fontWeight: 700, lineHeight: 1.15, color: 'var(--gs-light)', marginBottom: '0.5em', flexShrink: 0, borderLeft: '3px solid var(--gs-base)', paddingLeft: '0.6em' }}>
          {headline}
        </h2>

        {/* Executive Summary */}
        {execSummary && (
          <div style={{ marginBottom: '0.7em', flexShrink: 0 }}>
            <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', lineHeight: 1.6, color: 'var(--gs-light)', opacity: 0.85 }}>
              {execSummary}
            </p>
          </div>
        )}

        {/* Compliance Checklist */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4em 1.5em',
          marginBottom: '0.7em', flexShrink: 0,
          padding: '0.6em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
        }}>
          {checklist.map((item) => {
            const style = CHECKLIST_STYLE[item.status];
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4em' }}>
                <span className="font-display" style={{ fontSize: 'clamp(1px, 1.20cqi, 18px)', fontWeight: 700, color: style.color, lineHeight: 1, flexShrink: 0 }}>
                  {style.symbol}
                </span>
                <div>
                  <p className="font-data" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.3 }}>
                    {item.label}
                  </p>
                  <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', color: 'var(--gs-mid)', lineHeight: 1.3 }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Three columns: Findings | Recs | Score Breakdown */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, gap: '3%', borderTop: '1px solid rgba(255,178,239,0.06)', paddingTop: '0.6em' }}>

          {/* Findings */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Key Findings
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {findings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(1px, 0.98cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: `color-mix(in srgb, ${severityColor(f.severity)} 15%, transparent)`, color: severityColor(f.severity),
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {severityLabel(f.severity)}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
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
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Recommendations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {recs.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(1px, 0.98cqi, 14px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)',
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {r.priority}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
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
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.98cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Score Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                {scores.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <span className="font-data" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', color: 'var(--gs-light)', flex: 1 }}>
                      {s.criterion}
                    </span>
                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${s.score}%`, height: '100%', background: scoreC(s.score), borderRadius: '2px' }} />
                    </div>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.01cqi, 15px)', fontWeight: 600, color: scoreC(s.score), minWidth: '2em', textAlign: 'right' }}>
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
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            Source: DOM inspection, cookie audit, network requests, consent detection
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {scan.domain} — AlphaScan
          </span>
        </div>
      </div>
    </div>
  );
}
