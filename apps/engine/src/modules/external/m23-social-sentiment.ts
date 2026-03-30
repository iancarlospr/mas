/**
 * M23 - Social Sentiment Scanner
 *
 * Searches for brand mentions on Reddit, Twitter/X, and LinkedIn via a single
 * DataForSEO organic SERP query with location-aware brand + country keywords.
 * Reuses M22's resolved brand name. Classifies sentiment with Gemini Flash.
 *
 * Checkpoints:
 *   1. Social media presence (volume + platform diversity)
 *   2. Social sentiment (distribution + notable theme)
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

const logger = pino({ name: 'm23-social-sentiment' });

// ─── Schemas ─────────────────────────────────────────────────────────────────

const SocialSentimentSchema = z.object({
  mentions: z.array(z.object({
    platform: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    summary: z.string(),
  })),
  overallSentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  notableMention: z.string(),
  platforms: z.array(z.string()),
});

// ─── Brand Name Resolution (reuse M22, fallback to M04/domain) ──────────────

function resolveBrandName(ctx: ModuleContext): string {
  // Prefer M22's AI-resolved brand name
  const m22 = ctx.previousResults.get('M22' as ModuleId);
  const m22Brand = (m22?.data as Record<string, unknown> | undefined)?.['brandName'] as string | undefined;
  if (m22Brand && m22Brand.length > 1) return m22Brand;

  // Fallback: M04 og:site_name
  const m04 = ctx.previousResults.get('M04' as ModuleId);
  const m04Data = m04?.data as Record<string, unknown> | undefined;
  const ogTags = m04Data?.['openGraph'] as Record<string, string> | undefined;
  if (ogTags?.['og:site_name']) {
    const siteName = ogTags['og:site_name'].trim();
    if (siteName.length > 1 && siteName.length < 80) return siteName;
  }

  // Fallback: <title> tag
  const rawTitle = m04Data?.['title'];
  const title = typeof rawTitle === 'string' ? rawTitle : null;
  if (title) {
    const cleaned = title
      .replace(/\s*[|\-–—:]\s*(Home|Official Site|Homepage|Welcome|Main).*$/i, '')
      .replace(/\s*[|\-–—:]\s*$/, '')
      .trim();
    if (cleaned.length > 1 && cleaned.length < 80) return cleaned;
  }

  // Fallback: domain
  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const base = domain.split('.')[0] ?? domain;
  return base
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
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

// ─── Platform Detection ──────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('reddit.com')) return 'Reddit';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'Twitter/X';
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  return 'Other';
}

// ─── Execute ─────────────────────────────────────────────────────────────────

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  try {
    const brandName = resolveBrandName(ctx);
    const location = await resolveLocation(ctx.scanId);

    data.brandName = brandName;
    data.countryCode = location.countryCode;

    // Single combined query: "Brand Name" Country site:reddit.com OR site:twitter.com OR site:x.com OR site:linkedin.com
    const countryPart = location.countryName ? ` ${location.countryName}` : '';
    const searchQuery = `"${brandName}"${countryPart} site:reddit.com OR site:twitter.com OR site:x.com OR site:linkedin.com`;
    data.searchQuery = searchQuery;

    logger.info(
      { scanId: ctx.scanId, brandName, countryCode: location.countryCode, searchQuery },
      'Starting social sentiment search',
    );

    // Single SERP call with all platforms
    const result = await getSerpResults(searchQuery, {
      type: 'organic',
      depth: 15,
      locationCode: location.locationCode,
    }) as Record<string, unknown> | null;

    const items = result ? (result['items'] as Array<Record<string, unknown>>) ?? [] : [];

    // Dedup and extract mentions
    const seenUrls = new Set<string>();
    const allMentions: Array<{ platform: string; title: string; snippet: string; url: string }> = [];

    for (const item of items) {
      const url = (item['url'] as string ?? '').slice(0, 500);
      if (!url || seenUrls.has(url)) continue;

      const platform = detectPlatform(url);
      if (platform === 'Other') continue; // Skip non-social results

      seenUrls.add(url);
      allMentions.push({
        platform,
        title: (item['title'] as string ?? '').slice(0, 200),
        snippet: (item['snippet'] as string ?? '').slice(0, 300),
        url: url.slice(0, 200),
      });
    }

    data.socialMentions = allMentions.slice(0, 15);

    if (allMentions.length === 0) {
      checkpoints.push(infoCheckpoint('m23-presence', 'Social Presence', `No social mentions found for "${brandName}" in ${location.countryName || 'US'} (past year)`));
      data.socialSentiment = { overallSentiment: 'neutral', mentions: [], platforms: [], notableMention: 'No social mentions found' };
      return { moduleId: 'M23' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Classify sentiment with Gemini
    const platforms = [...new Set(allMentions.map(m => m.platform))];
    let sentiment: z.infer<typeof SocialSentimentSchema> = {
      mentions: allMentions.slice(0, 10).map(m => ({ platform: m.platform, sentiment: 'neutral' as const, summary: m.snippet })),
      overallSentiment: 'neutral',
      notableMention: 'Unable to classify — defaulted to neutral',
      platforms,
    };
    try {
      const prompt = `Analyze sentiment of these social media mentions about "${brandName}".
For each mention, identify the platform and classify as positive, negative, or neutral.
Give an overall sentiment across all platforms.
Identify the single most notable or recurring topic (e.g., "customer complaints about shipping", "praise for product quality", "discussion about pricing").

Mentions:
${allMentions.slice(0, 10).map((m, i) => `${i + 1}. [${m.platform}] "${m.title}" — ${m.snippet}`).join('\n')}`;

      const aiResult = await callFlash(prompt, SocialSentimentSchema, {
        systemInstruction: 'You are a social media sentiment analyst. Classify each mention and identify the dominant theme. Respond in JSON.',
        temperature: 0.2,
      });
      sentiment = aiResult.data;
    } catch (err) {
      // Gemini returned data that didn't match the strict schema.
      // Try to salvage partial data by calling without Zod and sanitizing.
      let salvaged = false;
      if (err instanceof z.ZodError) {
        try {
          const { generateText } = await import('../../services/gemini.js');
          const raw = await generateText('flash', `Analyze sentiment of these social media mentions about "${brandName}".
For each mention, identify the platform and classify as positive, negative, or neutral.
Give an overall sentiment across all platforms.
Identify the single most notable or recurring topic.

Mentions:
${allMentions.slice(0, 10).map((m, i) => `${i + 1}. [${m.platform}] "${m.title}" — ${m.snippet}`).join('\n')}

Respond as JSON: { "mentions": [{"platform":"...","sentiment":"positive|negative|neutral","summary":"..."}], "overallSentiment": "positive|negative|neutral|mixed", "notableMention": "...", "platforms": ["..."] }`, {
            systemInstruction: 'You are a social media sentiment analyst. Respond ONLY with valid JSON, no markdown.',
            temperature: 0.1,
          });
          const parsed = JSON.parse(raw.text.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
          const mentions = Array.isArray(parsed.mentions) ? parsed.mentions : [];
          sentiment = {
            mentions: mentions.map((m: Record<string, unknown>) => ({
              platform: String(m['platform'] ?? 'unknown'),
              sentiment: (['positive', 'negative', 'neutral'].includes(m['sentiment'] as string) ? m['sentiment'] : 'neutral') as 'positive' | 'negative' | 'neutral',
              summary: String(m['summary'] ?? ''),
            })),
            overallSentiment: (['positive', 'negative', 'neutral', 'mixed'].includes(parsed.overallSentiment) ? parsed.overallSentiment : 'neutral') as 'positive' | 'negative' | 'neutral' | 'mixed',
            notableMention: String(parsed.notableMention ?? ''),
            platforms: Array.isArray(parsed.platforms) ? parsed.platforms.map(String) : platforms,
          };
          salvaged = true;
        } catch {
          // Salvage failed too — fall through to neutral
        }
      }
      if (!salvaged) {
        sentiment = {
          mentions: allMentions.slice(0, 10).map(m => ({ platform: m.platform, sentiment: 'neutral' as const, summary: m.snippet })),
          overallSentiment: 'neutral',
          notableMention: 'Unable to classify — defaulted to neutral',
          platforms,
        };
      }
    }

    data.socialSentiment = sentiment;

    // Signal
    signals.push(createSignal({
      type: 'social_sentiment', name: 'Social Sentiment',
      confidence: 0.65,
      evidence: `${allMentions.length} mentions across ${platforms.join(', ')} for "${brandName}" (${location.countryName || 'US'}). Notable: ${sentiment.notableMention}`,
      category: 'market_intelligence',
    }));

    // CP1: Social presence
    {
      let health: CheckpointHealth;
      if (allMentions.length >= 5 && platforms.length >= 2) health = 'excellent';
      else if (allMentions.length >= 2) health = 'good';
      else health = 'good';

      checkpoints.push(createCheckpoint({
        id: 'm23-presence', name: 'Social Media Presence', weight: 0.5,
        health,
        evidence: `${allMentions.length} social mention(s) across ${platforms.length} platform(s): ${platforms.join(', ')} (${location.countryName || 'US'}, past year)`,
      }));
    }

    // CP2: Social sentiment
    {
      const positive = sentiment.mentions.filter(m => m.sentiment === 'positive').length;
      const negative = sentiment.mentions.filter(m => m.sentiment === 'negative').length;
      const neutral = sentiment.mentions.length - positive - negative;

      let health: CheckpointHealth;
      let evidence: string;

      if (sentiment.overallSentiment === 'positive') {
        health = 'excellent';
        evidence = `Positive social sentiment: ${positive} positive, ${negative} negative, ${neutral} neutral. Notable: ${sentiment.notableMention}`;
      } else if (sentiment.overallSentiment === 'neutral' || sentiment.overallSentiment === 'mixed') {
        health = 'good';
        evidence = `Mixed/neutral sentiment: ${positive} positive, ${negative} negative, ${neutral} neutral. Notable: ${sentiment.notableMention}`;
      } else {
        health = 'warning';
        evidence = `Negative social sentiment: ${negative} negative out of ${sentiment.mentions.length} mentions. Notable: ${sentiment.notableMention}`;
      }

      checkpoints.push(createCheckpoint({ id: 'm23-sentiment', name: 'Social Sentiment', weight: 0.5, health, evidence }));
    }
  } catch (error) {
    return { moduleId: 'M23' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M23' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M23' as ModuleId, execute);
