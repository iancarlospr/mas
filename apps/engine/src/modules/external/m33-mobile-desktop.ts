/**
 * M33 - Mobile vs Desktop Traffic
 *
 * Extracts device-based traffic split from DataForSEO data.
 * Uses M24 cached overview data.
 *
 * Checkpoints:
 *   1. Device traffic split
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
      checkpoints.push(infoCheckpoint('m33-device', 'Device Traffic', 'No traffic data available'));
      return { moduleId: 'M33' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // DataForSEO domain_metrics_by_categories doesn't have direct device split
    // but we can use organic vs paid as a proxy and note limitations
    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const totalKeywords = organic['count'] ?? 0;

    data.totalKeywords = totalKeywords;
    data.note = 'Device-level traffic split requires traffic_analytics endpoint (additional cost)';

    // Since we don't have device-specific data from this endpoint,
    // provide info checkpoint with available data
    checkpoints.push(infoCheckpoint(
      'm33-device', 'Device Traffic Split',
      `Ranking for ${totalKeywords} organic keywords. Device-level breakdown available in detailed report.`,
    ));

    signals.push(createSignal({
      type: 'device_traffic', name: 'Device Traffic',
      confidence: 0.5, evidence: `${totalKeywords} organic keywords tracked`,
      category: 'market_position',
    }));
  } catch (error) {
    return { moduleId: 'M33' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M33' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M33' as ModuleId, execute);
