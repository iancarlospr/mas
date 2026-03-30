/**
 * ImageAuditor — Browser-based audit of images, videos, and fonts.
 *
 * Single page.evaluate() captures all DOM-based media information including
 * alt-text quality, responsive image usage, video embeds, and font loading strategy.
 *
 * Consumers: M03 (performance), M04 (metadata), M10 (accessibility), M14 (mobile/responsive)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageInfo {
  src: string;                   // truncated to 200 chars
  alt: string | null;
  altQuality: 'missing' | 'empty' | 'generic' | 'good';
  width: number | null;          // HTML attribute
  height: number | null;         // HTML attribute
  naturalWidth: number;
  naturalHeight: number;
  isOversized: boolean;          // naturalWidth > 2x displayWidth
  hasLazyLoading: boolean;
  hasSrcset: boolean;
  format: string;                // from URL extension
  isAboveFold: boolean;
  inPictureElement: boolean;
}

export interface VideoInfo {
  platform: string | null;       // YouTube, Vimeo, Wistia, hosted
  hasAutoplay: boolean;
  hasPoster: boolean;
  hasCaptions: boolean;          // <track> element exists
  isMuted: boolean;
}

export interface FontInfo {
  family: string;
  display: string;               // auto, block, swap, fallback, optional
  isPreloaded: boolean;
  source: 'google' | 'typekit' | 'self-hosted' | 'system';
}

export interface ImageAudit {
  images: ImageInfo[];           // capped at 100
  totalImages: number;
  missingAlt: number;
  emptyAlt: number;              // decorative (alt="")
  genericAlt: number;            // "image", "photo", "untitled", filename patterns
  hasResponsiveImages: boolean;
  srcsetCount: number;
  pictureElementCount: number;
  lazyLoadedCount: number;
  modernFormatCount: number;     // WebP, AVIF
  legacyFormatCount: number;     // JPEG, PNG, GIF
  oversizedCount: number;        // naturalWidth > 2x displayWidth
  imageCDN: string | null;       // detected CDN provider

  videos: VideoInfo[];           // capped at 20
  totalVideos: number;

  fonts: FontInfo[];             // capped at 20
  fontDisplayValues: Record<string, number>;  // swap: 5, auto: 2, etc.
  preloadedFonts: number;
}

// ---------------------------------------------------------------------------
// ImageAuditor
// ---------------------------------------------------------------------------

export class ImageAuditor {
  /**
   * Audit all images, videos, and fonts on the current page.
   * Runs a single page.evaluate() to minimize round-trips.
   */
  static async audit(page: Page): Promise<ImageAudit> {
    return page.evaluate(() => {
      // -----------------------------------------------------------------------
      // Helper: extract file extension from URL
      // -----------------------------------------------------------------------
      function extractFormat(url: string): string {
        try {
          const pathname = new URL(url, window.location.href).pathname;
          const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
          const known = ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico'];
          return known.includes(ext) ? ext : 'unknown';
        } catch {
          return 'unknown';
        }
      }

      // -----------------------------------------------------------------------
      // Helper: classify alt text quality
      // -----------------------------------------------------------------------
      function classifyAlt(el: HTMLImageElement): { alt: string | null; altQuality: 'missing' | 'empty' | 'generic' | 'good' } {
        if (!el.hasAttribute('alt')) {
          return { alt: null, altQuality: 'missing' };
        }
        const alt = el.getAttribute('alt')!;
        if (alt === '') {
          return { alt: '', altQuality: 'empty' };
        }
        // Generic patterns: common placeholder words, filenames, bare numbers
        const genericPattern = /^(image|photo|img|picture|untitled|banner|icon|logo)\d*$/i;
        const filenamePattern = /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|tiff?|ico)$/i;
        const bareNumber = /^\d+$/;
        if (genericPattern.test(alt.trim()) || filenamePattern.test(alt.trim()) || bareNumber.test(alt.trim())) {
          return { alt, altQuality: 'generic' };
        }
        return { alt, altQuality: 'good' };
      }

      // -----------------------------------------------------------------------
      // Helper: detect image CDN from src URL
      // -----------------------------------------------------------------------
      function detectCDN(src: string): string | null {
        if (src.includes('res.cloudinary.com')) return 'Cloudinary';
        if (src.includes('.imgix.net')) return 'Imgix';
        if (src.includes('imagedelivery.net') || src.includes('/cdn-cgi/image/')) return 'Cloudflare Images';
        if (src.includes('fastly.net')) return 'Fastly';
        if (src.includes('cdn.shopify.com')) return 'Shopify CDN';
        if (/i[0-2]\.wp\.com/.test(src)) return 'WordPress Jetpack';
        if (src.includes('akamaized.net')) return 'Akamai';
        if (src.includes('b-cdn.net')) return 'Bunny CDN';
        return null;
      }

      // -----------------------------------------------------------------------
      // Images
      // -----------------------------------------------------------------------
      const imgEls = Array.from(document.querySelectorAll('img'));
      const totalImages = imgEls.length;
      const viewportHeight = window.innerHeight;

      let missingAlt = 0;
      let emptyAlt = 0;
      let genericAlt = 0;
      let srcsetCount = 0;
      let pictureElementCount = 0;
      let lazyLoadedCount = 0;
      let modernFormatCount = 0;
      let legacyFormatCount = 0;
      let oversizedCount = 0;
      let imageCDN: string | null = null;

      const images: Array<{
        src: string;
        alt: string | null;
        altQuality: 'missing' | 'empty' | 'generic' | 'good';
        width: number | null;
        height: number | null;
        naturalWidth: number;
        naturalHeight: number;
        isOversized: boolean;
        hasLazyLoading: boolean;
        hasSrcset: boolean;
        format: string;
        isAboveFold: boolean;
        inPictureElement: boolean;
      }> = [];

      for (let i = 0; i < imgEls.length; i++) {
        const el = imgEls[i]!;
        const src = (el.currentSrc || el.src || '').slice(0, 200);
        const { alt, altQuality } = classifyAlt(el);

        // Count alt quality
        if (altQuality === 'missing') missingAlt++;
        else if (altQuality === 'empty') emptyAlt++;
        else if (altQuality === 'generic') genericAlt++;

        // Dimensions
        const widthAttr = el.getAttribute('width');
        const heightAttr = el.getAttribute('height');
        const width = widthAttr ? parseInt(widthAttr, 10) : null;
        const height = heightAttr ? parseInt(heightAttr, 10) : null;
        if (width !== null && isNaN(width)) { /* leave as parsed */ }
        if (height !== null && isNaN(height)) { /* leave as parsed */ }
        const naturalWidth = el.naturalWidth;
        const naturalHeight = el.naturalHeight;

        // Oversized check
        const rect = el.getBoundingClientRect();
        const displayWidth = rect.width;
        const isOversized = naturalWidth > 0 && displayWidth > 0 && naturalWidth > 2 * displayWidth;
        if (isOversized) oversizedCount++;

        // Lazy loading
        const hasLazyLoading =
          el.getAttribute('loading') === 'lazy' ||
          el.hasAttribute('data-lazy') ||
          el.hasAttribute('data-src');
        if (hasLazyLoading) lazyLoadedCount++;

        // Srcset
        const hasSrcset = el.hasAttribute('srcset');
        if (hasSrcset) srcsetCount++;

        // Format
        const format = extractFormat(src);
        if (format === 'webp' || format === 'avif') modernFormatCount++;
        else if (format === 'jpeg' || format === 'jpg' || format === 'png' || format === 'gif') legacyFormatCount++;

        // Above fold
        const isAboveFold = rect.top < viewportHeight;

        // Picture element
        const inPictureElement = el.parentElement?.tagName === 'PICTURE';
        if (inPictureElement) pictureElementCount++;

        // CDN detection (first match wins)
        if (!imageCDN && src) {
          imageCDN = detectCDN(src);
        }

        // Only store details for the first 100 images
        if (i < 100) {
          images.push({
            src,
            alt,
            altQuality,
            width: width !== null && !isNaN(width) ? width : null,
            height: height !== null && !isNaN(height) ? height : null,
            naturalWidth,
            naturalHeight,
            isOversized,
            hasLazyLoading,
            hasSrcset,
            format,
            isAboveFold,
            inPictureElement,
          });
        }
      }

      const hasResponsiveImages = srcsetCount > 0 || pictureElementCount > 0;

      // -----------------------------------------------------------------------
      // Videos
      // -----------------------------------------------------------------------
      const videos: Array<{
        platform: string | null;
        hasAutoplay: boolean;
        hasPoster: boolean;
        hasCaptions: boolean;
        isMuted: boolean;
      }> = [];

      // <video> elements
      const videoEls = Array.from(document.querySelectorAll('video'));
      for (let i = 0; i < Math.min(videoEls.length, 20); i++) {
        const el = videoEls[i]!;
        videos.push({
          platform: 'hosted',
          hasAutoplay: el.hasAttribute('autoplay'),
          hasPoster: el.hasAttribute('poster'),
          hasCaptions: el.querySelector('track') !== null,
          isMuted: el.hasAttribute('muted'),
        });
      }

      // <iframe> video embeds
      if (videos.length < 20) {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const iframe of iframes) {
          if (videos.length >= 20) break;
          const src = (iframe.src || iframe.getAttribute('data-src') || '').toLowerCase();
          let platform: string | null = null;

          if (src.includes('youtube.com') || src.includes('youtube-nocookie.com')) {
            platform = 'YouTube';
          } else if (src.includes('player.vimeo.com') || src.includes('vimeo.com')) {
            platform = 'Vimeo';
          } else if (src.includes('wistia.com') || src.includes('fast.wistia.net')) {
            platform = 'Wistia';
          } else if (src.includes('dailymotion.com')) {
            platform = 'Dailymotion';
          }

          if (platform) {
            videos.push({
              platform,
              hasAutoplay: src.includes('autoplay=1'),
              hasPoster: false,
              hasCaptions: false,
              isMuted: src.includes('mute=1'),
            });
          }
        }
      }

      const totalVideos = videoEls.length + Array.from(document.querySelectorAll('iframe')).filter((iframe) => {
        const src = (iframe.src || '').toLowerCase();
        return (
          src.includes('youtube.com') ||
          src.includes('youtube-nocookie.com') ||
          src.includes('vimeo.com') ||
          src.includes('wistia.com') ||
          src.includes('fast.wistia.net') ||
          src.includes('dailymotion.com')
        );
      }).length;

      // -----------------------------------------------------------------------
      // Fonts
      // -----------------------------------------------------------------------
      const fontMap = new Map<string, { family: string; display: string; source: 'google' | 'typekit' | 'self-hosted' | 'system' }>();
      const preloadedFontHrefs = new Set<string>();
      const fontDisplayValues: Record<string, number> = {};

      // 1. Detect preloaded fonts
      const preloadLinks = Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'));
      for (const link of preloadLinks) {
        const href = (link as HTMLLinkElement).href || '';
        if (href) preloadedFontHrefs.add(href);
      }

      // 2. Detect Google Fonts and Typekit from <link> elements
      const linkEls = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"], link[rel="preload"]'));
      for (const link of linkEls) {
        const href = (link as HTMLLinkElement).href || '';
        if (href.includes('fonts.googleapis.com')) {
          // Extract font families from Google Fonts URL
          try {
            const url = new URL(href);
            const familyParam = url.searchParams.get('family') || '';
            const families = familyParam.split('|').map((f) => f.split(':')[0]!.replace(/\+/g, ' ').trim());
            for (const family of families) {
              if (family && !fontMap.has(family)) {
                fontMap.set(family, { family, display: 'swap', source: 'google' });
              }
            }
          } catch {
            // Could not parse Google Fonts URL
          }
        }
        if (href.includes('use.typekit.net')) {
          // Typekit — we can't easily parse the family names from the kit ID,
          // but mark it as detected
          if (!fontMap.has('__typekit__')) {
            fontMap.set('__typekit__', { family: 'Typekit Kit', display: 'auto', source: 'typekit' });
          }
        }
      }

      // 3. Extract @font-face from stylesheets
      try {
        for (let i = 0; i < document.styleSheets.length; i++) {
          let rules: CSSRuleList;
          try {
            rules = document.styleSheets[i]!.cssRules;
          } catch {
            continue; // cross-origin stylesheet
          }

          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j]!;
            if (rule instanceof CSSFontFaceRule) {
              const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
              const display = rule.style.getPropertyValue('font-display') || 'auto';
              const srcValue = rule.style.getPropertyValue('src') || '';

              if (family && !fontMap.has(family)) {
                let source: 'google' | 'typekit' | 'self-hosted' | 'system' = 'self-hosted';
                if (srcValue.includes('fonts.googleapis.com') || srcValue.includes('fonts.gstatic.com')) {
                  source = 'google';
                } else if (srcValue.includes('use.typekit.net') || srcValue.includes('typekit.com')) {
                  source = 'typekit';
                }
                fontMap.set(family, { family, display, source });
              }
            }
          }
        }
      } catch {
        // Fallback if styleSheets access fails entirely
      }

      // Also scan inline <style> elements
      try {
        const styleEls = document.querySelectorAll('style');
        styleEls.forEach((styleEl) => {
          try {
            if (styleEl.sheet) {
              const rules = styleEl.sheet.cssRules;
              for (let j = 0; j < rules.length; j++) {
                const rule = rules[j]!;
                if (rule instanceof CSSFontFaceRule) {
                  const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
                  const display = rule.style.getPropertyValue('font-display') || 'auto';
                  const srcValue = rule.style.getPropertyValue('src') || '';

                  if (family && !fontMap.has(family)) {
                    let source: 'google' | 'typekit' | 'self-hosted' | 'system' = 'self-hosted';
                    if (srcValue.includes('fonts.googleapis.com') || srcValue.includes('fonts.gstatic.com')) {
                      source = 'google';
                    } else if (srcValue.includes('use.typekit.net') || srcValue.includes('typekit.com')) {
                      source = 'typekit';
                    }
                    fontMap.set(family, { family, display, source });
                  }
                }
              }
            }
          } catch { /* cross-origin */ }
        });
      } catch { /* */ }

      // Build font list with preload detection, capped at 20
      const fonts: Array<{
        family: string;
        display: string;
        isPreloaded: boolean;
        source: 'google' | 'typekit' | 'self-hosted' | 'system';
      }> = [];

      let preloadedFonts = 0;
      const fontEntries = Array.from(fontMap.values()).slice(0, 20);
      for (const font of fontEntries) {
        // Check if any preloaded font href contains the font family name
        let isPreloaded = false;
        const familyLower = font.family.toLowerCase().replace(/\s+/g, '');
        for (const href of preloadedFontHrefs) {
          if (href.toLowerCase().replace(/\s+/g, '').includes(familyLower)) {
            isPreloaded = true;
            break;
          }
        }
        if (isPreloaded) preloadedFonts++;

        // Count font-display values
        const dv = font.display;
        fontDisplayValues[dv] = (fontDisplayValues[dv] || 0) + 1;

        fonts.push({
          family: font.family,
          display: font.display,
          isPreloaded,
          source: font.source,
        });
      }

      // -----------------------------------------------------------------------
      // Assemble result
      // -----------------------------------------------------------------------
      return {
        images,
        totalImages,
        missingAlt,
        emptyAlt,
        genericAlt,
        hasResponsiveImages,
        srcsetCount,
        pictureElementCount,
        lazyLoadedCount,
        modernFormatCount,
        legacyFormatCount,
        oversizedCount,
        imageCDN,

        videos,
        totalVideos,

        fonts,
        fontDisplayValues,
        preloadedFonts,
      };
    });
  }
}
