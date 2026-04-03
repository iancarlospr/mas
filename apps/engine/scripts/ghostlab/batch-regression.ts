/**
 * Ghostlab — Batch Regression Runner
 *
 * Single command that replays ALL modules × ALL sites and reports pass/fail.
 * Exits non-zero if any module regresses below threshold.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx scripts/ghostlab/batch-regression.ts
 *   npx tsx scripts/ghostlab/batch-regression.ts --module=M16
 *   npx tsx scripts/ghostlab/batch-regression.ts --site=ryder.com
 *   npx tsx scripts/ghostlab/batch-regression.ts --threshold=90
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');
const PASSIVE_MODULES = ['M01', 'M02', 'M04', 'M16', 'M17', 'M18', 'M19'];

const DEFAULT_THRESHOLD = 80;

function parseArgs() {
  const args = process.argv.slice(2);
  const moduleArg = args.find(a => a.startsWith('--module='))?.split('=')[1];
  const siteArg = args.find(a => a.startsWith('--site='))?.split('=')[1];
  const thresholdArg = args.find(a => a.startsWith('--threshold='))?.split('=')[1];

  // Discover all sites that have ground truth
  const allSites = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => {
      return existsSync(resolve(FIXTURES_DIR, name, 'ground-truth.json')) ||
        existsSync(resolve(FIXTURES_DIR, name, 'auto-ground-truth.json'));
    });

  return {
    modules: moduleArg ? [moduleArg] : PASSIVE_MODULES,
    sites: siteArg ? [siteArg] : allSites,
    threshold: thresholdArg ? parseInt(thresholdArg, 10) : DEFAULT_THRESHOLD,
  };
}

interface Score {
  module: string;
  site: string;
  overall: number;
  dataAccuracy: number;
  checkpointAccuracy: number;
  falsePositiveRate: number;
  regressionGuard: number;
  completeness: number;
}

function runReplay(module: string, site: string): boolean {
  try {
    execSync(
      `npx tsx scripts/ghostlab/replay-module.ts --module=${module} --site=${site} --save`,
      { stdio: 'pipe', timeout: 30000 },
    );
    return true;
  } catch {
    return false;
  }
}

function runCompare(module: string, site: string): Score | null {
  try {
    const output = execSync(
      `npx tsx scripts/ghostlab/compare-results.ts --module=${module} --site=${site}`,
      { stdio: 'pipe', timeout: 15000 },
    ).toString();

    // Parse overall score from output
    const overallMatch = output.match(/OVERALL:\s*(\d+)/);
    const dataMatch = output.match(/Data accuracy.*?(\d+)%/);
    const cpMatch = output.match(/Checkpoint health.*?(\d+)%/);
    const fpMatch = output.match(/False positives.*?(\d+)%/);
    const regMatch = output.match(/Regression guard.*?(\d+)%/);
    const compMatch = output.match(/Completeness.*?(\d+)%/);

    if (!overallMatch) return null;

    return {
      module,
      site,
      overall: parseInt(overallMatch[1]!, 10),
      dataAccuracy: dataMatch ? parseInt(dataMatch[1]!, 10) : 0,
      checkpointAccuracy: cpMatch ? parseInt(cpMatch[1]!, 10) : 0,
      falsePositiveRate: fpMatch ? parseInt(fpMatch[1]!, 10) : 0,
      regressionGuard: regMatch ? parseInt(regMatch[1]!, 10) : 0,
      completeness: compMatch ? parseInt(compMatch[1]!, 10) : 0,
    };
  } catch {
    return null;
  }
}

function main() {
  const { modules, sites, threshold } = parseArgs();

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`GHOSTLAB BATCH REGRESSION`);
  console.log(`Modules: ${modules.join(', ')}`);
  console.log(`Sites: ${sites.join(', ')}`);
  console.log(`Threshold: ${threshold}`);
  console.log(`${'═'.repeat(70)}\n`);

  const results: Score[] = [];
  const failures: string[] = [];
  const skipped: string[] = [];

  for (const module of modules) {
    for (const site of sites) {
      // Check if fixtures exist
      const hasContext = existsSync(resolve(FIXTURES_DIR, site, 'context.json'));
      const hasGroundTruth = existsSync(resolve(FIXTURES_DIR, site, 'ground-truth.json')) ||
        existsSync(resolve(FIXTURES_DIR, site, 'auto-ground-truth.json'));

      if (!hasContext || !hasGroundTruth) {
        skipped.push(`${module}@${site} (missing fixtures)`);
        continue;
      }

      // Check if this module has ground truth — check both manual and auto files
      let hasModuleGT = false;
      for (const gtFile of ['ground-truth.json', 'auto-ground-truth.json']) {
        const p = resolve(FIXTURES_DIR, site, gtFile);
        if (existsSync(p)) {
          const gt = JSON.parse(readFileSync(p, 'utf-8'));
          if (gt.modules?.[module]) { hasModuleGT = true; break; }
        }
      }
      if (!hasModuleGT) {
        skipped.push(`${module}@${site} (no ground truth for module)`);
        continue;
      }

      process.stdout.write(`  ${module}@${site}... `);

      // Replay
      const replayOk = runReplay(module, site);
      if (!replayOk) {
        console.log('REPLAY FAILED');
        failures.push(`${module}@${site} (replay failed)`);
        continue;
      }

      // Compare
      const score = runCompare(module, site);
      if (!score) {
        console.log('COMPARE FAILED');
        failures.push(`${module}@${site} (compare failed)`);
        continue;
      }

      results.push(score);

      if (score.overall >= threshold) {
        console.log(`${score.overall} ✓`);
      } else {
        console.log(`${score.overall} ✗ (below ${threshold})`);
        failures.push(`${module}@${site} (${score.overall} < ${threshold})`);
      }
    }
  }

  // Summary table
  console.log(`\n${'═'.repeat(70)}`);
  console.log('RESULTS');
  console.log('─'.repeat(70));
  console.log(
    'Module'.padEnd(8) +
    'Site'.padEnd(30) +
    'Data'.padStart(6) +
    'Chkpt'.padStart(7) +
    'FP'.padStart(5) +
    'Regr'.padStart(6) +
    'Total'.padStart(7),
  );
  console.log('─'.repeat(70));

  for (const s of results) {
    const status = s.overall >= threshold ? '✓' : '✗';
    console.log(
      s.module.padEnd(8) +
      s.site.padEnd(30) +
      `${s.dataAccuracy}%`.padStart(5) +
      `${s.checkpointAccuracy}%`.padStart(6) +
      `${s.falsePositiveRate}%`.padStart(5) +
      `${s.regressionGuard}%`.padStart(5) +
      `${s.overall}`.padStart(5) +
      ` ${status}`,
    );
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  // Exit code
  console.log(`\n${'═'.repeat(70)}`);
  if (failures.length === 0) {
    console.log(`✓ ALL PASSED (${results.length} tests, threshold ${threshold})`);
    process.exit(0);
  } else {
    console.log(`✗ ${failures.length} FAILED:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
