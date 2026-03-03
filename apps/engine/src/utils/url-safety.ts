/**
 * SSRF protection — blocks requests to private networks, cloud metadata,
 * and reserved hostnames. Used by fetchWithRetry, probeUrl, and browser navigation.
 */
import { lookup } from 'node:dns/promises';
import pino from 'pino';

const logger = pino({ name: 'url-safety' });

/** Private/reserved IPv4 CIDR ranges */
const PRIVATE_IPV4_PATTERNS = [
  /^127\./,                   // 127.0.0.0/8 (loopback)
  /^10\./,                    // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 (private)
  /^192\.168\./,              // 192.168.0.0/16 (private)
  /^169\.254\./,              // 169.254.0.0/16 (link-local / cloud metadata)
  /^0\./,                     // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // 100.64.0.0/10 (CGNAT)
  /^198\.1[89]\./,            // 198.18.0.0/15 (benchmarking)
  /^240\./,                   // 240.0.0.0/4 (reserved)
];

/** Private/reserved IPv6 patterns */
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/,                    // loopback
  /^fe80:/i,                  // link-local
  /^fc/i,                     // unique local (fc00::/7)
  /^fd/i,                     // unique local
  /^::$/,                     // unspecified
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/i, // IPv4-mapped
];

/** Blocked hostnames (case-insensitive) */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
]);

/** Blocked hostname suffixes */
const BLOCKED_HOSTNAME_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.test',
  '.invalid',
  '.example',
];

/** Ports that should never be accessed during scanning */
const BLOCKED_PORTS = new Set([
  6379,  // Redis
  27017, // MongoDB
  5432,  // PostgreSQL
  3306,  // MySQL
  11211, // Memcached
  9200,  // Elasticsearch
  2379,  // etcd
]);

function isPrivateIPv4(ip: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(ip));
}

function isPrivateIPv6(ip: string): boolean {
  return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(ip));
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Validate a URL is safe to fetch (no private IPs, no cloud metadata, no reserved hosts).
 * Throws if the URL targets a private/reserved network.
 *
 * This is a synchronous hostname-only check (no DNS). Use `assertUrlSafeWithDns`
 * for the full check including DNS resolution.
 */
export function assertUrlSafe(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[ssrf] Invalid URL: ${url}`);
  }

  const hostname = parsed.hostname;

  // Block reserved hostnames
  if (isBlockedHostname(hostname)) {
    throw new Error(`[ssrf] Blocked hostname: ${hostname}`);
  }

  // Block raw IP addresses in private ranges
  // Strip IPv6 brackets if present
  const cleanHost = hostname.replace(/^\[|\]$/g, '');
  if (isPrivateIP(cleanHost)) {
    throw new Error(`[ssrf] Blocked private IP: ${hostname}`);
  }

  // Block dangerous ports
  if (parsed.port && BLOCKED_PORTS.has(Number(parsed.port))) {
    throw new Error(`[ssrf] Blocked port: ${parsed.port}`);
  }
}

/**
 * Full SSRF check including DNS resolution.
 * Resolves the hostname and verifies the IP isn't private (prevents DNS rebinding).
 *
 * Use this before HTTP fetches. For browser navigation, use `assertUrlSafe` (sync)
 * since the browser handles its own DNS.
 */
export async function assertUrlSafeWithDns(url: string): Promise<void> {
  // First do the sync checks
  assertUrlSafe(url);

  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  // Skip DNS check for raw IPs (already validated above)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return;
  if (hostname.includes(':')) return; // IPv6

  // Resolve and verify
  try {
    const { address } = await lookup(hostname);
    if (isPrivateIP(address)) {
      logger.warn({ url, hostname, resolvedIp: address }, 'DNS rebinding blocked');
      throw new Error(`[ssrf] DNS rebinding: ${hostname} resolves to private IP ${address}`);
    }
  } catch (err) {
    // Re-throw our own errors
    if (err instanceof Error && err.message.startsWith('[ssrf]')) throw err;
    // DNS resolution failure — allow the fetch to fail naturally
    logger.debug({ url, hostname, error: (err as Error).message }, 'DNS lookup failed, allowing fetch to proceed');
  }
}
