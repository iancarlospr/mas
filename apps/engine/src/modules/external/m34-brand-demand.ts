/**
 * M34 - Search Volume & Brand Demand
 *
 * Checks brand keyword search volume using DataForSEO keyword overview.
 *
 * Checkpoints:
 *   1. Brand search volume
 *   2. Brand awareness signals
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
  // Extract brand name from domain (remove TLD)
  const brandName = domain.split('.')[0] ?? domain;

  try {
    // Search for brand keywords and common variations
    const keywords = [
      brandName,
      `${brandName} reviews`,
      `${brandName} pricing`,
      `${brandName} login`,
      `${brandName} alternatives`,
    ];

    const result = await getKeywordSearchVolume(keywords) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(createCheckpoint({
        id: 'm34-brand', name: 'Brand Search Volume', weight: 0.6,
        health: 'warning', evidence: 'Could not retrieve keyword search volumes',
      }));
      return { moduleId: 'M34' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];
    const brandData = items.map(item => ({
      keyword: item['keyword'] as string ?? '',
      searchVolume: item['search_volume'] as number ?? 0,
    }));

    const brandVolume = brandData[0]?.searchVolume ?? 0;
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

      checkpoints.push(createCheckpoint({ id: 'm34-brand', name: 'Brand Search Volume', weight: 0.6, health, evidence }));
    }

    // CP2: Brand awareness ecosystem
    {
      const hasReviews = brandData.find(k => k.keyword.includes('reviews'))?.searchVolume ?? 0;
      const hasAlternatives = brandData.find(k => k.keyword.includes('alternatives'))?.searchVolume ?? 0;

      const awarenessParts: string[] = [];
      if (hasReviews > 0) awarenessParts.push(`reviews: ${hasReviews}/mo`);
      if (hasAlternatives > 0) awarenessParts.push(`alternatives: ${hasAlternatives}/mo`);

      checkpoints.push(createCheckpoint({
        id: 'm34-awareness', name: 'Brand Awareness Signals', weight: 0.4,
        health: awarenessParts.length >= 2 ? 'excellent' : awarenessParts.length >= 1 ? 'good' : 'warning',
        evidence: awarenessParts.length > 0
          ? `Brand-adjacent searches: ${awarenessParts.join(', ')}`
          : 'No significant brand-adjacent searches detected',
      }));
    }
  } catch (error) {
    return { moduleId: 'M34' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M34' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M34' as ModuleId, execute);
