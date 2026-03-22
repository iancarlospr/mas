'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M25 Slide — Traffic by Country
 * ═══════════════════════════════
 *
 * Choropleth world map — countries colored by traffic share on the pink scale.
 * Stats panel overlaid bottom-right.
 */

const GEO_URL = '/api/geo/world';

interface CountryEntry {
  country?: string;
  locationCode?: number;
  organicEtv?: number;
  paidEtv?: number;
  totalEtv?: number;
  share?: number;
  percentage?: number;
  trafficShare?: number;
  traffic?: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString();
}

/** DataForSEO location code → ISO 3166-1 numeric string (topojson ID) */
function toIsoNumeric(locationCode: number): string {
  return String(locationCode - 2000);
}

/** Map traffic share (0–100) to pink fill color */
function trafficColor(sharePct: number, maxPct: number): string {
  if (sharePct <= 0) return 'rgba(255,178,239,0.03)';
  // Use sqrt scale to compress the range (top country doesn't drown out others)
  const t = Math.sqrt(sharePct / maxPct);
  const alpha = 0.08 + t * 0.82; // 0.08 → 0.9
  return `rgba(255,178,239,${alpha.toFixed(2)})`;
}

export function M25Slide({ scan, onAskChloe }: { scan: ScanWithResults; onAskChloe?: () => void }) {
  const syn = getM41Summary(scan, 'M25');
  const mod = getModuleResult(scan, 'M25');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'Geographic traffic distribution';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  const countriesRaw = (raw?.['countries'] as CountryEntry[] | undefined) ?? [];
  const totalCountries = typeof raw?.['totalCountries'] === 'number' ? raw['totalCountries'] as number : countriesRaw.length;

  // Build lookup: ISO numeric string → { name, etv, sharePct }
  const countries = countriesRaw.map((c) => {
    const name = typeof c.country === 'string' ? c.country : '?';
    const etv = typeof c.totalEtv === 'number' ? c.totalEtv
      : (typeof c.organicEtv === 'number' ? c.organicEtv : 0) + (typeof c.paidEtv === 'number' ? c.paidEtv : 0);
    const isoId = c.locationCode ? toIsoNumeric(c.locationCode) : null;
    return { name, etv, isoId, locationCode: c.locationCode };
  });

  const totalEtv = countries.reduce((sum, c) => sum + c.etv, 0);
  const countriesWithShare = countries.map((c) => ({
    ...c,
    sharePct: totalEtv > 0 ? (c.etv / totalEtv) * 100 : 0,
  }));

  const maxShare = Math.max(...countriesWithShare.map(c => c.sharePct), 1);

  const trafficMap = useMemo(() => {
    const m = new Map<string, { name: string; sharePct: number; etv: number }>();
    for (const c of countriesWithShare) {
      if (c.isoId) m.set(c.isoId, { name: c.name, sharePct: c.sharePct, etv: c.etv });
    }
    return m;
  }, [countriesWithShare]);

  // Top 5 for legend
  const top5 = countriesWithShare.slice(0, 5);

  // ── Tooltip state ──
  const [tooltip, setTooltip] = useState<{ name: string; pct: number; x: number; y: number; w: number; h: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent, entry: { name: string; sharePct: number } | undefined) => {
    if (!entry || !mapRef.current) { setTooltip(null); return; }
    const rect = mapRef.current.getBoundingClientRect();
    setTooltip({
      name: entry.name, pct: entry.sharePct,
      x: e.clientX - rect.left, y: e.clientY - rect.top,
      w: rect.width, h: rect.height,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Traffic by Country" scan={scan} sourceLabel="Source: Geographic traffic distribution, country-level analytics" />;
  }

  return (
    <SlideShell
      moduleName="Traffic by Country"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Geographic traffic distribution, country-level analytics"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      flexViz
      onAskChloe={onAskChloe}
    >
      <div style={{
        position: 'relative', flex: '1 1 0', minHeight: 0,
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
        marginBottom: '0.4em', padding: '0.3em 0',
        overflow: 'hidden',
      }}>
        {/* Map */}
        <div ref={mapRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 140, center: [10, 5] }}
            width={800}
            height={320}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties: Record<string, string> }> }) =>
                geographies.map((geo) => {
                  const id = geo.id;
                  const entry = trafficMap.get(id);
                  const fill = entry
                    ? trafficColor(entry.sharePct, maxShare)
                    : 'rgba(255,178,239,0.03)';

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseMove={(e: React.MouseEvent) => handleMouseMove(e, entry)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        default: {
                          fill,
                          stroke: 'rgba(255,178,239,0.08)',
                          strokeWidth: 0.3,
                          outline: 'none',
                          cursor: entry ? 'pointer' : 'default',
                        },
                        hover: {
                          fill: entry ? 'rgba(255,178,239,0.95)' : 'rgba(255,178,239,0.08)',
                          stroke: entry ? 'rgba(255,178,239,0.5)' : 'rgba(255,178,239,0.12)',
                          strokeWidth: entry ? 0.6 : 0.3,
                          outline: 'none',
                          cursor: entry ? 'pointer' : 'default',
                        },
                        pressed: { fill, stroke: 'rgba(255,178,239,0.08)', strokeWidth: 0.3, outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Hover tooltip */}
          {tooltip && (() => {
            const TOOLTIP_H = 42; // approx height of pill + arrow
            const MARGIN = 8;
            const flipY = tooltip.y < TOOLTIP_H + MARGIN; // too close to top → show below
            const clampedX = Math.max(60, Math.min(tooltip.x, tooltip.w - 60)); // keep away from L/R edges

            return (
              <div
                style={{
                  position: 'absolute',
                  left: clampedX,
                  top: tooltip.y,
                  transform: flipY
                    ? 'translate(-50%, 20%)'   // below cursor
                    : 'translate(-50%, -120%)', // above cursor
                  pointerEvents: 'none',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: flipY ? 'column-reverse' : 'column',
                }}
              >
                <div style={{
                  background: 'rgba(8,8,8,0.88)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,178,239,0.25)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(255,178,239,0.08)',
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'var(--gs-light)',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}>
                    {tooltip.name}
                  </span>
                  <span style={{
                    fontSize: '15px',
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'var(--gs-base)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {tooltip.pct < 1 ? tooltip.pct.toFixed(1) : Math.round(tooltip.pct)}%
                  </span>
                </div>
                {/* Arrow — flips direction */}
                <div style={{
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  ...(flipY
                    ? { borderBottom: '5px solid rgba(8,8,8,0.88)' }
                    : { borderTop: '5px solid rgba(8,8,8,0.88)' }),
                  margin: '0 auto',
                }} />
              </div>
            );
          })()}
        </div>

        {/* Stats overlay — bottom right */}
        <div style={{
          position: 'absolute', bottom: '0.8em', right: '0.8em',
          display: 'flex', gap: '1.5em', alignItems: 'flex-end',
          background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(8px)',
          padding: '0.6em 1em', borderRadius: '4px',
          border: '1px solid rgba(255,178,239,0.06)',
        }}>
          <StatBlock value={totalCountries.toLocaleString()} label="Countries" color="var(--gs-light)" />
          {totalEtv > 0 && <StatBlock value={fmtNum(totalEtv)} label="Total ETV" color="var(--gs-base)" />}
        </div>

        {/* Top countries legend — bottom left */}
        {top5.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '0.8em', left: '0.8em',
            display: 'flex', flexDirection: 'column', gap: '0.2em',
            background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(8px)',
            padding: '0.5em 0.8em', borderRadius: '4px',
            border: '1px solid rgba(255,178,239,0.06)',
          }}>
            {top5.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0,
                  background: trafficColor(c.sharePct, maxShare),
                }} />
                <span className="font-data" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-light)', lineHeight: 1.2 }}>
                  {c.name}
                </span>
                <span className="font-data tabular-nums" style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: 'var(--gs-mid)', marginLeft: 'auto', lineHeight: 1.2 }}>
                  {Math.round(c.sharePct)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideShell>
  );
}
