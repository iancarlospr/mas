/**
 * M25 - Monthly Visits & Top Pages
 *
 * Extracts monthly visit estimates and top-ranking pages from
 * M24's cached traffic data.
 *
 * Checkpoints:
 *   1. Monthly visit estimate
 *   2. Top pages diversity
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
      checkpoints.push(infoCheckpoint('m25-visits', 'Monthly Visits', 'No traffic data available'));
      return { moduleId: 'M25' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const paid = metrics?.['paid'] ?? {};

    const totalVisits = (organic['etv'] ?? 0) + (paid['etv'] ?? 0);
    const organicKeywords = organic['count'] ?? 0;

    data.totalVisits = totalVisits;
    data.organicKeywords = organicKeywords;

    // CP1: Monthly visits
    checkpoints.push(createCheckpoint({
      id: 'm25-visits', name: 'Monthly Visits', weight: 0.6,
      health: totalVisits >= 10000 ? 'excellent' : totalVisits >= 1000 ? 'good' : 'warning',
      evidence: `Estimated monthly visits: ~${Math.round(totalVisits).toLocaleString()}`,
    }));

    // CP2: Keyword diversity (proxy for top pages)
    checkpoints.push(createCheckpoint({
      id: 'm25-diversity', name: 'Keyword Diversity', weight: 0.4,
      health: organicKeywords >= 500 ? 'excellent' : organicKeywords >= 50 ? 'good' : 'warning',
      evidence: `Ranking for ${organicKeywords} organic keywords`,
    }));
  } catch (error) {
    return { moduleId: 'M25' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M25' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M25' as ModuleId, execute);
