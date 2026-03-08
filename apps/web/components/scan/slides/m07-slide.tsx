'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import type { ModuleResult } from '@marketing-alpha/types';
import {
  SlideShellAlt,
  getM41Summary,
  getModuleResult,
  Pill,
  StatBlock,
  SkippedSlide,
} from './module-slide-template';

/**
 * M07 Slide — MarTech Orchestration
 * ══════════════════════════════════
 *
 * Layout B: SlideShellAlt (two-column: viz left, findings/recs right).
 * Viz: Tools grouped by category as pill clusters, forms section, payload stat.
 */

interface MartechTool {
  name: string;
  category?: string;
}

interface FormEntry {
  action?: string;
  method?: string;
  id?: string;
}

export function M07Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M07');
  const mod = getModuleResult(scan, 'M07');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="MarTech Orchestration" scan={scan} sourceLabel="Source: Cookie inspection, DOM globals, script profiling" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'MarTech stack assessment';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const tools = (raw?.['tools'] as MartechTool[] | undefined) ?? [];
  const forms = (raw?.['forms'] as FormEntry[] | undefined) ?? [];
  const martechBytes = typeof raw?.['martechBytes'] === 'number' ? raw['martechBytes'] as number : null;

  // ── Pull detected tools from ALL modules to build complete landscape ──
  const resultMap = new Map<string, ModuleResult>(scan.moduleResults.map(r => [r.moduleId, r]));
  const allDetectedTools = new Map<string, string>(); // name → category
  // M07 own tools
  for (const t of tools) {
    const name = typeof t.name === 'string' ? t.name : '';
    if (name) allDetectedTools.set(name, typeof t.category === 'string' ? t.category : 'Other');
  }
  // M05 analytics tools
  const m05 = resultMap.get('M05');
  const m05Tools = (m05?.data?.['tools'] as Array<{ name?: string; category?: string }> | undefined) ?? [];
  for (const t of m05Tools) {
    const name = typeof t.name === 'string' ? t.name : '';
    if (name && !allDetectedTools.has(name)) allDetectedTools.set(name, t.category ?? 'Analytics');
  }
  // M06 pixel names
  const m06 = resultMap.get('M06');
  const m06Pixels = (m06?.data?.['pixels'] as Array<{ name?: string; pixelType?: string }> | undefined) ?? [];
  for (const p of m06Pixels) {
    const name = typeof p.name === 'string' ? p.name : (typeof p.pixelType === 'string' ? p.pixelType : '');
    if (name && !allDetectedTools.has(name)) allDetectedTools.set(name, 'Advertising');
  }
  // Tool-detected signals from all modules
  for (const mr of scan.moduleResults) {
    for (const s of mr.signals ?? []) {
      if (s.type === 'tool_detected' && s.name && !allDetectedTools.has(s.name)) {
        allDetectedTools.set(s.name, s.category ?? 'Other');
      }
    }
  }

  // Group all tools by category
  const categoryMap = new Map<string, string[]>();
  for (const [name, cat] of allDetectedTools) {
    const catLabel = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const existing = categoryMap.get(catLabel) ?? [];
    existing.push(name);
    categoryMap.set(catLabel, existing);
  }

  const toolCount = allDetectedTools.size;

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  // Category colors (cycle through)
  const catColors = ['var(--gs-base)', 'var(--gs-terminal)', 'var(--gs-warning)', 'var(--gs-light)', 'var(--gs-mid)'];

  // Expected MarTech categories — check by both category labels AND known tool names
  const allToolNames = new Set(Array.from(allDetectedTools.keys()).map(n => n.toLowerCase()));
  const detectedCats = new Set(Array.from(categoryMap.keys()).map(c => c.toLowerCase()));
  const categoryChecks: Array<{ label: string; keywords: string[] }> = [
    { label: 'Analytics', keywords: ['analytics', 'google analytics', 'ga4', 'adobe analytics', 'matomo', 'plausible', 'mixpanel', 'amplitude', 'heap'] },
    { label: 'CRM', keywords: ['crm', 'salesforce', 'hubspot', 'pipedrive', 'zoho'] },
    { label: 'Email Marketing', keywords: ['email', 'mailchimp', 'klaviyo', 'sendgrid', 'mailgun', 'constant contact', 'campaign monitor'] },
    { label: 'Marketing Automation', keywords: ['marketing automation', 'marketo', 'pardot', 'eloqua', 'activecampaign'] },
    { label: 'A/B Testing', keywords: ['a/b test', 'optimizely', 'vwo', 'google optimize', 'ab tasty', 'convert'] },
    { label: 'Personalization', keywords: ['personalization', 'dynamic yield', 'evergage', 'monetate'] },
    { label: 'Chat / Support', keywords: ['chat', 'support', 'intercom', 'drift', 'zendesk', 'freshdesk', 'crisp', 'tawk', 'livechat'] },
    { label: 'Tag Management', keywords: ['tag manag', 'gtm', 'google tag manager', 'tealium', 'segment', 'adobe launch', 'ensighten'] },
    { label: 'Advertising', keywords: ['advertising', 'ad', 'pixel', 'meta pixel', 'facebook pixel', 'google ads', 'tiktok pixel', 'linkedin insight'] },
  ];
  const missingCategories = categoryChecks
    .filter(({ label, keywords }) => {
      if (detectedCats.has(label.toLowerCase())) return false;
      // Check if any known tool name for this category was detected
      return !keywords.some(kw => allToolNames.has(kw) || Array.from(allToolNames).some(t => t.includes(kw)));
    })
    .map(c => c.label);

  const vizContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em', overflow: 'auto' }}>
      {/* Stats tiles — full width */}
      <div style={{ display: 'flex', gap: '0.5em', paddingBottom: '0.4em', borderBottom: '1px solid rgba(255,178,239,0.06)' }}>
        {[
          { value: toolCount, label: 'Total Tools', color: 'var(--gs-light)', show: true },
          { value: forms.length, label: forms.length === 1 ? 'Form' : 'Forms', color: 'var(--gs-light)', show: forms.length > 0 },
          { value: martechBytes != null ? formatBytes(martechBytes) : '', label: 'MarTech Payload', color: martechBytes != null && martechBytes > 500_000 ? 'var(--gs-warning)' : 'var(--gs-light)', show: martechBytes != null },
          { value: categoryMap.size, label: 'Categories', color: categoryMap.size >= 4 ? 'var(--gs-terminal)' : categoryMap.size >= 2 ? 'var(--gs-warning)' : 'var(--gs-critical)', show: true },
        ].filter(s => s.show).map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '0.5em 0.4em', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(255,178,239,0.04)', border: '1px solid rgba(255,178,239,0.08)',
          }}>
            <p className="font-data tabular-nums" style={{ fontSize: 'clamp(16px, 1.8cqi, 22px)', fontWeight: 700, lineHeight: 1, color: s.color }}>
              {s.value}
            </p>
            <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 0.9cqi, 12px)', color: 'var(--gs-base)', letterSpacing: '0.06em', marginTop: '0.25em' }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tool categories */}
      {categoryMap.size > 0 && (
        <div>
          <h4 className="font-display uppercase" style={{ fontSize: 'clamp(12px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.3em' }}>
            Detected Stack
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
            {Array.from(categoryMap.entries()).map(([cat, names], ci) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em' }}>
                <span className="font-data" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: catColors[ci % catColors.length], fontWeight: 600, minWidth: '8em', flexShrink: 0 }}>
                  {cat}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
                  {names.map((name, ni) => (
                    <Pill key={ni} text={name} color={catColors[ci % catColors.length]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing categories assessment */}
      {missingCategories.length > 0 && (
        <div style={{ paddingTop: '0.3em', borderTop: '1px solid rgba(255,178,239,0.06)' }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-critical)', letterSpacing: '0.08em', marginBottom: '0.2em', opacity: 0.8 }}>
            Missing Categories
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2em' }}>
            {missingCategories.map((cat) => (
              <Pill key={cat} text={cat} color="var(--gs-critical)" />
            ))}
          </div>
        </div>
      )}

      {/* Forms detail */}
      {forms.length > 0 && (
        <div style={{ paddingTop: '0.3em', borderTop: '1px solid rgba(255,178,239,0.06)' }}>
          <p className="font-data uppercase" style={{ fontSize: 'clamp(12px, 1.1cqi, 13px)', color: 'var(--gs-mid)', letterSpacing: '0.08em', marginBottom: '0.2em' }}>
            Forms Detected
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1em' }}>
            {forms.map((f, i) => (
              <p key={i} className="font-data" style={{ fontSize: 'clamp(12px, 1.15cqi, 13px)', color: 'var(--gs-light)', opacity: 0.8 }}>
                {f.id ?? f.action ?? `Form ${i + 1}`}
                {f.method ? ` (${f.method.toUpperCase()})` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <SlideShellAlt
      moduleName="MarTech Orchestration"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Cookie inspection, DOM globals, script profiling"
      vizContent={vizContent}
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    />
  );
}
