/**
 * M31 - Domain Trust
 *
 * Domain authority, backlink profile quality, and anchor text diversity
 * via DataForSEO backlinks API. Requires backlinks subscription ($100/mo).
 * Gracefully returns info checkpoints when subscription is not active.
 *
 * Shares cached backlink calls with M30 (Traffic Sources) and M32 (Domain Authority).
 *
 * Checkpoints:
 *   1. Domain authority (rank + referring domains)
 *   2. Backlink profile quality (broken ratio, nofollow ratio)
 *   3. Anchor text diversity
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBacklinkSummary, getBacklinkAnchors } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const [summaryResult, anchorsResult] = await Promise.allSettled([
      getBacklinkSummary(domain),
      getBacklinkAnchors(domain, 20),
    ]);

    const summary = summaryResult.status === 'fulfilled'
      ? (summaryResult.value as Record<string, unknown> | null)
      : null;

    if (!summary) {
      checkpoints.push(infoCheckpoint('m31-authority', 'Domain Trust', 'No backlink data available (requires backlinks subscription)'));
      return { moduleId: 'M31' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const rank = (summary['rank'] as number) ?? 0;
    const backlinks = (summary['backlinks'] as number) ?? 0;
    const referringDomains = (summary['referring_domains'] as number) ?? 0;
    const brokenBacklinks = (summary['broken_backlinks'] as number) ?? 0;
    const referringDomainsNofollow = (summary['referring_domains_nofollow'] as number) ?? 0;

    data.rank = rank;
    data.backlinks = backlinks;
    data.referringDomains = referringDomains;
    data.brokenBacklinks = brokenBacklinks;

    signals.push(createSignal({
      type: 'domain_trust', name: 'Domain Trust',
      confidence: 0.8,
      evidence: `Rank ${rank.toLocaleString()}, ${referringDomains.toLocaleString()} referring domains, ${backlinks.toLocaleString()} backlinks`,
      category: 'market_position',
    }));

    // CP1: Domain authority
    {
      let health: CheckpointHealth;
      if (rank > 0 && rank <= 100_000) health = 'excellent';
      else if (rank > 0 && rank <= 500_000) health = 'good';
      else if (referringDomains >= 10) health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm31-authority', name: 'Domain Authority', weight: 0.4,
        health,
        evidence: `Rank ${rank.toLocaleString()}, ${referringDomains.toLocaleString()} referring domains`,
      }));
    }

    // CP2: Backlink profile quality
    {
      const brokenRatio = backlinks > 0 ? brokenBacklinks / backlinks : 0;
      const nofollowRatio = referringDomains > 0 ? referringDomainsNofollow / referringDomains : 0;

      let health: CheckpointHealth;
      if (brokenRatio <= 0.05 && nofollowRatio <= 0.5) health = 'excellent';
      else if (brokenRatio <= 0.15) health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm31-quality', name: 'Backlink Quality', weight: 0.3,
        health,
        evidence: `${Math.round(brokenRatio * 100)}% broken, ${Math.round(nofollowRatio * 100)}% nofollow`,
      }));
    }

    // CP3: Anchor text diversity
    if (anchorsResult.status === 'fulfilled' && anchorsResult.value) {
      const anchorData = anchorsResult.value as Record<string, unknown>;
      const rawItems = anchorData['items'];
      const items = Array.isArray(rawItems) ? rawItems as Array<Record<string, unknown>> : [];

      const topAnchors = items.slice(0, 10).map(item => ({
        anchor: (item['anchor'] as string) ?? '',
        backlinks: (item['backlinks'] as number) ?? 0,
      }));

      data.topAnchors = topAnchors;

      const subsetTotal = topAnchors.reduce((sum, a) => sum + a.backlinks, 0);
      const denominator = backlinks > subsetTotal ? backlinks : subsetTotal;
      const topPct = denominator > 0 ? Math.round(((topAnchors[0]?.backlinks ?? 0) / denominator) * 100) : 0;

      let health: CheckpointHealth;
      if (topPct < 20) health = 'excellent';
      else if (topPct < 50) health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm31-anchors', name: 'Anchor Text Diversity', weight: 0.3,
        health,
        evidence: `Top anchor "${topAnchors[0]?.anchor ?? ''}" at ${topPct}%`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M31' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M31' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M31' as ModuleId, execute);
