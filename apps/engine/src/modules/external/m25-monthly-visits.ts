/**
 * M25 - Traffic by Country
 *
 * Geographic traffic distribution using DataForSEO domain_rank_overview.
 * One API call with no location_code returns organic + paid ETV for every
 * country where the domain ranks. $0.01 per call.
 *
 * Checkpoints:
 *   1. Geographic reach (how many countries)
 *   2. Market concentration (is traffic spread or concentrated)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getDomainRankOverview } from '../../services/dataforseo.js';

// DataForSEO location codes → country names (top markets)
const COUNTRY_NAMES: Record<number, string> = {
  2004: 'Afghanistan', 2008: 'Albania', 2012: 'Algeria', 2024: 'Angola',
  2032: 'Argentina', 2036: 'Australia', 2040: 'Austria', 2050: 'Bangladesh',
  2056: 'Belgium', 2076: 'Brazil', 2100: 'Bulgaria', 2124: 'Canada',
  2152: 'Chile', 2156: 'China', 2170: 'Colombia', 2203: 'Czech Republic',
  2208: 'Denmark', 2218: 'Ecuador', 2818: 'Egypt', 2246: 'Finland',
  2250: 'France', 2276: 'Germany', 2300: 'Greece', 2344: 'Hong Kong',
  2348: 'Hungary', 2356: 'India', 2360: 'Indonesia', 2372: 'Ireland',
  2376: 'Israel', 2380: 'Italy', 2392: 'Japan', 2404: 'Kenya',
  2410: 'South Korea', 2458: 'Malaysia', 2484: 'Mexico', 2528: 'Netherlands',
  2554: 'New Zealand', 2566: 'Nigeria', 2578: 'Norway', 2586: 'Pakistan',
  2604: 'Peru', 2608: 'Philippines', 2616: 'Poland', 2620: 'Portugal',
  2630: 'Puerto Rico', 2642: 'Romania', 2643: 'Russia', 2682: 'Saudi Arabia',
  2702: 'Singapore', 2710: 'South Africa', 2724: 'Spain', 2752: 'Sweden',
  2756: 'Switzerland', 2158: 'Taiwan', 2764: 'Thailand', 2792: 'Turkey',
  2804: 'Ukraine', 2784: 'UAE', 2826: 'United Kingdom', 2840: 'United States',
  2704: 'Vietnam',
};

function getCountryName(locationCode: number): string {
  return COUNTRY_NAMES[locationCode] ?? `Location ${locationCode}`;
}

interface RankOverviewItem {
  location_code?: number;
  language_code?: string;
  metrics?: {
    organic?: { etv?: number; count?: number; estimated_paid_traffic_cost?: number };
    paid?: { etv?: number; count?: number };
  };
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const result = await getDomainRankOverview(domain, 50) as {
      total_count?: number;
      items?: RankOverviewItem[];
    } | null;

    if (!result || !result.items?.length) {
      checkpoints.push(infoCheckpoint('m25-presence', 'Traffic by Country', 'No geographic traffic data available'));
      return { moduleId: 'M25' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Aggregate by country (may have multiple language entries per country)
    const countryMap = new Map<number, { organicEtv: number; paidEtv: number; keywordCount: number }>();

    for (const item of result.items) {
      const loc = item.location_code ?? 0;
      const organic = item.metrics?.organic;
      const paid = item.metrics?.paid;

      const existing = countryMap.get(loc);
      if (existing) {
        existing.organicEtv += organic?.etv ?? 0;
        existing.paidEtv += paid?.etv ?? 0;
        existing.keywordCount += organic?.count ?? 0;
      } else {
        countryMap.set(loc, {
          organicEtv: organic?.etv ?? 0,
          paidEtv: paid?.etv ?? 0,
          keywordCount: organic?.count ?? 0,
        });
      }
    }

    const countries = [...countryMap.entries()]
      .map(([locationCode, metrics]) => ({
        locationCode,
        country: getCountryName(locationCode),
        ...metrics,
        totalEtv: metrics.organicEtv + metrics.paidEtv,
      }))
      .sort((a, b) => b.totalEtv - a.totalEtv)
      .slice(0, 10);

    const totalCountries = countryMap.size;
    const topCountryPct = countries[0] && countries.length > 1
      ? Math.round((countries[0].totalEtv / countries.reduce((sum, c) => sum + c.totalEtv, 0)) * 100)
      : 100;

    data.countries = countries;
    data.totalCountries = totalCountries;
    data.topCountryPct = topCountryPct;

    if (countries.length > 0) {
      signals.push(createSignal({
        type: 'traffic_by_country', name: 'Traffic by Country',
        confidence: 0.85,
        evidence: `Top markets: ${countries.slice(0, 3).map(c => `${c.country} (${Math.round(c.totalEtv).toLocaleString()} ETV)`).join(', ')}`,
        category: 'market_intelligence',
      }));
    }

    // CP1: Geographic reach
    {
      let health: CheckpointHealth;
      if (totalCountries >= 10) health = 'excellent';
      else if (totalCountries >= 3) health = 'good';
      else if (totalCountries > 0) health = 'warning';
      else health = 'critical';

      checkpoints.push(createCheckpoint({
        id: 'm25-presence', name: 'Geographic Reach', weight: 0.5,
        health,
        evidence: `Domain ranks in ${totalCountries} countr${totalCountries === 1 ? 'y' : 'ies'}`,
      }));
    }

    // CP2: Market concentration
    if (countries.length >= 2) {
      let health: CheckpointHealth;
      if (topCountryPct <= 70) health = 'excellent';
      else if (topCountryPct <= 90) health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm25-diversity', name: 'Market Diversity', weight: 0.5,
        health,
        evidence: `${topCountryPct}% of traffic from ${countries[0]!.country} — ${topCountryPct <= 70 ? 'well diversified' : topCountryPct <= 90 ? 'moderately concentrated' : 'heavily concentrated in one market'}`,
      }));
    }
  } catch (error) {
    return { moduleId: 'M25' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M25' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M25' as ModuleId, execute);
