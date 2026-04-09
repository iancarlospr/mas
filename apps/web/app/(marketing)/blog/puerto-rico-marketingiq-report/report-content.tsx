'use client';

import { useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';

// ── Verified Data ─────────────────────────────────────────────────────────────

const histogramData = [
  { range: '40-59', count: 3 },
  { range: '60-79', count: 29 },
  { range: '80-100', count: 18 },
];

const radarData = [
  { category: 'Security', score: 50.0, baseline: 50 },
  { category: 'Analytics', score: 44.8, baseline: 50 },
  { category: 'Performance', score: 58.5, baseline: 50 },
  { category: 'SEO', score: 54.5, baseline: 50 },
  { category: 'Paid Media', score: 38.1, baseline: 50 },
  { category: 'MarTech', score: 54.5, baseline: 50 },
  { category: 'Brand', score: 41.2, baseline: 50 },
  { category: 'Market Intel', score: 42.1, baseline: 50 },
];

const categoryRankData = [
  { category: 'Performance', score: 58.5 },
  { category: 'SEO', score: 54.5 },
  { category: 'MarTech', score: 54.5 },
  { category: 'Security', score: 50.0 },
  { category: 'Analytics', score: 44.8 },
  { category: 'Market Intel', score: 42.1 },
  { category: 'Brand', score: 41.2 },
  { category: 'Paid Media', score: 38.1 },
];

const issuesData = [
  { issue: 'No A/B testing or experimentation', pct: 98, category: 'Analytics' },
  { issue: 'Low organic keyword visibility (Top-10 Ratio)', pct: 54, category: 'SEO' },
  { issue: 'Minimal traffic volume signals', pct: 54, category: 'Market Intel' },
  { issue: 'Missing or broken robots.txt / sitemap', pct: 38, category: 'SEO' },
  { issue: 'Single-platform ad presence only', pct: 36, category: 'Paid Media' },
  { issue: 'Missing privacy policy or terms pages', pct: 30, category: 'Security' },
  { issue: 'Incomplete email auth (DMARC/SPF/DKIM)', pct: 26, category: 'Security' },
  { issue: 'Missing or incomplete Open Graph tags', pct: 26, category: 'SEO' },
  { issue: 'Poor technical SEO (crawl/index)', pct: 22, category: 'SEO' },
  { issue: 'Failed Core Web Vitals', pct: 10, category: 'Performance' },
];

const heatmapCategories = ['Security', 'Analytics', 'Performance', 'SEO', 'Paid Media', 'MarTech', 'Brand', 'Market Intel'];
const heatmapData = [
  { industry: 'Tech & Econ Dev', Security: 58.2, Analytics: 46.4, Performance: 61.2, SEO: 68.0, 'Paid Media': 41.4, MarTech: 58.6, Brand: 51.2, 'Market Intel': 41.2 },
  { industry: 'Health / Pharma', Security: 56.0, Analytics: 48.4, Performance: 60.0, SEO: 58.6, 'Paid Media': 43.4, MarTech: 55.1, Brand: 40.1, 'Market Intel': 47.0 },
  { industry: 'CPG', Security: 52.6, Analytics: 44.0, Performance: 59.8, SEO: 51.4, 'Paid Media': 37.4, MarTech: 56.2, Brand: 41.4, 'Market Intel': 38.8 },
  { industry: 'Events & Tradeshows', Security: 46.0, Analytics: 51.0, Performance: 65.0, SEO: 51.2, 'Paid Media': 38.2, MarTech: 58.6, Brand: 45.4, 'Market Intel': 42.2 },
  { industry: 'Banks & Finance', Security: 48.9, Analytics: 49.0, Performance: 58.7, SEO: 60.5, 'Paid Media': 40.5, MarTech: 52.1, Brand: 38.6, 'Market Intel': 49.0 },
  { industry: 'Apps & Startups', Security: 47.6, Analytics: 41.8, Performance: 57.2, SEO: 34.8, 'Paid Media': 32.6, MarTech: 57.4, Brand: 39.8, 'Market Intel': 27.6 },
  { industry: 'Auto', Security: 45.8, Analytics: 32.2, Performance: 56.6, SEO: 47.0, 'Paid Media': 36.8, MarTech: 44.4, Brand: 38.2, 'Market Intel': 34.6 },
  { industry: 'News & Media', Security: 39.8, Analytics: 37.6, Performance: 47.8, SEO: 54.6, 'Paid Media': 26.4, MarTech: 55.6, Brand: 38.6, 'Market Intel': 44.2 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const getHeatColor = (val: number) => {
  const t = Math.max(0, Math.min(1, (val - 25) / 45));
  const stops = [
    { r: 180, g: 40, b: 40 },
    { r: 210, g: 110, b: 45 },
    { r: 190, g: 165, b: 50 },
    { r: 45, g: 160, b: 140 },
    { r: 22, g: 120, b: 65 },
  ];
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = idx - lo;
  const r = Math.round(stops[lo]!.r + (stops[hi]!.r - stops[lo]!.r) * f);
  const g = Math.round(stops[lo]!.g + (stops[hi]!.g - stops[lo]!.g) * f);
  const b = Math.round(stops[lo]!.b + (stops[hi]!.b - stops[lo]!.b) * f);
  return { fill: `rgb(${r}, ${g}, ${b})`, text: '#fff' };
};

const catTagColors: Record<string, { bg: string; text: string }> = {
  Analytics:      { bg: 'oklch(0.16 0.05 280)', text: 'oklch(0.72 0.12 280)' },
  Security:       { bg: 'oklch(0.16 0.05 340)', text: '#FFB2EF' },
  SEO:            { bg: 'oklch(0.16 0.05 155)', text: 'oklch(0.72 0.12 155)' },
  Performance:    { bg: 'oklch(0.16 0.05 250)', text: 'oklch(0.72 0.12 250)' },
  'Paid Media':   { bg: 'oklch(0.16 0.05 55)',  text: 'oklch(0.72 0.12 55)' },
  MarTech:        { bg: 'oklch(0.16 0.05 310)', text: 'oklch(0.72 0.12 310)' },
  Brand:          { bg: 'oklch(0.16 0.05 85)',  text: 'oklch(0.72 0.12 85)' },
  'Market Intel': { bg: 'oklch(0.16 0.05 220)', text: 'oklch(0.72 0.12 220)' },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'oklch(0.14 0.03 340)',
      border: '1px solid oklch(0.28 0.05 340)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      fontFamily: 'var(--font-system)',
      boxShadow: '0 4px 20px oklch(0.20 0.10 340 / 0.3)',
    }}>
      <div style={{ color: 'oklch(0.50 0.05 340)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || 'var(--gs-light)', fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

const renderPolarTick = ({ payload, x, y, cx, cy }: any) => {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offsetX = (dx / dist) * 20;
  const offsetY = (dy / dist) * 20;
  return (
    <text
      x={x + offsetX}
      y={y + offsetY}
      textAnchor={Math.abs(dx) < 5 ? 'middle' : dx > 0 ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fill: '#8a6a82', fontSize: 12, fontFamily: 'var(--font-system)', fontWeight: 500 }}
    >
      {payload.value}
    </text>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Reusable Components ───────────────────────────────────────────────────────

const Stat = ({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) => (
  <div style={{
    textAlign: 'center',
    padding: '20px 16px',
    background: accent ? 'oklch(0.10 0.04 340)' : 'oklch(0.14 0.02 340)',
    borderRadius: 12,
    border: accent ? '1px solid oklch(0.30 0.10 340)' : '1px solid oklch(0.22 0.03 340)',
    flex: '1 1 140px',
  }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 36,
      fontWeight: 700,
      color: accent ? '#FFB2EF' : 'var(--gs-light)',
      lineHeight: 1.1,
    }}>{value}</div>
    <div style={{
      fontFamily: 'var(--font-system)',
      fontSize: 11,
      color: accent ? 'oklch(0.55 0.06 340)' : 'oklch(0.42 0.04 340)',
      marginTop: 6,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    }}>{label}</div>
  </div>
);

const SectionLabel = ({ text }: { text: string }) => (
  <div style={{
    fontFamily: 'var(--font-system)',
    fontSize: 11,
    color: '#FFB2EF',
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    fontWeight: 600,
  }}>{text}</div>
);

const ChartFrame = ({ title, caption, children }: { title?: string; caption?: string; children: ReactNode }) => (
  <div style={{
    margin: '40px 0',
    background: 'oklch(0.11 0.02 340)',
    border: '1px solid oklch(0.22 0.04 340)',
    borderRadius: 16,
    padding: '28px 24px 20px',
    overflow: 'hidden',
  }}>
    {title && <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--gs-light)',
      marginBottom: 16,
      textAlign: 'center',
    }}>{title}</div>}
    {children}
    {caption && <div style={{
      fontFamily: 'var(--font-system)',
      fontSize: 11,
      color: 'oklch(0.42 0.04 340)',
      textAlign: 'center',
      marginTop: 12,
    }}>{caption}</div>}
  </div>
);

// ── Main Article ──────────────────────────────────────────────────────────────

export default function ReportContent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const P = ({ children, style = {} }: { children: ReactNode; style?: CSSProperties }) => (
    <p style={{
      fontFamily: 'var(--font-system)',
      fontSize: 15,
      lineHeight: 1.75,
      color: 'oklch(0.80 0.03 340)',
      margin: '0 0 20px',
      ...style,
    }}>{children}</p>
  );

  const H2 = ({ children }: { children: ReactNode }) => (
    <h2 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      color: 'var(--gs-light)',
      margin: '56px 0 16px',
      lineHeight: 1.2,
    }}>{children}</h2>
  );

  const H3 = ({ children }: { children: ReactNode }) => (
    <h3 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 20,
      fontWeight: 600,
      color: '#FFB2EF',
      margin: '40px 0 12px',
      lineHeight: 1.3,
    }}>{children}</h3>
  );

  const Divider = () => (
    <div style={{
      width: 60,
      height: 3,
      background: 'linear-gradient(90deg, #FFB2EF, oklch(0.45 0.10 340))',
      borderRadius: 2,
      margin: '48px 0',
    }} />
  );

  const Callout = ({ children }: { children: ReactNode }) => (
    <div style={{
      borderLeft: '3px solid #FFB2EF',
      background: 'oklch(0.12 0.04 340)',
      padding: '20px 24px',
      borderRadius: '0 12px 12px 0',
      margin: '28px 0',
      fontFamily: 'var(--font-system)',
      fontSize: 15,
      lineHeight: 1.7,
      color: 'oklch(0.82 0.04 340)',
    }}>{children}</div>
  );

  return (
    <div className="miq-report" style={{
      background: '#080808',
      minHeight: '100vh',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.6s ease',
    }}>
      <style>{`
        .miq-report strong { color: oklch(0.95 0.04 340); font-weight: 600; }
        .bar-anim { animation: growRight 0.8s ease-out forwards; }
        @keyframes growRight { from { width: 0%; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(165deg, #080808 0%, oklch(0.10 0.04 340) 50%, #080808 100%)',
        padding: '80px 24px 64px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 20%, oklch(0.45 0.18 340 / 0.10) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, oklch(0.40 0.15 340 / 0.06) 0%, transparent 50%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{
              width: 8,
              height: 8,
              background: '#FFB2EF',
              borderRadius: '50%',
              boxShadow: '0 0 10px #FFB2EF80',
            }} />
            <span style={{
              fontFamily: 'var(--font-system)',
              fontSize: 11,
              color: '#FFB2EF',
              letterSpacing: 3,
              textTransform: 'uppercase' as const,
            }}>MarTech Intelligence Report</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 700,
            color: 'var(--gs-light)',
            lineHeight: 1.15,
            margin: '0 0 24px',
          }}>
            I Audited 50 Puerto Rico Websites.<br />
            <span style={{ color: '#FFB2EF' }}>Here&apos;s What the Data Says.</span>
          </h1>
          <p style={{
            fontFamily: 'var(--font-system)',
            fontSize: 14,
            color: 'oklch(0.55 0.04 340)',
            lineHeight: 1.6,
            maxWidth: 540,
            margin: '0 auto 32px',
          }}>
            A comprehensive marketing technology audit across Banking, Healthcare, Auto, Tech, Events, Media, CPG, and Startups. 8 categories.
          </p>
          <div style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontFamily: 'var(--font-system)',
            fontSize: 12,
            color: 'oklch(0.42 0.04 340)',
          }}>
            <span>Ian C. Ramirez Rivera</span>
            <span style={{ color: 'oklch(0.28 0.03 340)' }}>|</span>
            <span>March 2026</span>
            <span style={{ color: 'oklch(0.28 0.03 340)' }}>|</span>
            <span>powered by AlphaScan</span>
          </div>
        </div>
      </div>

      {/* ── Article Body ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }}>

        <Link
          href="/blog"
          style={{
            fontFamily: 'var(--font-system)',
            fontSize: 13,
            color: '#FFB2EF',
            display: 'inline-block',
            marginBottom: 32,
            textDecoration: 'none',
          }}
        >
          &larr; Back to blog
        </Link>

        <P>Over the past several weeks, I ran a comprehensive marketing technology audit on 50 websites belonging to some of the largest organizations operating in Puerto Rico.</P>
        <P style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: 'oklch(0.65 0.08 340)', lineHeight: 1.55 }}>
          Banking. Healthcare. Auto. Retail. Tech. Events. Media. Consumer goods.
        </P>
        <P>The audits were performed using MarketingAlphaScan, a platform I built that runs 45+ analysis modules across 8 categories: Security &amp; Compliance, Analytics &amp; Measurement, Performance &amp; Experience, SEO &amp; Content, Paid Media, MarTech Infrastructure, Brand &amp; Digital Presence, and Market Intelligence.</P>
        <P>Each site received a MarketingIQ score from 0 to 100.</P>
        <P>None of this is theoretical. Every data point below comes from real scans of real production websites, conducted in March 2026.</P>
        <P>I&apos;m not naming any companies. This isn&apos;t about shaming anyone. It&apos;s about understanding where Puerto Rico&apos;s digital marketing infrastructure actually stands, and where the gaps are costing real money.</P>

        <Divider />

        {/* ── The Numbers ── */}
        <SectionLabel text="The Numbers" />
        <H2>Average MarketingIQ Score</H2>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '24px 0 32px' }}>
          <Stat value="76.2" label="Mean Score" accent />
          <Stat value="77.5" label="Median" />
          <Stat value="48" label="Lowest" />
          <Stat value="89" label="Highest" />
        </div>

        <P>For context, a score of 50 represents a baseline of functional marketing infrastructure. Above 70 indicates a mature, well-instrumented stack. Below 40 signals significant gaps that are likely costing the organization leads, revenue, or both.</P>

        <ChartFrame title="MarketingIQ Score Distribution: 50 Puerto Rico Websites" caption="58% cluster in the 60-79 range. 36% scored 80+. Zero sites below 40.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={histogramData} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2028" />
              <XAxis dataKey="range" tick={{ fill: '#8a6a82', fontSize: 12, fontFamily: 'var(--font-system)' }} axisLine={{ stroke: '#3a2e36' }} tickLine={false} />
              <YAxis tick={{ fill: '#8a6a82', fontSize: 12, fontFamily: 'var(--font-system)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Sites" radius={[6, 6, 0, 0]}>
                {histogramData.map((_, i) => (
                  <Cell key={i} fill={i === 2 ? '#FFB2EF' : i === 1 ? '#b87aaa' : '#6e4e6a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <P>On the surface, that looks encouraging. The median is 77.5. Nobody fell off a cliff.</P>
        <P>But the overall score masks what&apos;s happening underneath. When you break it down by category, the story changes.</P>

        <Divider />

        {/* ── Strong Categories ── */}
        <SectionLabel text="Where Puerto Rico Is Strong" />
        <H2>Three categories pulled scores above the 50 baseline</H2>

        <ChartFrame title="Average Category Scores: Puerto Rico" caption="8 MarketingIQ dimensions. Score out of 100.">
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#2d2028" />
              <PolarAngleAxis dataKey="category" tick={renderPolarTick} />
              <PolarRadiusAxis angle={90} domain={[0, 70]} tick={{ fill: '#6e4e6a', fontSize: 10, fontFamily: 'var(--font-system)' }} axisLine={false} />
              <Radar name="PR Average" dataKey="score" stroke="#FFB2EF" fill="rgba(255,178,239,0.08)" strokeWidth={2.5} dot={{ fill: '#FFB2EF', r: 4, strokeWidth: 0 }} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <H3>Performance &amp; Experience</H3>
        <P>68% of audited sites passed Core Web Vitals thresholds. Load times and mobile responsiveness were the strongest technical signals across the board. This reflects the industry-wide push toward page speed optimization over the past few years. The infrastructure is there. The basics are handled.</P>

        <H3>SEO &amp; Content</H3>
        <P>Technical SEO scored well, with an average of 68.9 across crawl and indexability metrics. Most sites have clean site architecture and functional sitemap configurations. The weakness here is content reach: the average Top-10 keyword visibility ratio was just 35.9, meaning most sites are technically crawlable but not ranking for anything meaningful.</P>

        <H3>MarTech &amp; Infrastructure</H3>
        <P>The CMS landscape is dominated by WordPress (38% of sites), followed by a mix of Webflow, Adobe Experience Manager, and Wix. 84% of sites are running Google Analytics 4 as their primary measurement tool. The stacks exist. Whether they&apos;re configured correctly is a different question.</P>

        <Divider />

        {/* ── Weak Categories ── */}
        <SectionLabel text="Where Puerto Rico Is Falling Behind" />
        <H2>Four categories scored below baseline</H2>

        <ChartFrame title="Category Rankings: Puerto Rico Average">
          <div style={{ padding: '0 8px' }}>
            {categoryRankData.map((item) => (
              <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '4px 0' }}>
                <div style={{ width: 100, textAlign: 'right', fontFamily: 'var(--font-system)', fontSize: 12, color: 'oklch(0.60 0.05 340)', fontWeight: 500, flexShrink: 0 }}>{item.category}</div>
                <div style={{ flex: 1, height: 28, background: 'oklch(0.18 0.02 340)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'oklch(0.40 0.04 340)', zIndex: 2, opacity: 0.5 }} />
                  <div className="bar-anim" style={{
                    width: `${item.score}%`,
                    height: '100%',
                    background: item.score >= 50
                      ? 'linear-gradient(90deg, oklch(0.55 0.12 340), #FFB2EF)'
                      : 'linear-gradient(90deg, oklch(0.40 0.18 25), oklch(0.55 0.22 25))',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 8,
                  }}>
                    <span style={{ fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, color: '#fff' }}>{item.score}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#FFB2EF' }}>{'\u25A0'} Above 50</span>
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'oklch(0.45 0.04 340)' }}>| Baseline</span>
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'oklch(0.55 0.22 25)' }}>{'\u25A0'} Below 50</span>
          </div>
        </ChartFrame>

        <H3>1. Paid Media Infrastructure</H3>
        <P>This was the lowest-scoring category across all 50 sites.</P>
        <P>36% of sites had single-platform or nonexistent paid media infrastructure. That means over a third of these organizations either aren&apos;t running paid campaigns at all, or are running them through a single channel with no diversification and limited tracking.</P>
        <P>30% had no multi-platform advertising presence detected. No Meta Pixel alongside Google Ads. No TikTok or LinkedIn tags. Just one channel, or nothing.</P>

        <Callout>If you&apos;re spending on organic content or SEO and people are visiting your site, but you have no retargeting pixel installed, every one of those visitors is a sunk cost. You paid to get them there. You have no mechanism to bring them back.</Callout>

        <H3>2. Brand &amp; Digital Presence</H3>
        <P>Only 18% of sites scored above 50 in Brand. This was a surprise.</P>
        <P>Most organizations have logos, color systems, and social accounts. What they don&apos;t have is consistent digital presence signals that translate into discoverability and authority. Open Graph implementation was missing or incomplete on 26% of sites. <strong>When someone shares your page on LinkedIn or WhatsApp and it shows a broken preview with no image and no description, that&apos;s a brand problem.</strong></P>

        <H3>3. Market Intelligence</H3>
        <P>54% of sites showed minimal traffic volume signals. The average traffic score was 36.0.</P>
        <P>This isn&apos;t just about visitor count. It&apos;s a proxy for digital footprint. Organizations with low traffic scores are invisible to their own market. They&apos;re not generating demand signals. They&apos;re not feeding their analytics. They&apos;re operating without the data density required to make informed decisions about what&apos;s working and what isn&apos;t.</P>

        <H3>4. Analytics &amp; Measurement</H3>
        <P>84% of sites are running GA4. That&apos;s the good news.</P>
        <P>The bad news: 18% had analytics configurations so weak they scored 30 or below. And the universal gap across nearly every site was experimentation. 90% of audited sites had zero A/B testing or experimentation infrastructure in place.</P>

        <Callout>No Google Optimize. No VWO. No Optimizely. No feature flags. Nothing. That means 90% of these organizations are making decisions about their websites, their landing pages, their conversion flows, and their campaigns based on gut feel, committee consensus, or whatever the last agency recommended. Not data. Not controlled experiments. Gut.</Callout>

        <Divider />

        {/* ── Top Issues ── */}
        <SectionLabel text="Top Issues" />
        <H2>The 10 most common gaps across all 50 scans</H2>

        <ChartFrame title="Top Issues: Sites Affected (%)" caption="Threshold: sub-metric score of 30 or below.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px', fontFamily: 'var(--font-system)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['', 'Issue', 'Affected', 'Category'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      color: 'oklch(0.45 0.04 340)',
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: 'uppercase' as const,
                      borderBottom: '1px solid oklch(0.22 0.04 340)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issuesData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 10px', color: 'oklch(0.42 0.04 340)', fontWeight: 600, width: 30 }}>{String(i + 1).padStart(2, '0')}</td>
                    <td style={{ padding: '9px 10px', color: 'oklch(0.82 0.03 340)', fontWeight: 500, fontFamily: 'var(--font-system)', fontSize: 13 }}>{row.issue}</td>
                    <td style={{ padding: '9px 10px', width: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 100, height: 7, background: 'oklch(0.18 0.02 340)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.pct}%`,
                            height: '100%',
                            background: row.pct >= 50 ? 'oklch(0.55 0.22 25)' : row.pct >= 30 ? 'oklch(0.78 0.15 75)' : '#FFB2EF',
                            borderRadius: 4,
                          }} />
                        </div>
                        <span style={{
                          color: row.pct >= 50 ? 'oklch(0.60 0.22 25)' : row.pct >= 30 ? 'oklch(0.78 0.15 75)' : '#FFB2EF',
                          fontWeight: 700,
                          minWidth: 30,
                        }}>{row.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{
                        background: catTagColors[row.category]?.bg,
                        color: catTagColors[row.category]?.text,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>{row.category}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartFrame>

        <Divider />

        {/* ── The Pattern ── */}
        <Callout>These organizations are spending on marketing. They have teams. They have agencies. They have budgets. So if the money is there and the people are there, what exactly is the bottleneck?</Callout>

        <Divider />

        {/* ── Industry View ── */}
        <SectionLabel text="The Industry View" />
        <H2>Score Heatmap by Industry</H2>

        <ChartFrame title="MarketingIQ Category Scores by Industry" caption="8 industries x 8 categories. Color intensity reflects average category score.">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: 'oklch(0.42 0.04 340)' }}>Low</span>
            <div style={{ width: 180, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, rgb(180,40,40), rgb(210,110,45), rgb(190,165,50), rgb(45,160,140), rgb(22,120,65))' }} />
            <span style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: 'oklch(0.42 0.04 340)' }}>High</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontFamily: 'var(--font-system)', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: 'oklch(0.45 0.04 340)', fontWeight: 500, fontSize: 10, letterSpacing: 0.5, minWidth: 110 }}>INDUSTRY</th>
                  {heatmapCategories.map(c => (
                    <th key={c} style={{ textAlign: 'center', padding: '6px 3px', color: 'oklch(0.45 0.04 340)', fontWeight: 500, fontSize: 9, letterSpacing: 0.3, minWidth: 52, lineHeight: 1.3 }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr key={row.industry}>
                    <td style={{ padding: '7px 8px', color: 'oklch(0.80 0.03 340)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{row.industry}</td>
                    {heatmapCategories.map(cat => {
                      const val = row[cat as keyof typeof row] as number;
                      const c = getHeatColor(val);
                      return (
                        <td key={cat} title={`${row.industry} / ${cat}`} style={{ textAlign: 'center', padding: 0 }}>
                          <div style={{ width: '100%', height: 36, background: c.fill, borderRadius: 3, opacity: 0.9 }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartFrame>

        <P><strong>Strongest verticals:</strong> Tech &amp; Economic Development (led by strong SEO and Brand) and Health/Pharma (strongest Security scores, likely driven by compliance requirements).</P>
        <P><strong>Weakest verticals:</strong> News &amp; Media (lowest Paid Media, lowest Analytics, lowest Performance) and Auto (lowest Analytics).</P>
        <P>Banking &amp; Finance, the largest group in the sample (10 sites), landed in the middle across every category. No major weaknesses. No standouts either.</P>

        <Divider />

        {/* ── What This Means ── */}
        <SectionLabel text="What This Means" />
        <H2>Configuration problems, not budget problems</H2>

        <P>Puerto Rico&apos;s digital economy is growing. Investment is flowing in. Organizations are spending on marketing.</P>
        <P>But the infrastructure underneath that spending has gaps. Not because the teams aren&apos;t capable. Because marketing technology audits aren&apos;t part of the standard operating rhythm. Most organizations don&apos;t know what they don&apos;t know.</P>
        <P>The improvements aren&apos;t expensive. Most of the issues I found are configuration problems, not budget problems. A missing retargeting pixel. An unconfigured event in GA4. An Open Graph tag that was never set. These are 15-minute fixes that compound over months and years.</P>

        <Divider />

        {/* ── 4 Actions ── */}
        <SectionLabel text="4 Actions Any Organization Can Take This Week" />
        <H2>Start here</H2>

        {[
          { num: '01', title: 'Audit your GA4 configuration.', body: 'Open Google Tag Assistant and verify that your measurement ID is firing on every page. Check that enhanced measurement events are enabled. If you\'re not tracking scroll depth, outbound clicks, and site search, you\'re missing basic signals.' },
          { num: '02', title: 'Install retargeting pixels.', body: 'If you have organic traffic and no Meta Pixel or Google Ads remarketing tag, you\'re paying for visitors you can\'t re-engage. This takes 15 minutes to fix.' },
          { num: '03', title: 'Run a Core Web Vitals check.', body: 'Go to PageSpeed Insights and test your homepage and top 3 landing pages. If LCP is above 2.5s or CLS is above 0.1, your user experience is costing you conversions.' },
          { num: '04', title: 'Review your security headers.', body: 'Missing Content Security Policy, X-Frame-Options, or Strict-Transport-Security headers are free to implement and reduce your attack surface immediately. 26% of sites in this audit had incomplete or missing email authentication (DMARC/SPF/DKIM).' },
        ].map(a => (
          <div key={a.num} style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start' }}>
            <div style={{
              fontFamily: 'var(--font-system)',
              fontSize: 13,
              color: '#FFB2EF',
              fontWeight: 700,
              background: 'oklch(0.14 0.06 340)',
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid oklch(0.28 0.08 340)',
            }}>{a.num}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 15, fontWeight: 600, color: 'var(--gs-light)', marginBottom: 4 }}>{a.title}</div>
              <P style={{ margin: 0, color: 'oklch(0.65 0.04 340)' }}>{a.body}</P>
            </div>
          </div>
        ))}

        <Divider />

        {/* ── Closing ── */}
        <P>I ran these audits because this is what I do. I extract intelligence from marketing data and turn it into actionable strategy. I&apos;ve done it across 16 LATAM territories for Canon, across $40M+ in paid media for US banking advertisers, and now across 50 websites in Puerto Rico.</P>
        <P>The data doesn&apos;t care about your logo, your agency of record, or the size of your team. It cares about whether your infrastructure is configured to capture, measure, and act on the signals your market is sending you.</P>

        <Callout>If your organization wants to understand where your marketing stack actually stands, my DMs are open. If you found this useful, share it with your marketing team.</Callout>

        {/* ── Footer ── */}
        <div style={{ marginTop: 56, padding: '24px 0', borderTop: '1px solid oklch(0.22 0.04 340)' }}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'oklch(0.42 0.04 340)', lineHeight: 1.7 }}>
            Data collected March 2026 via MarketingAlphaScan. 50 sites across 8 industries: Banking &amp; Finance, Health/Pharma, Tech &amp; Economic Development, Events &amp; Tradeshows, Consumer Packaged Goods, Automotive, News &amp; Media, Apps &amp; Startups. No individual organizations are identified in this report.
          </div>
        </div>
      </div>
    </div>
  );
}
