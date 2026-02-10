/**
 * M37 - Google Shopping Landscape
 *
 * Checks for Google Shopping / Merchant presence via DataForSEO.
 *
 * Checkpoints:
 *   1. Shopping presence
 *   2. Product listings
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getGoogleShoppingMerchants } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getGoogleShoppingMerchants(domain) as Record<string, unknown> | null;

    const items = result ? (result['items'] as Array<Record<string, unknown>>) ?? [] : [];
    const totalCount = result ? (result['total_count'] as number) ?? 0 : 0;

    data.shopping = { totalProducts: totalCount, items: items.slice(0, 10) };

    if (totalCount > 0) {
      signals.push(createSignal({
        type: 'google_shopping', name: 'Google Shopping',
        confidence: 0.85, evidence: `${totalCount} product listing(s) on Google Shopping`,
        category: 'market_position',
      }));

      checkpoints.push(createCheckpoint({
        id: 'm37-shopping', name: 'Google Shopping', weight: 0.5,
        health: totalCount >= 50 ? 'excellent' : totalCount >= 10 ? 'good' : 'good',
        evidence: `${totalCount} product listing(s) found on Google Shopping`,
      }));
    } else {
      checkpoints.push(infoCheckpoint(
        'm37-shopping', 'Google Shopping',
        'No Google Shopping listings found (may not be applicable for this business)',
      ));
    }
  } catch (error) {
    return { moduleId: 'M37' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M37' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M37' as ModuleId, execute);
