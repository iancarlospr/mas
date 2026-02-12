/**
 * CrUX / PageSpeed Insights API Service
 *
 * Fetches real-user Core Web Vitals field data from the Chrome User Experience
 * Report (CrUX) via the PageSpeed Insights API, which bundles both CrUX field
 * data and Lighthouse lab data in a single call.
 *
 * The PSI API works without an API key (rate-limited to ~25 req/100s).
 * Set GOOGLE_PSI_API_KEY for higher quotas.
 */

import type { CruxFieldData, CruxMetricData } from '../modules/types.js';
import pino from 'pino';

const logger = pino({ name: 'crux-service' });

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** CrUX metric key → our field name mapping. */
const METRIC_MAP: Record<string, keyof Pick<CruxFieldData, 'lcp' | 'cls' | 'inp' | 'fcp' | 'ttfb'>> = {
  LARGEST_CONTENTFUL_PAINT_MS: 'lcp',
  CUMULATIVE_LAYOUT_SHIFT_SCORE: 'cls',
  INTERACTION_TO_NEXT_PAINT: 'inp',
  FIRST_CONTENTFUL_PAINT_MS: 'fcp',
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: 'ttfb',
};

/**
 * Parse a CrUX metric from the PSI response.
 */
function parseMetric(metricData: Record<string, unknown> | undefined): CruxMetricData | null {
  if (!metricData) return null;

  const raw = metricData['percentile'] ?? metricData['p75'];
  if (raw == null || typeof raw !== 'number') return null;

  const category = metricData['category'] as string | undefined;

  return {
    p75: raw,
    category: (category === 'FAST' || category === 'AVERAGE' || category === 'SLOW')
      ? category
      : null,
  };
}

/**
 * Apply CrUX metrics from a loadingExperience block to a CruxFieldData result.
 * Shared between page-level and origin-level data to avoid duplication.
 *
 * @param result - The target CruxFieldData to populate
 * @param metrics - The metrics map from loadingExperience/originLoadingExperience
 * @param overwrite - If true, overwrite existing non-null metrics; if false, only fill nulls
 */
function applyMetrics(
  result: CruxFieldData,
  metrics: Record<string, Record<string, unknown>>,
  overwrite: boolean,
): void {
  for (const [psiKey, fieldName] of Object.entries(METRIC_MAP)) {
    const metricData = metrics[psiKey];
    if (metricData && (overwrite || !result[fieldName])) {
      result[fieldName] = parseMetric(metricData);
    }
  }
}

/**
 * Extract the collection period from a loadingExperience block.
 * The PSI API includes collectionPeriod at the top level of loadingExperience.
 */
function extractCollectionPeriod(
  loadingExp: Record<string, unknown>,
): { firstDate: string; lastDate: string } | null {
  const cp = loadingExp['collectionPeriod'] as Record<string, unknown> | undefined;
  if (!cp) return null;

  const first = cp['firstDate'] as Record<string, unknown> | undefined;
  const last = cp['lastDate'] as Record<string, unknown> | undefined;
  if (!first || !last) return null;

  // PSI dates are { year, month, day } objects
  const formatDate = (d: Record<string, unknown>): string =>
    `${d['year']}-${String(d['month']).padStart(2, '0')}-${String(d['day']).padStart(2, '0')}`;

  return { firstDate: formatDate(first), lastDate: formatDate(last) };
}

/**
 * Fetch CrUX field data + Lighthouse score from PageSpeed Insights API.
 *
 * @param url - The URL to analyze
 * @param strategy - 'mobile' or 'desktop' (default: 'mobile')
 * @param timeoutMs - Request timeout (default: 20s)
 * @returns CruxFieldData or null on failure
 */
export async function fetchCruxData(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
  timeoutMs: number = 20_000,
): Promise<CruxFieldData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiKey = process.env['GOOGLE_PSI_API_KEY'];
    const params = new URLSearchParams({
      url,
      strategy,
      category: 'performance',
    });
    if (apiKey) params.set('key', apiKey);

    const response = await fetch(`${PSI_BASE}?${params}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn({ status: response.status, url }, 'PSI API returned non-OK status');
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Extract CrUX field data from loadingExperience
    const loadingExperience = data['loadingExperience'] as Record<string, unknown> | undefined;
    const metrics = loadingExperience?.['metrics'] as Record<string, Record<string, unknown>> | undefined;
    const overallCategory = loadingExperience?.['overall_category'] as string | undefined;

    // Extract Lighthouse score
    const lighthouseResult = data['lighthouseResult'] as Record<string, unknown> | undefined;
    const categories = lighthouseResult?.['categories'] as Record<string, Record<string, unknown>> | undefined;
    const perfCategory = categories?.['performance'];
    const lighthouseScore = typeof perfCategory?.['score'] === 'number'
      ? Math.round((perfCategory['score'] as number) * 100)
      : null;

    // Determine if we have real CrUX field data
    const hasCruxData = metrics != null && overallCategory != null;

    // Safely extract origin — URL was already validated by the caller (runner),
    // but guard against edge cases where the string is malformed
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      origin = url;
    }

    // Build result
    const result: CruxFieldData = {
      origin,
      lcp: null,
      cls: null,
      inp: null,
      fcp: null,
      ttfb: null,
      formFactor: strategy === 'mobile' ? 'PHONE' : 'DESKTOP',
      collectionPeriod: null,
      lighthouseScore,
      source: hasCruxData ? 'crux' : 'psi-only',
    };

    // Parse CrUX metrics if available (page-level)
    if (metrics) {
      applyMetrics(result, metrics, true);
    }

    // Extract collection period from page-level data
    if (loadingExperience) {
      result.collectionPeriod = extractCollectionPeriod(loadingExperience);
    }

    // Fall back to origin-level data if page-level metrics are unavailable
    const originLoadingExp = data['originLoadingExperience'] as Record<string, unknown> | undefined;
    if (originLoadingExp) {
      const originMetrics = originLoadingExp['metrics'] as Record<string, Record<string, unknown>> | undefined;
      if (originMetrics && !metrics) {
        applyMetrics(result, originMetrics, false);
        result.source = 'crux';
        try { result.origin = new URL(url).origin; } catch { /* keep existing */ }
      }

      // Fall back to origin collection period if page-level wasn't available
      if (!result.collectionPeriod) {
        result.collectionPeriod = extractCollectionPeriod(originLoadingExp);
      }
    }

    logger.debug(
      {
        url,
        source: result.source,
        lighthouseScore: result.lighthouseScore,
        hasLcp: !!result.lcp,
        hasCls: !!result.cls,
        hasInp: !!result.inp,
        collectionPeriod: result.collectionPeriod,
      },
      'CrUX data fetched',
    );

    return result;
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      logger.warn({ url }, 'CrUX fetch timed out');
    } else {
      logger.warn({ url, error: err.message }, 'CrUX fetch failed');
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
