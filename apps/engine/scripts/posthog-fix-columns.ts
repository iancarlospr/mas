/**
 * PostHog Fix — correct the project's `live_events_columns` so the Events
 * view stops raising "Unable to resolve field: <x>".
 *
 * Rewrites for columns that are session-scoped but missing the `session.`
 * prefix required by HogQL when the column is evaluated from the events
 * table context:
 *
 *   session_id           → $session_id
 *   $start_timestamp     → session.$start_timestamp -- Start
 *   $end_timestamp       → session.$end_timestamp -- End
 *   $session_duration    → session.$session_duration -- Duration
 *   $entry_current_url   → session.$entry_current_url -- Entry URL
 *   $pageview_count      → session.$pageview_count -- Pageviews
 *   $is_bounce           → session.$is_bounce -- Bounce
 *
 * Each replacement was verified against the live project's HogQL engine.
 *
 * Usage:  npx tsx --env-file=.env scripts/posthog-fix-columns.ts
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

// Column-level rewrites. Key = bare (broken) column string, value = the
// HogQL expression that the PostHog Events view can actually resolve.
const REWRITES: Record<string, string> = {
  session_id: '$session_id',
  $start_timestamp: 'session.$start_timestamp -- Start',
  $end_timestamp: 'session.$end_timestamp -- End',
  $session_duration: 'session.$session_duration -- Duration',
  $entry_current_url: 'session.$entry_current_url -- Entry URL',
  $pageview_count: 'session.$pageview_count -- Pageviews',
  $is_bounce: 'session.$is_bounce -- Bounce',
};

async function main() {
  const url = `${BASE_URL}/projects/${PROJECT_ID}/`;

  const getRes = await fetch(url, { headers });
  if (!getRes.ok) {
    throw new Error(`GET ${url} → ${getRes.status}: ${await getRes.text()}`);
  }
  const project = (await getRes.json()) as { live_events_columns: string[] | null };
  const current = project.live_events_columns;

  if (!Array.isArray(current)) {
    console.log('No live_events_columns set on this project — nothing to fix.');
    return;
  }

  const fixed = current.map((col) =>
    typeof col === 'string' && REWRITES[col] ? REWRITES[col]! : col,
  );

  const changed = fixed.some((v, i) => v !== current[i]);

  console.log('Before:');
  for (const c of current) {
    const bad = typeof c === 'string' && REWRITES[c];
    console.log(`  - ${c}${bad ? '  ← BAD' : ''}`);
  }
  console.log('\nAfter:');
  for (const c of fixed) console.log(`  - ${c}`);

  if (!changed) {
    console.log('\n✓ Nothing to change.');
    return;
  }

  const patchRes = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ live_events_columns: fixed }),
  });
  if (!patchRes.ok) {
    throw new Error(`PATCH ${url} → ${patchRes.status}: ${await patchRes.text()}`);
  }

  console.log('\n✅ live_events_columns patched.');
}

main().catch((err) => {
  console.error('\n❌ Fix failed:', err);
  process.exit(1);
});
