/**
 * M40 - Subdomain & Attack Surface Enumeration
 *
 * Discovers subdomains via Certificate Transparency (crt.sh) logs,
 * DNS-resolves them, and classifies sensitive exposure (dev, admin, CI/CD).
 *
 * Checkpoints:
 *   1. Subdomain count (info)
 *   2. Sensitive subdomain exposure (scored)
 *   3. Wildcard DNS detection (info)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { queryCertificateTransparency } from '../../services/crt.js';
import pino from 'pino';

const logger = pino({ name: 'm40-subdomain' });

// ── Constants ─────────────────────────────────────────────────────────────
const CT_MAX_RESULTS = 500;
const CT_TIMEOUT = 30_000;
const DNS_BATCH_SIZE = 20;
const MAX_RESOLVE_SUBDOMAINS = 100;
const WILDCARD_MIN_ALIVE = 5;
const WILDCARD_IP_THRESHOLD = 0.8;
const DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

// ── Subdomain classification patterns ──────────────────────────────────────

interface SubdomainEntry {
  subdomain: string;
  ips: string[];
  isAlive: boolean;
  classification: string;
  securitySeverity: 'critical' | 'warning' | 'info';
  httpStatus?: number | null;
  pageTitle?: string | null;
  serverHeader?: string | null;
  redirectsTo?: string | null;
}

const CRITICAL_PATTERNS = [
  /^dev\b/i, /^admin\b/i, /^jenkins\b/i, /^gitlab\b/i, /^ci\b/i, /^cd\b/i,
  /^ci-cd\b/i, /^deploy\b/i, /^internal\b/i, /^mgmt\b/i, /^management\b/i,
  /^debug\b/i, /^root\b/i, /^ssh\b/i, /^console\b/i, /^grafana\b/i,
  /^prometheus\b/i, /^kibana\b/i, /^elastic\b/i, /^phpmyadmin\b/i,
  /^adminer\b/i, /^sonarqube\b/i, /^artifactory\b/i, /^nexus\b/i,
  /^vault\b/i, /^docker\b/i, /^k8s\b/i, /^kubernetes\b/i, /^rancher\b/i,
  /^portainer\b/i, /^traefik\b/i, /^db\b/i, /^database\b/i, /^mysql\b/i,
  /^postgres\b/i, /^redis\b/i, /^mongo\b/i, /^backup\b/i, /^ftp\b/i, /^git\b/i,
];

const WARNING_PATTERNS = [
  /^staging\b/i, /^stage\b/i, /^test\b/i, /^qa\b/i, /^uat\b/i,
  /^api-internal\b/i, /^vpn\b/i, /^preview\b/i, /^sandbox\b/i,
  /^demo\b/i, /^beta\b/i, /^preprod\b/i, /^pre-prod\b/i, /^canary\b/i,
];

const INFO_PATTERNS = [
  /^blog\b/i, /^docs\b/i, /^help\b/i, /^mail\b/i, /^www\b/i,
  /^api\b/i, /^cdn\b/i, /^static\b/i, /^assets\b/i, /^app\b/i,
  /^shop\b/i, /^store\b/i, /^support\b/i, /^status\b/i,
];

/**
 * Extract the subdomain prefix by stripping the apex domain suffix.
 * Uses string.endsWith + slice for correctness instead of non-anchored replace.
 */
function classifySubdomain(subdomain: string, apexDomain: string): { classification: string; severity: SubdomainEntry['securitySeverity'] } {
  // Extract prefix: everything before ".apexDomain"
  let prefix: string;
  if (subdomain === apexDomain) {
    return { classification: 'apex', severity: 'info' };
  } else if (subdomain.endsWith(`.${apexDomain}`)) {
    prefix = subdomain.slice(0, -(apexDomain.length + 1));
  } else {
    prefix = subdomain;
  }

  if (!prefix) return { classification: 'apex', severity: 'info' };

  // Test the first label of the prefix against classification patterns
  const firstLabel = prefix.split('.')[0] ?? prefix;

  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(firstLabel)) return { classification: firstLabel, severity: 'critical' };
  }
  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(firstLabel)) return { classification: firstLabel, severity: 'warning' };
  }
  for (const pattern of INFO_PATTERNS) {
    if (pattern.test(firstLabel)) return { classification: firstLabel, severity: 'info' };
  }

  return { classification: 'other', severity: 'info' };
}

/**
 * Batch DNS resolve subdomains — resolves in batches to avoid flooding.
 * Includes a small inter-batch delay for DNS rate limit safety.
 */
async function batchResolve(
  subdomains: string[],
): Promise<Map<string, string[]>> {
  const { Resolver } = await import('node:dns/promises');
  const resolver = new Resolver();
  resolver.setServers(DNS_SERVERS);

  const results = new Map<string, string[]>();

  for (let i = 0; i < subdomains.length; i += DNS_BATCH_SIZE) {
    const batch = subdomains.slice(i, i + DNS_BATCH_SIZE);
    const promises = batch.map(async (subdomain) => {
      try {
        const ips = await resolver.resolve4(subdomain);
        results.set(subdomain, ips);
      } catch {
        results.set(subdomain, []);
      }
    });
    await Promise.allSettled(promises);

    // Small inter-batch delay to avoid DNS rate limiting
    if (i + DNS_BATCH_SIZE < subdomains.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

/**
 * Confirm wildcard DNS by probing a random non-existent subdomain.
 * If a random gibberish subdomain resolves, the domain has wildcard DNS.
 * This avoids false positives from CDN-fronted domains where real subdomains
 * (www, api, blog) all legitimately resolve to the same CDN IP.
 */
async function confirmWildcard(apexDomain: string, suspectedIp: string): Promise<boolean> {
  const { Resolver } = await import('node:dns/promises');
  const resolver = new Resolver();
  resolver.setServers(DNS_SERVERS);

  // Generate a random subdomain that definitely doesn't exist
  const randomPrefix = `xzq-wildcard-probe-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const ips = await resolver.resolve4(`${randomPrefix}.${apexDomain}`);
    // If the random subdomain resolves (especially to the suspected IP), it's wildcard
    return ips.length > 0 && ips.includes(suspectedIp);
  } catch {
    // NXDOMAIN — no wildcard DNS, the IP frequency was just CDN/LB convergence
    return false;
  }
}

// ── Module executor ────────────────────────────────────────────────────────

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  // Extract apex domain
  const hostname = new URL(ctx.url).hostname;
  const apexDomain = hostname.replace(/^www\./, '');

  try {
    // Step 1: Query Certificate Transparency
    logger.debug({ domain: apexDomain }, 'Querying Certificate Transparency logs');
    const ctResult = await queryCertificateTransparency(apexDomain, CT_MAX_RESULTS, CT_TIMEOUT);

    if (ctResult.error && ctResult.subdomains.length === 0) {
      checkpoints.push(infoCheckpoint(
        'm40-count', 'Subdomain Enumeration',
        `Certificate Transparency query failed: ${ctResult.error}`,
      ));
      return {
        moduleId: 'M40' as ModuleId,
        status: 'partial',
        data,
        signals,
        score: null,
        checkpoints,
        duration: 0,
      };
    }

    data.totalDiscovered = ctResult.subdomains.length;
    logger.debug({ domain: apexDomain, discovered: ctResult.subdomains.length }, 'CT query complete');

    // Step 2: DNS-resolve top subdomains
    const toResolve = ctResult.subdomains.slice(0, MAX_RESOLVE_SUBDOMAINS);
    logger.debug({ count: toResolve.length }, 'Starting batch DNS resolution');
    const dnsResults = await batchResolve(toResolve);

    // Step 3: Classify each subdomain
    const subdomainEntries: SubdomainEntry[] = [];
    for (const subdomain of toResolve) {
      const ips = dnsResults.get(subdomain) ?? [];
      const { classification, severity } = classifySubdomain(subdomain, apexDomain);
      subdomainEntries.push({
        subdomain,
        ips,
        isAlive: ips.length > 0,
        classification,
        securitySeverity: severity,
      });
    }

    const aliveCount = subdomainEntries.filter(e => e.isAlive).length;
    const deadCount = subdomainEntries.filter(e => !e.isAlive).length;

    logger.debug({ alive: aliveCount, dead: deadCount }, 'DNS resolution complete');

    // Step 2.5: HTTP probe alive subdomains (up to 20, batches of 5)
    const aliveToProbe = subdomainEntries.filter(e => e.isAlive).slice(0, 20);
    const HTTP_PROBE_BATCH = 5;
    const HTTP_PROBE_TIMEOUT = 5_000;

    for (let i = 0; i < aliveToProbe.length; i += HTTP_PROBE_BATCH) {
      const batch = aliveToProbe.slice(i, i + HTTP_PROBE_BATCH);
      await Promise.allSettled(batch.map(async (entry) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), HTTP_PROBE_TIMEOUT);
          const res = await fetch(`https://${entry.subdomain}`, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingAlphaScan/1.0)' },
          });
          clearTimeout(timer);

          entry.httpStatus = res.status;
          entry.serverHeader = res.headers.get('server') ?? null;
          entry.redirectsTo = res.headers.get('location') ?? null;

          // Extract page title from body (only for 200 responses, limited read)
          if (res.status === 200) {
            try {
              const body = await res.text();
              const titleMatch = body.slice(0, 10_000).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
              entry.pageTitle = titleMatch?.[1]?.trim().slice(0, 100) ?? null;
            } catch {
              entry.pageTitle = null;
            }
          }
        } catch {
          // Probe failed — subdomain may not serve HTTPS
          entry.httpStatus = null;
        }
      }));
    }

    logger.debug({ probed: aliveToProbe.length }, 'HTTP probing complete');

    data.subdomains = subdomainEntries;

    // Step 4: Detect wildcard DNS — two-stage approach:
    //   a) Check if >80% of alive subdomains resolve to the same IP (heuristic)
    //   b) Confirm by probing a random non-existent subdomain (avoids CDN false positives)
    const aliveSubdomains = subdomainEntries.filter(e => e.isAlive);
    let wildcardDetected = false;
    let wildcardIp: string | null = null;

    if (aliveSubdomains.length >= WILDCARD_MIN_ALIVE) {
      const ipCounts = new Map<string, number>();
      for (const entry of aliveSubdomains) {
        for (const ip of entry.ips) {
          ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
        }
      }

      // Find the most common IP
      for (const [ip, count] of ipCounts) {
        if (count / aliveSubdomains.length > WILDCARD_IP_THRESHOLD) {
          // Stage 2: Confirm with random probe to avoid CDN/LB false positives
          const confirmed = await confirmWildcard(apexDomain, ip);
          if (confirmed) {
            wildcardDetected = true;
            wildcardIp = ip;
          }
          break;
        }
      }
    }

    data.wildcardDetected = wildcardDetected;
    data.wildcardIp = wildcardIp;

    // ── Checkpoint 1: Count (info) ────────────────────────────────────────
    checkpoints.push(infoCheckpoint(
      'm40-count', 'Subdomain Enumeration',
      `${ctResult.subdomains.length} unique subdomains found via CT logs, ${aliveCount} alive, ${deadCount} dead`,
    ));

    // ── Checkpoint 2: Sensitive exposure (scored) ─────────────────────────
    const criticalExposed = subdomainEntries.filter(
      e => e.isAlive && e.securitySeverity === 'critical',
    );
    const warningExposed = subdomainEntries.filter(
      e => e.isAlive && e.securitySeverity === 'warning',
    );

    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (criticalExposed.length > 0) {
        health = 'critical';
        evidence = `${criticalExposed.length} critical subdomain(s) exposed: ${criticalExposed.slice(0, 5).map(e => e.subdomain).join(', ')}`;
        recommendation = 'Critical: dev/admin/CI subdomains are publicly accessible. Restrict access via VPN, IP allowlists, or remove DNS records.';
      } else if (warningExposed.length > 0) {
        health = 'warning';
        evidence = `${warningExposed.length} staging/test subdomain(s) exposed: ${warningExposed.slice(0, 5).map(e => e.subdomain).join(', ')}`;
        recommendation = 'Consider restricting access to staging/test environments to prevent information disclosure.';
      } else {
        health = 'excellent';
        evidence = `No sensitive subdomains (dev/admin/staging) found publicly accessible among ${aliveCount} alive subdomains`;
      }

      checkpoints.push(createCheckpoint({
        id: 'm40-sensitive-exposure',
        name: 'Sensitive Subdomain Exposure',
        weight: 0.6,
        health,
        evidence,
        recommendation,
      }));
    }

    // ── Checkpoint 3: Wildcard DNS (info) ─────────────────────────────────
    if (wildcardDetected) {
      checkpoints.push(infoCheckpoint(
        'm40-wildcard', 'Wildcard DNS',
        `Wildcard DNS confirmed — random probe resolved to ${wildcardIp} (${aliveSubdomains.length} subdomains share this IP)`,
      ));
    }

    // Signal: attack surface size
    signals.push(createSignal({
      type: 'attack_surface',
      name: 'Subdomain Count',
      confidence: 0.85,
      evidence: `${ctResult.subdomains.length} subdomains from CT, ${aliveCount} alive, ${criticalExposed.length} critical, ${warningExposed.length} warning`,
      category: 'security',
    }));

  } catch (error) {
    return {
      moduleId: 'M40' as ModuleId,
      status: 'error',
      data,
      signals,
      score: null,
      checkpoints,
      duration: 0,
      error: (error as Error).message,
    };
  }

  return {
    moduleId: 'M40' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M40' as ModuleId, execute);
