/**
 * Cloudflare Browser Rendering — single-page content API only.
 *
 * Renders a single URL via Cloudflare's /content endpoint (JS-rendered HTML).
 * Used by the sitemap-driven page discovery pipeline to render matched URLs.
 *
 * Env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 */
import pino from 'pino';

const logger = pino({ name: 'cloudflare-render' });

// ── Config ──────────────────────────────────────────────────────────────────

let _available: boolean | null = null;

export function isAvailable(): boolean {
  if (_available !== null) return _available;
  _available = !!(process.env['CLOUDFLARE_ACCOUNT_ID'] && process.env['CLOUDFLARE_API_TOKEN']);
  return _available;
}

function getConfig() {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']!;
  const apiToken = process.env['CLOUDFLARE_API_TOKEN']!;
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  return { apiToken, baseUrl };
}

function authHeaders(): Record<string, string> {
  const { apiToken } = getConfig();
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Fetch JS-rendered HTML for a single page via Cloudflare /content endpoint.
 * Returns null on failure.
 */
export async function fetchRenderedContent(url: string): Promise<string | null> {
  if (!isAvailable()) return null;

  const { baseUrl } = getConfig();

  try {
    const resp = await fetch(`${baseUrl}/browser-rendering/content`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        url,
        rejectResourceTypes: ['image', 'media', 'font'],
        gotoOptions: { waitUntil: 'domcontentloaded' },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) return null;

    const json = await resp.json() as { result?: string; success?: boolean };
    return json.result ?? null;
  } catch (error) {
    logger.debug({ url, error: (error as Error).message }, 'Cloudflare /content fetch failed');
    return null;
  }
}
