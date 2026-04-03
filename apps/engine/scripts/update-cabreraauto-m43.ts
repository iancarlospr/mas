/**
 * update-cabreraauto-m43.ts
 *
 * Replaces M43 (Remediation Plan / PRD) for scan 06692cea-92a8-440a-9bb1-13c21def13ca
 * with corrected factual data from the cabreraauto.com investigation.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SCAN_ID = '06692cea-92a8-440a-9bb1-13c21def13ca';

async function replaceM43() {
  console.log('Replacing M43 (Remediation Plan)...');

  const markdown = readFileSync(resolve(__dirname, 'cabreraauto-prd.md'), 'utf-8');

  const metadata = {
    title: 'Remediation Plan: Cabrera Auto Group',
    businessName: 'Cabrera Auto Group',
    scanDate: '2026-04-02',
    totalFindings: 38,
    p0Count: 8,
    p1Count: 12,
    p2Count: 12,
    p3Count: 6,
    estimatedTimelineWeeks: 8,
  };

  const data = {
    markdown,
    metadata,
    promptVersion: 'manual-correction-2026-04-02',
  };

  const checkpoints = [
    { id: 'm43-findings-count', name: 'Total Findings', weight: 0, health: 'info',
      evidence: metadata.totalFindings + ' findings: ' + metadata.p0Count + ' P0, ' + metadata.p1Count + ' P1, ' + metadata.p2Count + ' P2, ' + metadata.p3Count + ' P3' },
    { id: 'm43-doc-length', name: 'Document Completeness', weight: 0, health: 'info',
      evidence: markdown.length + ' characters, all priority tiers covered with implementation steps and verification criteria' },
  ];

  const { error } = await supabase.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M43',
    status: 'success',
    score: null,
    data,
    checkpoints,
    signals: [],
  }, { onConflict: 'scan_id,module_id' });

  if (error) throw error;
  console.log('  M43 replaced (PRD: ' + markdown.length + ' chars, ' + metadata.totalFindings + ' findings)');
}

async function main() {
  console.log('Updating M43 (Remediation Plan) for cabreraauto.com...\n');
  await replaceM43();
  console.log('\nM43 updated successfully.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
