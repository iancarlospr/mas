/**
 * M23 - Social Sentiment Scanner
 *
 * Searches for brand mentions on social platforms via DataForSEO SERP
 * and classifies sentiment using Gemini Flash.
 *
 * Checkpoints:
 *   1. Social media presence
 *   2. Social sentiment
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getSerpResults } from '../../services/dataforseo.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';

const SocialSentimentSchema = z.object({
  mentions: z.array(z.object({
    platform: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    summary: z.string(),
  })),
  overallSentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  platforms: z.array(z.string()),
});

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const brandName = domain.split('.')[0] ?? domain;

  try {
    // Search social platforms for brand mentions
    const socialQueries = [
      `site:reddit.com "${brandName}"`,
      `site:twitter.com OR site:x.com "${brandName}"`,
      `site:linkedin.com "${brandName}"`,
    ];

    const allMentions: Array<{ platform: string; title: string; snippet: string; url: string }> = [];

    for (const query of socialQueries) {
      try {
        const result = await getSerpResults(query, { type: 'organic', depth: 5 }) as Record<string, unknown> | null;
        const items = result ? (result['items'] as Array<Record<string, unknown>>) ?? [] : [];

        for (const item of items.slice(0, 3)) {
          const url = (item['url'] as string ?? '').toLowerCase();
          let platform = 'other';
          if (url.includes('reddit.com')) platform = 'Reddit';
          else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'Twitter/X';
          else if (url.includes('linkedin.com')) platform = 'LinkedIn';

          allMentions.push({
            platform,
            title: (item['title'] as string ?? '').slice(0, 200),
            snippet: (item['snippet'] as string ?? '').slice(0, 300),
            url: (item['url'] as string ?? '').slice(0, 200),
          });
        }
      } catch {
        // Individual query failure is OK
      }
    }

    data.socialMentions = allMentions.slice(0, 15);

    if (allMentions.length === 0) {
      checkpoints.push(infoCheckpoint('m23-presence', 'Social Presence', `No social mentions found for "${brandName}"`));
      data.socialSentiment = { overallSentiment: 'neutral', mentions: [], platforms: [] };
      return { moduleId: 'M23' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Classify sentiment
    let sentiment;
    try {
      const prompt = `Analyze sentiment of these social media mentions about "${brandName}". For each, identify platform and classify as positive, negative, or neutral.\n\nMentions:\n${allMentions.slice(0, 10).map((m, i) => `${i + 1}. [${m.platform}] "${m.title}" - ${m.snippet}`).join('\n')}`;

      const result = await callFlash(prompt, SocialSentimentSchema, {
        systemInstruction: 'You are a social media sentiment analyst. Respond in JSON format.',
        temperature: 0.2,
      });
      sentiment = result.data;
    } catch {
      const platforms = [...new Set(allMentions.map(m => m.platform))];
      sentiment = {
        mentions: allMentions.slice(0, 10).map(m => ({ platform: m.platform, sentiment: 'neutral' as const, summary: m.snippet })),
        overallSentiment: 'neutral' as const,
        platforms,
      };
    }

    data.socialSentiment = sentiment;

    const platforms = [...new Set(allMentions.map(m => m.platform))];
    signals.push(createSignal({
      type: 'social_sentiment', name: 'Social Sentiment',
      confidence: 0.65, evidence: `${allMentions.length} mentions across ${platforms.join(', ')}`,
      category: 'market_position',
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
        evidence: `${allMentions.length} social mention(s) across ${platforms.length} platform(s): ${platforms.join(', ')}`,
      }));
    }

    // CP2: Social sentiment
    {
      const positive = sentiment.mentions.filter(m => m.sentiment === 'positive').length;
      const negative = sentiment.mentions.filter(m => m.sentiment === 'negative').length;

      let health: CheckpointHealth;
      let evidence: string;

      if (sentiment.overallSentiment === 'positive') {
        health = 'excellent';
        evidence = `Positive social sentiment: ${positive} positive, ${negative} negative`;
      } else if (sentiment.overallSentiment === 'neutral' || sentiment.overallSentiment === 'mixed') {
        health = 'good';
        evidence = `Mixed social sentiment: ${positive} positive, ${negative} negative, ${sentiment.mentions.length - positive - negative} neutral`;
      } else {
        health = 'warning';
        evidence = `Negative social sentiment: ${negative} negative mentions — community management needed`;
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
