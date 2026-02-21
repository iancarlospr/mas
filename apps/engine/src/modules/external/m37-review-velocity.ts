/**
 * M37 - Review Velocity
 *
 * Chains: getBusinessProfile(domain) → extract CID → getGoogleReviews(CID)
 * Uses the domain to find the Google Business Profile, then fetches reviews
 * by CID for accurate matching.
 *
 * Extracts: total count, avg rating, recent reviews, worst 1-star reviews,
 * and month-over-month review velocity trend.
 *
 * Checkpoints:
 *   1. Review volume
 *   2. Average rating
 *   3. Review velocity (MoM trend)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBusinessProfile, getGoogleReviews } from '../../services/dataforseo.js';

interface ReviewItem {
  rating?: { value?: number };
  review_text?: string;
  time_ago?: string;
  timestamp?: string;
}

/**
 * Bucket reviews by YYYY-MM from their timestamp field.
 */
function bucketByMonth(reviews: ReviewItem[]): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const r of reviews) {
    if (!r.timestamp) continue;
    const date = new Date(r.timestamp);
    if (isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return buckets;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    // Step 1: Get business profile to find CID
    const profile = await getBusinessProfile(domain) as {
      items?: Array<{ cid?: string; title?: string; rating?: { value?: number }; reviews_count?: number }>;
    } | null;

    const bizItem = profile?.items?.[0];
    const cid = bizItem?.cid;

    if (!cid) {
      checkpoints.push(infoCheckpoint('m37-volume', 'Review Velocity', 'No Google Business Profile found for this domain'));
      return { moduleId: 'M37' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    data.businessName = bizItem.title ?? domain;

    // Step 2: Fetch reviews by CID (accurate match)
    const result = await getGoogleReviews(cid, 40, 'newest') as Record<string, unknown> | null;

    if (!result) {
      // Still have profile data — show rating from profile
      if (bizItem.reviews_count) {
        data.totalReviews = bizItem.reviews_count;
        data.avgRating = bizItem.rating?.value ?? 0;
        checkpoints.push(createCheckpoint({
          id: 'm37-volume', name: 'Review Volume', weight: 0.3,
          health: bizItem.reviews_count >= 100 ? 'excellent' : 'good',
          evidence: `${bizItem.reviews_count} Google reviews (review details unavailable)`,
        }));
      } else {
        checkpoints.push(infoCheckpoint('m37-volume', 'Review Velocity', 'Google Business Profile found but review data unavailable'));
      }
      return { moduleId: 'M37' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const reviewsCount = (result['reviews_count'] as number) ?? 0;
    const ratingObj = result['rating'] as Record<string, number> | undefined;
    const avgRating = ratingObj?.['value'] ?? 0;
    const items = (result['items'] as ReviewItem[]) ?? [];

    // Recent reviews (top 5 newest)
    const recentReviews = items.slice(0, 5).map(r => ({
      rating: r.rating?.value ?? 0,
      text: (r.review_text ?? '').slice(0, 200),
      timeAgo: r.time_ago ?? '',
    }));

    // Worst reviews (1-star, most recent first — already sorted by newest)
    const worstReviews = items
      .filter(r => (r.rating?.value ?? 0) <= 1)
      .slice(0, 5)
      .map(r => ({
        rating: r.rating?.value ?? 0,
        text: (r.review_text ?? '').slice(0, 200),
        timeAgo: r.time_ago ?? '',
      }));

    // Velocity: bucket by month, calculate MoM trend
    const monthBuckets = bucketByMonth(items);
    const sortedMonths = [...monthBuckets.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const monthlyBuckets = sortedMonths.map(([month, count]) => ({ month, count }));

    const thisMonth = sortedMonths[0]?.[1] ?? 0;
    const lastMonth = sortedMonths[1]?.[1] ?? 0;
    const momChange = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;
    const trend = momChange > 10 ? 'up' : momChange < -10 ? 'declining' : 'stable';

    data.totalReviews = reviewsCount;
    data.avgRating = avgRating;
    data.recentReviews = recentReviews;
    data.worstReviews = worstReviews;
    data.velocity = { monthlyBuckets, trend, momChange };

    if (reviewsCount > 0) {
      signals.push(createSignal({
        type: 'review_velocity', name: 'Review Velocity',
        confidence: 0.85,
        evidence: `${reviewsCount} reviews, avg ${avgRating}/5, trend: ${trend}`,
        category: 'market_position',
      }));
    }

    // CP1: Review volume
    {
      let health: CheckpointHealth;
      if (reviewsCount >= 100) health = 'excellent';
      else if (reviewsCount >= 20) health = 'good';
      else if (reviewsCount > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm37-volume', name: 'Review Volume', weight: 0.3,
        health,
        evidence: reviewsCount > 0
          ? `${reviewsCount} Google reviews`
          : 'No Google reviews found',
      }));
    }

    // CP2: Average rating
    if (avgRating > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm37-rating', name: 'Average Rating', weight: 0.35,
        health: avgRating >= 4.5 ? 'excellent' : avgRating >= 4.0 ? 'good' : avgRating >= 3.0 ? 'warning' : 'critical',
        evidence: `Average rating: ${avgRating.toFixed(1)}/5 from ${reviewsCount} reviews`,
      }));
    }

    // CP3: Review velocity
    if (monthlyBuckets.length >= 2) {
      let health: CheckpointHealth;
      if (trend === 'up') health = 'excellent';
      else if (trend === 'stable') health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm37-velocity', name: 'Review Velocity', weight: 0.35,
        health,
        evidence: `${thisMonth} reviews this month vs ${lastMonth} last month (${momChange > 0 ? '+' : ''}${momChange}% MoM)`,
      }));
    } else if (monthlyBuckets.length === 1) {
      checkpoints.push(infoCheckpoint('m37-velocity', 'Review Velocity', `${thisMonth} review(s) this month — not enough history for trend`));
    }
  } catch (error) {
    return { moduleId: 'M37' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M37' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M37' as ModuleId, execute);
