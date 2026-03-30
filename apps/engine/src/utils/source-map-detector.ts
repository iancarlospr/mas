/**
 * Source Map Detector
 *
 * Scans network responses for source map indicators:
 *   1. `SourceMap` / `X-SourceMap` response headers
 *   2. `//# sourceMappingURL=` comments in JS/CSS responses
 *
 * Detection only — does NOT fetch the actual source maps.
 * Exposed source maps = security concern (reveals original source code).
 */

import type { CapturedResponse } from './network.js';

export interface SourceMapDetection {
  /** The URL of the JS/CSS file that references a source map */
  fileUrl: string;
  /** The source map URL (could be relative or absolute) */
  sourceMapUrl: string;
  /** How it was detected */
  detectedVia: 'header' | 'comment';
}

/**
 * Scan captured network responses for source map indicators.
 * Returns detected source map references (capped at 20).
 */
export function detectSourceMaps(responses: CapturedResponse[]): SourceMapDetection[] {
  const detections: SourceMapDetection[] = [];
  const seen = new Set<string>();

  for (const resp of responses) {
    if (detections.length >= 20) break;

    // Only check JS and CSS responses
    const contentType = resp.headers['content-type'] ?? '';
    const isJsOrCss = /javascript|css|ecmascript/i.test(contentType) ||
      /\.(js|mjs|css)(\?|$)/.test(resp.url);
    if (!isJsOrCss) continue;

    const pathname = safePathname(resp.url);

    // 1. Check SourceMap / X-SourceMap headers
    const sourceMapHeader = resp.headers['sourcemap'] ?? resp.headers['x-sourcemap'];
    if (sourceMapHeader && !seen.has(pathname)) {
      seen.add(pathname);
      detections.push({
        fileUrl: pathname,
        sourceMapUrl: sourceMapHeader,
        detectedVia: 'header',
      });
    }
  }

  return detections;
}

/**
 * Extract source map URLs from inline script content (for page.evaluate() results).
 * This is meant to be called with the text content of scripts found during browser phase.
 */
export function detectSourceMapComments(scripts: Array<{ url: string; content: string }>): SourceMapDetection[] {
  const detections: SourceMapDetection[] = [];
  const seen = new Set<string>();

  for (const script of scripts) {
    if (detections.length >= 20) break;
    const pathname = safePathname(script.url);
    if (seen.has(pathname)) continue;

    // Match //# sourceMappingURL= or /*# sourceMappingURL= */
    const match = script.content.match(/[/][/*]#\s*sourceMappingURL=(\S+)/);
    if (match && match[1]) {
      seen.add(pathname);
      detections.push({
        fileUrl: pathname,
        sourceMapUrl: match[1],
        detectedVia: 'comment',
      });
    }
  }

  return detections;
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname.slice(0, 100);
  } catch {
    return url.slice(0, 100);
  }
}
