'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  StatBlock,
  SegmentedBar,
  SkippedSlide,
} from './module-slide-template';

/**
 * M22 + M23 Slide — Sentiment Analysis
 * ═════════════════════════════════════
 *
 * Layout A: SlideShell with two side-by-side sentiment sections.
 * Left: News Sentiment (M22) — sentiment bar, key headlines.
 * Right: Social Sentiment (M23) — sentiment bar, social mentions.
 */

interface SentimentData {
  positive?: number;
  neutral?: number;
  negative?: number;
}

interface NewsHeadline {
  title?: string;
  source?: string;
  date?: string;
  sentiment?: string;
}

interface SocialMention {
  platform?: string;
  text?: string;
  sentiment?: string;
}

function sentimentColor(s?: string): string {
  if (s === 'positive') return 'var(--gs-terminal)';
  if (s === 'negative') return 'var(--gs-critical)';
  return 'var(--gs-mid)';
}

export function M22M23Slide({ scan, chloeCallout }: { scan: ScanWithResults; chloeCallout?: React.ReactNode }) {
  const syn22 = getM41Summary(scan, 'M22');
  const syn23 = getM41Summary(scan, 'M23');
  const mod22 = getModuleResult(scan, 'M22');
  const mod23 = getModuleResult(scan, 'M23');
  const raw22 = (mod22?.data as Record<string, unknown> | undefined) ?? null;
  const raw23 = (mod23?.data as Record<string, unknown> | undefined) ?? null;

  const skip22 = !mod22 || mod22.status === 'skipped' || mod22.status === 'error';
  const skip23 = !mod23 || mod23.status === 'skipped' || mod23.status === 'error';

  if (!syn22 && !syn23 && skip22 && skip23) {
    return <SkippedSlide moduleName="Sentiment Analysis" scan={scan} sourceLabel="Source: News API, social listening, sentiment analysis" />;
  }

  // Combine findings, recs, scores
  const findings = [
    ...(syn22?.key_findings ?? []),
    ...(syn23?.key_findings ?? []),
  ];
  const recs = [
    ...(syn22?.recommendations ?? []),
    ...(syn23?.recommendations ?? []),
  ];
  const scores = [
    ...(syn22?.score_breakdown ?? []),
    ...(syn23?.score_breakdown ?? []),
  ];

  const scoreVals = [syn22?.module_score ?? mod22?.score, syn23?.module_score ?? mod23?.score].filter((v): v is number => typeof v === 'number');
  const modScore = scoreVals.length > 0 ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) : null;

  const headline = findings.length > 0 ? findings[0]!.finding : 'Brand sentiment overview';
  const execSummary = syn22?.executive_summary ?? syn23?.executive_summary ?? syn22?.analysis ?? syn23?.analysis ?? '';

  // ── M22: News Sentiment ──
  // Engine stores sentiment.articles[] with per-article sentiment strings, NOT top-level counts
  const newsSentimentRaw = (raw22?.['sentiment'] as Record<string, unknown> | undefined) ?? {};
  const newsArticles = (newsSentimentRaw['articles'] as Array<{ title?: string; sentiment?: string; summary?: string }> | undefined) ?? [];
  const newsOverall = (newsSentimentRaw['overallSentiment'] as string | undefined) ?? null;
  const newsNotable = (newsSentimentRaw['notableMention'] as string | undefined) ?? null;
  const newsHeadlines = (raw22?.['newsHeadlines'] as NewsHeadline[] | undefined) ?? [];

  // Count sentiment from articles array
  const newsPositive = newsArticles.filter(a => a.sentiment === 'positive').length;
  const newsNeutral = newsArticles.filter(a => a.sentiment === 'neutral').length;
  const newsNegative = newsArticles.filter(a => a.sentiment === 'negative').length;
  const newsMentions = newsHeadlines.length > 0 ? newsHeadlines.length : newsArticles.length > 0 ? newsArticles.length : null;

  // ── M23: Social Sentiment ──
  const socialSentimentRaw = (raw23?.['socialSentiment'] as Record<string, unknown> | undefined)
    ?? (raw23?.['sentiment'] as Record<string, unknown> | undefined)
    ?? {};
  const socialArticles = (socialSentimentRaw['mentions'] as Array<{ sentiment?: string }> | undefined)
    ?? (socialSentimentRaw['articles'] as Array<{ sentiment?: string }> | undefined)
    ?? [];
  const socialMentions = (raw23?.['socialMentions'] as SocialMention[] | undefined) ?? [];
  const socialOverall = (socialSentimentRaw['overallSentiment'] as string | undefined) ?? null;

  const socialPositive = socialArticles.filter(a => a.sentiment === 'positive').length;
  const socialNeutralCount = socialArticles.filter(a => a.sentiment === 'neutral').length;
  const socialNegative = socialArticles.filter(a => a.sentiment === 'negative').length;
  const socialTotal = socialMentions.length > 0 ? socialMentions.length : socialArticles.length > 0 ? socialArticles.length : null;

  // Build segmented bar data
  function buildSegments(pos: number, neu: number, neg: number) {
    return [
      { value: pos, color: 'var(--gs-terminal)', label: 'Positive' },
      { value: neu, color: 'var(--gs-mid)', label: 'Neutral' },
      { value: neg, color: 'var(--gs-critical)', label: 'Negative' },
    ];
  }

  const newsSegments = buildSegments(newsPositive, newsNeutral, newsNegative);
  const socialSegments = buildSegments(socialPositive, socialNeutralCount, socialNegative);
  const hasNewsData = newsSegments.some((s) => s.value > 0);
  const hasSocialData = socialSegments.some((s) => s.value > 0);

  return (
    <SlideShell
      moduleName="Sentiment Analysis"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: News API, social listening, sentiment analysis"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
      chloeCallout={chloeCallout}
    >
      {/* ═══ Two-panel sentiment visualization ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 1, minHeight: 0,
        padding: '0.5em 0', borderTop: '1px solid rgba(255,178,239,0.06)', borderBottom: '1px solid rgba(255,178,239,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', gap: '3%', height: '100%', minHeight: 0 }}>
          {/* Left: News Sentiment (M22) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.35em' }}>
              News Sentiment
            </h4>

            {newsMentions != null && (
              <div style={{ marginBottom: '0.35em' }}>
                <StatBlock value={newsMentions} label="Mentions" color="var(--gs-light)" />
              </div>
            )}

            {hasNewsData && (
              <div style={{ marginBottom: '0.35em' }}>
                <SegmentedBar segments={newsSegments} />
              </div>
            )}

            {/* Notable mention */}
            {newsNotable && (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', marginBottom: '0.3em', fontStyle: 'italic', opacity: 0.8 }}>
                {newsNotable}
              </p>
            )}

            {/* Headlines */}
            {!hasNewsData && newsHeadlines.length === 0 && (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.5, padding: '0.5em 0' }}>
                No news coverage data was captured for this scan.
              </p>
            )}
            {newsHeadlines.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2em', overflow: 'auto', minHeight: 0, flex: '1 1 0' }}>
                {newsHeadlines.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '0.4em', alignItems: 'flex-start',
                    padding: '0.2em 0.4em', borderRadius: '3px',
                    background: h.sentiment === 'positive'
                      ? 'rgba(74,222,128,0.06)'
                      : h.sentiment === 'negative'
                        ? 'rgba(239,68,68,0.06)'
                        : 'transparent',
                  }}>
                    <span style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: sentimentColor(h.sentiment), flexShrink: 0, marginTop: '0.1em' }}>
                      {h.sentiment === 'positive' ? '+' : h.sentiment === 'negative' ? '-' : '\u00B7'}
                    </span>
                    <div>
                      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', lineHeight: 1.3 }}>
                        {h.title ?? 'Untitled'}
                      </p>
                      {h.source && (
                        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
                          {h.source}{h.date ? ` \u2014 ${h.date}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,178,239,0.08)', flexShrink: 0 }} />

          {/* Right: Social Sentiment (M23) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h4 className="font-display uppercase" style={{ fontSize: 'clamp(1px, 0.90cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.35em' }}>
              Social Sentiment
            </h4>

            {socialTotal != null && (
              <div style={{ marginBottom: '0.35em' }}>
                <StatBlock value={socialTotal} label="Mentions" color="var(--gs-light)" />
              </div>
            )}

            {hasSocialData && (
              <div style={{ marginBottom: '0.35em' }}>
                <SegmentedBar segments={socialSegments} />
              </div>
            )}

            {/* Social mentions */}
            {!hasSocialData && socialMentions.length === 0 && (
              <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-mid)', opacity: 0.5, padding: '0.5em 0' }}>
                No social mention data was captured for this scan.
              </p>
            )}
            {socialMentions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2em', overflow: 'auto', minHeight: 0, flex: '1 1 0' }}>
                {socialMentions.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '0.4em', alignItems: 'flex-start',
                    padding: '0.2em 0.4em', borderRadius: '3px',
                    background: m.sentiment === 'positive'
                      ? 'rgba(74,222,128,0.06)'
                      : m.sentiment === 'negative'
                        ? 'rgba(239,68,68,0.06)'
                        : 'transparent',
                  }}>
                    <span style={{ fontSize: 'clamp(1px, 0.83cqi, 13px)', color: sentimentColor(m.sentiment), flexShrink: 0, marginTop: '0.1em' }}>
                      {m.sentiment === 'positive' ? '+' : m.sentiment === 'negative' ? '-' : '\u00B7'}
                    </span>
                    <div>
                      <p className="font-data" style={{ fontSize: 'clamp(1px, 0.86cqi, 13px)', color: 'var(--gs-light)', lineHeight: 1.3 }}>
                        {m.text ?? 'No text'}
                      </p>
                      {m.platform && (
                        <p className="font-data" style={{ fontSize: 'clamp(1px, 0.75cqi, 12px)', color: 'var(--gs-mid)', opacity: 0.6 }}>
                          {m.platform}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}
