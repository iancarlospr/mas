'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  CheckItem,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M17 Slide — Careers & HR
 * ════════════════════════
 *
 * Layout D: SlideShell with CheckItem grid visualization.
 * Viz: Careers Page, ATS Provider, Positions count, Team/Culture pages,
 * Benefits as pills, DEI flag.
 */

export function M17Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M17');
  const mod = getModuleResult(scan, 'M17');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Careers & HR" scan={scan} sourceLabel="Source: Careers page analysis, ATS detection, job listing audit" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Careers and employer brand analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data (check both camelCase and snake_case) ──
  const careersPageUrl = (raw?.['careers_page_url'] as string | undefined)
    ?? (raw?.['careersPageUrl'] as string | undefined)
    ?? null;

  const atsProvider = (raw?.['ats_provider'] as string | undefined)
    ?? (raw?.['atsProvider'] as string | undefined)
    ?? null;

  const openPositionsCount = typeof raw?.['open_positions_count'] === 'number'
    ? raw['open_positions_count'] as number
    : typeof raw?.['openPositionsCount'] === 'number'
      ? raw['openPositionsCount'] as number
      : null;

  const benefitsRaw = raw?.['benefits_mentioned'] ?? raw?.['benefitsMentioned'] ?? null;
  const benefitsMentioned = Array.isArray(benefitsRaw) ? (benefitsRaw as string[]) : [];
  const hasBenefits = benefitsRaw === true || benefitsMentioned.length > 0;

  const deiMentioned = raw?.['dei_mentioned'] === true || raw?.['deiMentioned'] === true;

  const hasTeamPage = raw?.['has_team_page'] === true || raw?.['teamPage'] === true
    || (typeof raw?.['has_team_page'] === 'string' && (raw['has_team_page'] as string).length > 0)
    || (typeof raw?.['teamPage'] === 'string' && (raw['teamPage'] as string).length > 0);

  const hasCulturePage = raw?.['has_culture_page'] === true || raw?.['culturePage'] === true
    || (typeof raw?.['has_culture_page'] === 'string' && (raw['has_culture_page'] as string).length > 0)
    || (typeof raw?.['culturePage'] === 'string' && (raw['culturePage'] as string).length > 0);

  const externalLinks = (raw?.['external_careers_links'] as string[] | undefined) ?? [];
  const mostRecentPosting = (raw?.['most_recent_posting'] as string | undefined) ?? null;

  return (
    <SlideShell
      moduleName="Careers & HR"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Careers page analysis, ATS detection, job listing audit"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      onAskChloe={onAskChloe}
    >
      {/* ═══ Careers Stats & Checklist ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Stats tiles — full width */}
        <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.5em', paddingBottom: '0.5em', borderBottom: '1px solid rgba(255,178,239,0.06)' }}>
          {[
            openPositionsCount != null ? { value: `~${openPositionsCount}`, label: 'Est. Open Positions', color: openPositionsCount > 20 ? 'var(--gs-terminal)' : openPositionsCount > 0 ? 'var(--gs-warning)' : 'var(--gs-mid)' } : null,
            atsProvider ? { value: atsProvider, label: 'ATS Platform', color: 'var(--gs-base)' } : null,
            mostRecentPosting ? { value: new Date(mostRecentPosting).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), label: 'Latest Posting', color: 'var(--gs-light)' } : null,
            externalLinks.length > 0 ? { value: externalLinks.length, label: 'Job Boards', color: 'var(--gs-light)' } : null,
          ].filter((s) => s != null).map((s, i) => (
            <div key={i} style={{
              flex: s.label === 'ATS Platform' ? 2 : 1, padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.35cqi, 22px)', fontWeight: 700, lineHeight: 1.2, color: s.color }}>
                {s.value}
              </p>
              <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.68cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Checklist + benefits side by side */}
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Employer brand checklist */}
          <div style={{ flex: 1 }}>
            <p className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
              Employer Brand Checklist
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3em 1.5em' }}>
              <CheckItem status={careersPageUrl ? 'pass' : 'fail'} label="Careers Page" detail={careersPageUrl ? 'Found' : 'Not detected'} />
              <CheckItem status={atsProvider ? 'pass' : 'warn'} label="ATS Integration" detail={atsProvider ?? 'Not identified'} />
              <CheckItem status={hasTeamPage ? 'pass' : 'warn'} label="Team Page" detail={hasTeamPage ? 'Found' : 'Not found'} />
              <CheckItem status={hasCulturePage ? 'pass' : 'warn'} label="Culture Page" detail={hasCulturePage ? 'Found' : 'Not found'} />
              <CheckItem status={deiMentioned ? 'pass' : 'warn'} label="DEI Commitment" detail={deiMentioned ? 'Mentioned' : 'Not found'} />
              <CheckItem status={openPositionsCount != null && openPositionsCount > 0 ? 'pass' : 'warn'} label="Active Listings" detail={openPositionsCount != null ? `${openPositionsCount} positions` : 'Unknown'} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Right: Benefits + external links */}
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            {hasBenefits && (
              <div>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  Benefits & Perks
                </p>
                {benefitsMentioned.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                    {benefitsMentioned.map((b, i) => (
                      <Pill key={i} text={b} color="var(--gs-terminal)" />
                    ))}
                  </div>
                ) : (
                  <CheckItem status="pass" label="Benefits mentioned on careers pages" />
                )}
              </div>
            )}
            {externalLinks.length > 0 && (
              <div>
                <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.06em', marginBottom: '0.2em' }}>
                  External Job Boards
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {externalLinks.map((link, i) => {
                    let label = link;
                    try { label = new URL(link).hostname.replace('www.', ''); } catch { /* keep full */ }
                    return <Pill key={i} text={label} color="var(--gs-base)" />;
                  })}
                </div>
              </div>
            )}
            {!hasBenefits && externalLinks.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
                  No benefits or perks mentioned on careers pages
                </p>
                <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
                  No external job board links detected
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
