/**
 * M26 - Rankings
 *
 * Top organic keyword rankings — where the domain ranks in Google organic search.
 * Shows the highest-volume keywords with their SERP position, ETV, and CPC.
 * Uses cached getDomainRankedKeywords() shared with M34 (Losing Keywords).
 *
 * Checkpoints:
 *   1. Organic keyword portfolio size
 *   2. Top-10 ranking strength
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainRankedKeywords } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const result = await getDomainRankedKeywords(domain, 100, ['organic'], ['ranked_serp_element.serp_item.etv,desc']) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m26-count', 'Organic Rankings', 'No organic keyword data available'));
      return { moduleId: 'M26' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const totalCount = (result['total_count'] as number) ?? 0;
    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    const topKeywords = items.slice(0, 15).map(item => {
      const kwData = item['keyword_data'] as Record<string, unknown> | undefined;
      const kwInfo = kwData?.['keyword_info'] as Record<string, unknown> | undefined;
      const rankInfo = item['ranked_serp_element'] as Record<string, unknown> | undefined;
      const serpItem = rankInfo?.['serp_item'] as Record<string, unknown> | undefined;

      return {
        keyword: (kwData?.['keyword'] as string) ?? '',
        searchVolume: (kwInfo?.['search_volume'] as number) ?? 0,
        cpc: (kwInfo?.['cpc'] as number) ?? 0,
        rankAbsolute: (serpItem?.['rank_absolute'] as number) ?? (item['rank_absolute'] as number) ?? 0,
        etv: (serpItem?.['etv'] as number) ?? (item['etv'] as number) ?? 0,
      };
    }).filter(k => k.keyword && k.searchVolume > 0);

    const top10Count = topKeywords.filter(k => k.rankAbsolute >= 1 && k.rankAbsolute <= 10).length;

    data.totalOrganic = totalCount;
    data.topKeywords = topKeywords;
    data.top10Count = top10Count;

    if (topKeywords.length > 0) {
      signals.push(createSignal({
        type: 'organic_rankings', name: 'Organic Rankings',
        confidence: 0.85,
        evidence: `${totalCount.toLocaleString()} organic keywords, top: ${topKeywords.slice(0, 3).map(k => `"${k.keyword}" (#${k.rankAbsolute})`).join(', ')}`,
        category: 'market_position',
      }));
    }

    // CP1: Organic keyword portfolio size
    {
      let health: CheckpointHealth;
      if (totalCount >= 1000) health = 'excellent';
      else if (totalCount >= 100) health = 'good';
      else if (totalCount > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm26-count', name: 'Organic Keyword Portfolio', weight: 0.5,
        health,
        evidence: `${totalCount.toLocaleString()} organic keywords ranking in Google`,
      }));
    }

    // CP2: Top-10 ranking strength
    {
      let health: CheckpointHealth;
      if (top10Count >= 10) health = 'excellent';
      else if (top10Count >= 3) health = 'good';
      else if (top10Count > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm26-top10', name: 'Top-10 Rankings', weight: 0.5,
        health,
        evidence: top10Count > 0
          ? `${top10Count} keyword(s) ranking in positions 1-10`
          : 'No keywords in the top 10 — SEO optimization needed',
      }));
    }
  } catch (error) {
    return { moduleId: 'M26' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M26' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M26' as ModuleId, execute);
