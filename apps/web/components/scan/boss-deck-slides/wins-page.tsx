/**
 * Boss Deck — Wins Page (Page 2)
 * Smart widget grid, stat cards, strength pills.
 * Dark variant when widgets present, light otherwise.
 */

import type { BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import {
  extractCWV, extractPaidAds, extractSentiment, extractTraffic, extractTopKeyword,
  getStrengths, lightBg, lightColor, fmtNum, healthColor,
  type CWVData, type PaidAdsData, type SentimentData, type TrafficData, type TopKeywordData,
} from './helpers';
import { BDFooter } from './footer';
import { GrainCanvas } from './grain-canvas';

// ── Widget sub-components ───────────────────────────────────

function SvgGauge({ value, max, health, label, isCls }: { value: number; max: number; health: string; label: string; isCls: boolean }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = 34;
  const circumHalf = Math.PI * r;
  const dash = circumHalf * pct;
  const color = healthColor(health);
  const display = isCls ? value.toFixed(3) : value.toFixed(1) + 's';
  return (
    <div className="cwv-gauge">
      <svg width="86" height="50" viewBox="0 0 80 46">
        <path d={`M 6 44 A ${r} ${r} 0 0 1 74 44`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M 6 44 A ${r} ${r} 0 0 1 74 44`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${circumHalf.toFixed(1)}`} />
      </svg>
      <div className="cwv-val" style={{ color }}>{display}</div>
      <div className="cwv-lbl">{label}</div>
    </div>
  );
}

function CWVWidget({ cwv }: { cwv: CWVData }) {
  return (
    <div className="widget">
      <div className="widget-hdr">
        <span className="widget-title">SITE SPEED</span>
        <span className="widget-status widget-status-good">PASSING</span>
      </div>
      <div className="cwv-row">
        {cwv.metrics.map((m, i) => <SvgGauge key={i} value={m.sec} max={m.max} health={m.health} label={m.label} isCls={m.label === 'CLS'} />)}
      </div>
    </div>
  );
}

function AdsWidget({ ads }: { ads: PaidAdsData }) {
  return (
    <div className="widget">
      <div className="widget-hdr">
        <span className="widget-title">ACTIVE ADS</span>
        <span className="widget-badge">{ads.tierLabel}</span>
      </div>
      <div className="ads-hero">{ads.totalAds}</div>
      <div className="ads-platforms">
        {ads.fbActive && (
          <div className="ads-row">
            <span className="ads-dot" style={{ background: '#22C55E' }} />
            <span className="ads-name">Meta</span>
            <span className="ads-count">{ads.fbAds}</span>
          </div>
        )}
        {ads.googleActive && (
          <div className="ads-row">
            <span className="ads-dot" style={{ background: '#22C55E' }} />
            <span className="ads-name">Google</span>
            <span className="ads-count">{ads.googleAds}</span>
          </div>
        )}
      </div>
      {ads.pixelCount > 0 && (
        <div className="ads-pixels">{ads.pixelCount} pixel{ads.pixelCount !== 1 ? 's' : ''} installed</div>
      )}
    </div>
  );
}

function SentimentWidget({ s }: { s: SentimentData }) {
  const barSeg = (pct: number, color: string) => pct > 0 ? <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 3 }} /> : null;
  return (
    <div className="widget">
      <div className="widget-hdr">
        <span className="widget-title">NEWS SENTIMENT</span>
        <span className="widget-status widget-status-good">{s.overall.toUpperCase()}</span>
      </div>
      <div className="sentiment-total">{s.total}</div>
      <div className="sentiment-sub-label">Media Mentions</div>
      <div className="sentiment-bar">
        {barSeg(s.posPct, '#22C55E')}
        {barSeg(s.neuPct, '#475569')}
        {barSeg(s.negPct, '#EF4444')}
      </div>
      <div className="sentiment-legend">
        <span className="sent-pos">+{s.positive} ({s.posPct}%)</span>
        <span className="sent-neg">&minus;{s.negative} ({s.negPct}%)</span>
      </div>
    </div>
  );
}

function TrafficWidget({ t }: { t: TrafficData }) {
  const orgPct = t.total > 0 ? Math.round(t.organic / t.total * 100) : 0;
  const paidPct = 100 - orgPct;
  return (
    <div className="widget">
      <div className="widget-hdr">
        <span className="widget-title">TRAFFIC</span>
        <span className="widget-badge">{t.tierLabel}</span>
      </div>
      <div className="traffic-hero">{t.totalFmt}</div>
      <div className="traffic-tier">monthly visits (est.)</div>
      <div className="traffic-bar-wrap">
        <div className="traffic-bar">
          <div className="traffic-bar-org" style={{ width: `${orgPct}%` }} />
          <div className="traffic-bar-paid" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="traffic-legend">
          <span className="traf-org"><span className="traf-dot" style={{ background: '#22C55E' }} />Organic {fmtNum(t.organic)}</span>
          <span className="traf-paid"><span className="traf-dot" style={{ background: '#F59E0B' }} />Paid {fmtNum(t.paid)}</span>
        </div>
      </div>
      {t.topCountryCode && (
        <div className="traffic-country">#1 Market <span className="country-code">{t.topCountryCode}</span></div>
      )}
    </div>
  );
}

function KeywordWidget({ kw }: { kw: TopKeywordData }) {
  return (
    <div className="widget">
      <div className="widget-hdr">
        <span className="widget-title">TOP KEYWORD</span>
        <span className="widget-status widget-status-blue">#{kw.position}</span>
      </div>
      <div className="kw-name">&ldquo;{kw.keyword}&rdquo;</div>
      <div className="kw-meta">
        <span className="kw-vol">{kw.volumeFmt} searches/mo</span>
        <span className="kw-sep">&middot;</span>
        <span className="kw-total">{fmtNum(kw.totalOrganic)} ranked</span>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export function WinsPage({
  narrative,
  highlights,
  ctx,
  pageNum,
  totalPages,
}: {
  narrative: string;
  highlights: BossDeckAIOutput['wins_highlights'];
  ctx: BossDeckRenderContext;
  pageNum: number;
  totalPages: number;
}) {
  const strengths = getStrengths(ctx);

  const cwv = extractCWV(ctx.m03Data);
  const ads = extractPaidAds(ctx.m21Data, ctx.m06Data);
  const sentiment = extractSentiment(ctx.m22Data);
  const traffic = extractTraffic(ctx.m24Data, ctx.m25Data);
  const topKw = extractTopKeyword(ctx.m26Data);

  const widgets: React.ReactNode[] = [];
  if (cwv) widgets.push(<CWVWidget key="cwv" cwv={cwv} />);
  if (ads) widgets.push(<AdsWidget key="ads" ads={ads} />);
  if (sentiment) widgets.push(<SentimentWidget key="sent" s={sentiment} />);
  if (traffic) widgets.push(<TrafficWidget key="traf" t={traffic} />);
  if (topKw) widgets.push(<KeywordWidget key="kw" kw={topKw} />);

  const hasDarkBand = widgets.length > 0;

  return (
    <>
      {hasDarkBand && (
        <>
          <div className="wins-plasma" />
          <div className="wins-glow-1" />
          <div className="wins-glow-2" />
          <GrainCanvas opacity={0.10} className="wins-grain" />
        </>
      )}
      <div className={`page-inner${hasDarkBand ? ' wins-inner' : ''}`}>
        <div className={hasDarkBand ? 'section-header-dark wins-section' : 'section-header-light'}>
          <div className={hasDarkBand ? 'wins-section-num' : 'section-number'}>02</div>
          <div className={hasDarkBand ? 'section-label-dark' : 'section-label'}>CURRENT PERFORMANCE</div>
        </div>

        <h2 className={`${hasDarkBand ? 'title-dark' : 'title-light'} wins-title-sm`}>Here&rsquo;s What&rsquo;s Already Working</h2>
        <p className="wins-narrative">{narrative}</p>

        {widgets.length > 0 && (
          <div className="wins-widget-grid" style={{ gridTemplateColumns: `repeat(${widgets.length}, 1fr)` }}>
            {widgets}
          </div>
        )}

        <div className="wins-stats-row">
          {highlights.map((h, i) => (
            <div className="stat-card-win" key={i}>
              <div className="stat-val-win">{h.metric_value}</div>
              <div className="stat-lbl-win">{h.metric_label}</div>
              <div className="stat-ctx-win">{h.context}</div>
            </div>
          ))}
        </div>
      </div>
      <BDFooter pageNum={pageNum} totalPages={totalPages} variant={hasDarkBand ? 'dark' : 'light'} userName={ctx.userEmail} />
    </>
  );
}
