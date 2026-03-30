/**
 * Certificate Transparency (crt.sh) Service
 *
 * Queries the crt.sh API to discover subdomains from publicly-issued
 * TLS certificates. This reveals the complete attack surface of a domain
 * including dev, staging, and admin subdomains that may be exposed.
 */

import pino from 'pino';

const logger = pino({ name: 'crt-service' });

export interface CrtEntry {
  issuerCaId: number;
  issuerName: string;
  commonName: string;
  nameValue: string;
  notBefore: string;
  notAfter: string;
}

export interface CrtResult {
  subdomains: string[];
  rawEntries: CrtEntry[];
  error: string | null;
}

/**
 * Query Certificate Transparency logs via crt.sh for subdomains.
 *
 * @param domain - The apex domain to search (e.g., "example.com")
 * @param maxResults - Maximum unique subdomains to return (default: 500)
 * @param timeoutMs - Request timeout (default: 15s)
 */
export async function queryCertificateTransparency(
  domain: string,
  maxResults: number = 500,
  timeoutMs: number = 15_000,
): Promise<CrtResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)',
        },
      },
    );

    if (!response.ok) {
      return {
        subdomains: [],
        rawEntries: [],
        error: `crt.sh returned ${response.status}`,
      };
    }

    const entries = (await response.json()) as Array<Record<string, unknown>>;

    if (!Array.isArray(entries)) {
      return { subdomains: [], rawEntries: [], error: 'Invalid response format' };
    }

    // Parse entries and extract unique subdomains
    const subdomainSet = new Set<string>();
    const rawEntries: CrtEntry[] = [];

    for (const entry of entries) {
      const nameValue = (entry['name_value'] as string) ?? '';
      const commonName = (entry['common_name'] as string) ?? '';

      // Parse nameValue — may contain multiple names separated by newlines
      const names = nameValue.split('\n').map(n => n.trim().toLowerCase()).filter(Boolean);
      names.push(commonName.toLowerCase());

      for (let name of names) {
        // Strip wildcard prefix
        if (name.startsWith('*.')) {
          name = name.slice(2);
        }

        // Must be a subdomain of the target domain
        if (name === domain || name.endsWith(`.${domain}`)) {
          subdomainSet.add(name);
        }
      }

      // Keep raw entries (capped)
      if (rawEntries.length < 100) {
        rawEntries.push({
          issuerCaId: (entry['issuer_ca_id'] as number) ?? 0,
          issuerName: (entry['issuer_name'] as string) ?? '',
          commonName,
          nameValue,
          notBefore: (entry['not_before'] as string) ?? '',
          notAfter: (entry['not_after'] as string) ?? '',
        });
      }
    }

    // Convert to sorted array, capped at maxResults
    const subdomains = [...subdomainSet].sort().slice(0, maxResults);

    logger.debug(
      { domain, totalEntries: entries.length, uniqueSubdomains: subdomains.length },
      'Certificate Transparency query completed',
    );

    return { subdomains, rawEntries, error: null };
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      return { subdomains: [], rawEntries: [], error: `crt.sh request timed out after ${timeoutMs}ms` };
    }
    return { subdomains: [], rawEntries: [], error: err.message };
  } finally {
    clearTimeout(timer);
  }
}
