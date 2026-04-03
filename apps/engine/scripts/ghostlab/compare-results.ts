/**
 * Ghostlab — Compare Results
 *
 * Compares replayed module results against ground truth annotations and
 * produces a multi-dimensional quality score.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx scripts/ghostlab/compare-results.ts --module=M16 --site=senzary.com
 *   npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites
 *   npx tsx scripts/ghostlab/compare-results.ts --all --site=senzary.com
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

const PASSIVE_MODULES = ['M01', 'M02', 'M04', 'M16', 'M17', 'M18', 'M19'];
const KNOWN_SITES = ['senzary.com', 'ryder.com'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataExpectation {
  value?: unknown;
  match: 'exact' | 'contains' | 'truthy' | 'falsy' | 'gte' | 'lte' | 'regex';
  note?: string;
}

interface CheckpointExpectation {
  id: string;
  expectedHealth: string;
  note?: string;
}

interface NegativeAssertion {
  path: string;
  mustNotEqual?: unknown;
  mustNotContain?: string;
  note: string;
}

interface FixedBug {
  description: string;
  assertion: string;
  path?: string;
  mustNotEqual?: unknown;
  mustNotContain?: string;
}

interface ModuleGroundTruth {
  expectedData: Record<string, DataExpectation>;
  expectedCheckpoints: CheckpointExpectation[];
  negativeAssertions: NegativeAssertion[];
  fixedBugs: FixedBug[];
}

interface GroundTruth {
  site: string;
  verifiedAt: string;
  modules: Record<string, ModuleGroundTruth>;
}

interface ScoreDimension {
  score: number;
  matched: number;
  total: number;
  details: string[];
}

interface GhostlabScore {
  module: string;
  site: string;
  dataAccuracy: ScoreDimension;
  checkpointAccuracy: ScoreDimension;
  falsePositiveRate: ScoreDimension;
  regressionGuard: ScoreDimension;
  completeness: ScoreDimension;
  overall: number;
  scoredAt: string;
}

// ── Dot-path Access ───────────────────────────────────────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Matching ──────────────────────────────────────────────────────────────────

function matchValue(actual: unknown, expectation: DataExpectation): boolean {
  const { value, match } = expectation;

  switch (match) {
    case 'exact':
      return JSON.stringify(actual) === JSON.stringify(value);

    case 'contains':
      if (typeof actual === 'string' && typeof value === 'string') {
        return actual.toLowerCase().includes(value.toLowerCase());
      }
      if (Array.isArray(actual) && typeof value === 'string') {
        return actual.some(
          (item: unknown) =>
            typeof item === 'string' && item.toLowerCase().includes(value.toLowerCase()),
        );
      }
      return false;

    case 'truthy':
      if (typeof actual === 'number') return actual > 0;
      if (Array.isArray(actual)) return actual.length > 0;
      return !!actual;

    case 'falsy':
      if (typeof actual === 'number') return actual === 0;
      if (Array.isArray(actual)) return actual.length === 0;
      return !actual;

    case 'gte':
      return typeof actual === 'number' && typeof value === 'number' && actual >= value;

    case 'lte':
      return typeof actual === 'number' && typeof value === 'number' && actual <= value;

    case 'regex':
      if (typeof actual !== 'string' || typeof value !== 'string') return false;
      return new RegExp(value, 'i').test(actual);

    default:
      return false;
  }
}

// ── Scoring Functions ─────────────────────────────────────────────────────────

function scoreDataAccuracy(
  data: Record<string, unknown>,
  expectations: Record<string, DataExpectation>,
): ScoreDimension {
  const total = Object.keys(expectations).length;
  if (total === 0) return { score: 100, matched: 0, total: 0, details: [] };

  let matched = 0;
  const details: string[] = [];

  for (const [path, expectation] of Object.entries(expectations)) {
    const actual = getByPath(data, path);
    if (matchValue(actual, expectation)) {
      matched++;
    } else {
      const expectedDesc = expectation.match === 'truthy' ? 'truthy'
        : expectation.match === 'falsy' ? 'falsy'
        : `${expectation.match} ${JSON.stringify(expectation.value)}`;
      details.push(
        `  data.${path}: expected ${expectedDesc}, got ${JSON.stringify(actual)}${expectation.note ? ` (${expectation.note})` : ''}`,
      );
    }
  }

  return {
    score: Math.round((matched / total) * 100),
    matched,
    total,
    details,
  };
}

function scoreCheckpointAccuracy(
  checkpoints: Array<{ id: string; health: string; [k: string]: unknown }>,
  expectations: CheckpointExpectation[],
): ScoreDimension {
  const total = expectations.length;
  if (total === 0) return { score: 100, matched: 0, total: 0, details: [] };

  let matched = 0;
  const details: string[] = [];

  for (const exp of expectations) {
    const actual = checkpoints.find(cp => cp.id === exp.id);
    if (!actual) {
      details.push(`  checkpoint ${exp.id}: NOT FOUND (expected ${exp.expectedHealth})`);
    } else if (actual.health === exp.expectedHealth) {
      matched++;
    } else {
      details.push(
        `  checkpoint ${exp.id}: expected ${exp.expectedHealth}, got ${actual.health}${exp.note ? ` (${exp.note})` : ''}`,
      );
    }
  }

  return {
    score: Math.round((matched / total) * 100),
    matched,
    total,
    details,
  };
}

function scoreFalsePositives(
  data: Record<string, unknown>,
  assertions: NegativeAssertion[],
): ScoreDimension {
  const total = assertions.length;
  if (total === 0) return { score: 100, matched: 0, total: 0, details: [] };

  let passed = 0;
  const details: string[] = [];

  for (const assertion of assertions) {
    const actual = getByPath(data, assertion.path);

    let violated = false;
    if (assertion.mustNotEqual !== undefined) {
      violated = JSON.stringify(actual) === JSON.stringify(assertion.mustNotEqual);
    }
    if (assertion.mustNotContain !== undefined && typeof actual === 'string') {
      violated = actual.toLowerCase().includes(assertion.mustNotContain.toLowerCase());
    }

    if (violated) {
      details.push(
        `  FALSE POSITIVE: data.${assertion.path} = ${JSON.stringify(actual)} — ${assertion.note}`,
      );
    } else {
      passed++;
    }
  }

  return {
    score: Math.round((passed / total) * 100),
    matched: passed,
    total,
    details,
  };
}

function scoreRegressionGuard(
  data: Record<string, unknown>,
  bugs: FixedBug[],
): ScoreDimension {
  const total = bugs.length;
  if (total === 0) return { score: 100, matched: 0, total: 0, details: [] };

  let passed = 0;
  const details: string[] = [];

  for (const bug of bugs) {
    let regressed = false;

    if (bug.path && bug.mustNotEqual !== undefined) {
      const actual = getByPath(data, bug.path);
      regressed = JSON.stringify(actual) === JSON.stringify(bug.mustNotEqual);
    } else if (bug.path && bug.mustNotContain !== undefined) {
      const actual = getByPath(data, bug.path);
      regressed = typeof actual === 'string' && actual.toLowerCase().includes(bug.mustNotContain.toLowerCase());
    }

    if (regressed) {
      details.push(`  REGRESSION: ${bug.description}`);
    } else {
      passed++;
    }
  }

  return {
    score: Math.round((passed / total) * 100),
    matched: passed,
    total,
    details,
  };
}

function scoreCompleteness(
  checkpoints: Array<{ id: string; [k: string]: unknown }>,
  expectedCheckpoints: CheckpointExpectation[],
): ScoreDimension {
  const expectedIds = new Set(expectedCheckpoints.map(e => e.id));
  const actualIds = new Set(checkpoints.map(cp => cp.id));
  const details: string[] = [];

  const missing = [...expectedIds].filter(id => !actualIds.has(id));
  const extra = [...actualIds].filter(id => !expectedIds.has(id));

  for (const id of missing) {
    details.push(`  MISSING checkpoint: ${id}`);
  }
  for (const id of extra) {
    details.push(`  EXTRA checkpoint: ${id} (not in ground truth — add if expected)`);
  }

  const total = expectedIds.size;
  const found = total - missing.length;

  return {
    score: total === 0 ? 100 : Math.round((found / total) * 100),
    matched: found,
    total,
    details,
  };
}

// ── Display ───────────────────────────────────────────────────────────────────

function renderBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function displayScore(score: GhostlabScore): void {
  const W = 62;
  console.log(`\n╔${'═'.repeat(W)}╗`);
  console.log(`║  GHOSTLAB SCORE — ${score.module} @ ${score.site}`.padEnd(W + 1) + '║');
  console.log(`╠${'═'.repeat(W)}╣`);

  const dims: [string, ScoreDimension, number][] = [
    ['Data accuracy', score.dataAccuracy, 30],
    ['Checkpoint health', score.checkpointAccuracy, 25],
    ['False positives', score.falsePositiveRate, 20],
    ['Regression guard', score.regressionGuard, 15],
    ['Completeness', score.completeness, 10],
  ];

  for (const [label, dim, weight] of dims) {
    const bar = renderBar(dim.score);
    const counts = dim.total > 0 ? ` (${dim.matched}/${dim.total})` : '';
    const line = `  ${label.padEnd(20)} ${bar}  ${String(dim.score).padStart(3)}%${counts}  [w${weight}]`;
    console.log(`║${line.padEnd(W)}║`);
  }

  console.log(`║${''.padEnd(W)}║`);
  const overallLine = `  OVERALL: ${score.overall}`;
  console.log(`║${overallLine.padEnd(W)}║`);
  console.log(`╚${'═'.repeat(W)}╝`);

  // Print details for any mismatches
  const allDetails = [
    ...score.dataAccuracy.details,
    ...score.checkpointAccuracy.details,
    ...score.falsePositiveRate.details,
    ...score.regressionGuard.details,
    ...score.completeness.details,
  ];

  if (allDetails.length > 0) {
    console.log('\nDETAILS:');
    for (const detail of allDetails) {
      console.log(detail);
    }
  }
}

// ── Main Compare ──────────────────────────────────────────────────────────────

function compareModule(moduleId: string, site: string): GhostlabScore | null {
  // Load replay result
  const replayPath = resolve(FIXTURES_DIR, site, 'replay-results', `${moduleId}.json`);
  if (!existsSync(replayPath)) {
    console.error(`No replay result found: ${replayPath}`);
    console.error(`Run: npx tsx scripts/ghostlab/replay-module.ts --module=${moduleId} --site=${site} --save`);
    return null;
  }

  // Load ground truth — try manual first, fall back to auto-generated
  let gtPath = resolve(FIXTURES_DIR, site, 'ground-truth.json');
  if (!existsSync(gtPath)) {
    gtPath = resolve(FIXTURES_DIR, site, 'auto-ground-truth.json');
  }
  if (!existsSync(gtPath)) {
    console.error(`No ground truth found for ${site}. Run capture-ground-truth.ts + generate-ground-truth-json.ts first.`);
    return null;
  }

  const replayResult = JSON.parse(readFileSync(replayPath, 'utf-8'));
  const groundTruth: GroundTruth = JSON.parse(readFileSync(gtPath, 'utf-8'));

  // Check manual ground truth first for this module, fall back to auto
  let moduleGT = groundTruth.modules[moduleId];
  if (!moduleGT) {
    const autoGtPath = resolve(FIXTURES_DIR, site, 'auto-ground-truth.json');
    if (existsSync(autoGtPath)) {
      const autoGt: GroundTruth = JSON.parse(readFileSync(autoGtPath, 'utf-8'));
      moduleGT = autoGt.modules[moduleId];
    }
  }
  if (!moduleGT) {
    console.error(`No ground truth for ${moduleId} in ${site}`);
    return null;
  }

  // Score each dimension
  const dataAccuracy = scoreDataAccuracy(replayResult.data ?? {}, moduleGT.expectedData);
  const checkpointAccuracy = scoreCheckpointAccuracy(replayResult.checkpoints ?? [], moduleGT.expectedCheckpoints);
  const falsePositiveRate = scoreFalsePositives(replayResult.data ?? {}, moduleGT.negativeAssertions);
  const regressionGuard = scoreRegressionGuard(replayResult.data ?? {}, moduleGT.fixedBugs);
  const completeness = scoreCompleteness(replayResult.checkpoints ?? [], moduleGT.expectedCheckpoints);

  // Weighted overall
  const overall = Math.round(
    dataAccuracy.score * 0.30 +
    checkpointAccuracy.score * 0.25 +
    falsePositiveRate.score * 0.20 +
    regressionGuard.score * 0.15 +
    completeness.score * 0.10,
  );

  return {
    module: moduleId,
    site,
    dataAccuracy,
    checkpointAccuracy,
    falsePositiveRate,
    regressionGuard,
    completeness,
    overall,
    scoredAt: new Date().toISOString(),
  };
}

function parseCompareArgs(): { modules: string[]; sites: string[] } {
  const args = process.argv.slice(2);
  const moduleArg = args.find(a => a.startsWith('--module='))?.split('=')[1];
  const siteArg = args.find(a => a.startsWith('--site='))?.split('=')[1];
  const allModules = args.includes('--all');
  const allSites = args.includes('--all-sites');

  if (!moduleArg && !allModules) {
    console.error('Usage: npx tsx scripts/ghostlab/compare-results.ts --module=M16 --site=senzary.com');
    console.error('       npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites');
    console.error('       npx tsx scripts/ghostlab/compare-results.ts --all --site=senzary.com');
    process.exit(1);
  }

  return {
    modules: allModules ? PASSIVE_MODULES : [moduleArg!],
    sites: allSites ? KNOWN_SITES : (siteArg ? [siteArg] : KNOWN_SITES),
  };
}

async function main() {
  const { modules, sites } = parseCompareArgs();
  const scores: GhostlabScore[] = [];

  for (const moduleId of modules) {
    for (const site of sites) {
      const score = compareModule(moduleId, site);
      if (score) {
        displayScore(score);
        scores.push(score);

        // Save score
        const scoreDir = resolve(FIXTURES_DIR, site, 'scores');
        mkdirSync(scoreDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        writeFileSync(
          resolve(scoreDir, `${moduleId}-${timestamp}.json`),
          JSON.stringify(score, null, 2),
        );
      }
    }
  }

  // Summary table if multiple results
  if (scores.length > 1) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log('SUMMARY');
    console.log(`${'═'.repeat(70)}`);
    console.log(
      'Module'.padEnd(8) +
      'Site'.padEnd(16) +
      'Data'.padStart(6) +
      'Chkpt'.padStart(7) +
      'FP'.padStart(5) +
      'Regr'.padStart(6) +
      'Compl'.padStart(7) +
      'TOTAL'.padStart(7),
    );
    console.log('─'.repeat(70));
    for (const s of scores) {
      console.log(
        s.module.padEnd(8) +
        s.site.padEnd(16) +
        String(s.dataAccuracy.score).padStart(5) + '%' +
        String(s.checkpointAccuracy.score).padStart(5) + '%' +
        String(s.falsePositiveRate.score).padStart(4) + '%' +
        String(s.regressionGuard.score).padStart(5) + '%' +
        String(s.completeness.score).padStart(5) + '%' +
        String(s.overall).padStart(6),
      );
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
