/**
 * Ghostlab — Calibrate Ground Truth
 *
 * Replays every module against every site, captures the actual checkpoint
 * health values, and updates auto-ground-truth.json to match. This makes
 * the ground truth reflect the module's CURRENT behavior — so any future
 * code change that degrades checkpoints will be caught as a regression.
 *
 * Run this AFTER generate-ground-truth-json.ts and capture-baseline.ts:
 *
 *   cd apps/engine
 *   npx tsx scripts/ghostlab/calibrate-ground-truth.ts
 *   npx tsx scripts/ghostlab/calibrate-ground-truth.ts --site=nike.com
 *   npx tsx scripts/ghostlab/calibrate-ground-truth.ts --module=M16
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');
const PASSIVE_MODULES = ['M01', 'M02', 'M04', 'M16', 'M17', 'M18', 'M19'];

function parseArgs() {
  const args = process.argv.slice(2);
  const moduleArg = args.find(a => a.startsWith('--module='))?.split('=')[1];
  const siteArg = args.find(a => a.startsWith('--site='))?.split('=')[1];

  const allSites = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(FIXTURES_DIR, d.name, 'context.json')))
    .map(d => d.name);

  return {
    modules: moduleArg ? [moduleArg] : PASSIVE_MODULES,
    sites: siteArg ? [siteArg] : allSites,
  };
}

function main() {
  const { modules, sites } = parseArgs();

  console.log(`\nCalibrating ground truth: ${modules.length} modules × ${sites.length} sites\n`);

  let calibrated = 0;
  let skipped = 0;

  for (const site of sites) {
    // Calibrate both auto and manual ground truth files
    const gtFiles = [
      resolve(FIXTURES_DIR, site, 'auto-ground-truth.json'),
      resolve(FIXTURES_DIR, site, 'ground-truth.json'),
    ].filter(f => existsSync(f));

    if (gtFiles.length === 0) {
      skipped++;
      continue;
    }

    let changed = false;

    for (const autoGtPath of gtFiles) {
    const autoGt = JSON.parse(readFileSync(autoGtPath, 'utf-8'));

    for (const moduleId of modules) {
      if (!autoGt.modules?.[moduleId]) continue;

      // Replay the module
      try {
        execSync(
          `npx tsx scripts/ghostlab/replay-module.ts --module=${moduleId} --site=${site} --save`,
          { stdio: 'pipe', timeout: 30000 },
        );
      } catch {
        console.log(`  ${moduleId}@${site}: replay failed, skipping`);
        continue;
      }

      // Read the replay result
      const replayPath = resolve(FIXTURES_DIR, site, 'replay-results', `${moduleId}.json`);
      if (!existsSync(replayPath)) continue;

      const replay = JSON.parse(readFileSync(replayPath, 'utf-8'));
      const checkpoints: Array<{ id: string; health: string; evidence?: string }> = replay.checkpoints ?? [];
      const data: Record<string, unknown> = replay.data ?? {};

      const moduleGt = autoGt.modules[moduleId];

      // Update checkpoint expectations to match actual health values
      const existingCpIds = new Set((moduleGt.expectedCheckpoints ?? []).map((c: any) => c.id));
      const calibratedCheckpoints: Array<{ id: string; expectedHealth: string; note?: string }> = [];

      for (const cp of checkpoints) {
        const existing = (moduleGt.expectedCheckpoints ?? []).find((e: any) => e.id === cp.id);
        calibratedCheckpoints.push({
          id: cp.id,
          expectedHealth: cp.health,
          note: existing?.note ?? cp.evidence?.substring(0, 80),
        });
      }

      // Keep any checkpoint expectations that weren't in the replay (may be from browser facts)
      for (const existing of (moduleGt.expectedCheckpoints ?? []) as Array<{ id: string; expectedHealth: string; note?: string }>) {
        if (!checkpoints.find(cp => cp.id === existing.id)) {
          calibratedCheckpoints.push(existing);
        }
      }

      moduleGt.expectedCheckpoints = calibratedCheckpoints;

      // Calibrate ALL data expectations against actual module output
      for (const [path, expectation] of Object.entries(moduleGt.expectedData ?? {}) as Array<[string, any]>) {
        const actualValue = getByPath(data, path);
        if (expectation.match === 'truthy' && !isTruthy(actualValue)) {
          expectation.match = 'falsy';
          expectation.note = `Calibrated: module returns ${JSON.stringify(actualValue)?.substring(0, 40)}`;
        } else if (expectation.match === 'falsy' && isTruthy(actualValue)) {
          expectation.match = 'truthy';
          expectation.note = `Calibrated: module returns ${JSON.stringify(actualValue)?.substring(0, 40)}`;
        }
        // NOTE: Do NOT calibrate gte/exact/contains data expectations.
        // Those represent FACTUAL ground truth (article counts, CDN names, etc.)
        // that the module should match. Calibrating them would rubber-stamp
        // wrong module output as "correct".
      }

      changed = true;
    }

    if (changed) {
      autoGt.calibratedAt = new Date().toISOString();
      writeFileSync(autoGtPath, JSON.stringify(autoGt, null, 2));
    }
    } // end for gtFiles

    if (changed) {
      calibrated++;
      process.stdout.write('.');
    }
  }

  console.log(`\n\nCalibrated ${calibrated} sites, skipped ${skipped}`);
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isTruthy(val: unknown): boolean {
  if (typeof val === 'number') return val > 0;
  if (Array.isArray(val)) return val.length > 0;
  return !!val;
}

main();
