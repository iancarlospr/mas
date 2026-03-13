/**
 * FrameCollector — One-shot snapshot of iframe elements + Playwright frame objects.
 *
 * Combines DOM iframe inspection (src, dimensions, visibility, sandbox) with
 * Playwright's page.frames() for cross-origin frame enumeration.
 *
 * Consumers: M05 (tool detection), M07 (martech widgets), M12 (consent banner iframes),
 *            M06 (ad slots), M20 (payment iframes)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FrameInfo {
  src: string;
  domain: string | null;
  isCrossOrigin: boolean;
  isVisible: boolean;
  width: number;
  height: number;
  toolMatch: string | null;
  sandbox: string | null;
}

export interface FrameSnapshot {
  frames: FrameInfo[];
  totalFrames: number;
  crossOriginFrames: number;
  sameOriginFrames: number;
  hiddenFrames: number;
  toolFrames: Array<{ tool: string; src: string }>;
}

// ---------------------------------------------------------------------------
// Known iframe domain patterns — maps iframe src to tool names
// ---------------------------------------------------------------------------

const IFRAME_TOOL_PATTERNS: Array<{ pattern: RegExp; tool: string }> = [
  // Chat & support
  { pattern: /intercom-sheets\.com|intercomcdn\.com|widget\.intercom\.io/i, tool: 'Intercom' },
  { pattern: /js\.driftt\.com|drift\.com/i, tool: 'Drift' },
  { pattern: /tawk\.to|embed\.tawk\.to/i, tool: 'Tawk.to' },
  { pattern: /crisp\.chat/i, tool: 'Crisp' },
  { pattern: /livechatinc\.com/i, tool: 'LiveChat' },
  { pattern: /zopim\.com|zendesk\.com/i, tool: 'Zendesk' },
  { pattern: /freshdesk\.com|freshchat\.com/i, tool: 'Freshdesk' },
  { pattern: /tidio\.co/i, tool: 'Tidio' },
  { pattern: /helpscout\.net/i, tool: 'Help Scout' },

  // Reviews & trust
  { pattern: /widget\.trustpilot\.com/i, tool: 'Trustpilot' },
  { pattern: /yotpo\.com/i, tool: 'Yotpo' },
  { pattern: /bazaarvoice\.com/i, tool: 'Bazaarvoice' },

  // Scheduling & forms
  { pattern: /calendly\.com/i, tool: 'Calendly' },
  { pattern: /typeform\.com/i, tool: 'Typeform' },
  { pattern: /hsforms\.com|hubspot\.com.*forms/i, tool: 'HubSpot Forms' },
  { pattern: /jotfor\.ms|jotform\.com/i, tool: 'JotForm' },

  // Video
  { pattern: /youtube\.com|youtube-nocookie\.com/i, tool: 'YouTube' },
  { pattern: /player\.vimeo\.com/i, tool: 'Vimeo' },
  { pattern: /wistia\.(com|net)/i, tool: 'Wistia' },
  { pattern: /vidyard\.com/i, tool: 'Vidyard' },

  // CAPTCHA
  { pattern: /recaptcha|google\.com\/recaptcha/i, tool: 'reCAPTCHA' },
  { pattern: /hcaptcha\.com/i, tool: 'hCaptcha' },
  { pattern: /challenges\.cloudflare\.com/i, tool: 'Cloudflare Turnstile' },

  // Advertising
  { pattern: /googlesyndication\.com/i, tool: 'Google Ads' },
  { pattern: /doubleclick\.net/i, tool: 'Google DFP' },
  { pattern: /facebook\.com\/plugins/i, tool: 'Facebook Widget' },

  // Social
  { pattern: /platform\.twitter\.com/i, tool: 'Twitter/X Widget' },
  { pattern: /linkedin\.com\/in\//i, tool: 'LinkedIn Widget' },

  // Payment
  { pattern: /js\.stripe\.com|stripe\.com/i, tool: 'Stripe' },
  { pattern: /paypal\.com|paypalobjects\.com/i, tool: 'PayPal' },
  { pattern: /braintreegateway\.com/i, tool: 'Braintree' },
  { pattern: /adyen\.com/i, tool: 'Adyen' },

  // Marketing
  { pattern: /hubspot\.com/i, tool: 'HubSpot' },
  { pattern: /marketo\.com/i, tool: 'Marketo' },
  { pattern: /pardot\.com/i, tool: 'Pardot' },

  // Analytics
  { pattern: /hotjar\.com/i, tool: 'Hotjar' },
  { pattern: /mouseflow\.com/i, tool: 'Mouseflow' },
];

const MAX_FRAMES = 50;

// ---------------------------------------------------------------------------
// FrameCollector
// ---------------------------------------------------------------------------

export class FrameCollector {
  /**
   * Take a one-shot snapshot of all iframes on the page.
   */
  static async snapshot(page: Page, targetDomain: string): Promise<FrameSnapshot> {
    const domFrames = await page.evaluate(
      ({ patterns, maxFrames, domain }: {
        patterns: Array<{ pattern: string; flags: string; tool: string }>;
        maxFrames: number;
        domain: string;
      }) => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const frames: Array<{
          src: string; domain: string | null; isCrossOrigin: boolean;
          isVisible: boolean; width: number; height: number;
          toolMatch: string | null; sandbox: string | null;
        }> = [];

        for (const iframe of iframes.slice(0, maxFrames)) {
          const src = iframe.src || iframe.getAttribute('data-src') || '';
          if (!src) continue;

          let iframeDomain: string | null = null;
          let isCrossOrigin = false;
          try {
            const url = new URL(src, location.href);
            iframeDomain = url.hostname;
            isCrossOrigin = !url.hostname.includes(domain.replace(/^www\./, ''));
          } catch {
            // Relative or invalid URL
          }

          const rect = iframe.getBoundingClientRect();
          const style = window.getComputedStyle(iframe);
          const isVisible = rect.width > 0 && rect.height > 0 &&
            style.display !== 'none' && style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0;

          // Match against tool patterns
          let toolMatch: string | null = null;
          for (const { pattern, flags, tool } of patterns) {
            if (new RegExp(pattern, flags).test(src)) {
              toolMatch = tool;
              break;
            }
          }

          frames.push({
            src: src.slice(0, 300),
            domain: iframeDomain,
            isCrossOrigin,
            isVisible,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            toolMatch,
            sandbox: iframe.getAttribute('sandbox'),
          });
        }

        return frames;
      },
      {
        patterns: IFRAME_TOOL_PATTERNS.map((p) => ({
          pattern: p.pattern.source,
          flags: p.pattern.flags,
          tool: p.tool,
        })),
        maxFrames: MAX_FRAMES,
        domain: targetDomain,
      },
    );

    // Also check Playwright's frame objects for any we missed (e.g., dynamically injected)
    const pwFrames = page.frames();
    const domSrcs = new Set(domFrames.map((f) => f.src));

    for (const frame of pwFrames) {
      const url = frame.url();
      if (!url || url === 'about:blank' || domSrcs.has(url.slice(0, 300))) continue;
      if (domFrames.length >= MAX_FRAMES) break;

      let frameDomain: string | null = null;
      let isCrossOrigin = false;
      try {
        const parsed = new URL(url);
        frameDomain = parsed.hostname;
        isCrossOrigin = !parsed.hostname.includes(targetDomain.replace(/^www\./, ''));
      } catch {
        continue;
      }

      let toolMatch: string | null = null;
      for (const { pattern, tool } of IFRAME_TOOL_PATTERNS) {
        if (pattern.test(url)) {
          toolMatch = tool;
          break;
        }
      }

      domFrames.push({
        src: url.slice(0, 300),
        domain: frameDomain,
        isCrossOrigin,
        isVisible: true, // can't determine from Playwright frame API
        width: 0,
        height: 0,
        toolMatch,
        sandbox: null,
      });
    }

    const toolFrames: Array<{ tool: string; src: string }> = [];
    const seenTools = new Set<string>();
    for (const frame of domFrames) {
      if (frame.toolMatch && !seenTools.has(frame.toolMatch)) {
        seenTools.add(frame.toolMatch);
        toolFrames.push({ tool: frame.toolMatch, src: frame.src });
      }
    }

    return {
      frames: domFrames,
      totalFrames: domFrames.length,
      crossOriginFrames: domFrames.filter((f) => f.isCrossOrigin).length,
      sameOriginFrames: domFrames.filter((f) => !f.isCrossOrigin).length,
      hiddenFrames: domFrames.filter((f) => !f.isVisible).length,
      toolFrames,
    };
  }
}
