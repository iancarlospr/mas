/**
 * PostHog Fix — correct the project's `live_events_columns` so the Events
 * view stops raising "Unable to resolve field: session_id".
 *
 * The bug: the columns array contains a bare `"session_id"` string, which is
 * not a field on the events table (events expose `$session_id`; the bare
 * column only exists on the sessions table as `session.session_id`).
 *
 * The fix: replace `"session_id"` with `"$session_id"` in the columns array.
 * Other entries are left untouched.
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

const BAD_REF = /(?<![$.])session_id\b/;

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
    typeof col === 'string' && BAD_REF.test(col) && col === 'session_id'
      ? '$session_id'
      : col,
  );

  const changed = fixed.some((v, i) => v !== current[i]);

  console.log('Before:');
  for (const c of current) console.log(`  - ${c}${BAD_REF.test(c) && c === 'session_id' ? '  ← BAD' : ''}`);
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
