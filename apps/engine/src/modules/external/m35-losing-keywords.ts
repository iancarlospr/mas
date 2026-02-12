/**
 * M35 - Top Losing Organic Keywords
 *
 * Identifies organic keywords losing rank using DataForSEO ranked keywords.
 *
 * Checkpoints:
 *   1. Organic keyword health
 *   2. Ranking stability
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

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getDomainRankedKeywords(domain, 100) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m35-keywords', 'Organic Keywords', 'No keyword data available'));
      return { moduleId: 'M35' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const totalCount = (result['total_count'] as number) ?? 0;
    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    // Extract keywords with position changes
    const keywordsWithChanges = items.map(item => {
      const kwData = item['keyword_data'] as Record<string, unknown> | undefined;
      const kwInfo = kwData?.['keyword_info'] as Record<string, unknown> | undefined;
      const rankGroup = item['rank_group'] as number ?? 0;
      const rankAbsolute = item['rank_absolute'] as number ?? 0;
      const isUp = item['is_up'] as boolean | undefined;

      return {
        keyword: kwData?.['keyword'] as string ?? '',
        searchVolume: kwInfo?.['search_volume'] as number ?? 0,
        rankGroup,
        rankAbsolute,
        isUp: isUp ?? null,
      };
    });

    const losingKeywords = keywordsWithChanges.filter(k => k.isUp === false);
    const gainingKeywords = keywordsWithChanges.filter(k => k.isUp === true);

    data.totalKeywords = totalCount;
    data.losingKeywords = losingKeywords.slice(0, 15);
    data.gainingKeywords = gainingKeywords.slice(0, 15);
    data.losingCount = losingKeywords.length;
    data.gainingCount = gainingKeywords.length;

    if (losingKeywords.length > 0) {
      signals.push(createSignal({
        type: 'losing_keywords', name: 'Losing Keywords',
        confidence: 0.7, evidence: `${losingKeywords.length} keywords declining: ${losingKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`,
        category: 'market_position',
      }));
    }

    // CP1: Organic keyword health
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (totalCount >= 100 && losingKeywords.length <= totalCount * 0.2) {
        health = 'excellent';
        evidence = `Strong keyword portfolio: ${totalCount} keywords, only ${losingKeywords.length} declining`;
      } else if (totalCount >= 20) {
        health = 'good';
        evidence = `${totalCount} ranked keywords: ${gainingKeywords.length} gaining, ${losingKeywords.length} losing`;
      } else if (totalCount > 0) {
        health = 'warning';
        evidence = `Only ${totalCount} ranked keywords — SEO growth opportunity`;
      } else {
        health = 'critical';
        evidence = 'No organic keywords ranking — critical SEO gap';
      }

      checkpoints.push(createCheckpoint({ id: 'm35-keywords', name: 'Organic Keyword Health', weight: 0.7, health, evidence }));
    }

    // CP2: Ranking stability
    {
      const total = gainingKeywords.length + losingKeywords.length;
      if (total > 0) {
        const gainPct = Math.round((gainingKeywords.length / total) * 100);
        checkpoints.push(createCheckpoint({
          id: 'm35-stability', name: 'Ranking Stability', weight: 0.5,
          health: gainPct >= 60 ? 'excellent' : gainPct >= 40 ? 'good' : 'warning',
          evidence: `${gainPct}% of changing keywords are gaining rank (${gainingKeywords.length} up, ${losingKeywords.length} down)`,
        }));
      } else {
        checkpoints.push(infoCheckpoint('m35-stability', 'Ranking Stability', 'No keyword movement data available'));
      }
    }
  } catch (error) {
    return { moduleId: 'M35' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M35' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M35' as ModuleId, execute);
