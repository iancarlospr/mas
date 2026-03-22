'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  StatBlock,
  Pill,
  SkippedSlide,
} from './module-slide-template';

/**
 * M06 Slide — Paid Media Pixels
 * ══════════════════════════════
 *
 * Layout B: SlideShellAlt — left panel has the Pixel Capability Matrix,
 * right panel has findings/recs/scores.
 */

interface AdPixel {
  name?: string;
  pixelType?: string;
  id?: string | null;
  hasEnhancedConversions?: boolean;
  enhanced?: boolean;
  serverSide?: boolean;
  consentAware?: boolean;
  networkFires?: number;
  fireCount?: number;
  confidence?: number;
  loadMethod?: string;
}

export function M06Slide({ scan, chloeCallout }: { scan: ScanWithResults; chloeCallout?: React.ReactNode }) {
  const syn = getM41Summary(scan, 'M06');
  const mod = getModuleResult(scan, 'M06');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Paid Media Pixels" scan={scan} sourceLabel="Source: Network requests, pixel detection, CAPI inspection" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Paid media pixel infrastructure analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const pixels = (raw?.['pixels'] as AdPixel[] | undefined) ?? [];
  const capiDetected = raw?.['capiDetected'] === true;
  const adScriptBytes = typeof raw?.['adScriptBytes'] === 'number' ? raw['adScriptBytes'] as number : 0;
  const clickIdsRaw = raw?.['clickIds'];
  const clickIds = Array.isArray(clickIdsRaw) ? (clickIdsRaw as string[]) : [];
  const pixelCount = typeof raw?.['pixelCount'] === 'number' ? raw['pixelCount'] as number : pixels.length;
  const totalNetworkFires = typeof raw?.['totalNetworkFires'] === 'number' ? raw['totalNetworkFires'] as number : 0;

  // Status icon helper
  const statusIcon = (val: boolean | undefined) => {
    if (val === true) return { sym: '\u2713', color: 'var(--gs-terminal)' };
    return { sym: '\u2717', color: 'var(--gs-critical)' };
  };

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
      <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.15em' }}>
        Pixel Capability Matrix
      </h4>

      {/* Stats tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5em', marginBottom: '0.3em' }}>
        {[
          { value: pixelCount, label: 'Pixels', color: 'var(--gs-light)' },
          { value: totalNetworkFires || '—', label: 'Total Fires', color: 'var(--gs-light)' },
          { value: `${Math.round(adScriptBytes / 1024)}KB`, label: 'Ad Script Size', color: adScriptBytes > 200000 ? 'var(--gs-warning)' : 'var(--gs-light)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 1.35cqi, 22px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
              {s.value}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.68cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      {pixels.length > 0 ? (
        <div style={{ overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(80px, 1.5fr) repeat(4, 1fr)',
            gap: '1px',
            marginBottom: '1px',
          }}>
            <div className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', padding: '0.2em 0.3em', letterSpacing: '0.05em' }}>
              Pixel
            </div>
            <div className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', padding: '0.2em', textAlign: 'center', letterSpacing: '0.05em' }}>
              Enhanced
            </div>
            <div className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', padding: '0.2em', textAlign: 'center', letterSpacing: '0.05em' }}>
              Server
            </div>
            <div className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', padding: '0.2em', textAlign: 'center', letterSpacing: '0.05em' }}>
              Consent
            </div>
            <div className="font-data uppercase" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', padding: '0.2em', textAlign: 'center', letterSpacing: '0.05em' }}>
              Fires
            </div>
          </div>

          {/* Data rows */}
          {pixels.slice(0, 8).map((px, i) => {
            const pixelName = typeof px.name === 'string' ? px.name : typeof px.pixelType === 'string' ? px.pixelType : 'Unknown';
            const enhanced = statusIcon(px.hasEnhancedConversions ?? px.enhanced);
            const server = statusIcon(px.serverSide);
            const consent = statusIcon(px.consentAware);
            const fires = px.networkFires ?? px.fireCount ?? 0;

            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(80px, 1.5fr) repeat(4, 1fr)',
                gap: '1px',
                background: i % 2 === 0 ? 'rgba(255,178,239,0.03)' : 'transparent',
                borderRadius: '2px',
              }}>
                <div className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)', padding: '0.25em 0.3em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pixelName}
                </div>
                <div style={{ textAlign: 'center', padding: '0.25em' }}>
                  <span className="font-display" style={{ fontSize: 'clamp(1px, 0.98cqi, 15px)', fontWeight: 700, color: enhanced.color }}>{enhanced.sym}</span>
                </div>
                <div style={{ textAlign: 'center', padding: '0.25em' }}>
                  <span className="font-display" style={{ fontSize: 'clamp(1px, 0.98cqi, 15px)', fontWeight: 700, color: server.color }}>{server.sym}</span>
                </div>
                <div style={{ textAlign: 'center', padding: '0.25em' }}>
                  <span className="font-display" style={{ fontSize: 'clamp(1px, 0.98cqi, 15px)', fontWeight: 700, color: consent.color }}>{consent.sym}</span>
                </div>
                <div className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.86cqi, 14px)', color: 'var(--gs-light)', textAlign: 'center', padding: '0.25em', fontWeight: 600 }}>
                  {fires}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.90cqi, 14px)', color: 'var(--gs-mid)' }}>
          No ad pixels detected on this page.
        </p>
      )}

      {/* CAPI + Click IDs footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em', flexWrap: 'wrap', marginTop: '0.2em' }}>
        <Pill text={capiDetected ? 'CAPI Active' : 'No CAPI'} color={capiDetected ? 'var(--gs-terminal)' : 'var(--gs-critical)'} />
        {clickIds.slice(0, 4).map((id, i) => (
          <Pill key={i} text={id} color="var(--gs-mid)" />
        ))}
      </div>
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="Paid Media Pixels"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Network requests, pixel detection, CAPI inspection"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      chloeCallout={chloeCallout}
    />
  );
}
