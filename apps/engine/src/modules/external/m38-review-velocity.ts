/**
 * M38 - Review Velocity & Sentiment
 *
 * Fetches Google Reviews data via DataForSEO.
 *
 * Checkpoints:
 *   1. Review volume
 *   2. Average rating
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getGoogleReviews } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getGoogleReviews(domain) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m38-reviews', 'Google Reviews', 'No review data found'));
      return { moduleId: 'M38' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const reviewsCount = (result['reviews_count'] as number) ?? 0;
    const rating = (result['rating'] as Record<string, number>) ?? {};
    const avgRating = rating['value'] ?? 0;
    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    data.reviews = {
      count: reviewsCount,
      avgRating,
      recentReviews: items.slice(0, 5).map(r => ({
        rating: r['rating'] as Record<string, number> | undefined,
        text: ((r['review_text'] as string) ?? '').slice(0, 100),
        time: r['time_ago'] as string ?? '',
      })),
    };

    if (reviewsCount > 0) {
      signals.push(createSignal({
        type: 'google_reviews', name: 'Google Reviews',
        confidence: 0.85, evidence: `${reviewsCount} reviews, avg ${avgRating}/5`,
        category: 'market_position',
      }));
    }

    // CP1: Review volume
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (reviewsCount >= 100) {
        health = 'excellent';
        evidence = `Strong review presence: ${reviewsCount} Google reviews`;
      } else if (reviewsCount >= 20) {
        health = 'good';
        evidence = `${reviewsCount} Google reviews`;
      } else if (reviewsCount > 0) {
        health = 'good';
        evidence = `${reviewsCount} Google review(s) — consider encouraging more reviews`;
      } else {
        health = 'good';
        evidence = 'No Google reviews found (may not be applicable)';
      }

      checkpoints.push(createCheckpoint({ id: 'm38-reviews', name: 'Review Volume', weight: 0.5, health, evidence }));
    }

    // CP2: Average rating
    if (avgRating > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm38-rating', name: 'Average Rating', weight: 0.5,
        health: avgRating >= 4.5 ? 'excellent' : avgRating >= 4.0 ? 'good' : avgRating >= 3.0 ? 'warning' : 'critical',
        evidence: `Average Google rating: ${avgRating.toFixed(1)}/5 from ${reviewsCount} reviews`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M38' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M38' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M38' as ModuleId, execute);
