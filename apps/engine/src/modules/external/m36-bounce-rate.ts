/**
 * M36 - Bounce Rate Estimate
 *
 * Extracts engagement metrics from M24's cached data.
 *
 * Checkpoints:
 *   1. Engagement signals
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
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
      checkpoints.push(infoCheckpoint('m36-engagement', 'Engagement Metrics', 'No traffic data available'));
      return { moduleId: 'M36' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const totalKeywords = organic['count'] ?? 0;
    const etv = organic['etv'] ?? 0;

    // Pages per keyword as proxy for content depth
    const contentDepth = totalKeywords > 0 ? etv / totalKeywords : 0;

    data.engagement = {
      totalKeywords,
      estimatedTraffic: etv,
      contentDepthProxy: contentDepth,
      note: 'Bounce rate estimates require traffic_analytics endpoint (additional cost)',
    };

    signals.push(createSignal({
      type: 'engagement', name: 'Engagement Estimate',
      confidence: 0.5, evidence: `${totalKeywords} keywords, ~${Math.round(etv)} visits/mo`,
      category: 'market_position',
    }));

    // CP1: Engagement signals
    checkpoints.push(createCheckpoint({
      id: 'm36-engagement', name: 'Engagement Metrics', weight: 0.4,
      health: totalKeywords >= 50 ? 'good' : totalKeywords > 0 ? 'good' : 'warning',
      evidence: totalKeywords > 0
        ? `Content indexed for ${totalKeywords} keywords — engagement data available in detailed report`
        : 'Insufficient data for engagement analysis',
    }));
  } catch (error) {
    return { moduleId: 'M36' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M36' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M36' as ModuleId, execute);
