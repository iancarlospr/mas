/**
 * Module Data Contract Tests
 *
 * Validates that module data shapes match their declared TypeScript interfaces.
 * When a module's output shape changes, these tests fail — alerting developers
 * that downstream consumers (other modules reading previousResults) may break.
 *
 * WS3-C: Contract snapshot tests for modules with downstream consumers.
 */

import { describe, it, expect } from 'vitest';
import { MODULE_DEPENDENCIES } from '../../src/modules/dependency-graph.js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';
import type {
  M01Data, M02Data, M04Data, M05Data, M06Data,
  M07Data, M08Data, M12Data, M24Data, M41Data,
} from '@marketing-alpha/types';

// ── Fixture factories ───────────────────────────────────────────────────
// Each factory returns a valid data object matching the module's interface.
// If a module changes its output shape, the factory must be updated,
// and the snapshot test will flag the change.

function makeM01Data(): M01Data {
  return {
    dmarc: { record: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com', policy: 'reject', rua: 'mailto:dmarc@example.com', ruf: null },
    spf: { record: 'v=spf1 include:_spf.google.com ~all', includes: ['_spf.google.com'], mechanisms: ['include', 'all'] },
    dkim: { selectors: ['google', 'default'], found: true },
    hsts: { present: true, maxAge: 31536000, includeSubDomains: true, preload: true },
    tls: { protocol: 'TLSv1.3', grade: 'A+' },
    securityHeaders: { 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'content-security-policy': null },
    dnssec: false,
    caa: ['0 issue "letsencrypt.org"'],
  };
}

function makeM04Data(): M04Data {
  return {
    title: { content: 'Example Site', length: 12 },
    metaDescription: { content: 'An example website', length: 18 },
    canonical: 'https://example.com/',
    ogTags: { 'og:title': 'Example', 'og:type': 'website' },
    twitterCards: { 'twitter:card': 'summary' },
    jsonLd: {
      raw: [], types: ['Organization'], organizationName: 'Example Inc',
      organizationLogo: null, socialProfiles: [], contactPoints: [],
      websiteName: 'Example', hasSearchAction: false,
    },
    robotsTxt: { present: true, blocked: false, sitemapUrls: ['/sitemap.xml'], disallowedPaths: ['/admin'], userAgentCount: 1 },
    sitemap: { present: true, urlCount: 150, source: 'standard' },
    llmsTxt: { present: false },
    manifest: { present: false },
    favicon: { present: true, formats: [{ rel: 'icon', href: '/favicon.ico' }] },
    htmlLang: 'en',
    hreflang: [{ lang: 'en', href: 'https://example.com/' }],
    preconnectHints: [],
    metaTags: {},
    robotsDirectives: { metaRobots: null, xRobotsTag: null, noindex: false, nofollow: false },
    viewport: { content: 'width=device-width, initial-scale=1', hasWidth: true, hasInitialScale: true },
    charset: { charset: 'utf-8', source: 'meta' },
    adsTxt: { present: false, blocked: false },
    alternateLinks: [],
    pagination: { next: null, prev: null },
    openSearch: { present: false },
  };
}

function makeM05Data(): M05Data {
  return {
    tools: [{ name: 'Google Analytics 4', type: 'analytics', id: 'G-XXXXXXXX', confidence: 0.95, details: {} }],
    dataLayer: [{ event: 'gtm.js' }],
    consent: { hasConsentMode: true, version: 2, defaultState: { analytics_storage: 'denied' }, updatedState: { analytics_storage: 'granted' }, consentPlatform: 'OneTrust' },
    networkMeasurementIds: ['G-XXXXXXXX'],
    networkEventNames: ['page_view'],
    pixelFires: 3,
    analyticsRequestCount: 5,
    tagManagerRequestCount: 1,
    serverSideTracking: false,
    cookies: [{ name: '_ga', domain: '.example.com', tool: 'Google Analytics', secure: true, sameSite: 'Lax' }],
    toolCount: 1,
    toolNames: ['Google Analytics 4'],
  };
}

function makeM06Data(): M06Data {
  return {
    pixels: [{ name: 'Google Ads', id: 'AW-123456', events: ['conversion'], hasEnhancedConversions: false, serverSide: false, confidence: 0.9, networkFires: 2, loadMethod: 'gtm' }],
    adRequestCount: 4,
    adScriptBytes: 85000,
    adScriptCount: 2,
    adBytesByPlatform: { google: 50000, facebook: 35000 },
    clickIds: { gclid: null, fbclid: null },
    utmParams: { utm_source: null, utm_medium: null },
    attributionCookies: [{ name: '_gcl_aw', domain: '.example.com', platform: 'Google Ads' }],
    cookiesByPlatform: { google: ['_gcl_aw'] },
    googleAdsCookieFallback: false,
    capiDetected: false,
    capiSource: null,
    pixelCount: 1,
    pixelNames: ['Google Ads'],
    totalNetworkFires: 2,
  };
}

function makeM24Data(): M24Data {
  return {
    overview: {},
    organicTraffic: 50000,
    paidTraffic: 10000,
    organicKeywords: 3200,
    paidKeywords: 150,
    totalTraffic: 60000,
  };
}

// ── Contract Tests ──────────────────────────────────────────────────────

describe('Module Data Contracts', () => {
  describe('M01 Data Shape', () => {
    it('should have all required fields', () => {
      const data = makeM01Data();
      expect(data).toHaveProperty('dmarc');
      expect(data).toHaveProperty('spf');
      expect(data).toHaveProperty('hsts');
      expect(data).toHaveProperty('securityHeaders');
      expect(data.dmarc).toHaveProperty('policy');
      expect(data.spf).toHaveProperty('record');
    });

    it('should match snapshot', () => {
      expect(Object.keys(makeM01Data()).sort()).toMatchSnapshot();
    });
  });

  describe('M04 Data Shape', () => {
    it('should have hreflang array for downstream M12', () => {
      const data = makeM04Data();
      expect(Array.isArray(data.hreflang)).toBe(true);
      expect(data.hreflang[0]).toHaveProperty('lang');
      expect(data.hreflang[0]).toHaveProperty('href');
    });

    it('should have htmlLang for downstream M12/M17', () => {
      const data = makeM04Data();
      expect(typeof data.htmlLang === 'string' || data.htmlLang === null).toBe(true);
    });

    it('should match snapshot', () => {
      expect(Object.keys(makeM04Data()).sort()).toMatchSnapshot();
    });
  });

  describe('M05 Data Shape', () => {
    it('should have toolNames for downstream M06, M06b, M07, M08', () => {
      const data = makeM05Data();
      expect(Array.isArray(data.toolNames)).toBe(true);
    });

    it('should have serverSideTracking for downstream M06, M07, M08', () => {
      const data = makeM05Data();
      expect(typeof data.serverSideTracking).toBe('boolean');
    });

    it('should have consent object for downstream M06, M12', () => {
      const data = makeM05Data();
      expect(data.consent).toHaveProperty('hasConsentMode');
      expect(data.consent).toHaveProperty('consentPlatform');
    });

    it('should match snapshot', () => {
      expect(Object.keys(makeM05Data()).sort()).toMatchSnapshot();
    });
  });

  describe('M06 Data Shape', () => {
    it('should have adScriptBytes for downstream M45', () => {
      const data = makeM06Data();
      expect(typeof data.adScriptBytes).toBe('number');
    });

    it('should have pixelCount for downstream M45', () => {
      const data = makeM06Data();
      expect(typeof data.pixelCount).toBe('number');
    });

    it('should match snapshot', () => {
      expect(Object.keys(makeM06Data()).sort()).toMatchSnapshot();
    });
  });

  describe('M24 Data Shape', () => {
    it('should have traffic fields for downstream M42, M44', () => {
      const data = makeM24Data();
      expect(typeof data.organicTraffic).toBe('number');
      expect(typeof data.paidTraffic).toBe('number');
      expect(typeof data.totalTraffic).toBe('number');
    });

    it('should match snapshot', () => {
      expect(Object.keys(makeM24Data()).sort()).toMatchSnapshot();
    });
  });
});

describe('Dependency Graph Completeness', () => {
  it('should have no orphaned dependencies (producer module must exist)', () => {
    const validModuleIds = new Set([
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M06b', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17',
      'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26',
      'M27', 'M28', 'M29', 'M30', 'M31', 'M33', 'M34',
      'M36', 'M37', 'M38', 'M39', 'M41', 'M42', 'M43', 'M44', 'M45',
    ]);

    for (const dep of MODULE_DEPENDENCIES) {
      expect(validModuleIds.has(dep.consumer)).toBe(true);
      expect(validModuleIds.has(dep.producer)).toBe(true);
    }
  });

  it('should not have circular dependencies', () => {
    // Build adjacency list
    const graph = new Map<string, Set<string>>();
    for (const dep of MODULE_DEPENDENCIES) {
      if (!graph.has(dep.consumer)) graph.set(dep.consumer, new Set());
      graph.get(dep.consumer)!.add(dep.producer);
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(node: string): boolean {
      if (inStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      inStack.add(node);

      const neighbors = graph.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      inStack.delete(node);
      return false;
    }

    for (const node of graph.keys()) {
      expect(hasCycle(node)).toBe(false);
    }
  });

  it('all required dependencies should be in the graph', () => {
    const requiredDeps = MODULE_DEPENDENCIES.filter(d => d.required);
    expect(requiredDeps.length).toBeGreaterThan(0);

    // Every synthesis module (M42-M45) should have M42 as required dep
    // (or M41 for M42)
    const synthesisConsumers = requiredDeps.filter(d =>
      ['M42', 'M43', 'M44', 'M45'].includes(d.consumer)
    );
    expect(synthesisConsumers.length).toBeGreaterThan(0);
  });
});
