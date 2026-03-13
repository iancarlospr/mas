export interface NetworkEntry {
  url: string;
  method: string;
  resourceType: string;
  category: string;
  mimeType?: string;
  responseSize?: number;
  startTime: number;
  duration: number;
  status: number;
}

export interface MockNetworkCollector {
  entries: NetworkEntry[];
  getByCategory: (category: string) => NetworkEntry[];
  getByDomain: (domain: string) => NetworkEntry[];
  getByPattern: (pattern: RegExp) => NetworkEntry[];
  getByMimeType: (mime: string) => NetworkEntry[];
  getTotalSize: () => number;
  getTimeline: () => NetworkEntry[];
}

export function createMockNetworkCollector(
  entries: NetworkEntry[] = [],
): MockNetworkCollector {
  return {
    entries,
    getByCategory: (category: string) => entries.filter((e) => e.category === category),
    getByDomain: (domain: string) =>
      entries.filter((e) => new URL(e.url).hostname.includes(domain)),
    getByPattern: (pattern: RegExp) => entries.filter((e) => pattern.test(e.url)),
    getByMimeType: (mime: string) => entries.filter((e) => e.mimeType?.includes(mime)),
    getTotalSize: () => entries.reduce((sum, e) => sum + (e.responseSize || 0), 0),
    getTimeline: () => [...entries].sort((a, b) => a.startTime - b.startTime),
  };
}

/** Fixture: site running Google Analytics + Facebook Pixel */
export const GA_FB_NETWORK_FIXTURE: NetworkEntry[] = [
  {
    url: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX',
    method: 'GET',
    resourceType: 'script',
    category: 'analytics',
    mimeType: 'application/javascript',
    responseSize: 84_230,
    startTime: 150,
    duration: 45,
    status: 200,
  },
  {
    url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXXXXXX',
    method: 'POST',
    resourceType: 'xhr',
    category: 'analytics',
    mimeType: 'text/plain',
    responseSize: 0,
    startTime: 320,
    duration: 12,
    status: 204,
  },
  {
    url: 'https://connect.facebook.net/en_US/fbevents.js',
    method: 'GET',
    resourceType: 'script',
    category: 'advertising',
    mimeType: 'application/javascript',
    responseSize: 62_100,
    startTime: 180,
    duration: 38,
    status: 200,
  },
  {
    url: 'https://www.facebook.com/tr/?id=123456789&ev=PageView',
    method: 'GET',
    resourceType: 'image',
    category: 'advertising',
    mimeType: 'image/gif',
    responseSize: 44,
    startTime: 350,
    duration: 22,
    status: 200,
  },
];
