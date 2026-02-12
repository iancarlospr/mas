/**
 * M15 - Social & Sharing Optimization
 *
 * Audits Open Graph tags, Twitter Cards, social share buttons,
 * social profile links, and sharing metadata quality.
 *
 * Checkpoints:
 *   1. Open Graph tags
 *   2. Twitter Card tags
 *   3. Social share buttons
 *   4. Social profile links
 *   5. OG image quality
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M15' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  const socialData = await page.evaluate(() => {
    // Open Graph
    const ogTags: Record<string, string> = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
      const prop = el.getAttribute('property');
      const content = el.getAttribute('content');
      if (prop && content) ogTags[prop] = content;
    });

    // Twitter Card
    const twitterTags: Record<string, string> = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach((el) => {
      const name = el.getAttribute('name');
      const content = el.getAttribute('content');
      if (name && content) twitterTags[name] = content;
    });

    // Social share buttons
    const sharePatterns = [
      { name: 'Facebook', selectors: ['a[href*="facebook.com/share"], a[href*="facebook.com/sharer"], [class*="facebook-share"], [data-share="facebook"]'] },
      { name: 'Twitter/X', selectors: ['a[href*="twitter.com/intent"], a[href*="x.com/intent"], [class*="twitter-share"], [data-share="twitter"]'] },
      { name: 'LinkedIn', selectors: ['a[href*="linkedin.com/share"], [class*="linkedin-share"], [data-share="linkedin"]'] },
      { name: 'Pinterest', selectors: ['a[href*="pinterest.com/pin"], [class*="pinterest-share"]'] },
      { name: 'Email', selectors: ['a[href^="mailto:?"], [class*="email-share"], [data-share="email"]'] },
      { name: 'WhatsApp', selectors: ['a[href*="wa.me"], a[href*="whatsapp.com/send"], [data-share="whatsapp"]'] },
    ];

    const shareButtons: string[] = [];
    for (const { name, selectors } of sharePatterns) {
      for (const sel of selectors) {
        if (document.querySelector(sel)) {
          shareButtons.push(name);
          break;
        }
      }
    }

    // Generic share button widget detection
    const hasShareThis = !!document.querySelector('[class*="sharethis"], script[src*="sharethis"]');
    const hasAddThis = !!document.querySelector('[class*="addthis"], script[src*="addthis"]');
    const hasNativeShare = !!document.querySelector('[class*="share-button"], [class*="social-share"]');

    // Social profile links
    const socialPlatforms = [
      { name: 'Facebook', pattern: /facebook\.com\/(?!share|sharer)/ },
      { name: 'Twitter/X', pattern: /(?:twitter|x)\.com\/(?!intent)/ },
      { name: 'LinkedIn', pattern: /linkedin\.com\/(?:company|in)\// },
      { name: 'Instagram', pattern: /instagram\.com\// },
      { name: 'YouTube', pattern: /youtube\.com\/(channel|c|user|@|[A-Za-z0-9_-]{2,})/ },
      { name: 'TikTok', pattern: /tiktok\.com\/@/ },
      { name: 'GitHub', pattern: /github\.com\// },
      { name: 'Pinterest', pattern: /pinterest\.com\/(?!pin\/)/ },
    ];

    const profileLinks: string[] = [];
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      for (const { name, pattern } of socialPlatforms) {
        if (pattern.test(href) && !profileLinks.includes(name)) {
          profileLinks.push(name);
        }
      }
    });

    // JSON-LD sameAs detection (stronger social signal)
    const sameAsLinks: string[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        const json = JSON.parse(el.textContent || '');
        const sameAs = json.sameAs || (Array.isArray(json['@graph']) ? json['@graph'].find((g: Record<string, unknown>) => g.sameAs)?.sameAs : null);
        if (Array.isArray(sameAs)) {
          for (const url of sameAs) {
            if (typeof url === 'string') sameAsLinks.push(url);
          }
        } else if (typeof sameAs === 'string') {
          sameAsLinks.push(sameAs);
        }
      } catch { /* invalid JSON-LD */ }
    });

    // Merge sameAs-detected platforms into profileLinks
    for (const url of sameAsLinks) {
      for (const { name, pattern } of socialPlatforms) {
        if (pattern.test(url) && !profileLinks.includes(name)) {
          profileLinks.push(name);
        }
      }
    }

    return {
      ogTags,
      twitterTags,
      shareButtons,
      profileLinks,
      sameAsLinks,
      hasShareThis,
      hasAddThis,
      hasNativeShare,
    };
  });

  data.socialData = socialData;

  // ─── Build signals ───────────────────────────────────────────────────────
  if (Object.keys(socialData.ogTags).length > 0) {
    signals.push(createSignal({ type: 'social_meta', name: 'Open Graph', confidence: 0.95, evidence: `OG tags: ${Object.keys(socialData.ogTags).join(', ')}`, category: 'social' }));
  }
  for (const platform of socialData.profileLinks) {
    signals.push(createSignal({ type: 'social_profile', name: platform, confidence: 0.9, evidence: `${platform} profile link found`, category: 'social' }));
  }

  // ─── Build checkpoints ───────────────────────────────────────────────────
  const og = socialData.ogTags;
  const tw = socialData.twitterTags;

  // CP1: Open Graph tags
  {
    const hasTitle = !!og['og:title'];
    const hasDesc = !!og['og:description'];
    const hasImage = !!og['og:image'];
    const hasUrl = !!og['og:url'];
    const hasType = !!og['og:type'];
    const complete = [hasTitle, hasDesc, hasImage, hasUrl, hasType].filter(Boolean).length;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const missingOg: string[] = [];
    if (!hasTitle) missingOg.push('og:title');
    if (!hasDesc) missingOg.push('og:description');
    if (!hasImage) missingOg.push('og:image');
    if (!hasUrl) missingOg.push('og:url');
    if (!hasType) missingOg.push('og:type');

    if (complete >= 4 && hasImage) {
      health = 'excellent';
      evidence = `Open Graph complete (${complete}/5): title, description, image${hasUrl ? ', url' : ''}${hasType ? ', type' : ''}${missingOg.length > 0 ? ` (missing: ${missingOg.join(', ')})` : ''}`;
    } else if (complete >= 2) {
      health = 'good';
      evidence = `Open Graph partial (${complete}/5 tags)${!hasImage ? ' — missing og:image' : ''}`;
      if (!hasImage) recommendation = 'Add og:image for better social sharing previews.';
    } else if (complete >= 1) {
      health = 'warning';
      evidence = `Open Graph minimal (${complete}/5 tags)`;
      recommendation = 'Add og:title, og:description, og:image, og:url for social sharing.';
    } else {
      health = 'critical';
      evidence = 'No Open Graph tags — social shares will have poor previews';
      recommendation = 'Implement OG tags (title, description, image, url) for all pages.';
    }

    checkpoints.push(createCheckpoint({ id: 'm15-og', name: 'Open Graph Tags', weight: 0.8, health, evidence, recommendation }));
  }

  // CP2: Twitter Card tags
  {
    const hasCard = !!tw['twitter:card'];
    const hasTitle = !!tw['twitter:title'] || !!og['og:title'];
    const hasImage = !!tw['twitter:image'] || !!og['og:image'];

    let health: CheckpointHealth;
    let evidence: string;

    const hasSite = !!tw['twitter:site'];

    if (hasCard && hasTitle && hasImage) {
      health = 'excellent';
      evidence = `Twitter Card: ${tw['twitter:card']} with title and image${hasSite ? ` (@${tw['twitter:site']!.replace('@', '')})` : ''}`;
    } else if (hasCard || (hasTitle && hasImage)) {
      health = 'good';
      evidence = 'Twitter Card partially configured (falls back to OG tags)';
    } else if (og['og:title'] && og['og:image']) {
      health = 'good';
      evidence = 'No explicit Twitter Card but OG tags provide fallback';
    } else {
      health = 'warning';
      evidence = 'No Twitter Card or OG fallback for X/Twitter sharing';
    }

    checkpoints.push(createCheckpoint({ id: 'm15-twitter', name: 'Twitter Card Tags', weight: 0.5, health, evidence }));
  }

  // CP3: Social share buttons
  {
    const total = socialData.shareButtons.length + (socialData.hasShareThis || socialData.hasAddThis ? 1 : 0);

    let health: CheckpointHealth;
    let evidence: string;

    if (total >= 3) {
      health = 'excellent';
      evidence = `Share buttons: ${socialData.shareButtons.join(', ')}${socialData.hasShareThis ? ' (ShareThis)' : ''}${socialData.hasAddThis ? ' (AddThis)' : ''}`;
    } else if (total >= 1) {
      health = 'good';
      evidence = `${total} share option(s): ${socialData.shareButtons.join(', ')}`;
    } else {
      health = 'good'; // Info — not every page needs share buttons
      evidence = 'No social share buttons detected (common for non-content pages)';
    }

    checkpoints.push(createCheckpoint({ id: 'm15-share', name: 'Social Share Buttons', weight: 0.4, health, evidence }));
  }

  // CP4: Social profile links
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (socialData.profileLinks.length >= 3) {
      health = 'excellent';
      evidence = `Social profiles: ${socialData.profileLinks.join(', ')}`;
    } else if (socialData.profileLinks.length >= 1) {
      health = 'good';
      evidence = `${socialData.profileLinks.length} social profile(s): ${socialData.profileLinks.join(', ')}`;
    } else {
      health = 'warning';
      evidence = 'No social profile links found in page footer/header';
    }

    checkpoints.push(createCheckpoint({ id: 'm15-profiles', name: 'Social Profile Links', weight: 0.4, health, evidence }));
  }

  // CP5: OG image quality (with dimension and aspect ratio check)
  {
    const ogImage = og['og:image'];
    const ogWidth = parseInt(og['og:image:width'] || '0', 10);
    const ogHeight = parseInt(og['og:image:height'] || '0', 10);
    const hasAlt = !!og['og:image:alt'];
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (ogImage && ogImage.startsWith('https://')) {
      // Check dimensions against recommended 1200×630 (1.91:1 for Facebook/LinkedIn)
      if (ogWidth >= 1200 && ogHeight >= 600) {
        const ratio = ogWidth / ogHeight;
        const dimInfo = `${ogWidth}×${ogHeight}${hasAlt ? ', alt text' : ''}`;
        if (ratio >= 1.7 && ratio <= 2.1) {
          health = 'excellent';
          evidence = `OG image: ${dimInfo} — optimal dimensions and ratio for social sharing`;
        } else {
          health = 'good';
          evidence = `OG image: ${dimInfo} — large enough but aspect ratio ${ratio.toFixed(1)}:1 differs from optimal 1.91:1`;
        }
      } else if (ogWidth > 0 && ogHeight > 0) {
        health = 'good';
        evidence = `OG image: ${ogWidth}×${ogHeight} — below recommended 1200×630 minimum`;
        recommendation = 'Use at least 1200×630px for optimal social sharing previews on Facebook and LinkedIn.';
      } else {
        health = 'excellent';
        evidence = `OG image: HTTPS absolute URL${hasAlt ? ' with alt text' : ''} (no dimensions specified)`;
      }
    } else if (ogImage && ogImage.startsWith('http://')) {
      health = 'warning';
      evidence = 'OG image uses HTTP — some platforms may not load it';
      recommendation = 'Use HTTPS for og:image URL.';
    } else if (ogImage) {
      health = 'warning';
      evidence = 'OG image uses relative URL — may not render on all platforms';
      recommendation = 'Use an absolute HTTPS URL for og:image.';
    } else {
      health = 'warning';
      evidence = 'No og:image set — social shares will use platform-chosen preview';
      recommendation = 'Add og:image (1200×630px HTTPS) for rich social sharing previews.';
    }

    checkpoints.push(createCheckpoint({ id: 'm15-og-image', name: 'OG Image Quality', weight: 0.5, health, evidence, recommendation }));
  }

  return { moduleId: 'M15' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M15' as ModuleId, execute);
