/**
 * M32 - Domain Trust & Authority
 *
 * Fetches backlink summary, referring domains, and anchor text distribution
 * from DataForSEO for comprehensive domain authority signals.
 *
 * Checkpoints:
 *   1. Domain rank / authority score
 *   2. Backlink profile quality
 *   3. Referring domain quality
 *   4. Anchor text diversity
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBacklinkSummary, getBacklinkReferringDomains, getBacklinkAnchors } from '../../services/dataforseo.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    // Fetch all three backlink endpoints in parallel (fail-safe)
    const [summaryResult, referringResult, anchorsResult] = await Promise.allSettled([
      getBacklinkSummary(domain),
      getBacklinkReferringDomains(domain, 30),
      getBacklinkAnchors(domain, 20),
    ]);

    const result = summaryResult.status === 'fulfilled'
      ? (summaryResult.value as Record<string, unknown> | null)
      : null;

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

      if (rank > 0 && rank <= 100_000) {
        health = 'excellent';
        evidence = `High domain authority: rank ${rank.toLocaleString()}, ${referringDomains.toLocaleString()} referring domains`;
      } else if (rank > 0 && rank <= 500_000) {
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

    // ── CP3: Referring Domains enrichment ────────────────────────────────────
    if (referringResult.status === 'fulfilled' && referringResult.value) {
      const refData = referringResult.value as Record<string, unknown>;
      const rawItems = refData['items'];
      const items = Array.isArray(rawItems) ? rawItems as Array<Record<string, unknown>> : [];

      const topDomains = items.slice(0, 30).map(item => ({
        domain: (item['target'] as string) ?? '',
        rank: (item['rank'] as number) ?? 0,
        backlinks: (item['backlinks'] as number) ?? 0,
        firstSeen: (item['first_seen'] as string) ?? null,
      }));

      data.referringDomains = topDomains;

      const domainsInTop100K = topDomains.filter(d => d.rank > 0 && d.rank <= 100_000).length;

      let health: CheckpointHealth;
      let evidence: string;

      if (domainsInTop100K >= 5) {
        health = 'excellent';
        evidence = `${domainsInTop100K} of top 30 referring domains rank in the global top 100K — strong authority signals`;
      } else if (domainsInTop100K >= 1) {
        health = 'good';
        const topNames = topDomains
          .filter(d => d.rank > 0 && d.rank <= 100_000)
          .slice(0, 3)
          .map(d => d.domain)
          .join(', ');
        evidence = `${domainsInTop100K} referring domain(s) in the top 100K: ${topNames}`;
      } else {
        health = 'warning';
        evidence = `No referring domains in the top 100K (of ${topDomains.length} sampled) — consider outreach to high-authority sites`;
      }

      checkpoints.push(createCheckpoint({
        id: 'm32-referring-quality', name: 'Referring Domain Quality', weight: 0.4, health, evidence,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m32-referring-quality', 'Referring Domain Quality', 'Referring domain data not available'));
    }

    // ── CP4: Anchor Text enrichment ──────────────────────────────────────────
    if (anchorsResult.status === 'fulfilled' && anchorsResult.value) {
      const anchorData = anchorsResult.value as Record<string, unknown>;
      const rawItems = anchorData['items'];
      const items = Array.isArray(rawItems) ? rawItems as Array<Record<string, unknown>> : [];

      const topAnchors = items.slice(0, 20).map(item => ({
        anchor: (item['anchor'] as string) ?? '',
        backlinks: (item['backlinks'] as number) ?? 0,
        referringDomains: (item['referring_domains'] as number) ?? 0,
        percentage: 0, // calculated below
      }));

      // Use the total backlink count from the summary (not just the top-20 subset)
      // to avoid inflating concentration percentages. If the summary total is
      // unavailable or lower than the top-20 sum, fall back to the subset total.
      const subsetTotal = topAnchors.reduce((sum, a) => sum + a.backlinks, 0);
      const denominator = backlinks > subsetTotal ? backlinks : subsetTotal;
      for (const anchor of topAnchors) {
        anchor.percentage = denominator > 0 ? Math.round((anchor.backlinks / denominator) * 100) : 0;
      }

      data.anchors = topAnchors;

      // Determine anchor diversity using the corrected percentages
      const topAnchorPct = topAnchors[0]?.percentage ?? 0;
      const anchorDiversity = topAnchorPct < 20 ? 'diverse' : topAnchorPct < 50 ? 'moderate' : 'concentrated';
      data.anchorDiversity = anchorDiversity;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (topAnchorPct < 20) {
        health = 'excellent';
        evidence = `Natural anchor text profile — top anchor "${topAnchors[0]?.anchor ?? ''}" at ${topAnchorPct}% of ${backlinks.toLocaleString()} total backlinks`;
      } else if (topAnchorPct < 50) {
        health = 'good';
        evidence = `Moderate anchor diversity — top anchor "${topAnchors[0]?.anchor ?? ''}" at ${topAnchorPct}%`;
      } else {
        health = 'warning';
        evidence = `Concentrated anchor text — top anchor "${topAnchors[0]?.anchor ?? ''}" at ${topAnchorPct}%. Potential over-optimization risk`;
        recommendation = 'Diversify anchor text in link building. Over-concentrated anchors can trigger search engine penalties.';
      }

      checkpoints.push(createCheckpoint({
        id: 'm32-anchor-diversity', name: 'Anchor Text Diversity', weight: 0.4, health, evidence, recommendation,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m32-anchor-diversity', 'Anchor Text Diversity', 'Anchor text data not available'));
    }
  } catch (error) {
    return { moduleId: 'M32' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M32' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M32' as ModuleId, execute);
