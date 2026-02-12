/**
 * M39 - Local Pack Visibility
 *
 * Checks Google Business Profile completeness via DataForSEO.
 *
 * Checkpoints:
 *   1. Business profile presence
 *   2. Profile completeness
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBusinessProfile } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getBusinessProfile(domain) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m39-profile', 'Business Profile', 'No Google Business Profile data found'));
      return { moduleId: 'M39' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];
    const profile = items[0] as Record<string, unknown> | undefined;

    if (!profile) {
      checkpoints.push(infoCheckpoint('m39-profile', 'Business Profile', 'No Google Business Profile found for this domain'));
      return { moduleId: 'M39' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const title = profile['title'] as string ?? '';
    const category = profile['category'] as string ?? '';
    const rating = profile['rating'] as Record<string, number> | undefined;
    const avgRating = rating?.['value'] ?? 0;
    const reviewCount = rating?.['votes_count'] ?? 0;
    const address = profile['address'] as string ?? '';
    const phone = profile['phone'] as string ?? '';
    const url = profile['url'] as string ?? '';
    const workHours = profile['work_hours'] as Record<string, unknown> | undefined;

    data.businessProfile = {
      title, category, avgRating, reviewCount, address, phone, url,
      hasWorkHours: !!workHours,
    };

    signals.push(createSignal({
      type: 'business_profile', name: 'Google Business Profile',
      confidence: 0.9, evidence: `"${title}" — ${category}, ${avgRating}/5 (${reviewCount} reviews)`,
      category: 'market_position',
    }));

    // CP1: Profile presence
    checkpoints.push(createCheckpoint({
      id: 'm39-profile', name: 'Business Profile', weight: 0.5,
      health: 'excellent',
      evidence: `Google Business Profile: "${title}" (${category})`,
    }));

    // CP2: Profile completeness
    {
      const fields = [
        !!title, !!category, !!address, !!phone, !!url, !!workHours, avgRating > 0,
      ];
      const completeness = fields.filter(Boolean).length / fields.length;

      let health: CheckpointHealth;
      let evidence: string;

      if (completeness >= 0.85) {
        health = 'excellent';
        evidence = `${Math.round(completeness * 100)}% profile completeness (${fields.filter(Boolean).length}/${fields.length} fields)`;
      } else if (completeness >= 0.6) {
        health = 'good';
        evidence = `${Math.round(completeness * 100)}% profile completeness — consider adding missing fields`;
      } else {
        health = 'warning';
        evidence = `Only ${Math.round(completeness * 100)}% profile completeness — incomplete profile hurts local visibility`;
      }

      checkpoints.push(createCheckpoint({ id: 'm39-completeness', name: 'Profile Completeness', weight: 0.5, health, evidence }));
    }
  } catch (error) {
    return { moduleId: 'M39' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M39' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M39' as ModuleId, execute);
