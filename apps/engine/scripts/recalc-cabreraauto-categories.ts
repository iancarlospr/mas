import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const scanId = '06692cea-92a8-440a-9bb1-13c21def13ca';

const CATEGORY_MODULES: Record<string, string[]> = {
  security_compliance: ['M01', 'M12', 'M40'],
  analytics_measurement: ['M05', 'M06', 'M06b', 'M08', 'M09'],
  performance_experience: ['M03', 'M10', 'M11', 'M13', 'M14'],
  seo_content: ['M04', 'M15', 'M26', 'M34', 'M39'],
  paid_media: ['M21', 'M28', 'M29'],
  martech_infrastructure: ['M02', 'M07', 'M20'],
  brand_presence: ['M16', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38'],
  market_intelligence: ['M24', 'M25', 'M27', 'M30', 'M31', 'M32', 'M33', 'M35', 'M36'],
};

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  security_compliance: 'Security & Compliance',
  analytics_measurement: 'Analytics & Measurement',
  performance_experience: 'Performance & Experience',
  seo_content: 'SEO & Content',
  paid_media: 'Paid Media',
  martech_infrastructure: 'MarTech & Infrastructure',
  brand_presence: 'Brand & Digital Presence',
  market_intelligence: 'Market Intelligence',
};

function getTrafficLight(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

function getLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Critical';
}

async function main() {
  // Read M41 module summaries
  const { data: m41Row } = await sb.from('module_results').select('data').eq('scan_id', scanId).eq('module_id', 'M41').single();
  const summaries = (m41Row?.data as Record<string, unknown>)?.moduleSummaries as Record<string, Record<string, unknown>>;

  // Build score map from M41
  const scoreMap: Record<string, number | null> = {};
  for (const [mod, syn] of Object.entries(summaries)) {
    scoreMap[mod] = syn.module_score != null ? syn.module_score as number : null;
  }

  // Calculate category scores
  const categories = Object.entries(CATEGORY_MODULES).map(([category, moduleIds]) => {
    const moduleScores: Array<{ moduleId: string; score: number | null }> = [];
    const validScores: number[] = [];

    for (const moduleId of moduleIds) {
      const score = scoreMap[moduleId] ?? null;
      moduleScores.push({ moduleId, score });
      if (score != null) validScores.push(score);
    }

    const categoryScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

    return {
      category,
      score: categoryScore,
      light: getTrafficLight(categoryScore),
      moduleScores,
    };
  });

  // Calculate overall MarketingIQ
  const allScores: number[] = [];
  for (const syn of Object.values(summaries)) {
    if (syn.module_score != null) allScores.push(syn.module_score as number);
  }
  const raw = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  const marketingIqResult = {
    raw,
    penalties: [],
    bonuses: [],
    final: raw,
    label: getLabel(raw),
    categories,
  };

  // Print results
  console.log('MarketingIQ:', raw, `(${getLabel(raw)})`);
  console.log('\nCategory scores:');
  for (const cat of categories) {
    console.log(`  ${CATEGORY_DISPLAY_NAMES[cat.category]}: ${cat.score} (${cat.light})`);
    for (const ms of cat.moduleScores) {
      console.log(`    ${ms.moduleId}: ${ms.score ?? 'null'}`);
    }
  }

  // Update scan record
  const { error } = await sb.from('scans').update({
    marketing_iq: raw,
    marketing_iq_result: marketingIqResult,
  }).eq('id', scanId);

  if (error) throw error;
  console.log('\nScan record updated with recalculated marketing_iq_result');
}

main();
