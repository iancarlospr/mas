import type { ScoreCategory } from '@marketing-alpha/types';

/* ── Category grouping ─────────────────────────────────────────── */

/** Categories available on the free tier (MarTech & Infrastructure). */
export const FREE_CATEGORIES = new Set(['overview', 'martech_infrastructure']);

export const CATEGORY_META: {
  key: ScoreCategory | 'overview' | 'paid_executive' | 'paid_roi' | 'paid_roadmap' | 'paid_costcutter';
  label: string;
  modules: string[];
  paidOnly?: boolean;
}[] = [
  { key: 'overview', label: 'Overview', modules: ['overview'] },
  { key: 'security_compliance', label: 'Security & Compliance', modules: ['M01', 'M12', 'M40'] },
  { key: 'analytics_measurement', label: 'Analytics & Measurement', modules: ['M05', 'M06', 'M06b', 'M08', 'M09'] },
  { key: 'performance_experience', label: 'Performance & Experience', modules: ['M03', 'M10', 'M11', 'M13', 'M14'] },
  { key: 'seo_content', label: 'SEO & Content', modules: ['M04', 'M15', 'M26', 'M34', 'M39'] },
  { key: 'paid_media', label: 'Paid Media', modules: ['M21', 'M28', 'M29'] },
  { key: 'martech_infrastructure', label: 'MarTech & Infrastructure', modules: ['M02', 'M07', 'M20'] },
  { key: 'brand_presence', label: 'Brand & Digital Presence', modules: ['M16', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38'] },
  { key: 'market_intelligence', label: 'Market Intelligence', modules: ['M24', 'M25', 'M27', 'M30', 'M31', 'M32', 'M33', 'M35', 'M36'] },
  { key: 'paid_executive', label: 'Executive Brief', modules: ['M42'], paidOnly: true },
  { key: 'paid_roi', label: 'Impact Scenarios', modules: ['M44'], paidOnly: true },
  { key: 'paid_roadmap', label: 'Remediation Roadmap', modules: ['M43'], paidOnly: true },
  { key: 'paid_costcutter', label: 'Stack Analyzer', modules: ['M45'], paidOnly: true },
];

export const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security', M02: 'CMS & Infrastructure', M03: 'Performance',
  M04: 'Page Metadata', M05: 'Analytics', M06: 'Paid Media',
  M06b: 'PPC Landing Audit', M07: 'MarTech', M08: 'Tag Governance',
  M09: 'Behavioral Intel', M10: 'Accessibility', M11: 'Console Errors',
  M12: 'Compliance', M13: 'Perf & Carbon', M14: 'Mobile & Responsive',
  M15: 'Social & Sharing', M16: 'PR & Media', M17: 'Careers & HR',
  M18: 'Investor Relations', M19: 'Support', M20: 'Ecommerce/SaaS',
  M21: 'Ad Library', M22: 'News Sentiment', M23: 'Social Sentiment',
  M24: 'Monthly Visits', M25: 'Traffic by Country', M26: 'Rankings',
  M27: 'Paid Traffic Cost', M28: 'Top Paid Keywords', M29: 'Competitors',
  M30: 'Traffic Sources', M31: 'Domain Trust',
  M33: 'Brand Search', M34: 'Losing Keywords',
  M36: 'Google Shopping', M37: 'Review Velocity', M38: 'Local Pack',
  M39: 'Sitemap & Indexing', M40: 'Subdomain & Attack Surface',
  M42: 'Executive Brief', M43: 'Remediation Roadmap',
  M44: 'Impact Scenarios', M45: 'Stack Analyzer',
};
