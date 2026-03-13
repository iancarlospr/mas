/**
 * M27 - Global, Country & Category Rank
 *
 * Extracts ranking data from M24's cached data.
 *
 * Checkpoints:
 *   1. Domain rank
 *   2. Category positioning
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainRankOverview } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getDomainRankOverview(domain, 50) as {
      items?: Array<{
        location_code?: number;
        metrics?: {
          organic?: { pos_1?: number; pos_2_3?: number; pos_4_10?: number; count?: number; etv?: number };
          paid?: { count?: number };
        };
      }>;
    } | null;

    if (!result || !result.items?.length) {
      checkpoints.push(infoCheckpoint('m27-rank', 'Domain Rank', 'No ranking data available'));
      return { moduleId: 'M27' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Aggregate SERP position counts across all countries
    let pos1 = 0, pos2_3 = 0, pos4_10 = 0, totalKeywords = 0, organicEtv = 0;
    for (const item of result.items) {
      const organic = item.metrics?.organic;
      pos1 += organic?.pos_1 ?? 0;
      pos2_3 += organic?.pos_2_3 ?? 0;
      pos4_10 += organic?.pos_4_10 ?? 0;
      totalKeywords += organic?.count ?? 0;
      organicEtv += organic?.etv ?? 0;
    }

    data.rankings = { pos1, pos2_3, pos4_10, totalKeywords };
    data.organicKeywords = totalKeywords;
    data.organicEtv = organicEtv;
    data.countriesTracked = result.items.length;

    signals.push(createSignal({
      type: 'ranking_distribution', name: 'SERP Positions',
      confidence: 0.7, evidence: `#1: ${pos1}, #2-3: ${pos2_3}, #4-10: ${pos4_10}`,
      category: 'market_intelligence',
    }));

    // CP1: Top positions
    {
      const topPositions = pos1 + pos2_3;
      let health: CheckpointHealth;
      let evidence: string;

      if (topPositions >= 50) {
        health = 'excellent';
        evidence = `Strong SERP presence: ${pos1} #1 positions, ${pos2_3} #2-3 positions`;
      } else if (topPositions >= 10) {
        health = 'good';
        evidence = `Moderate SERP presence: ${pos1} #1 positions, ${pos2_3} #2-3 positions`;
      } else if (totalKeywords > 0) {
        health = 'warning';
        evidence = `Few top positions: ${topPositions} keywords in top 3 out of ${totalKeywords} total`;
      } else {
        health = 'critical';
        evidence = 'No organic keyword rankings detected';
      }

      checkpoints.push(createCheckpoint({ id: 'm27-rank', name: 'SERP Rankings', weight: 0.7, health, evidence }));
    }

    // CP2: Keyword portfolio breadth
    {
      let health: CheckpointHealth;
      if (totalKeywords >= 10000) health = 'excellent';
      else if (totalKeywords >= 1000) health = 'good';
      else if (totalKeywords > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm27-portfolio', name: 'Keyword Portfolio', weight: 0.4,
        health,
        evidence: `${totalKeywords.toLocaleString()} organic keywords ranked across ${result.items.length} countries`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M27' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M27' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M27' as ModuleId, execute);
