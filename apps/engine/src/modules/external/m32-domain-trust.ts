/**
 * M32 - Domain Trust & Authority
 *
 * Fetches backlink summary from DataForSEO for domain authority signals.
 *
 * Checkpoints:
 *   1. Domain rank / authority score
 *   2. Backlink profile quality
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBacklinkSummary } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    const result = await getBacklinkSummary(domain) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m32-authority', 'Domain Authority', 'No backlink data available'));
      return { moduleId: 'M32' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const rank = (result['rank'] as number) ?? 0;
    const backlinks = (result['backlinks'] as number) ?? 0;
    const referringDomains = (result['referring_domains'] as number) ?? 0;
    const brokenBacklinks = (result['broken_backlinks'] as number) ?? 0;
    const referringDomainsNofollow = (result['referring_domains_nofollow'] as number) ?? 0;

    data.authority = { rank, backlinks, referringDomains, brokenBacklinks, referringDomainsNofollow };

    signals.push(createSignal({
      type: 'domain_authority', name: 'Domain Rank',
      confidence: 0.8, evidence: `Rank: ${rank}, ${referringDomains} referring domains, ${backlinks} backlinks`,
      category: 'market_position',
    }));

    // CP1: Domain authority
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (rank > 0 && rank <= 100000) {
        health = 'excellent';
        evidence = `High domain authority: rank ${rank.toLocaleString()}, ${referringDomains.toLocaleString()} referring domains`;
      } else if (rank > 0 && rank <= 500000) {
        health = 'good';
        evidence = `Moderate authority: rank ${rank.toLocaleString()}, ${referringDomains.toLocaleString()} referring domains`;
      } else if (referringDomains >= 10) {
        health = 'good';
        evidence = `Building authority: ${referringDomains} referring domains, ${backlinks} backlinks`;
      } else {
        health = 'warning';
        evidence = `Low domain authority: ${referringDomains} referring domains — link building needed`;
      }

      checkpoints.push(createCheckpoint({ id: 'm32-authority', name: 'Domain Authority', weight: 0.7, health, evidence }));
    }

    // CP2: Backlink quality
    {
      const brokenRatio = backlinks > 0 ? brokenBacklinks / backlinks : 0;
      const nofollowRatio = referringDomains > 0 ? referringDomainsNofollow / referringDomains : 0;

      let health: CheckpointHealth;
      let evidence: string;

      if (brokenRatio <= 0.05 && nofollowRatio <= 0.5) {
        health = 'excellent';
        evidence = `Healthy backlink profile: ${Math.round(brokenRatio * 100)}% broken, ${Math.round(nofollowRatio * 100)}% nofollow`;
      } else if (brokenRatio <= 0.15) {
        health = 'good';
        evidence = `${Math.round(brokenRatio * 100)}% broken backlinks, ${Math.round(nofollowRatio * 100)}% nofollow referring domains`;
      } else {
        health = 'warning';
        evidence = `${Math.round(brokenRatio * 100)}% broken backlinks (${brokenBacklinks}) — link reclamation opportunity`;
      }

      checkpoints.push(createCheckpoint({ id: 'm32-quality', name: 'Backlink Quality', weight: 0.5, health, evidence }));
    }
  } catch (error) {
    return { moduleId: 'M32' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M32' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M32' as ModuleId, execute);
