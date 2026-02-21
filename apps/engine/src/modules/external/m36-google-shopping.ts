/**
 * M36 - Google Shopping
 *
 * Checks for Google Shopping product listings via DataForSEO Merchant API.
 * Uses async task flow (task_post → poll → task_get) since the Merchant API
 * has no live endpoint. Flattens carousel structures to extract individual products.
 *
 * Checkpoints:
 *   1. Google Shopping presence (has products or not)
 *   2. Product rating quality (avg rating across listings)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getGoogleShoppingProducts } from '../../services/dataforseo.js';

interface CarouselElement {
  title?: string;
  price?: number;
  currency?: string;
  seller?: string;
  product_rating?: { value?: number; votes_count?: number };
  shopping_url?: string;
  tags?: string[];
  delivery_info?: { delivery_message?: string };
}

interface CarouselItem {
  type?: string;
  title?: string;
  items?: CarouselElement[];
}

/**
 * Flatten carousel structures into individual product entries.
 * Google Shopping results come as carousels (e.g. "Nike running shoes")
 * containing multiple product elements.
 */
function flattenProducts(rawItems: CarouselItem[]): CarouselElement[] {
  const products: CarouselElement[] = [];
  for (const item of rawItems) {
    if (item.items && Array.isArray(item.items)) {
      for (const product of item.items) {
        products.push(product);
      }
    }
  }
  return products;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const result = await getGoogleShoppingProducts(domain) as {
      items_count?: number;
      items?: CarouselItem[];
    } | null;

    if (!result || !result.items?.length) {
      checkpoints.push(infoCheckpoint(
        'm36-presence', 'Google Shopping',
        'No Google Shopping listings found (may not be applicable for this business)',
      ));
      return { moduleId: 'M36' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const products = flattenProducts(result.items);

    if (products.length === 0) {
      checkpoints.push(infoCheckpoint(
        'm36-presence', 'Google Shopping',
        'No product listings found in Google Shopping results',
      ));
      return { moduleId: 'M36' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    const topProducts = products.slice(0, 10).map(p => ({
      title: p.title ?? '',
      price: p.price ?? 0,
      currency: p.currency ?? 'USD',
      seller: p.seller ?? '',
      rating: p.product_rating?.value ?? null,
      ratingCount: p.product_rating?.votes_count ?? 0,
      url: p.shopping_url ?? '',
      tags: p.tags ?? [],
      delivery: p.delivery_info?.delivery_message ?? null,
    }));

    data.totalProducts = products.length;
    data.topProducts = topProducts;
    data.categories = result.items.map(c => c.title).filter(Boolean);

    signals.push(createSignal({
      type: 'google_shopping', name: 'Google Shopping',
      confidence: 0.85,
      evidence: `${products.length} product listing(s) across ${result.items.length} categories`,
      category: 'market_position',
    }));

    // CP1: Shopping presence
    {
      let health: CheckpointHealth;
      if (products.length >= 20) health = 'excellent';
      else if (products.length >= 5) health = 'good';
      else health = 'warning';

      checkpoints.push(createCheckpoint({
        id: 'm36-presence', name: 'Google Shopping Presence', weight: 0.5,
        health,
        evidence: `${products.length} product(s) across ${result.items.length} category carousel(s)`,
      }));
    }

    // CP2: Product rating quality
    {
      const rated = topProducts.filter(p => p.rating != null && p.rating > 0);
      if (rated.length > 0) {
        const avgRating = rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length;

        let health: CheckpointHealth;
        if (avgRating >= 4.0) health = 'excellent';
        else if (avgRating >= 3.0) health = 'good';
        else health = 'warning';

        checkpoints.push(createCheckpoint({
          id: 'm36-ratings', name: 'Product Ratings', weight: 0.5,
          health,
          evidence: `Average rating: ${avgRating.toFixed(1)}/5 across ${rated.length} rated product(s)`,
        }));
      } else {
        checkpoints.push(infoCheckpoint('m36-ratings', 'Product Ratings', 'No product ratings available'));
      }
    }
  } catch (error) {
    return { moduleId: 'M36' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M36' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M36' as ModuleId, execute);
