/**
 * M21 - Ad Library Recon
 *
 * Searches for active ads across Meta and Google Ad Libraries via
 * DataForSEO SERP search as a proxy.
 *
 * Checkpoints:
 *   1. Active advertising detected
 *   2. Ad platform diversity
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getSerpResults } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');
  const brandName = domain.split('.')[0] ?? domain;

  try {
    // Search for ads mentioning the brand on Google
    const serpResult = await getSerpResults(`${brandName} ads`, { type: 'organic', depth: 10 }) as Record<string, unknown> | null;

    const items = serpResult ? (serpResult['items'] as Array<Record<string, unknown>>) ?? [] : [];

    // Look for paid results and ad library references
    const paidItems = items.filter(item => item['type'] === 'paid');
    const adLibraryHits = items.filter(item => {
      const url = (item['url'] as string ?? '').toLowerCase();
      const title = (item['title'] as string ?? '').toLowerCase();
      return url.includes('facebook.com/ads/library') ||
        url.includes('adstransparency.google.com') ||
        title.includes('ad library') ||
        title.includes('ad transparency');
    });

    // Also check previous browser module results for detected ad platforms
    const m06Result = ctx.previousResults.get('M06' as ModuleId);
    const m06Data = m06Result?.data as Record<string, unknown> | undefined;
    const detectedPlatforms = (m06Data?.['platforms'] as string[]) ?? [];

    data.adLibrary = {
      paidSerpResults: paidItems.length,
      adLibraryHits: adLibraryHits.length,
      detectedPlatforms,
      serpItems: items.slice(0, 5).map(i => ({ type: i['type'], title: (i['title'] as string ?? '').slice(0, 80), url: (i['url'] as string ?? '').slice(0, 100) })),
    };

    const isActivelyAdvertising = paidItems.length > 0 || detectedPlatforms.length > 0;

    if (isActivelyAdvertising) {
      signals.push(createSignal({
        type: 'active_advertising', name: 'Active Ads',
        confidence: 0.75, evidence: `Paid SERP results: ${paidItems.length}, Detected platforms: ${detectedPlatforms.join(', ') || 'none'}`,
        category: 'paid_media',
      }));
    }

    // CP1: Active advertising
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (paidItems.length > 0 && detectedPlatforms.length >= 2) {
        health = 'excellent';
        evidence = `Active advertising: ${paidItems.length} paid SERP results, platforms: ${detectedPlatforms.join(', ')}`;
      } else if (isActivelyAdvertising) {
        health = 'good';
        evidence = `Advertising detected: ${paidItems.length} paid results${detectedPlatforms.length > 0 ? `, platforms: ${detectedPlatforms.join(', ')}` : ''}`;
      } else {
        health = 'good';
        evidence = 'No active paid advertising detected in SERPs';
      }

      checkpoints.push(createCheckpoint({ id: 'm21-ads', name: 'Active Advertising', weight: 0.6, health, evidence }));
    }

    // CP2: Platform diversity
    {
      if (detectedPlatforms.length >= 3) {
        checkpoints.push(createCheckpoint({
          id: 'm21-platforms', name: 'Ad Platform Diversity', weight: 0.4,
          health: 'excellent',
          evidence: `Multi-platform advertising: ${detectedPlatforms.join(', ')}`,
        }));
      } else if (detectedPlatforms.length >= 1) {
        checkpoints.push(createCheckpoint({
          id: 'm21-platforms', name: 'Ad Platform Diversity', weight: 0.4,
          health: 'good',
          evidence: `Advertising on ${detectedPlatforms.length} platform(s): ${detectedPlatforms.join(', ')}`,
        }));
      } else {
        checkpoints.push(infoCheckpoint('m21-platforms', 'Ad Platform Diversity', 'No ad platforms detected (see M06 for browser-detected pixels)'));
      }
    }
  } catch (error) {
    return { moduleId: 'M21' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M21' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M21' as ModuleId, execute);
