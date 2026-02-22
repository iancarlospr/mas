/**
 * M29 - Competitors (Organic + Paid)
 *
 * Uses the same paid keyword data as M28 (cached — zero extra API cost),
 * sorts by estimated spend, and feeds the top keywords into serp_competitors
 * to find domains competing for the same money terms.
 *
 * Checkpoints:
 *   1. Competitor count — how many domains compete on your paid keywords
 *   2. Keyword overlap density — avg shared keywords per competitor
 *   3. Competitive landscape intensity — top competitor strength
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainPaidKeywords, getSerpCompetitors } from '../../services/dataforseo.js';

// ─── Noise filter ───────────────────────────────────────────────────────────
const NOISE_DOMAINS = new Set([
  'youtube.com', 'reddit.com', 'quora.com', 'facebook.com', 'instagram.com',
  'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com', 'linkedin.com',
  'medium.com', 'tumblr.com', 'discord.com',
  'wikipedia.org', 'wikihow.com', 'britannica.com', 'merriam-webster.com',
  'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com',
  'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com',
  'g2.com', 'capterra.com', 'trustpilot.com', 'sitejabber.com',
  'yelp.com', 'bbb.org', 'trustradius.com', 'getapp.com',
  'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
  'forbes.com', 'nytimes.com', 'washingtonpost.com', 'bbc.com', 'cnn.com',
  'google.com', 'support.google.com', 'cloud.google.com',
  'github.com', 'stackoverflow.com', 'w3schools.com',
  'apple.com', 'microsoft.com',
]);

function isNoiseDomain(rawDomain: string, targetDomain: string): boolean {
  const clean = rawDomain.replace(/^www\./, '');
  if (NOISE_DOMAINS.has(clean)) return true;
  for (const noise of NOISE_DOMAINS) {
    if (clean.endsWith(`.${noise}`)) return true;
  }
  if (clean !== targetDomain && clean.endsWith(`.${targetDomain}`)) return true;
  return false;
}

// ─── Response types ─────────────────────────────────────────────────────────

interface SerpCompetitorItem {
  domain?: string;
  avg_position?: number;
  median_position?: number;
  rating?: number;
  etv?: number;
  keywords_count?: number;
  visibility?: number;
  relevant_serp_items?: number;
  keywords_positions?: Record<string, number[]>;
}

// ─── Module execute ─────────────────────────────────────────────────────────

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace('www.', '');

  try {
    // ── Step 1: Get paid keywords (same cached call as M28) ───────────────
    const result = await getDomainPaidKeywords(domain, 50) as Record<string, unknown> | null;

    if (!result) {
      checkpoints.push(infoCheckpoint('m29-competitors', 'Competitors', 'No paid keyword data — cannot identify business competitors'));
      return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const items = (result['items'] as Array<Record<string, unknown>>) ?? [];

    // Parse and sort by estimated spend (CPC × estimated traffic)
    const paidKeywords = items
      .map(item => {
        const kwData = item['keyword_data'] as Record<string, unknown> | undefined;
        const kwInfo = kwData?.['keyword_info'] as Record<string, unknown> | undefined;
        const rankInfo = item['ranked_serp_element'] as Record<string, unknown> | undefined;
        const serpItem = rankInfo?.['serp_item'] as Record<string, unknown> | undefined;

        const keyword = (kwData?.['keyword'] as string) ?? '';
        const cpc = (kwInfo?.['cpc'] as number) ?? 0;
        const searchVolume = (kwInfo?.['search_volume'] as number) ?? 0;
        const position = (serpItem?.['rank_absolute'] as number) ?? (rankInfo?.['rank_absolute'] as number) ?? 0;

        const ctrEstimate = position <= 1 ? 0.05 : position <= 2 ? 0.03 : position <= 3 ? 0.02 : 0.01;
        const estimatedSpend = cpc * searchVolume * ctrEstimate;

        return { keyword, cpc, searchVolume, position, estimatedSpend };
      })
      .filter(k => k.keyword && k.searchVolume > 0)
      .sort((a, b) => b.estimatedSpend - a.estimatedSpend);

    const keywords = paidKeywords.map(k => k.keyword).slice(0, 200);

    if (keywords.length === 0) {
      checkpoints.push(infoCheckpoint('m29-competitors', 'Competitors', 'No viable paid keywords to find competitors'));
      return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    data.seedKeywords = keywords.length;
    data.topKeywordBySpend = paidKeywords[0]?.keyword;

    // ── Step 2: Find who competes for those paid keywords ─────────────────
    const serpResult = await getSerpCompetitors(keywords, 50) as {
      total_count?: number;
      items?: SerpCompetitorItem[];
    } | null;

    if (!serpResult) {
      checkpoints.push(infoCheckpoint('m29-competitors', 'Competitors', 'No SERP competitor data available'));
      return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Filter self, subdomains, noise platforms
    const cleanItems = (serpResult.items ?? []).filter(item => {
      const d = item.domain ?? '';
      const clean = d.replace(/^www\./, '');
      if (clean === domain) return false;
      return !isNoiseDomain(d, domain);
    });

    const topCompetitors = cleanItems.slice(0, 10).map(item => ({
      domain: (item.domain ?? '').replace(/^www\./, ''),
      avgPosition: item.avg_position ?? 0,
      medianPosition: item.median_position ?? 0,
      rating: item.rating ?? 0,
      etv: item.etv ?? 0,
      keywordsCount: item.keywords_count ?? 0,
      visibility: item.visibility ?? 0,
      serpItems: item.relevant_serp_items ?? 0,
      keywordPositions: item.keywords_positions ?? {},
    }));

    data.totalCompetitors = cleanItems.length;
    data.topCompetitors = topCompetitors;

    if (topCompetitors.length > 0) {
      signals.push(createSignal({
        type: 'business_competitors', name: 'Business Competitors',
        confidence: 0.85,
        evidence: `Top business competitors: ${topCompetitors.slice(0, 3).map(c => c.domain).join(', ')}`,
        category: 'market_intelligence',
      }));
    }

    // ── CP1: Competitor count ─────────────────────────────────────────────
    {
      const count = cleanItems.length;
      let health: CheckpointHealth;
      if (count >= 15) health = 'excellent';
      else if (count >= 5) health = 'good';
      else if (count > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm29-competitors', name: 'Competitor Count', weight: 0.3,
        health,
        evidence: count > 0
          ? `${count} business competitors found across ${keywords.length} paid keywords (top spend: "${paidKeywords[0]?.keyword}")`
          : 'No competitors found — niche market or new domain',
      }));
    }

    // ── CP2: Keyword overlap density ──────────────────────────────────────
    if (topCompetitors.length > 0) {
      const avgKeywords = topCompetitors.reduce((sum, c) => sum + c.keywordsCount, 0) / topCompetitors.length;

      let health: CheckpointHealth;
      if (avgKeywords >= 20) health = 'excellent';
      else if (avgKeywords >= 8) health = 'good';
      else if (avgKeywords >= 3) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm29-overlap', name: 'Keyword Overlap Density', weight: 0.35,
        health,
        evidence: `Average ${Math.round(avgKeywords)} shared paid keywords per competitor`,
      }));
    }

    // ── CP3: Competitive landscape intensity ──────────────────────────────
    if (topCompetitors.length > 0) {
      const top = topCompetitors[0]!;

      let health: CheckpointHealth;
      if (top.rating >= 5000) health = 'excellent';
      else if (top.rating >= 1000) health = 'good';
      else if (top.rating >= 200) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm29-landscape', name: 'Competitive Landscape Intensity', weight: 0.35,
        health,
        evidence: `Top competitor ${top.domain}: rating ${Math.round(top.rating).toLocaleString()}, avg position ${top.avgPosition.toFixed(1)}, ETV ${Math.round(top.etv).toLocaleString()}`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M29' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M29' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M29' as ModuleId, execute);
