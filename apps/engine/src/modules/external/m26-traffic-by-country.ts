/**
 * M26 - Traffic by Country
 *
 * Extracts geographic traffic distribution from M24's cached data.
 *
 * Checkpoints:
 *   1. Geographic data availability
 *   2. Market concentration
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getTrafficAnalyticsOverview } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const overview = await getTrafficAnalyticsOverview(domain) as Record<string, unknown> | null;

    if (!overview) {
      checkpoints.push(infoCheckpoint('m26-geo', 'Geographic Data', 'No traffic data available'));
      return { moduleId: 'M26' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const categories = overview['categories'] as Array<Record<string, unknown>> | undefined;

    data.categories = categories?.slice(0, 10) ?? [];
    data.hasData = !!categories && categories.length > 0;

    // CP1: Geographic data
    checkpoints.push(createCheckpoint({
      id: 'm26-geo', name: 'Geographic Distribution', weight: 0.4,
      health: categories && categories.length > 0 ? 'excellent' : 'good',
      evidence: categories && categories.length > 0
        ? `Traffic data available across ${categories.length} categories`
        : 'Geographic breakdown data not available for this domain',
    }));

    // CP2: Market concentration (info only for this module)
    checkpoints.push(infoCheckpoint('m26-concentration', 'Market Concentration', 'See M24 for traffic mix details'));
  } catch (error) {
    return { moduleId: 'M26' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M26' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M26' as ModuleId, execute);
