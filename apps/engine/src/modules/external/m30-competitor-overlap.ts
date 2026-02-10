/**
 * M30 - Paid Competitor Overlap
 *
 * Identifies competing domains and keyword overlap via DataForSEO.
 *
 * Checkpoints:
 *   1. Competitor count
 *   2. Competitive landscape density
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainCompetitors } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getDomainCompetitors(domain, 20) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m30-competitors', 'Competitor Overlap', 'No competitor data available'));
      return { moduleId: 'M30' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];
    const totalCount = (result['total_count'] as number) ?? 0;

    const competitors = items.slice(0, 15).map(item => ({
      domain: item['domain'] as string ?? '',
      avgPosition: item['avg_position'] as number ?? 0,
      intersections: item['intersections'] as number ?? 0,
      competitorMetrics: item['metrics'] as Record<string, unknown> ?? {},
    }));

    data.competitors = competitors;
    data.totalCompetitors = totalCount;

    if (competitors.length > 0) {
      signals.push(createSignal({
        type: 'competitors', name: 'Organic Competitors',
        confidence: 0.8, evidence: `Top competitors: ${competitors.slice(0, 3).map(c => c.domain).join(', ')}`,
        category: 'market_position',
      }));
    }

    // CP1: Competitor landscape
    checkpoints.push(createCheckpoint({
      id: 'm30-competitors', name: 'Competitor Landscape', weight: 0.5,
      health: totalCount >= 5 ? 'excellent' : totalCount > 0 ? 'good' : 'warning',
      evidence: totalCount > 0
        ? `${totalCount} organic competitors identified, top: ${competitors.slice(0, 3).map(c => c.domain).join(', ')}`
        : 'No organic competitors identified — niche market or new domain',
    }));

    // CP2: Competitive density
    if (competitors.length > 0) {
      const avgIntersections = competitors.reduce((sum, c) => sum + c.intersections, 0) / competitors.length;
      checkpoints.push(createCheckpoint({
        id: 'm30-density', name: 'Competitive Density', weight: 0.4,
        health: avgIntersections >= 100 ? 'excellent' : avgIntersections >= 20 ? 'good' : 'warning',
        evidence: `Average keyword overlap: ${Math.round(avgIntersections)} keywords per competitor`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M30' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M30' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M30' as ModuleId, execute);
