'use client';

import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * M01 Slide — Security Headers & TLS
 * ════════════════════════════════════
 *
 * Layout:
 *   Row 1: Module bar + score
 *   Row 2: Action headline
 *   Row 3: Email Auth Chain — inline horizontal, no boxes
 *   Row 4: Analysis — full width
 *   Row 5: Findings | Recs | Score Breakdown — 3 columns
 *   Row 6: Footnote
 */

interface M41Summary {
  analysis?: string;
  executive_summary?: string;
  key_findings?: Array<{ finding: string; severity: string; evidence: string }>;
  recommendations?: Array<{ action: string; priority: string }>;
  score_breakdown?: Array<{ criterion: string; score: number; weight: number }>;
}
interface DkimEntry { selector: string; record: string }

function spfH(q: string | null) { return q === '-all' ? 'good' : q === '~all' ? 'warning' : 'critical' as const; }
function dkimH(e: DkimEntry[], b: number | null) { return !e?.length ? 'critical' : b != null && b < 1024 ? 'warning' : 'good' as const; }
function dmarcH(p: string | null) { return p === 'reject' ? 'good' : p === 'quarantine' ? 'warning' : 'critical' as const; }

const STATUS_STYLE = {
  good:     { color: 'var(--gs-terminal)', symbol: '✓', label: 'PASS' },
  warning:  { color: 'var(--gs-warning)',  symbol: '~', label: 'WEAK' },
  critical: { color: 'var(--gs-critical)', symbol: '✗', label: 'FAIL' },
} as const;

function sc(s: string) { return s === 'critical' ? 'var(--gs-critical)' : s === 'warning' ? 'var(--gs-warning)' : s === 'positive' ? 'var(--gs-terminal)' : 'var(--gs-mid)'; }
function scoreC(n: number) { return n >= 70 ? 'var(--gs-terminal)' : n >= 40 ? 'var(--gs-warning)' : 'var(--gs-critical)'; }

// ── Dev mocks ─────────────────────────────────────────────────────────
const MOCK_M41: M41Summary | null = process.env.NODE_ENV === 'development' ? {
  analysis: 'Chase.com has a solid TLS foundation with TLS 1.3 and HSTS properly configured, but email authentication has a critical gap. DMARC is set to p=none (monitor-only), meaning anyone can impersonate @chase.com. SPF uses soft fail (~all) rather than hard fail. DKIM is present but key strength could not be verified.',
  key_findings: [
    { finding: 'DMARC at p=none allows domain spoofing', severity: 'critical', evidence: 'v=DMARC1; p=none' },
    { finding: 'SPF uses soft fail instead of hard fail', severity: 'warning', evidence: '~all qualifier' },
    { finding: 'Missing X-Content-Type-Options header', severity: 'critical', evidence: 'Header absent' },
    { finding: 'Referrer-Policy header missing', severity: 'critical', evidence: 'Header absent' },
  ],
  recommendations: [
    { action: 'Upgrade DMARC from p=none → p=quarantine → p=reject', priority: 'P0' },
    { action: 'Change SPF qualifier from ~all to -all', priority: 'P1' },
    { action: 'Add X-Content-Type-Options: nosniff header', priority: 'P1' },
  ],
  score_breakdown: [
    { criterion: 'TLS Configuration', score: 95, weight: 1.0 },
    { criterion: 'HSTS Policy', score: 80, weight: 0.8 },
    { criterion: 'Email Auth (SPF)', score: 60, weight: 0.8 },
    { criterion: 'Email Auth (DKIM)', score: 85, weight: 0.7 },
    { criterion: 'Email Auth (DMARC)', score: 15, weight: 0.9 },
    { criterion: 'Security Headers', score: 55, weight: 0.7 },
    { criterion: 'CSP Policy', score: 70, weight: 0.7 },
  ],
} : null;

const MOCK_M01: Record<string, unknown> | null = process.env.NODE_ENV === 'development' ? {
  spf: 'v=spf1 include:_spf.google.com ~all', spfAllQualifier: '~all', spfLookups: 4,
  dkim: [{ selector: 'google', record: 'v=DKIM1; k=rsa; p=MIIBIjANBg...' }], dkimBestKeyBits: 2048,
  dmarc: 'v=DMARC1; p=none; rua=mailto:dmarc@chase.com', dmarcPolicy: 'none', dmarcRua: true, dmarcRuf: false, dmarcPct: 100,
} : null;

// ── Component ─────────────────────────────────────────────────────────

export function M01Slide({ scan }: { scan: ScanWithResults }) {
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m41 = rm.get('M41');
  const sums = (m41?.data?.['moduleSummaries'] as Record<string, M41Summary> | undefined) ?? {};
  const syn = sums['M01'] ?? MOCK_M41;
  const m01 = rm.get('M01');
  const raw = (m01?.data as Record<string, unknown> | undefined) ?? MOCK_M01;
  if (!syn && !raw) return null;

  const analysis = syn?.analysis ?? syn?.executive_summary ?? '';
  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = (syn?.score_breakdown?.length ? syn.score_breakdown : MOCK_M41?.score_breakdown) ?? [];

  const spfQ = (raw?.['spfAllQualifier'] as string | null) ?? null;
  const spfRec = (raw?.['spf'] as string | null) ?? null;
  const dkimE = (raw?.['dkim'] as DkimEntry[] | null) ?? [];
  const dkimB = (raw?.['dkimBestKeyBits'] as number | null) ?? null;
  const dmarcP = (raw?.['dmarcPolicy'] as string | null) ?? null;
  const hasDmarc = !!(raw?.['dmarc'] as string | null);

  const ss = spfRec ? spfH(spfQ) : 'critical';
  const ds = dkimH(dkimE, dkimB);
  const ms = hasDmarc ? dmarcH(dmarcP) : 'critical';

  const headline = findings.length > 0 ? findings[0]!.finding : 'Email authentication chain requires attention';
  const modScore = m01?.score ?? null;

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      style={{ aspectRatio: '14 / 8.5', background: 'var(--gs-void)', borderRadius: '2px', containerType: 'inline-size' }}
    >
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ padding: '3% 4.5% 2%' }}>

        {/* ═══ Module bar ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15em', flexShrink: 0 }}>
          <span className="font-data uppercase" style={{ fontSize: 'clamp(11px, 1.3cqi, 14px)', letterSpacing: '0.18em', color: 'var(--gs-base)' }}>
            Security &amp; Compliance — M01
          </span>
          {modScore != null && (
            <span className="font-data tabular-nums" style={{ fontSize: 'clamp(13px, 1.5cqi, 17px)', fontWeight: 700, color: scoreC(modScore) }}>
              {modScore}<span style={{ fontWeight: 400, color: 'var(--gs-mid)', fontSize: '0.75em' }}>/100</span>
            </span>
          )}
        </div>

        {/* ═══ Action headline ═══ */}
        <h2 className="font-display" style={{ fontSize: 'clamp(17px, 2.2cqi, 26px)', fontWeight: 600, lineHeight: 1.2, color: 'var(--gs-light)', marginBottom: '0.6em', flexShrink: 0 }}>
          {headline}
        </h2>

        {/* ═══ Email Auth Chain — inline, no boxes ═══ */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0', marginBottom: '0.8em', flexShrink: 0,
          padding: '0.6em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
        }}>
          <ChainItem label="SPF" desc="Sender Policy Framework — authorized mail servers" why="Without it, anyone can send email as your domain. Spam filters flag you." status={ss} detail={spfQ ?? (spfRec ? 'present' : 'missing')} />
          <ChainConnector />
          <ChainItem label="DKIM" desc="DomainKeys — cryptographic email signature" why="Proves your marketing emails weren't tampered with in transit. Required by Gmail and Yahoo." status={ds} detail={dkimE.length > 0 ? `${dkimB ?? '?'}-bit` : 'not found'} />
          <ChainConnector />
          <ChainItem label="DMARC" desc="Domain Authentication — spoofing enforcement policy" why="Tells inboxes to reject fakes. Without it, phishing emails using your brand land in customer inboxes." status={ms} detail={dmarcP ?? 'missing'} />
        </div>

        {/* ═══ Analysis — full width ═══ */}
        {analysis && (
          <div style={{ marginBottom: '0.7em', flexShrink: 0 }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(9px, 1cqi, 11px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
              Analysis
            </h4>
            <p className="font-data" style={{ fontSize: 'clamp(12px, 1.35cqi, 15px)', lineHeight: 1.6, color: 'var(--gs-light)', opacity: 0.85 }}>
              {analysis}
            </p>
          </div>
        )}

        {/* ═══ Three columns: Findings | Recs | Score Breakdown ═══ */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, gap: '3%', borderTop: '1px solid rgba(255,178,239,0.06)', paddingTop: '0.6em' }}>

          {/* Findings */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(9px, 1cqi, 11px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Key Findings
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {findings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(9px, 1cqi, 11px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: `color-mix(in srgb, ${sc(f.severity)} 15%, transparent)`, color: sc(f.severity),
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {f.severity === 'critical' ? 'CRIT' : f.severity === 'warning' ? 'WARN' : f.severity === 'positive' ? 'GOOD' : 'INFO'}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(11px, 1.25cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
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
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(9px, 1cqi, 11px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
              Recommendations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {recs.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4em', alignItems: 'flex-start' }}>
                  <span className="font-data uppercase flex-shrink-0" style={{
                    fontSize: 'clamp(9px, 1cqi, 11px)', padding: '0.1em 0.3em', borderRadius: '2px',
                    background: 'rgba(255,178,239,0.08)', color: 'var(--gs-base)',
                    marginTop: '0.15em', fontWeight: 600,
                  }}>
                    {r.priority}
                  </span>
                  <p className="font-data" style={{ fontSize: 'clamp(11px, 1.25cqi, 14px)', color: 'var(--gs-light)', lineHeight: 1.4 }}>
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
              <h4 className="font-display uppercase" style={{ fontSize: 'clamp(9px, 1cqi, 11px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.4em' }}>
                Score Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
                {scores.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <span className="font-data" style={{ fontSize: 'clamp(11px, 1.25cqi, 14px)', color: 'var(--gs-light)', flex: 1 }}>
                      {s.criterion}
                    </span>
                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${s.score}%`, height: '100%', background: scoreC(s.score), borderRadius: '2px' }} />
                    </div>
                    <span className="font-data tabular-nums" style={{ fontSize: 'clamp(11px, 1.25cqi, 14px)', fontWeight: 600, color: scoreC(s.score), minWidth: '2em', textAlign: 'right' }}>
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Footnote ═══ */}
        <div style={{ padding: '0.6em 0 0', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span className="font-data" style={{ fontSize: 'clamp(9px, 0.95cqi, 11px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            Source: DNS TXT records (SPF, DKIM, DMARC), HTTP headers, TLS handshake
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(9px, 0.95cqi, 11px)', color: 'var(--gs-mid)', opacity: 0.4 }}>
            {scan.domain} — AlphaScan
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Chain Item — inline, no box ───────────────────────────────────────

function ChainItem({ label, desc, why, status, detail }: { label: string; desc: string; why: string; status: 'good' | 'warning' | 'critical'; detail: string }) {
  const s = STATUS_STYLE[status];
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '0.5em' }}>
      {/* Status symbol */}
      <span className="font-display" style={{ fontSize: 'clamp(28px, 3.5cqi, 42px)', fontWeight: 700, color: s.color, lineHeight: 1, marginTop: '0.1em' }}>
        {s.symbol}
      </span>
      {/* Label + desc + detail + why */}
      <div>
        <p className="font-data" style={{ fontSize: 'clamp(9px, 0.95cqi, 11px)', color: 'var(--gs-mid)', lineHeight: 1.3, marginBottom: '0.1em' }}>
          {desc}
        </p>
        <div style={{ marginBottom: '0.2em' }}>
          <span className="font-display" style={{ fontSize: 'clamp(18px, 2.2cqi, 26px)', fontWeight: 700, color: 'var(--gs-light)' }}>
            {label}
          </span>
          <span className="font-data" style={{ fontSize: 'clamp(12px, 1.3cqi, 15px)', color: 'var(--gs-mid)', marginLeft: '0.5em' }}>
            {detail}
          </span>
        </div>
        <p className="font-data" style={{ fontSize: 'clamp(9px, 0.95cqi, 11px)', color: 'var(--gs-mid)', lineHeight: 1.4, opacity: 0.7 }}>
          {why}
        </p>
      </div>
    </div>
  );
}

// ── Chain Connector — visible arrow ───────────────────────────────────

function ChainConnector() {
  return (
    <div style={{ flexShrink: 0, padding: '0 1em', display: 'flex', alignItems: 'center' }}>
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
        <path d="M2 12h38m0 0l-7-7m7 7l-7 7" stroke="var(--gs-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      </svg>
    </div>
  );
}
