/**
 * M22 - News Sentiment Scanner
 *
 * Resolves brand name from M04 metadata + Gemini, searches Google News
 * via DataForSEO with location-aware dual queries (brand alone + brand + country),
 * past-year time range, and classifies sentiment with notable mention extraction.
 *
 * Checkpoints:
 *   1. News coverage volume
 *   2. Sentiment distribution
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getSerpResults, getDataForSEOLocationCode, getCountryDisplayName } from '../../services/dataforseo.js';
import { getScanById } from '../../services/supabase.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'm22-news-sentiment' });

// ─── Schemas ─────────────────────────────────────────────────────────────────

const BrandNameSchema = z.object({
  brandName: z.string(),
});

const SentimentSchema = z.object({
  articles: z.array(z.object({
    title: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    summary: z.string(),
  })),
  overallSentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  notableMention: z.string(),
});

// ─── Brand Name Resolution ───────────────────────────────────────────────────

function extractFromMetadata(m04Data: Record<string, unknown>): string | null {
  // Try og:site_name first (most reliable brand indicator)
  const ogTags = m04Data['openGraph'] as Record<string, string> | undefined;
  if (ogTags?.['og:site_name']) {
    const siteName = ogTags['og:site_name'].trim();
    if (siteName.length > 1 && siteName.length < 80) return siteName;
  }

  // Fall back to <title> tag with common suffix stripping
  const rawTitle = m04Data['title'];
  const title = typeof rawTitle === 'string' ? rawTitle : null;
  if (title) {
    const cleaned = title
      .replace(/\s*[|\-–—:]\s*(Home|Official Site|Homepage|Welcome|Main).*$/i, '')
      .replace(/\s*[|\-–—:]\s*$/, '')
      .trim();
    if (cleaned.length > 1 && cleaned.length < 80) return cleaned;
  }

  return null;
}

function extractFromDomain(url: string): string {
  const domain = new URL(url).hostname.replace('www.', '');
  const base = domain.split('.')[0] ?? domain;
  // Convert hyphens and camelCase to spaces: "una-app" → "una app", "UnaApp" → "Una App"
  return base
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

async function resolveBrandName(ctx: ModuleContext): Promise<string> {
  const domain = new URL(ctx.url).hostname.replace('www.', '');

  // Step 1: Try M04 metadata
  const m04 = ctx.previousResults.get('M04' as ModuleId);
  const m04Data = m04?.data as Record<string, unknown> | undefined;
  const metadataName = m04Data ? extractFromMetadata(m04Data) : null;

  // Step 2: Domain-based fallback
  const domainName = extractFromDomain(ctx.url);

  // Step 3: Let Gemini pick the best brand name (cheap, fast)
  const rawT = m04Data?.['title'];
  const title = typeof rawT === 'string' ? rawT : '';
  try {
    const result = await callFlash(
      `Given the domain "${domain}" and page title "${title}", what is the company or brand name? Reply with just the brand name, nothing else.`,
      BrandNameSchema,
      { temperature: 0.1, maxTokens: 50 },
    );
    const name = result.data.brandName.trim();
    if (name.length > 1 && name.length < 80) return name;
  } catch {
    // Gemini failed — use metadata or domain fallback
  }

  return metadataName ?? domainName;
}

// ─── Location Resolution ─────────────────────────────────────────────────────

async function resolveLocation(scanId: string): Promise<{ countryCode: string; locationCode: number; countryName: string }> {
  let countryCode = 'US';

  try {
    const scan = await getScanById(scanId);
    const code = scan?.['country_code'] as string | null;
    if (code && /^[A-Z]{2}$/.test(code)) countryCode = code;
  } catch {
    logger.warn({ scanId }, 'Could not fetch scan record for country code — using US fallback');
  }

  return {
    countryCode,
    locationCode: getDataForSEOLocationCode(countryCode),
    countryName: getCountryDisplayName(countryCode),
  };
}

// ─── News Fetching (dual query + dedup) ──────────────────────────────────────

interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  url: string;
  date: string;
}

async function fetchNews(
  brandName: string,
  locationCode: number,
  countryName: string,
): Promise<{ items: NewsItem[]; queries: string[] }> {
  const queries = [brandName];
  if (countryName) {
    queries.push(`${brandName} ${countryName}`);
  }

  const allItems: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const result = await getSerpResults(query, {
        type: 'news',
        depth: 10,
        locationCode,
        timeRange: 'y', // past year
      }) as Record<string, unknown> | null;

      const rawItems = result ? (result['items'] as Array<Record<string, unknown>>) ?? [] : [];

      // Flatten: top_stories contain nested items[] with actual articles
      const flatItems: Array<Record<string, unknown>> = [];
      for (const item of rawItems) {
        if (item['type'] === 'top_stories' && Array.isArray(item['items'])) {
          for (const sub of item['items'] as Array<Record<string, unknown>>) {
            flatItems.push(sub);
          }
        } else {
          flatItems.push(item);
        }
      }

      for (const item of flatItems) {
        const url = (item['url'] as string ?? '').slice(0, 500);
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);

        allItems.push({
          title: (item['title'] as string ?? '').slice(0, 200),
          snippet: (item['snippet'] as string ?? item['description'] as string ?? '').slice(0, 300),
          source: (item['source'] as string ?? item['domain'] as string) ?? '',
          url,
          date: (item['date'] as string ?? item['time_published'] as string) ?? '',
        });
      }
    } catch (err) {
      logger.warn({ query, error: (err as Error).message }, 'News search failed for query');
    }
  }

  // Cap at 15 articles total
  return { items: allItems.slice(0, 15), queries };
}

// ─── Execute ─────────────────────────────────────────────────────────────────

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  try {
    // Resolve brand name and location in parallel
    const [brandName, location] = await Promise.all([
      resolveBrandName(ctx),
      resolveLocation(ctx.scanId),
    ]);

    data.brandName = brandName;
    data.countryCode = location.countryCode;

    logger.info(
      { scanId: ctx.scanId, brandName, countryCode: location.countryCode, countryName: location.countryName },
      'Starting news sentiment search',
    );

    // Fetch news with dual query
    const { items: headlines, queries } = await fetchNews(brandName, location.locationCode, location.countryName);
    data.newsHeadlines = headlines;
    data.searchQueries = queries;

    if (headlines.length === 0) {
      checkpoints.push(infoCheckpoint('m22-coverage', 'News Coverage', `No recent news found for "${brandName}" in ${location.countryName || 'US'} (past year)`));
      data.sentiment = { articles: [], overallSentiment: 'neutral', notableMention: 'No news coverage found' };
      return { moduleId: 'M22' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Classify sentiment with Gemini
    let sentiment: z.infer<typeof SentimentSchema> = {
      articles: headlines.map(h => ({ title: h.title, sentiment: 'neutral' as const, summary: h.snippet })),
      overallSentiment: 'neutral',
      notableMention: 'Unable to classify — defaulted to neutral',
    };
    try {
      const prompt = `Analyze sentiment of these news headlines about "${brandName}".
For each article, classify as positive, negative, or neutral.
Give an overall sentiment.
Identify the single most notable or recurring topic across all articles (e.g., "product launch", "funding round", "data breach", "expansion", "partnership").

Articles:
${headlines.map((h, i) => `${i + 1}. "${h.title}" — ${h.snippet} (${h.source})`).join('\n')}`;

      const result = await callFlash(prompt, SentimentSchema, {
        systemInstruction: 'You are a news sentiment analyst. Classify each article and identify the dominant theme. Respond in JSON.',
        temperature: 0.2,
      });
      sentiment = result.data;
    } catch (err) {
      // Gemini returned data that didn't match the strict schema.
      // Try to salvage partial data by sanitizing the raw response.
      let salvaged = false;
      if (err instanceof z.ZodError) {
        try {
          // Re-call Gemini without Zod — parse raw JSON and sanitize
          const { generateText } = await import('../../services/gemini.js');
          const raw = await generateText('flash', `Analyze sentiment of these news headlines about "${brandName}".
For each article, classify as positive, negative, or neutral.
Give an overall sentiment.
Identify the single most notable or recurring topic.

Articles:
${headlines.map((h, i) => `${i + 1}. "${h.title}" — ${h.snippet} (${h.source})`).join('\n')}

Respond as JSON: { "articles": [{"title":"...","sentiment":"positive|negative|neutral","summary":"..."}], "overallSentiment": "positive|negative|neutral|mixed", "notableMention": "..." }`, {
            systemInstruction: 'You are a news sentiment analyst. Respond ONLY with valid JSON, no markdown.',
            temperature: 0.1,
          });
          const parsed = JSON.parse(raw.text.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
          const articles = Array.isArray(parsed.articles) ? parsed.articles : [];
          sentiment = {
            articles: articles.map((a: Record<string, unknown>) => ({
              title: String(a['title'] ?? 'Untitled'),
              sentiment: (['positive', 'negative', 'neutral'].includes(a['sentiment'] as string) ? a['sentiment'] : 'neutral') as 'positive' | 'negative' | 'neutral',
              summary: String(a['summary'] ?? ''),
            })),
            overallSentiment: (['positive', 'negative', 'neutral', 'mixed'].includes(parsed.overallSentiment) ? parsed.overallSentiment : 'neutral') as 'positive' | 'negative' | 'neutral' | 'mixed',
            notableMention: String(parsed.notableMention ?? ''),
          };
          salvaged = true;
        } catch {
          // Salvage failed too — fall through to neutral
        }
      }
      if (!salvaged) {
        sentiment = {
          articles: headlines.map(h => ({ title: h.title, sentiment: 'neutral' as const, summary: h.snippet })),
          overallSentiment: 'neutral',
          notableMention: 'Unable to classify — defaulted to neutral',
        };
      }
    }

    data.sentiment = sentiment;

    // Signal
    signals.push(createSignal({
      type: 'news_sentiment', name: 'News Sentiment',
      confidence: 0.7,
      evidence: `${headlines.length} articles for "${brandName}" (${location.countryName || 'US'}), overall: ${sentiment.overallSentiment}. Notable: ${sentiment.notableMention}`,
      category: 'market_intelligence',
    }));

    // CP1: News coverage volume
    {
      let health: CheckpointHealth;
      if (headlines.length >= 5) health = 'excellent';
      else if (headlines.length >= 2) health = 'good';
      else health = 'good';

      checkpoints.push(createCheckpoint({
        id: 'm22-coverage', name: 'News Coverage', weight: 0.5,
        health,
        evidence: `${headlines.length} news article(s) found for "${brandName}" in ${location.countryName || 'US'} (past year)`,
      }));
    }

    // CP2: Sentiment
    {
      const positive = sentiment.articles.filter(a => a.sentiment === 'positive').length;
      const negative = sentiment.articles.filter(a => a.sentiment === 'negative').length;
      const neutral = sentiment.articles.length - positive - negative;

      let health: CheckpointHealth;
      let evidence: string;

      if (sentiment.overallSentiment === 'positive') {
        health = 'excellent';
        evidence = `Positive news sentiment: ${positive} positive, ${negative} negative, ${neutral} neutral. Notable: ${sentiment.notableMention}`;
      } else if (sentiment.overallSentiment === 'neutral' || sentiment.overallSentiment === 'mixed') {
        health = 'good';
        evidence = `Mixed/neutral sentiment: ${positive} positive, ${negative} negative, ${neutral} neutral. Notable: ${sentiment.notableMention}`;
      } else {
        health = 'warning';
        evidence = `Negative news sentiment: ${negative} negative out of ${sentiment.articles.length} articles. Notable: ${sentiment.notableMention}`;
      }

      checkpoints.push(createCheckpoint({ id: 'm22-sentiment', name: 'News Sentiment', weight: 0.6, health, evidence }));
    }
  } catch (error) {
    return { moduleId: 'M22' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M22' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M22' as ModuleId, execute);
