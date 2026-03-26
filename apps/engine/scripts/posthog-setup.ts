/**
 * PostHog Setup Script — Beta Launch Analytics
 *
 * Creates cohorts, dashboards (with insights), and feature flags
 * via the PostHog REST API. Idempotent — checks for existing items
 * by name before creating.
 *
 * Usage: npx tsx --env-file=.env scripts/posthog-setup.ts
 *
 * Required env vars:
 *   POSTHOG_PERSONAL_API_KEY — Personal API key from PostHog settings
 *   POSTHOG_PROJECT_ID       — Project ID (number in PostHog URL)
 */

const BASE_URL = 'https://us.posthog.com/api';
const API_KEY = process.env['POSTHOG_PERSONAL_API_KEY'];
const PROJECT_ID = process.env['POSTHOG_PROJECT_ID'];

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID in .env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
}

async function listAll<T>(path: string): Promise<T[]> {
  const data = await api<PaginatedResponse<T>>('GET', path);
  return data.results;
}

async function findByName<T extends { name: string }>(
  path: string,
  name: string,
): Promise<T | undefined> {
  const items = await listAll<T>(path);
  return items.find((i) => i.name === name);
}

// ─── Cohort Definitions ──────────────────────────────────────────────────────

interface CohortDef {
  name: string;
  description: string;
  groups: unknown[];
}

const COHORT_DEFS: CohortDef[] = [
  {
    name: 'Beta Invitees',
    description: 'All beta testers who redeemed an invite code',
    groups: [
      {
        properties: [
          { key: 'beta_invitee', value: ['true'], type: 'person', operator: 'exact' },
        ],
      },
    ],
  },
  {
    name: 'Converted Beta',
    description: 'Beta testers who completed a payment',
    groups: [
      {
        properties: [
          { key: 'beta_invitee', value: ['true'], type: 'person', operator: 'exact' },
        ],
        event_id: 'payment_completed',
        action_id: null,
      },
    ],
  },
  {
    name: 'Active Beta',
    description: 'Beta testers who scanned in last 7 days',
    groups: [
      {
        properties: [
          { key: 'beta_invitee', value: ['true'], type: 'person', operator: 'exact' },
        ],
        event_id: 'scan_started',
        action_id: null,
        days: 7,
      },
    ],
  },
  {
    name: 'Chat-Active Beta',
    description: 'Beta testers who used AI chat',
    groups: [
      {
        properties: [
          { key: 'beta_invitee', value: ['true'], type: 'person', operator: 'exact' },
        ],
        event_id: 'chat_message_sent',
        action_id: null,
      },
    ],
  },
  {
    name: 'Dormant Beta',
    description: 'Beta testers with no activity in 14 days',
    groups: [
      {
        properties: [
          { key: 'beta_invitee', value: ['true'], type: 'person', operator: 'exact' },
        ],
        event_id: '$pageview',
        action_id: null,
        days: 14,
        count: 0,
        count_operator: 'eq',
      },
    ],
  },
  {
    name: 'High-Intent Free',
    description: 'Users who started checkout but never paid',
    groups: [
      {
        event_id: 'checkout_started',
        action_id: null,
        properties: [
          { key: 'tier', value: ['paid'], type: 'person', operator: 'is_not' },
        ],
      },
    ],
  },
];

// ─── Insight Builders ────────────────────────────────────────────────────────

type InsightConfig = {
  name: string;
  query: Record<string, unknown>;
};

function trendInsight(
  name: string,
  events: { id: string; math?: string; math_property?: string; properties?: unknown[] }[],
  opts: {
    display?: string;
    breakdown?: string;
    breakdown_type?: string;
    date_from?: string;
    interval?: string;
    formula?: string;
    filter_test_accounts?: boolean;
    properties?: unknown[];
  } = {},
): InsightConfig {
  const series = events.map((e) => ({
    kind: 'EventsNode',
    event: e.id,
    math: e.math ?? 'total',
    ...(e.math_property ? { math_property: e.math_property } : {}),
    ...(e.properties ? { properties: e.properties } : {}),
  }));

  return {
    name,
    query: {
      kind: 'TrendsQuery',
      series,
      dateRange: { date_from: opts.date_from ?? '-30d' },
      interval: opts.interval ?? 'day',
      ...(opts.breakdown
        ? {
            breakdownFilter: {
              breakdowns: [
                {
                  property: opts.breakdown,
                  type: opts.breakdown_type ?? 'event',
                },
              ],
            },
          }
        : {}),
      ...(opts.display ? { trendsFilter: { display: opts.display } } : {}),
      ...(opts.formula ? { trendsFilter: { formula: opts.formula } } : {}),
      ...(opts.properties ? { properties: opts.properties } : {}),
      filterTestAccounts: opts.filter_test_accounts ?? false,
    },
  };
}

function funnelInsight(
  name: string,
  steps: string[],
  opts: {
    funnel_window_days?: number;
    breakdown?: string;
    properties?: unknown[];
    layout?: string;
  } = {},
): InsightConfig {
  const series = steps.map((event) => ({
    kind: 'EventsNode',
    event,
  }));

  return {
    name,
    query: {
      kind: 'FunnelsQuery',
      series,
      funnelsFilter: {
        funnelWindowIntervalUnit: 'day',
        funnelWindowInterval: opts.funnel_window_days ?? 30,
        layout: opts.layout ?? 'horizontal',
      },
      ...(opts.breakdown
        ? {
            breakdownFilter: {
              breakdowns: [{ property: opts.breakdown, type: 'event' }],
            },
          }
        : {}),
      ...(opts.properties ? { properties: opts.properties } : {}),
      dateRange: { date_from: '-30d' },
    },
  };
}

function lifecycleInsight(
  name: string,
  event: string,
  opts: { properties?: unknown[] } = {},
): InsightConfig {
  return {
    name,
    query: {
      kind: 'LifecycleQuery',
      series: [{ kind: 'EventsNode', event, math: 'total' }],
      dateRange: { date_from: '-30d' },
      interval: 'day',
      ...(opts.properties ? { properties: opts.properties } : {}),
    },
  };
}

// ─── Dashboard Definitions ───────────────────────────────────────────────────

// Helper: beta cohort filter (used by many insights)
const betaCohortFilter = (cohortId: number) => [
  { key: 'id', value: cohortId, type: 'cohort' },
];

interface DashboardDef {
  name: string;
  description: string;
  insights: (cohortIds: Record<string, number>) => InsightConfig[];
}

const DASHBOARD_DEFS: DashboardDef[] = [
  // ─── Dashboard 1: Beta Program Command Center ───
  {
    name: 'Beta Program Command Center',
    description: 'Track all 22 beta testers — invite redemption, engagement, credit consumption, and per-user activity',
    insights: (cohorts) => [
      funnelInsight('Beta Invite Funnel', [
        'beta_invite_clicked',
        'account_created',
        'beta_invite_redeemed',
        'scan_started',
        'scan_completed',
        'report_viewed',
        'checkout_started',
        'payment_completed',
      ], { funnel_window_days: 30 }),

      trendInsight('Invite Redemption Status', [
        { id: 'beta_invite_redeemed' },
      ], { display: 'ActionsTable', breakdown: 'invite_name' }),

      lifecycleInsight('Beta Activity Lifecycle', '$pageview', {
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Scan Credit Consumption', [
        { id: 'scan_started' },
      ], {
        display: 'ActionsLineGraphCumulative',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Chat Burn Rate', [
        { id: 'chat_message_sent' },
      ], {
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Per-User Engagement', [
        { id: 'scan_started' },
        { id: 'report_viewed' },
        { id: 'chat_message_sent' },
        { id: 'pdf_downloaded' },
      ], {
        display: 'ActionsTable',
        breakdown: 'invite_name',
        breakdown_type: 'person',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      funnelInsight('Time to First Scan', [
        'account_created',
        'scan_started',
      ], {
        funnel_window_days: 30,
        layout: 'horizontal',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Report Read Depth', [
        { id: 'report_scroll_depth' },
      ], {
        display: 'ActionsBar',
        breakdown: 'depth_percent',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Feature Discovery', [
        { id: 'window_opened' },
      ], {
        display: 'ActionsTable',
        breakdown: 'window_id',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),

      trendInsight('Scans by Beta User', [
        { id: 'scan_started' },
      ], {
        display: 'ActionsTable',
        breakdown: 'invite_name',
        breakdown_type: 'person',
        properties: cohorts['Beta Invitees'] ? betaCohortFilter(cohorts['Beta Invitees']!) : [],
      }),
    ],
  },

  // ─── Dashboard 2: Revenue Command Center ───
  {
    name: 'Revenue Command Center',
    description: 'Payment tracking, conversion, ARPU, and revenue by product',
    insights: () => [
      trendInsight('Total Revenue', [
        { id: 'payment_completed', math: 'sum', math_property: 'revenue' },
      ], { date_from: '-30d' }),

      trendInsight('Revenue by Product', [
        { id: 'payment_completed', math: 'sum', math_property: 'revenue' },
      ], { breakdown: 'product' }),

      funnelInsight('Checkout Funnel', [
        'checkout_started',
        'payment_completed',
      ], { funnel_window_days: 1, breakdown: 'product' }),

      trendInsight('ARPU', [
        { id: 'payment_completed', math: 'sum', math_property: 'revenue' },
        { id: 'payment_completed', math: 'dau' },
      ], { interval: 'week', formula: 'A / B' }),

      trendInsight('Payment Count Today', [
        { id: 'payment_completed' },
      ], { date_from: 'dStart', display: 'BoldNumber' }),

      trendInsight('Revenue Today', [
        { id: 'payment_completed', math: 'sum', math_property: 'revenue' },
      ], { date_from: 'dStart', display: 'BoldNumber' }),

      trendInsight('Revenue by Beta User', [
        { id: 'payment_completed', math: 'sum', math_property: 'revenue' },
      ], { display: 'ActionsTable', breakdown: 'invite_name', breakdown_type: 'person' }),
    ],
  },

  // ─── Dashboard 3: Scan Funnel & Quality ───
  {
    name: 'Scan Funnel & Quality',
    description: 'Scan pipeline health, success rates, duration, and MarketingIQ distribution',
    insights: () => [
      funnelInsight('Full Scan Pipeline', [
        'scan_started',
        'engine_scan_started',
        'engine_scan_completed',
        'scan_completed',
      ], { funnel_window_days: 1 }),

      trendInsight('Engine Success Rate', [
        { id: 'engine_scan_completed' },
        { id: 'engine_scan_failed' },
      ], { formula: 'A / (A + B) * 100' }),

      trendInsight('Scan Duration P90', [
        { id: 'engine_scan_completed', math: 'p90', math_property: 'duration_ms' },
      ]),

      trendInsight('MarketingIQ Distribution', [
        { id: 'engine_scan_completed' },
      ], { breakdown: 'marketing_iq' }),

      trendInsight('Failed Scans', [
        { id: 'engine_scan_failed' },
      ], { breakdown: 'error', date_from: '-7d' }),

      trendInsight('Scans Per Domain', [
        { id: 'scan_started' },
      ], { display: 'ActionsTable', breakdown: 'domain' }),
    ],
  },

  // ─── Dashboard 4: User Engagement ───
  {
    name: 'User Engagement',
    description: 'Report interaction, slide views, downloads, chat, and Chloe engagement',
    insights: () => [
      trendInsight('Most Viewed Slides', [
        { id: 'slide_viewed' },
      ], { display: 'ActionsBar', breakdown: 'slide_id' }),

      trendInsight('Tab Navigation', [
        { id: 'report_tab_clicked' },
      ], { display: 'ActionsBar', breakdown: 'tab' }),

      trendInsight('PDF Download Sources', [
        { id: 'pdf_downloaded' },
      ], { display: 'ActionsPie', breakdown: 'source' }),

      trendInsight('Chat Usage', [
        { id: 'chat_message_sent' },
      ]),

      trendInsight('Markdown Exports', [
        { id: 'markdown_copied' },
      ]),

      trendInsight('Share Link Usage', [
        { id: 'share_link_created' },
      ]),

      trendInsight('Chloe Engagement', [
        { id: 'chloe_callout_clicked' },
      ], { breakdown: 'variant' }),
    ],
  },

  // ─── Dashboard 5: Health & Security ───
  {
    name: 'Health & Security',
    description: 'Error rates, rate limits, auth failures, engine health',
    insights: () => [
      trendInsight('Error Rate', [
        { id: '$exception' },
      ], { interval: 'hour', date_from: '-7d' }),

      trendInsight('Rate Limit Hits', [
        { id: 'rate_limit_hit' },
      ], { display: 'ActionsTable', breakdown: 'endpoint', date_from: '-7d' }),

      trendInsight('Auth Failures', [
        { id: 'auth_failed' },
      ], { breakdown: 'mode', date_from: '-7d' }),

      trendInsight('Engine Health', [
        { id: 'engine_scan_failed' },
      ], { date_from: '-7d' }),

      trendInsight('Scan Duration Trend', [
        { id: 'engine_scan_completed', math: 'p90', math_property: 'duration_ms' },
      ], { date_from: '-7d' }),
    ],
  },
];

// ─── Feature Flag Definitions ────────────────────────────────────────────────

interface FlagDef {
  key: string;
  name: string;
  active: boolean;
  filters: Record<string, unknown>;
}

const FLAG_DEFS: FlagDef[] = [
  {
    key: 'kill-switch-scans',
    name: 'Kill Switch: Scans',
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 0 }],
    },
  },
  {
    key: 'kill-switch-chat',
    name: 'Kill Switch: Chat',
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 0 }],
    },
  },
  {
    key: 'beta-extra-scans',
    name: 'Beta: Extra Scans',
    active: true,
    filters: {
      groups: [
        {
          properties: [
            { key: 'invite_code', type: 'person', value: [], operator: 'exact' },
          ],
          rollout_percentage: 100,
        },
      ],
    },
  },
  {
    key: 'beta-chat-unlimited',
    name: 'Beta: Unlimited Chat',
    active: true,
    filters: {
      groups: [
        {
          properties: [
            { key: 'invite_code', type: 'person', value: [], operator: 'exact' },
          ],
          rollout_percentage: 100,
        },
      ],
    },
  },
  {
    key: 'show-boss-deck',
    name: 'Show Boss Deck',
    active: true,
    filters: {
      groups: [
        {
          properties: [
            { key: 'beta_invitee', type: 'person', value: ['true'], operator: 'exact' },
          ],
          rollout_percentage: 100,
        },
      ],
    },
  },
  {
    key: 'session-recording-enabled',
    name: 'Session Recording Enabled',
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
    },
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 PostHog Setup — Project ${PROJECT_ID}\n`);

  // ── Step 1: Create Cohorts ──
  console.log('━━━ Creating Cohorts ━━━');
  const cohortIds: Record<string, number> = {};

  for (const def of COHORT_DEFS) {
    const existing = await findByName<{ name: string; id: number }>('/cohorts', def.name);
    if (existing) {
      console.log(`  ✓ "${def.name}" already exists (id: ${existing.id})`);
      cohortIds[def.name] = existing.id;
    } else {
      const created = await api<{ id: number }>('POST', '/cohorts', {
        name: def.name,
        description: def.description,
        groups: def.groups,
        is_static: false,
      });
      console.log(`  + Created "${def.name}" (id: ${created.id})`);
      cohortIds[def.name] = created.id;
    }
  }

  // ── Step 2: Create Dashboards + Insights ──
  console.log('\n━━━ Creating Dashboards ━━━');

  for (const dashDef of DASHBOARD_DEFS) {
    const existing = await findByName<{ name: string; id: number }>('/dashboards', dashDef.name);
    let dashboardId: number;

    if (existing) {
      console.log(`  ✓ "${dashDef.name}" already exists (id: ${existing.id})`);
      dashboardId = existing.id;
    } else {
      const created = await api<{ id: number }>('POST', '/dashboards', {
        name: dashDef.name,
        description: dashDef.description,
      });
      console.log(`  + Created "${dashDef.name}" (id: ${created.id})`);
      dashboardId = created.id;
    }

    // Create insights for this dashboard
    const insightDefs = dashDef.insights(cohortIds);
    for (const insightDef of insightDefs) {
      try {
        await api('POST', '/insights', {
          name: insightDef.name,
          query: insightDef.query,
          dashboards: [dashboardId],
        });
        console.log(`    + Insight: "${insightDef.name}"`);
      } catch (err) {
        console.error(`    ✗ Failed: "${insightDef.name}":`, (err as Error).message);
      }
    }
  }

  // ── Step 3: Create Feature Flags ──
  console.log('\n━━━ Creating Feature Flags ━━━');

  const existingFlags = await listAll<{ key: string; id: number }>('/feature_flags');
  const existingFlagKeys = new Set(existingFlags.map((f) => f.key));

  for (const def of FLAG_DEFS) {
    if (existingFlagKeys.has(def.key)) {
      console.log(`  ✓ "${def.key}" already exists`);
    } else {
      try {
        await api('POST', '/feature_flags', {
          key: def.key,
          name: def.name,
          active: def.active,
          filters: def.filters,
        });
        console.log(`  + Created "${def.key}"`);
      } catch (err) {
        console.error(`  ✗ Failed "${def.key}":`, (err as Error).message);
      }
    }
  }

  // ── Summary ──
  console.log('\n━━━ Summary ━━━');
  console.log(`  Cohorts: ${COHORT_DEFS.length}`);
  console.log(`  Dashboards: ${DASHBOARD_DEFS.length}`);
  console.log(`  Insights: ${DASHBOARD_DEFS.reduce((sum, d) => sum + d.insights(cohortIds).length, 0)}`);
  console.log(`  Feature Flags: ${FLAG_DEFS.length}`);
  console.log(`\n✅ Done! Visit https://us.posthog.com/project/${PROJECT_ID} to verify.\n`);

  // Manual steps reminder
  console.log('📋 Manual steps remaining:');
  console.log('  1. Data Management > Events > Set display names (see plan)');
  console.log('  2. Data Management > Properties > Set types (revenue=Numeric, etc.)');
  console.log('  3. Session Replay > Create 6 playlists (see plan)');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
