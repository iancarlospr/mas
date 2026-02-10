/**
 * M31 - Traffic Sources Breakdown
 *
 * Analyzes traffic source distribution from M24's cached data.
 *
 * Checkpoints:
 *   1. Source diversity
 *   2. Channel health
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
      checkpoints.push(infoCheckpoint('m31-sources', 'Traffic Sources', 'No traffic data available'));
      return { moduleId: 'M31' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const paid = metrics?.['paid'] ?? {};

    const organicTraffic = organic['etv'] ?? 0;
    const paidTraffic = paid['etv'] ?? 0;
    const totalTraffic = organicTraffic + paidTraffic;

    data.sources = {
      organic: organicTraffic,
      paid: paidTraffic,
      total: totalTraffic,
      organicPct: totalTraffic > 0 ? Math.round((organicTraffic / totalTraffic) * 100) : 0,
      paidPct: totalTraffic > 0 ? Math.round((paidTraffic / totalTraffic) * 100) : 0,
    };

    signals.push(createSignal({
      type: 'traffic_sources', name: 'Traffic Sources',
      confidence: 0.7, evidence: `Organic: ${Math.round(organicTraffic)}, Paid: ${Math.round(paidTraffic)}`,
      category: 'market_position',
    }));

    // CP1: Source diversity
    {
      const channels = [organicTraffic > 0, paidTraffic > 0].filter(Boolean).length;
      let health: CheckpointHealth;
      let evidence: string;

      if (channels >= 2 && organicTraffic > 0 && paidTraffic > 0) {
        health = 'excellent';
        evidence = 'Multi-channel traffic acquisition (organic + paid)';
      } else if (organicTraffic > 0) {
        health = 'good';
        evidence = 'Primarily organic traffic — consider paid channels for growth';
      } else if (paidTraffic > 0) {
        health = 'warning';
        evidence = 'Only paid traffic detected — high risk if ad budget changes';
      } else {
        health = 'warning';
        evidence = 'No significant search traffic detected';
      }

      checkpoints.push(createCheckpoint({ id: 'm31-sources', name: 'Traffic Source Diversity', weight: 0.6, health, evidence }));
    }

    // CP2: Channel balance
    if (totalTraffic > 0) {
      const organicPct = (organicTraffic / totalTraffic) * 100;
      checkpoints.push(createCheckpoint({
        id: 'm31-balance', name: 'Channel Balance', weight: 0.4,
        health: organicPct >= 40 && organicPct <= 90 ? 'excellent' : organicPct >= 20 ? 'good' : 'warning',
        evidence: `${Math.round(organicPct)}% organic, ${Math.round(100 - organicPct)}% paid search traffic`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M31' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M31' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M31' as ModuleId, execute);
