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
 * M18 + M19 Slide — Corporate Infrastructure
 * ════════════════════════════════════════════
 *
 * Layout B: SlideShellAlt (two-column: viz left, findings/recs right).
 * Combines M18 (Investor Relations) and M19 (Support Infrastructure).
 */

export function M18M19Slide({ scan }: { scan: ScanWithResults }) {
  const syn18 = getM41Summary(scan, 'M18');
  const syn19 = getM41Summary(scan, 'M19');
  const mod18 = getModuleResult(scan, 'M18');
  const mod19 = getModuleResult(scan, 'M19');
  const raw18 = (mod18?.data as Record<string, unknown> | undefined) ?? null;
  const raw19 = (mod19?.data as Record<string, unknown> | undefined) ?? null;

  const skip18 = !mod18 || mod18.status === 'skipped' || mod18.status === 'error';
  const skip19 = !mod19 || mod19.status === 'skipped' || mod19.status === 'error';

  if (!syn18 && !syn19 && skip18 && skip19) {
    return <SkippedSlide moduleName="Corporate Infrastructure" scan={scan} sourceLabel="Source: IR portal audit, help center detection, support infrastructure" />;
  }

  // Combine findings, recs, scores from both modules
  const findings = [
    ...(syn18?.key_findings ?? []),
    ...(syn19?.key_findings ?? []),
  ];
  const recs = [
    ...(syn18?.recommendations ?? []),
    ...(syn19?.recommendations ?? []),
  ];
  const scores = [
    ...(syn18?.score_breakdown ?? []),
    ...(syn19?.score_breakdown ?? []),
  ];

  // Average score
  const scoreVals = [syn18?.module_score ?? mod18?.score, syn19?.module_score ?? mod19?.score].filter((v): v is number => typeof v === 'number');
  const modScore = scoreVals.length > 0 ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) : null;

  const headline = findings.length > 0 ? findings[0]!.finding : 'Corporate infrastructure assessment';
  const execSummary = syn18?.executive_summary ?? syn19?.executive_summary ?? syn18?.analysis ?? syn19?.analysis ?? '';

  // ── M18: Investor Relations data ──
  const secFilingsRaw = raw18?.['sec_filings'] ?? raw18?.['secFilings'] ?? null;
  const secFilings = Array.isArray(secFilingsRaw) ? secFilingsRaw : [];
  const irPortalDepth = typeof (raw18?.['ir_portal_depth'] ?? raw18?.['irPortalDepth']) === 'number'
    ? (raw18?.['ir_portal_depth'] ?? raw18?.['irPortalDepth']) as number
    : null;
  const esgReportRaw = raw18?.['esg_report'] ?? raw18?.['esgReport'] ?? null;
  const hasEsg = esgReportRaw === true || (typeof esgReportRaw === 'string' && esgReportRaw.length > 0);
  const ticker = typeof raw18?.['ticker'] === 'string' ? raw18['ticker'] as string : null;
  const boardMembersRaw = raw18?.['boardMembers'] ?? null;
  const boardMembersCount = typeof boardMembersRaw === 'number'
    ? boardMembersRaw
    : Array.isArray(boardMembersRaw)
      ? boardMembersRaw.length
      : null;
  const earningsCalendarRaw = raw18?.['earningsCalendar'] ?? null;
  const hasEarnings = earningsCalendarRaw === true || (typeof earningsCalendarRaw === 'string' && earningsCalendarRaw.length > 0);

  // ── M19: Support Infrastructure data ──
  const helpCenterProvider = (raw19?.['help_center_provider'] as string | undefined)
    ?? (raw19?.['helpCenterProvider'] as string | undefined)
    ?? null;
  const supportChannels = (raw19?.['support_channels'] as string[] | undefined)
    ?? (raw19?.['supportChannels'] as string[] | undefined)
    ?? [];
  const chatbotRaw = raw19?.['chatbot'] ?? null;
  const hasChatbot = chatbotRaw === true || (chatbotRaw != null && typeof chatbotRaw === 'object');
  const statusPageRaw = raw19?.['statusPage'] ?? null;
  const hasStatusPage = statusPageRaw === true || (typeof statusPageRaw === 'string' && statusPageRaw.length > 0);
  const forumsRaw = raw19?.['communityForums'] ?? null;
  const hasForums = forumsRaw === true || (typeof forumsRaw === 'string' && forumsRaw.length > 0);
  const devDocsRaw = raw19?.['devDocs'] ?? null;
  const hasDevDocs = devDocsRaw === true || (typeof devDocsRaw === 'string' && devDocsRaw.length > 0);

  // ── AI fallback: check if M41 findings mention items as present ──
  // When raw data says "not found" but AI analysis confirms existence (e.g. from footer links)
  const allText = [...findings.map(f => f.finding), execSummary].join(' ').toLowerCase();
  const aiConfirms = (keywords: string[]) => keywords.some(kw => allText.includes(kw));

  const aiSec = aiConfirms(['sec filing', 'sec filings', 'financial disclosures', '10-k', '10-q', 'annual report']);
  const aiEsg = aiConfirms(['esg', 'sustainability report', 'sustainability reporting']);
  const aiEarnings = aiConfirms(['earnings', 'investor event', 'quarterly report']);
  const aiIrPortal = aiConfirms(['ir portal', 'investor relations portal', 'dedicated ir', 'investor subdomain']);
  // Support items: only trust AI for help center (high confidence), skip the rest
  // (AI tends to misidentify order tracking as "status page", live agents as "chatbot", etc.)
  const aiHelpCenter = aiConfirms(['help center', 'help centre', 'knowledge base']);
  const aiStatusPage = false; // Too often misidentified
  const aiForums = false;     // Too often misidentified
  const aiChatbot = false;    // Live agents ≠ chatbot
  const aiDevDocs = false;    // Rarely hallucinated but low value

  // Count pass/warn for quick summary
  const irPassCount = [secFilings.length > 0 || aiSec, hasEsg || aiEsg, hasEarnings || aiEarnings, (irPortalDepth != null && irPortalDepth > 0) || aiIrPortal].filter(Boolean).length;
  const supportPassCount = [!!helpCenterProvider || aiHelpCenter, hasStatusPage || aiStatusPage, hasForums || aiForums, hasChatbot || aiChatbot, hasDevDocs || aiDevDocs].filter(Boolean).length;

  return (
    <SlideShell
      moduleName="Corporate Infrastructure"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: IR portal audit, help center detection, support infrastructure"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Two-column: stats + checklists */}
        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Investor Relations */}
          <div style={{ flex: 1 }}>
            {/* IR stats tiles */}
            <div style={{ display: 'flex', gap: '0.4em', marginBottom: '0.5em' }}>
              {[
                { value: `${irPassCount}/4`, label: 'IR Compliance', color: irPassCount >= 3 ? 'var(--gs-terminal)' : irPassCount >= 2 ? 'var(--gs-warning)' : 'var(--gs-critical)', show: true },
                { value: ticker ?? '', label: 'Ticker', color: 'var(--gs-base)', show: !!ticker },
                { value: secFilings.length, label: 'SEC Filings', color: 'var(--gs-light)', show: secFilings.length > 0 },
                { value: irPortalDepth ?? 0, label: 'IR Pages', color: 'var(--gs-light)', show: irPortalDepth != null && irPortalDepth > 0 },
              ].filter(s => s.show).map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: '0.4em 0.3em', borderRadius: '4px', textAlign: 'center',
                  background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.27cqi, 20px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
                    {s.value}
                  </p>
                  <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.64cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.2em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.25em' }}>
              Investor Relations
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>
              <CheckItem status={secFilings.length > 0 ? 'pass' : aiSec ? 'pass' : 'warn'} label="SEC Filings" detail={secFilings.length > 0 ? `${secFilings.length} found` : aiSec ? 'Confirmed via AI analysis' : 'None found'} />
              <CheckItem status={hasEsg ? 'pass' : aiEsg ? 'pass' : 'warn'} label="ESG Report" detail={hasEsg ? 'Published' : aiEsg ? 'Confirmed via AI analysis' : 'Not found'} />
              <CheckItem status={hasEarnings ? 'pass' : aiEarnings ? 'pass' : 'warn'} label="Earnings Calendar" detail={hasEarnings ? 'Available' : aiEarnings ? 'Confirmed via AI analysis' : 'Not found'} />
              <CheckItem status={(irPortalDepth != null && irPortalDepth > 0) ? 'pass' : aiIrPortal ? 'pass' : 'warn'} label="IR Portal" detail={irPortalDepth != null && irPortalDepth > 0 ? `${irPortalDepth} pages deep` : aiIrPortal ? 'Confirmed via AI analysis' : 'Not detected'} />
              {boardMembersCount != null && <CheckItem status="pass" label="Board Members" detail={`${boardMembersCount} listed`} />}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.06)', flexShrink: 0 }} />

          {/* Right: Support Infrastructure */}
          <div style={{ flex: 1 }}>
            {/* Support stats tiles */}
            <div style={{ display: 'flex', gap: '0.4em', marginBottom: '0.5em' }}>
              {[
                { value: `${supportPassCount}/5`, label: 'Support Coverage', color: supportPassCount >= 4 ? 'var(--gs-terminal)' : supportPassCount >= 2 ? 'var(--gs-warning)' : 'var(--gs-critical)', show: true },
                { value: supportChannels.length, label: 'Support Channels', color: 'var(--gs-terminal)', show: supportChannels.length > 0 },
              ].filter(s => s.show).map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: '0.4em 0.3em', borderRadius: '4px', textAlign: 'center',
                  background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}>
                  <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.27cqi, 20px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
                    {s.value}
                  </p>
                  <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.64cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.2em' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.25em' }}>
              Support Infrastructure
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25em' }}>
              <CheckItem status={helpCenterProvider ? 'pass' : aiHelpCenter ? 'pass' : 'warn'} label="Help Center" detail={helpCenterProvider ?? (aiHelpCenter ? 'Confirmed via AI analysis' : 'Not detected')} />
              <CheckItem status={hasStatusPage ? 'pass' : aiStatusPage ? 'pass' : 'warn'} label="Status Page" detail={hasStatusPage ? 'Active' : aiStatusPage ? 'Confirmed via AI analysis' : 'Not found'} />
              <CheckItem status={hasForums ? 'pass' : aiForums ? 'pass' : 'warn'} label="Community Forums" detail={hasForums ? 'Active' : aiForums ? 'Confirmed via AI analysis' : 'Not found'} />
              <CheckItem status={hasChatbot ? 'pass' : aiChatbot ? 'pass' : 'warn'} label="Chatbot" detail={hasChatbot ? 'Detected' : aiChatbot ? 'Confirmed via AI analysis' : 'Not found'} />
              <CheckItem status={hasDevDocs ? 'pass' : aiDevDocs ? 'pass' : 'warn'} label="Developer Docs" detail={hasDevDocs ? 'Available' : aiDevDocs ? 'Confirmed via AI analysis' : 'Not found'} />
            </div>
            {supportChannels.length > 0 && (
              <div style={{ marginTop: '0.3em' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {supportChannels.map((ch, i) => (
                    <Pill key={i} text={ch} color="var(--gs-terminal)" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
