# Ghostlab Optimization Playbook

Recursive module optimization loop for passive scan modules.
Uses captured fixtures from ryder.com and senzary.com as benchmark sites.

## Prerequisites

```bash
cd apps/engine

# 1. Capture baselines (one-time, needs network + Supabase)
npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --all

# 2. Verify fixtures exist
ls test/fixtures/ghostlab/senzary.com/
ls test/fixtures/ghostlab/ryder.com/

# 3. Ground truth files should already exist (hand-authored from QA sessions)
cat test/fixtures/ghostlab/senzary.com/ground-truth.json | head
cat test/fixtures/ghostlab/ryder.com/ground-truth.json | head
```

## The Loop — Per Module

### Step 1: Baseline (2 min)

```bash
npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=senzary.com --save
npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=ryder.com --save
npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites
```

Record the baseline scores. These are your "before" numbers.

### Step 2: Analyze (10-15 min)

Read the comparison output. Identify:
- [ ] Mismatched data fields (accuracy gaps)
- [ ] Wrong checkpoint health values
- [ ] False positives still present
- [ ] Regressions from previous fixes
- [ ] Missing detections (completeness gaps)

Prioritize by impact: **false positives > accuracy > completeness**.

Also read the module source code to understand WHY the issues exist:
```bash
# Read the full module
cat src/modules/passive/m16-pr-media.ts
```

### Step 3: Improve (15-30 min)

Edit ONE category of issues per iteration in the module source file.
Focus on the highest-impact issue first.

Example: if a press page false positive exists, fix the detection logic.
Do NOT fix 5 things at once — isolate changes for clear before/after comparison.

### Step 4: Replay & Compare (2 min)

```bash
npx tsx scripts/ghostlab/replay-module.ts --module=M16 --all-sites --save
npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites
```

Check:
- Did overall score improve?
- Did any dimension regress?
- Did the fix work on BOTH sites?

### Step 5: Judge (2 min)

| Result | Action |
|--------|--------|
| Improved on BOTH sites | Keep the change, commit |
| Improved on one, regressed on other | Fix is too site-specific — generalize |
| Regressed on both | Revert: `git checkout -- src/modules/passive/m16-pr-media.ts` |
| Same score but simpler code | Keep — simplicity is a win |

### Step 6: Loop

Go back to Step 2. Repeat until exit criteria met.

## Exit Criteria

Per module, stop when:
- Data accuracy >= 95% on both sites
- Checkpoint accuracy >= 90% on both sites
- False positive rate = 100% (zero violations)
- Regression score = 100% (all fixed bugs stay fixed)

## Module Priority Order

| # | Module | Lines | Reason |
|---|--------|-------|--------|
| 1 | M16 (PR/Media) | 822 | Smallest, most QA bugs found |
| 2 | M17 (Careers) | 699 | Second smallest, missing fallback probing |
| 3 | M19 (Support) | 1078 | Known false positive patterns |
| 4 | M18 (IR) | 927 | Fixed NSE/NYSE, English-only board names |
| 5 | M02 (CMS) | 1562 | Fingerprint database, foundational |
| 6 | M04 (Metadata) | 2219 | Broad surface, mostly clean in QA |
| 7 | M01 (DNS) | 2473 | Most complex, needs DNS mock |

## Adding New Benchmark Sites

```bash
# 1. Run a paid scan of the site through the product
# 2. QA the results manually (use the QA audit methodology)
# 3. Capture baselines
npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts \
  --domain=newsite.com --scan-id=<uuid-prefix>

# 4. Create ground truth from QA findings
# Edit: test/fixtures/ghostlab/newsite.com/ground-truth.json

# 5. Re-run comparison across all sites
npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites
```

## Quick Reference

```bash
# Capture baselines (needs network)
npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --all

# Replay one module against one site
npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=senzary.com --save

# Replay one module against all sites
npx tsx scripts/ghostlab/replay-module.ts --module=M16 --all-sites --save

# Compare one module against one site
npx tsx scripts/ghostlab/compare-results.ts --module=M16 --site=senzary.com

# Compare one module against all sites
npx tsx scripts/ghostlab/compare-results.ts --module=M16 --all-sites

# Compare all modules against one site
npx tsx scripts/ghostlab/compare-results.ts --all --site=senzary.com

# Typecheck after changes
npx tsc --noEmit --project tsconfig.json
```

## Scoring Dimensions

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Data accuracy | 30% | Expected fields present with correct values |
| Checkpoint health | 25% | Checkpoints have expected health levels |
| False positive rate | 20% | Negative assertions pass |
| Regression guard | 15% | Previously fixed bugs stay fixed |
| Completeness | 10% | Expected checkpoints exist |
