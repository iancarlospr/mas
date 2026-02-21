/**
 * M30 - Traffic Sources
 *
 * Shows top referring domains driving traffic to the target site,
 * using DataForSEO backlinks/referring_domains endpoint.
 * Cached so M32 (Domain Trust) shares the same call at zero extra cost.
 *
 * Checkpoints:
 *   1. Referring domain count
 *   2. Source diversity (platform types)
 *   3. Top source authority
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBacklinkReferringDomains } from '../../services/dataforseo.js';

interface ReferringDomainItem {
  domain?: string;
  rank?: number;
  backlinks?: number;
  first_seen?: string;
  broken_backlinks?: number;
  referring_domains?: number;
  referring_pages?: number;
  referring_links_platform_types?: Record<string, number>;
  referring_links_tld?: Record<string, number>;
  referring_links_types?: Record<string, number>;
  referring_links_attributes?: Record<string, number>;
  referring_links_countries?: Record<string, number>;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const result = await getBacklinkReferringDomains(domain, 50) as {
      total_count?: number;
      items?: ReferringDomainItem[];
    } | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m30-sources', 'Traffic Sources', 'No referring domain data available'));
      return { moduleId: 'M30' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = result.items ?? [];
    const totalCount = result.total_count ?? 0;

    // Filter out self-referencing domains (including international TLD variants like hubspot.es)
    const baseDomain = domain.replace(/\.[^.]+$/, ''); // hubspot.com → hubspot
    const filtered = items.filter(item => {
      const d = (item.domain ?? '').replace(/^www\./, '');
      if (d === domain) return false;
      if (d.endsWith(`.${domain}`)) return false;
      // Filter international variants (e.g. hubspot.es, hubspot.jp, hubspot.de)
      const itemBase = d.replace(/\.[^.]+$/, '');
      if (itemBase === baseDomain && d !== domain) return false;
      return true;
    });

    const topSources = filtered.slice(0, 5).map(item => ({
      domain: item.domain ?? '',
      rank: item.rank ?? 0,
      backlinks: item.backlinks ?? 0,
      referringPages: item.referring_pages ?? 0,
      firstSeen: item.first_seen ?? null,
      platformTypes: item.referring_links_platform_types ?? {},
      tld: item.referring_links_tld ?? {},
      countries: item.referring_links_countries ?? {},
    }));

    data.totalReferringDomains = totalCount;
    data.topSources = topSources;

    if (topSources.length > 0) {
      signals.push(createSignal({
        type: 'traffic_sources', name: 'Top Traffic Sources',
        confidence: 0.8,
        evidence: `Top sources: ${topSources.slice(0, 3).map(s => s.domain).join(', ')}`,
        category: 'market_position',
      }));
    }

    // CP1: Referring domain count
    {
      let health: CheckpointHealth;
      if (totalCount >= 500) health = 'excellent';
      else if (totalCount >= 50) health = 'good';
      else if (totalCount > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm30-sources', name: 'Referring Domain Count', weight: 0.3,
        health,
        evidence: `${totalCount.toLocaleString()} domains linking to this site`,
      }));
    }

    // CP2: Source diversity (how many distinct platform types across top sources)
    if (topSources.length > 0) {
      const allPlatforms = new Set<string>();
      for (const source of topSources) {
        for (const platform of Object.keys(source.platformTypes)) {
          allPlatforms.add(platform);
        }
      }

      let health: CheckpointHealth;
      if (allPlatforms.size >= 4) health = 'excellent';
      else if (allPlatforms.size >= 2) health = 'good';
      else if (allPlatforms.size >= 1) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm30-diversity', name: 'Source Diversity', weight: 0.35,
        health,
        evidence: `${allPlatforms.size} platform types: ${[...allPlatforms].join(', ')}`,
      }));
    }

    // CP3: Top source authority
    if (topSources.length > 0) {
      const top = topSources[0]!;

      let health: CheckpointHealth;
      if (top.rank > 0 && top.rank <= 10_000) health = 'excellent';
      else if (top.rank > 0 && top.rank <= 100_000) health = 'good';
      else if (top.rank > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm30-authority', name: 'Top Source Authority', weight: 0.35,
        health,
        evidence: `Top source ${top.domain}: rank ${top.rank.toLocaleString()}, ${top.backlinks.toLocaleString()} backlinks`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M30' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M30' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M30' as ModuleId, execute);
