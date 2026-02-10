import { parse as parseDomain } from 'tldts';

export interface ParsedDomain {
  hostname: string;
  domain: string | null;
  subdomain: string | null;
  publicSuffix: string | null;
  isIp: boolean;
  isPrivate: boolean;
}

/**
 * Normalize a URL to a consistent format.
 * Ensures https://, strips trailing slashes, lowercases hostname.
 */
export function normalizeUrl(input: string): string {
  let url = input.trim();

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Force https
    parsed.protocol = 'https:';
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove default port
    parsed.port = '';

    let normalized = parsed.toString();
    // Remove trailing slash for root paths
    if (parsed.pathname === '/') {
      normalized = normalized.replace(/\/$/, '');
    }

    return normalized;
  } catch {
    // If URL parsing fails, return the cleaned input
    return url;
  }
}

/**
 * Extract domain information using tldts.
 */
export function extractDomain(url: string): ParsedDomain {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const result = parseDomain(hostname);

  return {
    hostname,
    domain: result.domain ?? null,
    subdomain: result.subdomain ?? null,
    publicSuffix: result.publicSuffix ?? null,
    isIp: result.isIp ?? false,
    isPrivate: result.isPrivate ?? false,
  };
}

/**
 * Get the registrable domain (e.g., "example.com" from "www.sub.example.com").
 */
export function getRegistrableDomain(url: string): string | null {
  const parsed = extractDomain(url);
  return parsed.domain;
}

/**
 * Check if two URLs share the same registrable domain.
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = getRegistrableDomain(url1);
  const domain2 = getRegistrableDomain(url2);
  if (!domain1 || !domain2) return false;
  return domain1 === domain2;
}

/**
 * Build a set of common path probes to check on a domain.
 */
export function buildProbeUrls(
  baseUrl: string,
  paths: string[],
): string[] {
  const base = normalizeUrl(baseUrl);
  return paths.map((path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  });
}

/**
 * Common paths to probe for various module detections.
 */
export const COMMON_PROBE_PATHS = {
  robots: '/robots.txt',
  sitemap: '/sitemap.xml',
  securityTxt: '/.well-known/security.txt',
  humansTxt: '/humans.txt',
  adsTxt: '/ads.txt',
  appAdsTxt: '/app-ads.txt',
  wellKnownChange: '/.well-known/change-password',
  favicon: '/favicon.ico',
  llmsTxt: '/llms.txt',
  privacyPolicy: '/privacy',
  termsOfService: '/terms',
  careers: '/careers',
  pricing: '/pricing',
  press: '/press',
  investors: '/investors',
  support: '/support',
  blog: '/blog',
  rss: '/rss',
  feed: '/feed',
} as const;

/**
 * Probe a URL and check if it returns a successful response.
 * Returns the response body if successful, null otherwise.
 */
export async function probeUrl(
  url: string,
  timeoutMs: number = 5_000,
): Promise<{ exists: boolean; status: number; body?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MarketingAlphaScan/1.0 (+https://marketingalphascan.com)',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (response.ok) {
      const body = await response.text();
      return { exists: true, status: response.status, body };
    }

    return { exists: false, status: response.status };
  } catch {
    return { exists: false, status: 0 };
  }
}
