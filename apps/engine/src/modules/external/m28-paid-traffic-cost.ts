/**
 * M28 - Paid Traffic Cost Estimate
 *
 * Estimates cost of paid search traffic using DataForSEO domain metrics.
 *
 * Checkpoints:
 *   1. Paid search investment level
 *   2. Cost efficiency (CPC analysis)
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
      checkpoints.push(infoCheckpoint('m28-cost', 'Paid Traffic Cost', 'No data available'));
      return { moduleId: 'M28' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const paid = metrics?.['paid'] ?? {};
    const paidTraffic = paid['etv'] ?? 0;
    const paidCost = paid['estimated_paid_traffic_cost'] ?? 0;
    const paidKeywords = paid['count'] ?? 0;

    data.paidTraffic = paidTraffic;
    data.paidCost = paidCost;
    data.paidKeywords = paidKeywords;
    data.avgCpc = paidTraffic > 0 ? paidCost / paidTraffic : 0;

    if (paidCost > 0) {
      signals.push(createSignal({
        type: 'paid_spend', name: 'Estimated Paid Search Cost',
        confidence: 0.6, evidence: `~$${Math.round(paidCost).toLocaleString()}/mo on ${paidKeywords} keywords`,
        category: 'paid_media',
      }));
    }

    // CP1: Paid search investment
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (paidCost >= 10000) {
        health = 'excellent';
        evidence = `Active paid search: ~$${Math.round(paidCost).toLocaleString()}/mo, ${paidKeywords} keywords`;
      } else if (paidCost >= 1000) {
        health = 'good';
        evidence = `Moderate paid search: ~$${Math.round(paidCost).toLocaleString()}/mo, ${paidKeywords} keywords`;
      } else if (paidCost > 0) {
        health = 'good';
        evidence = `Light paid search: ~$${Math.round(paidCost).toLocaleString()}/mo`;
      } else {
        health = 'good';
        evidence = 'No paid search activity detected (may rely on organic/other channels)';
      }

      checkpoints.push(createCheckpoint({ id: 'm28-cost', name: 'Paid Search Investment', weight: 0.6, health, evidence }));
    }

    // CP2: CPC efficiency
    {
      const avgCpc = paidTraffic > 0 ? paidCost / paidTraffic : 0;
      if (paidTraffic > 0) {
        checkpoints.push(createCheckpoint({
          id: 'm28-cpc', name: 'Average CPC', weight: 0.4,
          health: avgCpc <= 2 ? 'excellent' : avgCpc <= 5 ? 'good' : 'warning',
          evidence: `Average CPC: $${avgCpc.toFixed(2)} (${paidTraffic.toLocaleString()} clicks/mo)`,
        }));
      } else {
        checkpoints.push(infoCheckpoint('m28-cpc', 'Average CPC', 'No paid traffic data for CPC analysis'));
      }
    }
  } catch (error) {
    return { moduleId: 'M28' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M28' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M28' as ModuleId, execute);
