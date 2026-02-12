/**
 * M24 - Market Intelligence Overview
 *
 * Fetches traffic analytics overview from DataForSEO and caches it
 * for downstream modules (M25-M27, M31, M33, M36).
 *
 * Checkpoints:
 *   1. Traffic data availability
 *   2. Monthly organic traffic level
 *   3. Organic vs paid traffic mix
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
      checkpoints.push(createCheckpoint({
        id: 'm24-data', name: 'Traffic Data', weight: 0.5,
        health: 'warning', evidence: 'No traffic data available from DataForSEO for this domain',
      }));
      return { moduleId: 'M24' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    data.overview = overview;

    const metrics = overview['metrics'] as Record<string, Record<string, number>> | undefined;
    const organic = metrics?.['organic'] ?? {};
    const paid = metrics?.['paid'] ?? {};

    const organicTraffic = organic['etv'] ?? 0; // estimated traffic volume
    const paidTraffic = paid['etv'] ?? 0;
    const organicKeywords = organic['count'] ?? 0;
    const paidKeywords = paid['count'] ?? 0;

    data.organicTraffic = organicTraffic;
    data.paidTraffic = paidTraffic;
    data.organicKeywords = organicKeywords;
    data.paidKeywords = paidKeywords;
    data.totalTraffic = organicTraffic + paidTraffic;

    signals.push(createSignal({
      type: 'traffic_volume', name: 'Estimated Traffic',
      confidence: 0.7, evidence: `Organic: ~${Math.round(organicTraffic).toLocaleString()}/mo, Paid: ~${Math.round(paidTraffic).toLocaleString()}/mo`,
      category: 'market_position',
    }));

    // CP1: Traffic data
    checkpoints.push(createCheckpoint({
      id: 'm24-data', name: 'Traffic Data', weight: 0.5,
      health: 'excellent', evidence: 'Traffic analytics data retrieved successfully',
    }));

    // CP2: Organic traffic level
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (organicTraffic >= 50000) {
        health = 'excellent';
        evidence = `Strong organic traffic: ~${Math.round(organicTraffic).toLocaleString()}/mo from ${organicKeywords} keywords`;
      } else if (organicTraffic >= 5000) {
        health = 'good';
        evidence = `Moderate organic traffic: ~${Math.round(organicTraffic).toLocaleString()}/mo from ${organicKeywords} keywords`;
      } else if (organicTraffic >= 500) {
        health = 'warning';
        evidence = `Low organic traffic: ~${Math.round(organicTraffic).toLocaleString()}/mo — significant growth opportunity`;
      } else {
        health = 'critical';
        evidence = `Very low organic traffic: ~${Math.round(organicTraffic).toLocaleString()}/mo — SEO investment needed`;
      }

      checkpoints.push(createCheckpoint({ id: 'm24-organic', name: 'Organic Traffic Level', weight: 0.7, health, evidence }));
    }

    // CP3: Traffic mix
    {
      const totalTraffic = organicTraffic + paidTraffic;
      if (totalTraffic > 0) {
        const organicPct = Math.round((organicTraffic / totalTraffic) * 100);
        const paidPct = 100 - organicPct;

        let health: CheckpointHealth;
        let evidence: string;

        if (organicPct >= 70) {
          health = 'excellent';
          evidence = `Healthy traffic mix: ${organicPct}% organic, ${paidPct}% paid — strong organic foundation`;
        } else if (organicPct >= 40) {
          health = 'good';
          evidence = `Balanced traffic mix: ${organicPct}% organic, ${paidPct}% paid`;
        } else if (organicPct >= 15) {
          health = 'warning';
          evidence = `Paid-heavy traffic: ${organicPct}% organic, ${paidPct}% paid — high dependency on ad spend`;
        } else {
          health = 'critical';
          evidence = `Almost entirely paid traffic: ${organicPct}% organic, ${paidPct}% paid — extremely vulnerable to ad budget cuts`;
        }

        checkpoints.push(createCheckpoint({ id: 'm24-mix', name: 'Traffic Mix', weight: 0.6, health, evidence }));
      } else {
        checkpoints.push(infoCheckpoint('m24-mix', 'Traffic Mix', 'Insufficient traffic data to analyze mix'));
      }
    }
  } catch (error) {
    const msg = (error as Error).message;
    checkpoints.push(createCheckpoint({
      id: 'm24-data', name: 'Traffic Data', weight: 0.5,
      health: 'warning', evidence: `Could not retrieve traffic data: ${msg.slice(0, 100)}`,
    }));
    return { moduleId: 'M24' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: msg };
  }

  return { moduleId: 'M24' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M24' as ModuleId, execute);
