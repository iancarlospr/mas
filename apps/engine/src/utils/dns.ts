import { Resolver } from 'node:dns/promises';
import pino from 'pino';

const logger = pino({ name: 'dns-util' });

const resolver = new Resolver();
// Use Google and Cloudflare DNS
resolver.setServers(['8.8.8.8', '1.1.1.1']);

export interface DnsRecords {
  A: string[];
  AAAA: string[];
  MX: Array<{ exchange: string; priority: number }>;
  NS: string[];
  TXT: string[][];
  CNAME: string[];
  SOA: {
    nsname: string;
    hostmaster: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minttl: number;
  } | null;
  CAA: Array<{ critical: number; iodef?: string; issue?: string; issuewild?: string }>;
}

/**
 * Resolves all standard DNS record types for a given domain.
 * Each record type resolution is independent -- failures in one
 * type do not affect others.
 */
export async function resolveAllRecords(domain: string): Promise<DnsRecords> {
  const results: DnsRecords = {
    A: [],
    AAAA: [],
    MX: [],
    NS: [],
    TXT: [],
    CNAME: [],
    SOA: null,
    CAA: [],
  };

  const tasks = [
    resolveA(domain).then((r) => { results.A = r; }),
    resolveAAAA(domain).then((r) => { results.AAAA = r; }),
    resolveMX(domain).then((r) => { results.MX = r; }),
    resolveNS(domain).then((r) => { results.NS = r; }),
    resolveTXT(domain).then((r) => { results.TXT = r; }),
    resolveCNAME(domain).then((r) => { results.CNAME = r; }),
    resolveSOA(domain).then((r) => { results.SOA = r; }),
    resolveCAA(domain).then((r) => { results.CAA = r; }),
  ];

  await Promise.allSettled(tasks);

  return results;
}

async function resolveA(domain: string): Promise<string[]> {
  try {
    return await resolver.resolve4(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve A records');
    return [];
  }
}

async function resolveAAAA(domain: string): Promise<string[]> {
  try {
    return await resolver.resolve6(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve AAAA records');
    return [];
  }
}

async function resolveMX(domain: string): Promise<Array<{ exchange: string; priority: number }>> {
  try {
    return await resolver.resolveMx(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve MX records');
    return [];
  }
}

async function resolveNS(domain: string): Promise<string[]> {
  try {
    return await resolver.resolveNs(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve NS records');
    return [];
  }
}

async function resolveTXT(domain: string): Promise<string[][]> {
  try {
    return await resolver.resolveTxt(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve TXT records');
    return [];
  }
}

async function resolveCNAME(domain: string): Promise<string[]> {
  try {
    return await resolver.resolveCname(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve CNAME records');
    return [];
  }
}

async function resolveSOA(domain: string): Promise<DnsRecords['SOA']> {
  try {
    return await resolver.resolveSoa(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve SOA record');
    return null;
  }
}

async function resolveCAA(domain: string): Promise<DnsRecords['CAA']> {
  try {
    return await resolver.resolveCaa(domain);
  } catch (error) {
    logger.debug({ domain, error: (error as Error).message }, 'Failed to resolve CAA records');
    return [];
  }
}

/**
 * Check if a domain has SPF records in its TXT records.
 */
export function findSpfRecord(txtRecords: string[][]): string | null {
  for (const parts of txtRecords) {
    const full = parts.join('');
    if (full.startsWith('v=spf1')) {
      return full;
    }
  }
  return null;
}

/**
 * Check if a domain has DMARC records by querying _dmarc subdomain.
 */
export async function resolveDmarc(domain: string): Promise<string | null> {
  try {
    const records = await resolver.resolveTxt(`_dmarc.${domain}`);
    for (const parts of records) {
      const full = parts.join('');
      if (full.startsWith('v=DMARC1')) {
        return full;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a domain has DKIM records for common selectors.
 */
export async function probeDkim(
  domain: string,
  selectors: string[] = ['default', 'google', 'selector1', 'selector2', 'k1', 's1', 's2', 'mail'],
): Promise<Array<{ selector: string; record: string }>> {
  const results: Array<{ selector: string; record: string }> = [];

  const tasks = selectors.map(async (selector) => {
    try {
      const records = await resolver.resolveTxt(`${selector}._domainkey.${domain}`);
      for (const parts of records) {
        const full = parts.join('');
        if (full.includes('v=DKIM1') || full.includes('p=')) {
          results.push({ selector, record: full });
        }
      }
    } catch {
      // Expected for most selectors
    }
  });

  await Promise.allSettled(tasks);
  return results;
}
