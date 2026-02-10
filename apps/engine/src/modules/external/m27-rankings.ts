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
import { getTrafficAnalyticsOverview } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const overview = await getTrafficAnalyticsOverview(domain) as Record<string, unknown> | null;

    if (!overview) {
      checkpoints.push(infoCheckpoint('m27-rank', 'Domain Rank', 'No ranking data available'));
      return { moduleId: 'M27' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const pos1 = organic['pos_1'] ?? 0;
    const pos2_3 = organic['pos_2_3'] ?? 0;
    const pos4_10 = organic['pos_4_10'] ?? 0;
    const totalKeywords = organic['count'] ?? 0;

    data.rankings = { pos1, pos2_3, pos4_10, totalKeywords };

    signals.push(createSignal({
      type: 'ranking_distribution', name: 'SERP Positions',
      confidence: 0.7, evidence: `#1: ${pos1}, #2-3: ${pos2_3}, #4-10: ${pos4_10}`,
      category: 'market_position',
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

    // CP2: Category positioning
    {
      const categories = overview['categories'] as unknown[] | undefined;
      checkpoints.push(createCheckpoint({
        id: 'm27-category', name: 'Category Positioning', weight: 0.4,
        health: categories && categories.length > 0 ? 'good' : 'warning',
        evidence: categories && categories.length > 0
          ? `Present in ${categories.length} DataForSEO categories`
          : 'No category data available',
      }));
    }
  } catch (error) {
    return { moduleId: 'M27' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M27' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M27' as ModuleId, execute);
