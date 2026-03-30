/**
 * Unified Tool Registry — merges the 5 separate domain JSON files into a
 * single in-memory lookup for mapping third-party domains to tool names and
 * categories.
 *
 * Used by ThirdPartyProfiler (M08) and tool-extractor.ts.
 */

import type { DetectedToolCategory } from '@marketing-alpha/types';
import analyticsJson from './domains/analytics.json' with { type: 'json' };
import advertisingJson from './domains/advertising.json' with { type: 'json' };
import tagManagersJson from './domains/tag-managers.json' with { type: 'json' };
import martechJson from './domains/martech.json' with { type: 'json' };
import cdnJson from './domains/cdn.json' with { type: 'json' };

// ── Category assignment per source file ─────────────────────────────────

interface RegistryEntry {
  pattern: string;
  tool: string;
  category: DetectedToolCategory;
}

const CATEGORY_MAP: Record<string, DetectedToolCategory> = {
  analytics: 'analytics',
  advertising: 'advertising',
  'tag-managers': 'tag_manager',
  martech: 'crm_marketing_automation',
  cdn: 'cdn',
};

// Manual overrides for tools that appear in one file but belong to a
// different category (e.g. chat tools in the martech file)
const TOOL_CATEGORY_OVERRIDES: Record<string, DetectedToolCategory> = {
  'Intercom': 'chat_support',
  'Drift': 'chat_support',
  'Crisp': 'chat_support',
  'Zendesk': 'chat_support',
  'Tawk.to': 'chat_support',
  'LiveChat': 'chat_support',
  'Olark': 'chat_support',
  'Freshchat': 'chat_support',
  'Tidio': 'chat_support',
  'OneSignal': 'push_notifications',
  'Pushwoosh': 'push_notifications',
  'Calendly': 'other',
  'ConvertFlow': 'crm_marketing_automation',
  'Qualified': 'crm_marketing_automation',
  'iubenda': 'consent',
  'Google Fonts': 'other',
  'Adobe Fonts': 'other',
  'Segment': 'analytics',
  'Shopify CDN': 'ecommerce',
  'Vercel': 'hosting',
  'Netlify': 'hosting',
  'Google APIs': 'other',
  'Google Static': 'other',
  'jsDelivr': 'cdn',
  'unpkg': 'cdn',
};

function buildEntries(
  items: Array<{ pattern: string; tool: string }>,
  defaultCategory: DetectedToolCategory,
): RegistryEntry[] {
  return items.map((item) => ({
    pattern: item.pattern,
    tool: item.tool,
    category: TOOL_CATEGORY_OVERRIDES[item.tool] ?? defaultCategory,
  }));
}

const REGISTRY: RegistryEntry[] = [
  ...buildEntries(analyticsJson, CATEGORY_MAP['analytics']!),
  ...buildEntries(advertisingJson, CATEGORY_MAP['advertising']!),
  ...buildEntries(tagManagersJson, CATEGORY_MAP['tag-managers']!),
  ...buildEntries(martechJson, CATEGORY_MAP['martech']!),
  ...buildEntries(cdnJson, CATEGORY_MAP['cdn']!),
];

// ── Public lookup ───────────────────────────────────────────────────────

export interface ToolLookupResult {
  name: string;
  category: DetectedToolCategory;
}

/**
 * Look up a third-party domain in the unified registry.
 * Matches if the domain ends with the pattern, or equals it exactly.
 * Patterns are treated as domain suffixes — a match requires a domain
 * boundary (`.` or start-of-string) immediately before the pattern.
 * This prevents "t.co" from matching "onetrust.com".
 */
export function lookupToolByDomain(domain: string): ToolLookupResult | null {
  const lower = domain.toLowerCase();
  for (const entry of REGISTRY) {
    const p = entry.pattern;
    if (lower === p || lower.endsWith('.' + p) || lower.endsWith('/' + p)) {
      return { name: entry.tool, category: entry.category };
    }
    // Also support path-containing patterns like "facebook.com/tr"
    if (p.includes('/') && lower.includes(p)) {
      return { name: entry.tool, category: entry.category };
    }
  }
  return null;
}
