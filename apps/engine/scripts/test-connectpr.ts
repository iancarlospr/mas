import { execute } from '../src/modules/external/m21-ad-library.js';
import type { ModuleContext } from '../src/modules/types.js';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';

// Simulate M15 providing the real Facebook slug
const fakeM15: ModuleResult = {
  moduleId: 'M15' as ModuleId,
  status: 'success',
  data: {
    socialData: {
      sameAsLinks: ['https://www.facebook.com/connectassistancepr'],
    },
  },
  signals: [],
  score: null,
  checkpoints: [],
  duration: 0,
};

const previousResults = new Map<string, ModuleResult>();
previousResults.set('M15', fakeM15);

const ctx: ModuleContext = {
  url: 'https://connect.pr',
  scanId: `test-connectpr-${Date.now()}`,
  tier: 'paid',
  html: null, headers: {}, page: null, networkCollector: null,
  consoleCollector: null, storageSnapshot: null, frameSnapshot: null,
  domForensics: null, inlineConfigs: null, cookieAnalysis: null,
  formSnapshot: null, contentAnalysis: null, imageAudit: null,
  linkAnalysis: null, navigatorSnapshot: null, redirectChain: [],
  finalUrl: 'https://connect.pr', browserRedirectChains: [],
  mixedContent: null, cruxData: null, mobileMetrics: null,
  previousResults,
};

const r = await execute(ctx);
const fb = (r.data as any).facebook;
const g = (r.data as any).google;
console.log('\n=== RESULTS ===');
console.log('FB search:', fb?.searchSuccessful, '| ads:', fb?.totalAdsVisible, '| screenshot:', !!fb?.screenshot, '| extracted:', fb?.ads?.length);
console.log('G  search:', g?.searchSuccessful, '| ads:', g?.totalAdsVisible, '| screenshot:', !!g?.screenshot);
