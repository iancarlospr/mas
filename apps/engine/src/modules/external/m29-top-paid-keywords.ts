/**
 * M29 - Top Paid Keywords
 *
 * Identifies top paid search keywords via DataForSEO.
 *
 * Checkpoints:
 *   1. Paid keyword count
 *   2. Keyword diversity
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainPaidKeywords } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getDomainPaidKeywords(domain, 50) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m29-keywords', 'Paid Keywords', 'No paid keyword data available'));
      return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const totalCount = (result['total_count'] as number) ?? 0;
    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    const topKeywords = items.slice(0, 20).map(item => {
      const kwData = item['keyword_data'] as Record<string, unknown> | undefined;
      const kwInfo = kwData?.['keyword_info'] as Record<string, unknown> | undefined;
      return {
        keyword: kwData?.['keyword'] as string ?? '',
        searchVolume: kwInfo?.['search_volume'] as number ?? 0,
        cpc: kwInfo?.['cpc'] as number ?? 0,
      };
    });

    data.totalPaidKeywords = totalCount;
    data.topKeywords = topKeywords;

    if (topKeywords.length > 0) {
      signals.push(createSignal({
        type: 'top_paid_keywords', name: 'Top Paid Keywords',
        confidence: 0.8, evidence: `Top paid: ${topKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`,
        category: 'paid_media',
      }));
    }

    // CP1: Paid keyword count
    {
      let health: CheckpointHealth;
      if (totalCount >= 100) health = 'excellent';
      else if (totalCount >= 20) health = 'good';
      else if (totalCount > 0) health = 'good';
      else health = 'good';

      checkpoints.push(createCheckpoint({
        id: 'm29-keywords', name: 'Paid Keywords', weight: 0.5,
        health,
        evidence: totalCount > 0
          ? `${totalCount} paid keywords detected`
          : 'No paid keywords detected (may not be running paid search)',
      }));
    }

    // CP2: Keyword diversity
    if (topKeywords.length > 0) {
      const avgCpc = topKeywords.reduce((sum, k) => sum + k.cpc, 0) / topKeywords.length;
      checkpoints.push(createCheckpoint({
        id: 'm29-diversity', name: 'Paid Keyword Diversity', weight: 0.4,
        health: topKeywords.length >= 10 ? 'excellent' : topKeywords.length >= 5 ? 'good' : 'warning',
        evidence: `Top ${topKeywords.length} keywords, avg CPC: $${avgCpc.toFixed(2)}`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M29' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M29' as ModuleId, execute);
