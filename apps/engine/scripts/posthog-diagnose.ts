/**
 * PostHog Diagnostic — find every saved resource that references a bare
 * `session_id` field (as opposed to the correct `$session_id` on events or
 * `session.session_id` on the sessions table).
 *
 * This is a READ-ONLY script. It does not modify PostHog in any way.
 *
 * Usage:  npx tsx --env-file=.env scripts/posthog-diagnose.ts
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

// bare `session_id`: a session_id not preceded by `$` and not preceded by
// `session.` (so `$session_id` and `session.session_id` are both ignored).
const BAD_REF = /(?<![$.])session_id\b/;

interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
  count?: number;
}

async function getJSON<T>(path: string): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}/projects/${PROJECT_ID}${path}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function pageAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  while (next) {
    const data: PaginatedResponse<T> = await getJSON<PaginatedResponse<T>>(next);
    out.push(...data.results);
    next = data.next;
  }
  return out;
}

function excerpt(text: string, match: RegExpMatchArray): string {
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + 60);
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end).replace(/\s+/g, ' ') +
    (end < text.length ? '…' : '')
  );
}

function scan(label: string, items: Array<Record<string, unknown>>, keys: string[]) {
  console.log(`\n━━━ ${label} (${items.length}) ━━━`);
  let hits = 0;
  for (const item of items) {
    const id = item['id'] ?? item['short_id'] ?? '?';
    const name = item['name'] ?? item['derived_name'] ?? item['key'] ?? '(unnamed)';
    const payload = keys
      .map((k) => {
        const v = (item as Record<string, unknown>)[k];
        return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      })
      .join('\n');
    const m = payload.match(BAD_REF);
    if (m) {
      hits++;
      console.log(`  ✗ [${id}] "${name}"`);
      console.log(`     ${excerpt(payload, m)}`);
    }
  }
  if (hits === 0) console.log('  ✓ clean');
  return hits;
}

async function main() {
  console.log(`\n🔍 PostHog diagnostic — project ${PROJECT_ID}`);
  console.log(`    Matcher: /(?<![$.])session_id\\b/  (bare session_id)\n`);

  let totalHits = 0;

  // Insights — scan the saved query JSON
  const insights = await pageAll<Record<string, unknown>>('/insights/?limit=500');
  totalHits += scan('Insights', insights, ['query', 'filters']);

  // Actions — scan step definitions + HogQL bytecode
  const actions = await pageAll<Record<string, unknown>>('/actions/?limit=500');
  totalHits += scan('Actions', actions, ['steps', 'bytecode_error', 'post_to_slack']);

  // Session-replay playlists — scan filter JSON
  try {
    const playlists = await pageAll<Record<string, unknown>>(
      '/session_recording_playlists/?limit=200',
    );
    totalHits += scan('Session replay playlists', playlists, ['filters', 'short_id']);
  } catch (err) {
    console.log(`\n━━━ Session replay playlists ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Property definitions — look for any property literally named `session_id`
  // (it should be `$session_id`). Mis-created ones can trip the events view.
  try {
    const props = await pageAll<Record<string, unknown>>(
      '/property_definitions/?limit=500&search=session',
    );
    const bad = props.filter((p) => p['name'] === 'session_id');
    console.log(`\n━━━ Property definitions matching "session" (${props.length}) ━━━`);
    if (bad.length === 0) {
      console.log('  ✓ no bare `session_id` property definition');
    } else {
      for (const p of bad) {
        console.log(`  ✗ [${p['id']}] name="${p['name']}" type=${p['property_type']}`);
      }
      totalHits += bad.length;
    }
  } catch (err) {
    console.log(`\n━━━ Property definitions ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Dashboards — the error *banner* in Events view can also come from a
  // dashboard's saved filter/HogQL. Check dashboard `filters` + `variables`.
  try {
    const dashboards = await pageAll<Record<string, unknown>>('/dashboards/?limit=200');
    totalHits += scan('Dashboards', dashboards, ['filters', 'variables', 'tiles']);
  } catch (err) {
    console.log(`\n━━━ Dashboards ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Cohorts — filters can reference HogQL too.
  try {
    const cohorts = await pageAll<Record<string, unknown>>('/cohorts/?limit=200');
    totalHits += scan('Cohorts', cohorts, ['filters', 'groups']);
  } catch (err) {
    console.log(`\n━━━ Cohorts ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Feature flags — filters can reference property names.
  try {
    const flags = await pageAll<Record<string, unknown>>('/feature_flags/?limit=200');
    totalHits += scan('Feature flags', flags, ['filters']);
  } catch (err) {
    console.log(`\n━━━ Feature flags ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Event definitions — can carry HogQL filters/aliases.
  try {
    const events = await pageAll<Record<string, unknown>>('/event_definitions/?limit=500');
    totalHits += scan('Event definitions', events, ['hogql_filter', 'description']);
  } catch (err) {
    console.log(`\n━━━ Event definitions ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Dump the 8 property defs matching "session" — the earlier strict-name
  // filter only looked for exact `session_id`; print them all for eyeballing.
  try {
    const props = await pageAll<Record<string, unknown>>(
      '/property_definitions/?limit=500&search=session',
    );
    console.log(`\n━━━ All property_definitions matching "session" (verbose) ━━━`);
    for (const p of props) {
      console.log(`  - [${p['id']}] name="${p['name']}" type=${p['property_type']} is_numerical=${p['is_numerical']}`);
    }
  } catch {
    /* noop */
  }

  // Notebooks — saved HogQL snippets.
  try {
    const notebooks = await pageAll<Record<string, unknown>>('/notebooks/?limit=200');
    totalHits += scan('Notebooks', notebooks, ['content', 'text_content']);
  } catch (err) {
    console.log(`\n━━━ Notebooks ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Project settings — `live_events_columns` is the most common place a bad
  // HogQL reference ends up, because the PostHog UI lets you drag columns
  // onto the Events table and save them per project. Catches:
  //   • bare `session_id` (should be `$session_id` or `session.session_id`)
  //   • bare `$start_timestamp`, `$end_timestamp`, `$session_duration`,
  //     `$entry_current_url`, `$pageview_count`, `$is_bounce` — all
  //     session-scoped and need the `session.` prefix.
  const BARE_SESSION_PROPS = new Set([
    'session_id',
    '$start_timestamp',
    '$end_timestamp',
    '$session_duration',
    '$entry_current_url',
    '$pageview_count',
    '$is_bounce',
  ]);
  try {
    const settings = await getJSON<Record<string, unknown>>('/');
    const cols = settings['live_events_columns'];
    console.log(`\n━━━ Project settings > live_events_columns ━━━`);
    if (Array.isArray(cols)) {
      const bad = cols.filter(
        (c): c is string =>
          typeof c === 'string' &&
          (BARE_SESSION_PROPS.has(c) || (BAD_REF.test(c) && !c.includes('session.'))),
      );
      if (bad.length === 0) {
        console.log('  ✓ clean');
      } else {
        console.log(`  ✗ ${bad.length} bad column(s): ${JSON.stringify(bad)}`);
        console.log(`    full array: ${JSON.stringify(cols)}`);
        totalHits += bad.length;
      }
    } else {
      console.log('  (no live_events_columns set)');
    }
  } catch (err) {
    console.log(`\n━━━ Project settings ━━━\n  ! skipped: ${(err as Error).message}`);
  }

  // Person display-name resolution. When this is null the PostHog UI shows
  // raw distinct_ids instead of the person's name/email in session lists,
  // event rows, etc. It should normally be ["name","Name","email","Email",
  // "username","Username"] so identified users are readable.
  try {
    const settings = await getJSON<Record<string, unknown>>('/');
    const displayProps = settings['person_display_name_properties'];
    console.log(`\n━━━ Project settings > person_display_name_properties ━━━`);
    if (displayProps == null) {
      console.log('  ✗ null — distinct_ids will render as raw UUIDs in the UI');
      totalHits++;
    } else if (Array.isArray(displayProps) && displayProps.length > 0) {
      console.log(`  ✓ ${JSON.stringify(displayProps)}`);
    } else {
      console.log(`  ? unexpected value: ${JSON.stringify(displayProps)}`);
    }
  } catch {
    /* noop */
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`  ${totalHits === 0 ? '✓ No bare `session_id` references found.' : `✗ ${totalHits} resource(s) need fixing.`}`);
  console.log('');
  if (totalHits > 0) {
    console.log('Next step: pass these IDs into scripts/posthog-fix-insights.ts to patch them.');
  }
}

main().catch((err) => {
  console.error('\n❌ Diagnostic failed:', err);
  process.exit(1);
});
