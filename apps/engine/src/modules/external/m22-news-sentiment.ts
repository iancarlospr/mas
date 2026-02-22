/**
 * M22 - News Sentiment Scanner
 *
 * Searches for recent news about the brand via DataForSEO SERP
 * and classifies sentiment using Gemini Flash.
 *
 * Checkpoints:
 *   1. News coverage volume
 *   2. Sentiment distribution
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getSerpResults } from '../../services/dataforseo.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';

const SentimentSchema = z.object({
  articles: z.array(z.object({
    title: z.string(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    summary: z.string(),
  })),
  overallSentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
});

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const brandName = domain.split('.')[0] ?? domain;

  try {
    // Fetch news results
    const newsResult = await getSerpResults(brandName, { type: 'news', depth: 10 }) as Record<string, unknown> | null;

    const items = newsResult ? (newsResult['items'] as Array<Record<string, unknown>>) ?? [] : [];

    if (items.length === 0) {
      checkpoints.push(infoCheckpoint('m22-coverage', 'News Coverage', `No recent news found for "${brandName}"`));
      data.news = { articles: [], overallSentiment: 'neutral' };
      return { moduleId: 'M22' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Extract headlines for sentiment analysis
    const headlines = items.slice(0, 10).map(item => ({
      title: (item['title'] as string ?? '').slice(0, 200),
      snippet: (item['snippet'] as string ?? '').slice(0, 300),
      source: (item['source'] as string) ?? '',
      url: (item['url'] as string ?? '').slice(0, 200),
    }));

    data.newsHeadlines = headlines;

    // Classify sentiment with Gemini
    let sentiment;
    try {
      const prompt = `Analyze sentiment of these news headlines about "${brandName}". For each article, classify as positive, negative, or neutral. Also give an overall sentiment.\n\nArticles:\n${headlines.map((h, i) => `${i + 1}. "${h.title}" - ${h.snippet}`).join('\n')}`;

      const result = await callFlash(prompt, SentimentSchema, {
        systemInstruction: 'You are a sentiment analysis expert. Respond in JSON format.',
        temperature: 0.2,
      });
      sentiment = result.data;
    } catch {
      // If Gemini fails, provide basic analysis without sentiment
      sentiment = {
        articles: headlines.map(h => ({ title: h.title, sentiment: 'neutral' as const, summary: h.snippet })),
        overallSentiment: 'neutral' as const,
      };
    }

    data.sentiment = sentiment;

    signals.push(createSignal({
      type: 'news_sentiment', name: 'News Sentiment',
      confidence: 0.7, evidence: `${headlines.length} articles, overall: ${sentiment.overallSentiment}`,
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
        evidence: `${headlines.length} recent news article(s) found for "${brandName}"`,
      }));
    }

    // CP2: Sentiment
    {
      const positive = sentiment.articles.filter(a => a.sentiment === 'positive').length;
      const negative = sentiment.articles.filter(a => a.sentiment === 'negative').length;

      let health: CheckpointHealth;
      let evidence: string;

      if (sentiment.overallSentiment === 'positive') {
        health = 'excellent';
        evidence = `Positive news sentiment: ${positive} positive, ${negative} negative out of ${sentiment.articles.length} articles`;
      } else if (sentiment.overallSentiment === 'neutral' || sentiment.overallSentiment === 'mixed') {
        health = 'good';
        evidence = `Mixed/neutral sentiment: ${positive} positive, ${negative} negative, ${sentiment.articles.length - positive - negative} neutral`;
      } else {
        health = 'warning';
        evidence = `Negative news sentiment: ${negative} negative out of ${sentiment.articles.length} articles — reputation management may be needed`;
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
