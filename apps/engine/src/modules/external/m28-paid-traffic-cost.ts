/**
 * M28 - Paid Traffic Cost Estimate
 *
 * Extracts the domain's top paid search keywords with per-keyword CPC,
 * search volume, traffic, and position data. Computes aggregate cost estimates.
 *
 * Checkpoints:
 *   1. Paid search investment level
 *   2. Average CPC efficiency
 *   3. Paid keyword coverage (breadth)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainPaidKeywords } from '../../services/dataforseo.js';

interface PaidKeyword {
  keyword: string;
  cpc: number;
  searchVolume: number;
  estimatedTraffic: number;
  position: number;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getDomainPaidKeywords(domain, 50) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m28-investment', 'Paid Search Investment', 'No paid keyword data available from DataForSEO'));
      checkpoints.push(infoCheckpoint('m28-cpc', 'Average CPC', 'No data'));
      checkpoints.push(infoCheckpoint('m28-keyword-coverage', 'Paid Keyword Coverage', 'No data'));
      return { moduleId: 'M28' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const totalCount = (result['total_count'] as number) ?? 0;
    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    // Parse keyword data
    const allKeywords: PaidKeyword[] = items.map(item => {
      const kwData = item['keyword_data'] as Record<string, unknown> | undefined;
      const kwInfo = kwData?.['keyword_info'] as Record<string, unknown> | undefined;
      const rankInfo = item['ranked_serp_element'] as Record<string, unknown> | undefined;
      const serpItem = rankInfo?.['serp_item'] as Record<string, unknown> | undefined;

      const cpc = (kwInfo?.['cpc'] as number) ?? 0;
      const searchVolume = (kwInfo?.['search_volume'] as number) ?? 0;
      const position = (serpItem?.['rank_absolute'] as number) ?? (rankInfo?.['rank_absolute'] as number) ?? 0;

      // Estimate traffic: search volume × CTR based on position
      // Rough paid CTR model: position 1 ~5%, 2 ~3%, 3 ~2%, 4+ ~1%
      const ctrEstimate = position <= 1 ? 0.05 : position <= 2 ? 0.03 : position <= 3 ? 0.02 : 0.01;
      const estimatedTraffic = Math.round(searchVolume * ctrEstimate);

      return {
        keyword: (kwData?.['keyword'] as string) ?? '',
        cpc,
        searchVolume,
        estimatedTraffic,
        position,
      };
    });

    // Top 10 by estimated traffic (most valuable keywords)
    const topKeywords = allKeywords
      .filter(k => k.keyword && k.searchVolume > 0)
      .sort((a, b) => b.estimatedTraffic - a.estimatedTraffic)
      .slice(0, 10);

    // Aggregates across all returned keywords
    const totalEstimatedClicks = allKeywords.reduce((sum, k) => sum + k.estimatedTraffic, 0);
    const estimatedMonthlyCost = allKeywords.reduce((sum, k) => sum + (k.cpc * k.estimatedTraffic), 0);
    const keywordsWithCpc = allKeywords.filter(k => k.cpc > 0);
    const avgCpc = keywordsWithCpc.length > 0
      ? keywordsWithCpc.reduce((sum, k) => sum + k.cpc, 0) / keywordsWithCpc.length
      : 0;

    data.totalPaidKeywords = totalCount;
    data.topKeywords = topKeywords;
    data.estimatedMonthlyCost = Math.round(estimatedMonthlyCost);
    data.avgCpc = Math.round(avgCpc * 100) / 100;
    data.totalEstimatedClicks = totalEstimatedClicks;

    // Signals
    if (topKeywords.length > 0) {
      signals.push(createSignal({
        type: 'paid_spend', name: 'Estimated Paid Search Cost',
        confidence: 0.7,
        evidence: `~$${Math.round(estimatedMonthlyCost).toLocaleString()}/mo on ${totalCount} keywords (top: ${topKeywords.slice(0, 3).map(k => k.keyword).join(', ')})`,
        category: 'paid_media',
      }));
    }

    // CP1: Paid search investment level
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (estimatedMonthlyCost >= 10_000) {
        health = 'excellent';
        evidence = `Heavy paid search investment: ~$${Math.round(estimatedMonthlyCost).toLocaleString()}/mo across ${totalCount} keywords`;
      } else if (estimatedMonthlyCost >= 1_000) {
        health = 'good';
        evidence = `Moderate paid search: ~$${Math.round(estimatedMonthlyCost).toLocaleString()}/mo across ${totalCount} keywords`;
      } else if (estimatedMonthlyCost > 0) {
        health = 'good';
        evidence = `Light paid search: ~$${Math.round(estimatedMonthlyCost).toLocaleString()}/mo across ${totalCount} keywords`;
      } else if (totalCount > 0) {
        health = 'good';
        evidence = `${totalCount} paid keywords detected but estimated cost is minimal`;
      } else {
        health = 'good';
        evidence = 'No paid search activity detected (may rely on organic/other channels)';
      }

      checkpoints.push(createCheckpoint({ id: 'm28-investment', name: 'Paid Search Investment', weight: 0.5, health, evidence }));
    }

    // CP2: Average CPC efficiency
    {
      if (keywordsWithCpc.length > 0) {
        let health: CheckpointHealth;
        let evidence: string;

        if (avgCpc <= 2) {
          health = 'excellent';
          evidence = `Low average CPC: $${avgCpc.toFixed(2)} across ${keywordsWithCpc.length} keywords`;
        } else if (avgCpc <= 5) {
          health = 'good';
          evidence = `Average CPC: $${avgCpc.toFixed(2)} across ${keywordsWithCpc.length} keywords`;
        } else if (avgCpc <= 15) {
          health = 'good';
          evidence = `Above-average CPC: $${avgCpc.toFixed(2)} (${keywordsWithCpc.length} keywords — may indicate competitive niche)`;
        } else {
          health = 'warning';
          evidence = `High CPC: $${avgCpc.toFixed(2)} — consider long-tail or less competitive keyword alternatives`;
        }

        checkpoints.push(createCheckpoint({ id: 'm28-cpc', name: 'Average CPC', weight: 0.4, health, evidence }));
      } else {
        checkpoints.push(infoCheckpoint('m28-cpc', 'Average CPC', 'No CPC data available'));
      }
    }

    // CP3: Paid keyword coverage
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (totalCount >= 100) {
        health = 'excellent';
        evidence = `Broad paid keyword coverage: ${totalCount} keywords`;
      } else if (totalCount >= 20) {
        health = 'good';
        evidence = `Moderate paid keyword coverage: ${totalCount} keywords`;
      } else if (totalCount > 0) {
        health = 'good';
        evidence = `Narrow paid coverage: ${totalCount} keywords`;
      } else {
        health = 'good';
        evidence = 'No paid keywords detected';
      }

      checkpoints.push(createCheckpoint({ id: 'm28-keyword-coverage', name: 'Paid Keyword Coverage', weight: 0.3, health, evidence }));
    }
  } catch (error) {
    return { moduleId: 'M28' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M28' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M28' as ModuleId, execute);
