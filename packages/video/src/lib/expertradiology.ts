/**
 * Expert Radiology scan data — derived from the 2026-03-31 paid scan.
 * MIQ: 54 / Developing
 */
import { COLOR } from './constants';

export const ER_DOMAIN = 'expertradiology.com';
export const ER_URL = 'https://expertradiology.com/';
export const ER_SCORE = 54;
export const ER_LABEL = 'Developing';
export const ER_DATE = 'March 31, 2026';
export const ER_MODULES_RAN = '44 / 45';

export const ER_VERDICT =
  "They can spot a fracture the size of a hair but their marketing budget has a hole in it you could drive an ambulance through";

export const ER_SYNTHESIS_HEADLINE =
  'National Teleradiology Ambitions Undermined by Missing Lead Capture, Empty Analytics, and a Hijacked Local Search Profile';

/** Hook text — same as main app H1 */
export const ER_HOOK_LINE = 'Your website is losing you money.';
export const ER_SUBLINE = "Let's fix that.";

/** Categories sorted by score descending */
export const ER_CATEGORIES = [
  { name: 'Performance', score: 78, color: COLOR.terminal },
  { name: 'SEO & Content', score: 73, color: COLOR.terminal },
  { name: 'Security', score: 64, color: COLOR.warning },
  { name: 'MarTech', score: 57, color: COLOR.warning },
  { name: 'Analytics', score: 45, color: COLOR.warning },
  { name: 'Brand', score: 45, color: COLOR.warning },
  { name: 'Market Intel', score: 44, color: COLOR.warning },
  { name: 'Paid Media', score: 32, color: COLOR.critical },
] as const;

/** Key findings from M42 synthesis */
export const ER_FINDINGS = [
  {
    title: 'Zero lead capture forms',
    severity: 'critical' as const,
    desc: 'Targeting high-value B2B clients across 50 states with no contact forms — prospects forced through a chat widget',
  },
  {
    title: 'Google Business Profile hijacked',
    severity: 'critical' as const,
    desc: 'Local search traffic actively diverted to a Canadian competitor — warm leads handed to another clinic',
  },
  {
    title: 'Analytics is a black hole',
    severity: 'critical' as const,
    desc: 'GTM installed but data layer is empty, tags firing outside governance, zero conversion tracking',
  },
  {
    title: 'Zero referring domains',
    severity: 'warning' as const,
    desc: 'No backlinks for a YMYL medical-legal service — organic authority capped, cant rank for commercial terms',
  },
  {
    title: 'Grade 27.4 readability',
    severity: 'warning' as const,
    desc: 'Academic-grade copy alienating the attorneys and clinicians it aims to attract',
  },
  {
    title: '216ms TTFB',
    severity: 'good' as const,
    desc: 'Lightning-fast Vercel hosting with lean 507KB page weight — excellent technical foundation',
  },
] as const;

/** Boot lines for scan sequence */
export const ER_BOOT_LINES = [
  { text: 'GhostScan OS v2.0.26 — Forensic Marketing Intelligence', type: 'info' },
  { text: `Target acquired: ${ER_DOMAIN}`, type: 'ok' },
  { text: 'DNS resolution complete', type: 'ok' },
  { text: 'Loading forensic module array (42 modules)', type: 'scan' },
  { text: 'Ghost detection array: ARMED', type: 'ghost' },
  { text: 'Stealth browser initialized (Chrome 134)', type: 'ok' },
  { text: `Rendering ${ER_DOMAIN}...`, type: 'scan' },
] as const;

/** Module extraction lines — healthcare/radiology themed */
export const ER_MODULE_LINES = [
  'SEO Fundamentals: EXTRACTED',
  'MarTech Stack: EXTRACTED',
  'Analytics Coverage: EXTRACTED',
  'Performance Metrics: EXTRACTED',
  'Security Headers: EXTRACTED',
  'Lead Capture Audit: EXTRACTED',
  'Content Quality: EXTRACTED',
  'Local Search Profile: EXTRACTED',
  'Accessibility: EXTRACTED',
  'Brand Presence: EXTRACTED',
  'Competitor Intel: EXTRACTED',
  'Paid Media Signals: EXTRACTED',
] as const;

/** Boss Deck wins */
export const ER_WINS = [
  { label: 'Server Response', value: '216ms', icon: '⚡' },
  { label: 'US Traffic', value: '89%', icon: '🎯' },
  { label: 'Wasted Ad Spend', value: '$0', icon: '💰' },
] as const;

/** Boss Deck top issues */
export const ER_TOP_ISSUES = [
  'Zero lead capture forms on the entire site',
  'Google Business Profile hijacked by Canadian competitor',
  'Analytics infrastructure is completely blind',
] as const;
