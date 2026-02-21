/**
 * M33 - Brand Search
 *
 * Measures branded keyword search volume and intent signals.
 * Searches 12 keyword variations covering: core brand, reviews, pricing,
 * login, alternatives, demo, free tier, support, and comparison intent.
 * Each keyword includes a ratio-to-brand percentage for quick analysis.
 *
 * Checkpoints:
 *   1. Brand search volume (core brand term)
 *   2. Brand awareness ecosystem (reviews, alternatives, demo, free, support, vs)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint } from '../../utils/signals.js';
import { getKeywordSearchVolume } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const brandName = domain.split('.')[0] ?? domain;

  try {
    const keywords = [
      brandName,                          // core brand volume (baseline)
      `${brandName} reviews`,             // social proof intent
      `${brandName} pricing`,             // funnel — evaluating cost
      `${brandName} login`,               // existing user base signal
      `${brandName} alternatives`,        // churn risk / comparison
      `${brandName} demo`,                // funnel — sales intent
      `${brandName} free`,                // free tier demand
      `${brandName} free trial`,          // free tier demand
      `${brandName} free plan`,           // free tier demand
      `${brandName} support`,             // post-sale / retention
      `${brandName} vs`,                  // comparison shopping
      `${brandName} comparison`,          // comparison shopping
    ];

    const result = await getKeywordSearchVolume(keywords) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(createCheckpoint({
        id: 'm33-brand', name: 'Brand Search Volume', weight: 0.6,
        health: 'warning', evidence: 'Could not retrieve keyword search volumes',
      }));
      return { moduleId: 'M33' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    const getVolume = (item: Record<string, unknown>): number => {
      const kwInfo = item['keyword_info'] as Record<string, unknown> | undefined;
      return (kwInfo?.['search_volume'] as number) ?? 0;
    };

    const brandVolume = items[0] ? getVolume(items[0]) : 0;

    const brandData = items.map(item => {
      const sv = getVolume(item);
      return {
        keyword: (item['keyword'] as string) ?? '',
        searchVolume: sv,
        ratioToBrand: brandVolume > 0 ? Math.round((sv / brandVolume) * 1000) / 10 : 0,
      };
    });

    const totalBrandVolume = brandData.reduce((sum, k) => sum + k.searchVolume, 0);

    data.brandKeywords = brandData;
    data.brandVolume = brandVolume;
    data.totalBrandVolume = totalBrandVolume;

    if (brandVolume > 0) {
      signals.push(createSignal({
        type: 'brand_demand', name: 'Brand Search Volume',
        confidence: 0.8, evidence: `"${brandName}": ${brandVolume.toLocaleString()}/mo`,
        category: 'market_position',
      }));
    }

    // CP1: Brand search volume
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (brandVolume >= 10000) {
        health = 'excellent';
        evidence = `Strong brand demand: "${brandName}" gets ${brandVolume.toLocaleString()} monthly searches`;
      } else if (brandVolume >= 1000) {
        health = 'good';
        evidence = `Moderate brand demand: "${brandName}" gets ${brandVolume.toLocaleString()} monthly searches`;
      } else if (brandVolume >= 100) {
        health = 'good';
        evidence = `Emerging brand: "${brandName}" gets ${brandVolume.toLocaleString()} monthly searches`;
      } else {
        health = 'warning';
        evidence = `Low brand search volume: "${brandName}" gets ${brandVolume} monthly searches — brand awareness opportunity`;
      }

      checkpoints.push(createCheckpoint({ id: 'm33-brand', name: 'Brand Search Volume', weight: 0.6, health, evidence }));
    }

    // CP2: Brand awareness ecosystem
    {
      const vol = (kw: string) => brandData.find(k => k.keyword.includes(kw))?.searchVolume ?? 0;

      const hasReviews = vol('reviews');
      const hasAlternatives = vol('alternatives');
      const hasDemo = vol('demo');
      const hasFree = Math.max(vol(' free'), vol('free trial'), vol('free plan'));
      const hasSupport = vol('support');
      const hasVs = Math.max(vol(' vs'), vol('comparison'));

      const parts: string[] = [];
      if (hasReviews > 0) parts.push(`reviews: ${hasReviews.toLocaleString()}/mo`);
      if (hasAlternatives > 0) parts.push(`alternatives: ${hasAlternatives.toLocaleString()}/mo`);
      if (hasDemo > 0) parts.push(`demo: ${hasDemo.toLocaleString()}/mo`);
      if (hasFree > 0) parts.push(`free: ${hasFree.toLocaleString()}/mo`);
      if (hasSupport > 0) parts.push(`support: ${hasSupport.toLocaleString()}/mo`);
      if (hasVs > 0) parts.push(`vs/comparison: ${hasVs.toLocaleString()}/mo`);

      checkpoints.push(createCheckpoint({
        id: 'm33-awareness', name: 'Brand Awareness Ecosystem', weight: 0.4,
        health: parts.length >= 4 ? 'excellent' : parts.length >= 2 ? 'good' : 'warning',
        evidence: parts.length > 0
          ? `Brand-adjacent searches: ${parts.join(', ')}`
          : 'No significant brand-adjacent searches detected',
      }));
    }
  } catch (error) {
    return { moduleId: 'M33' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M33' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M33' as ModuleId, execute);
