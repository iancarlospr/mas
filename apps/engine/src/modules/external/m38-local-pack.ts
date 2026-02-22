/**
 * M38 - Local Pack
 *
 * Google Business Profile completeness audit.
 * Uses cached getBusinessProfile(domain) — shared with M37 ($0 extra).
 * Extracts all available GBP fields and scores against a 10-point
 * completeness checklist based on Google best practices.
 *
 * Checkpoints:
 *   1. GBP presence
 *   2. Profile completeness (10-field checklist with specific callouts)
 *   3. Photo count health
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getBusinessProfile } from '../../services/dataforseo.js';

interface AddressInfo {
  borough?: string;
  address?: string;
  city?: string;
  zip?: string;
  region?: string;
  country_code?: string;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const domain = new URL(ctx.url).hostname.replace(/^www\./, '');

  try {
    const result = await getBusinessProfile(domain) as {
      items?: Array<Record<string, unknown>>;
    } | null;

    const profile = result?.items?.[0];

    if (!profile) {
      checkpoints.push(infoCheckpoint('m38-presence', 'Local Pack', 'No Google Business Profile found for this domain'));
      return { moduleId: 'M38' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
    }

    // Extract all available fields
    const title = (profile['title'] as string) ?? '';
    const description = (profile['description'] as string) ?? '';
    const category = (profile['category'] as string) ?? '';
    const categoryIds = (profile['category_ids'] as string[]) ?? [];
    const additionalCategories = (profile['additional_categories'] as string[]) ?? null;
    const addressInfo = (profile['address_info'] as AddressInfo) ?? null;
    const address = (profile['address'] as string) ?? '';
    const phone = (profile['phone'] as string) ?? '';
    const url = (profile['url'] as string) ?? '';
    const contactUrl = (profile['contact_url'] as string) ?? '';
    const bookOnlineUrl = (profile['book_online_url'] as string) ?? '';
    const workTime = profile['work_time'] as Record<string, unknown> | undefined;
    const workHours = workTime?.['work_hours'] as Record<string, unknown> | undefined;
    const popularTimes = profile['popular_times'] as Record<string, unknown> | undefined;
    const totalPhotos = (profile['total_photos'] as number) ?? 0;
    const logo = (profile['logo'] as string) ?? '';
    const mainImage = (profile['main_image'] as string) ?? '';
    const ratingObj = profile['rating'] as Record<string, number> | undefined;
    const avgRating = ratingObj?.['value'] ?? 0;
    const reviewCount = ratingObj?.['votes_count'] ?? 0;
    const placeId = (profile['place_id'] as string) ?? '';
    const cid = (profile['cid'] as string) ?? '';

    data.businessProfile = {
      title,
      description: description.slice(0, 300),
      category,
      categoryIds,
      additionalCategories,
      address,
      addressInfo,
      phone,
      url,
      contactUrl,
      bookOnlineUrl,
      hasWorkHours: !!workHours,
      currentStatus: (workHours?.['current_status'] as string) ?? null,
      hasPopularTimes: !!popularTimes,
      totalPhotos,
      hasLogo: !!logo,
      hasMainImage: !!mainImage,
      avgRating,
      reviewCount,
      placeId,
      cid,
    };

    signals.push(createSignal({
      type: 'local_pack', name: 'Google Business Profile',
      confidence: 0.9,
      evidence: `"${title}" — ${category}, ${avgRating}/5 (${reviewCount} reviews), ${totalPhotos} photos`,
      category: 'market_intelligence',
    }));

    // CP1: GBP presence
    checkpoints.push(createCheckpoint({
      id: 'm38-presence', name: 'GBP Presence', weight: 0.3,
      health: 'excellent',
      evidence: `Google Business Profile: "${title}" (${category})`,
    }));

    // CP2: Profile completeness — 10-field checklist
    {
      const checklist: { field: string; present: boolean; label: string }[] = [
        { field: 'description', present: !!description, label: 'Business description' },
        { field: 'photos', present: totalPhotos >= 10, label: 'Photos (10+)' },
        { field: 'url', present: !!url, label: 'Website URL' },
        { field: 'phone', present: !!phone, label: 'Phone number' },
        { field: 'workHours', present: !!workHours, label: 'Work hours' },
        { field: 'categories', present: (additionalCategories?.length ?? 0) > 0, label: 'Multiple categories' },
        { field: 'address', present: !!address && !!addressInfo?.city, label: 'Full address' },
        { field: 'logo', present: !!logo, label: 'Logo' },
        { field: 'rating', present: reviewCount > 0, label: 'Has reviews' },
        { field: 'bookingUrl', present: !!bookOnlineUrl || !!contactUrl, label: 'Booking/contact URL' },
      ];

      const filled = checklist.filter(c => c.present).length;
      const missing = checklist.filter(c => !c.present).map(c => c.label);
      const completeness = filled / checklist.length;

      data.completenessChecklist = checklist;

      let health: CheckpointHealth;
      if (completeness >= 0.8) health = 'excellent';
      else if (completeness >= 0.6) health = 'good';
      else health = 'warning';

      const evidence = missing.length > 0
        ? `${filled}/${checklist.length} fields complete. Missing: ${missing.join(', ')}`
        : `${filled}/${checklist.length} fields complete — fully optimized profile`;

      checkpoints.push(createCheckpoint({
        id: 'm38-completeness', name: 'Profile Completeness', weight: 0.4,
        health, evidence,
      }));
    }

    // CP3: Photo count health
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (totalPhotos >= 50) {
        health = 'excellent';
        evidence = `${totalPhotos} photos — strong visual presence`;
      } else if (totalPhotos >= 10) {
        health = 'good';
        evidence = `${totalPhotos} photos (Google recommends 10+)`;
      } else if (totalPhotos > 0) {
        health = 'warning';
        evidence = `Only ${totalPhotos} photo(s) — add more to improve local visibility`;
      } else {
        health = 'critical';
        evidence = 'No photos on Google Business Profile — significantly hurts local ranking';
      }

      checkpoints.push(createCheckpoint({
        id: 'm38-photos', name: 'Photo Presence', weight: 0.3,
        health, evidence,
      }));
    }
  } catch (error) {
    return { moduleId: 'M38' as ModuleId, status: 'error', data, signals, score: null, checkpoints, duration: 0, error: (error as Error).message };
  }

  return { moduleId: 'M38' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M38' as ModuleId, execute);
