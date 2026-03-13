/**
 * Tool Extractor — per-module functions that reshape existing module `data`
 * fields into a standardized `DetectedTool[]` array.
 *
 * No new detection logic — pure reshaping of what each module already outputs.
 */

import type { DetectedTool, DetectedToolCategory, DetectedToolEvidenceType } from '@marketing-alpha/types';

// ── Helper ──────────────────────────────────────────────────────────────

function tool(
  name: string,
  category: DetectedToolCategory,
  confidence: number,
  source: string,
  evidenceType: DetectedToolEvidenceType,
  identifier?: string,
): DetectedTool {
  return { name, category, confidence, source, evidenceType, ...(identifier ? { identifier } : {}) };
}

// ── Per-module extractors ───────────────────────────────────────────────

type Extractor = (data: Record<string, unknown>) => DetectedTool[];

function extractM01(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const email = data['emailProvider'] as { provider?: string } | undefined;
  if (email?.provider && email.provider !== 'none' && email.provider !== 'Custom') {
    tools.push(tool(email.provider, 'email', 0.9, 'M01', 'dns'));
  }

  const ns = data['nsProvider'] as { provider?: string; confidence?: number } | undefined;
  if (ns?.provider && ns.provider !== 'unknown') {
    tools.push(tool(ns.provider, 'dns', ns.confidence ?? 0.8, 'M01', 'dns'));
  }

  const verifications = data['domainVerifications'] as Array<{ service: string }> | undefined;
  if (verifications) {
    for (const v of verifications) {
      tools.push(tool(v.service, 'other', 0.9, 'M01', 'dns'));
    }
  }

  return tools;
}

function extractM02(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  // Category mapping for M02's DetectedTech category field
  const M02_CATEGORY_MAP: Record<string, DetectedToolCategory> = {
    cms: 'cms',
    cdn: 'cdn',
    framework: 'framework',
    hosting: 'hosting',
    analytics: 'analytics',
    tag_manager: 'tag_manager',
    advertising: 'advertising',
    server: 'hosting',
    language: 'framework',
    build_tool: 'framework',
    security: 'security',
    font: 'other',
    widget: 'other',
  };

  const techs = data['detectedTechnologies'] as Array<{
    name: string;
    category: string;
    confidence: number;
    id?: string;
  }> | undefined;

  if (techs) {
    for (const t of techs) {
      const cat = M02_CATEGORY_MAP[t.category] ?? 'other';
      tools.push(tool(t.name, cat, t.confidence, 'M02', 'fingerprint', t.id));
    }
  }

  // Structured fields (cms, cdn, framework, hosting, server) if not already in detectedTechnologies
  const techNames = new Set((techs ?? []).map(t => t.name.toLowerCase()));

  for (const field of ['cms', 'cdn', 'framework', 'hosting', 'server'] as const) {
    const obj = data[field] as { name?: string | null; confidence?: number; id?: string } | null | undefined;
    if (obj?.name && !techNames.has(obj.name.toLowerCase())) {
      const cat = M02_CATEGORY_MAP[field] ?? 'other';
      tools.push(tool(obj.name, cat, obj.confidence ?? 0.8, 'M02', 'header', obj.id));
    }
  }

  const waf = data['waf'] as { name?: string | null } | null | undefined;
  if (waf?.name) {
    tools.push(tool(waf.name, 'security', 0.85, 'M02', 'header'));
  }

  return tools;
}

function extractM05(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const M05_TYPE_MAP: Record<string, DetectedToolCategory> = {
    analytics: 'analytics',
    tag_manager: 'tag_manager',
    session_replay: 'session_replay',
    heatmap: 'session_replay',
  };

  const m05tools = data['tools'] as Array<{
    name: string;
    type: string;
    id?: string;
    confidence: number;
  }> | undefined;

  if (m05tools) {
    for (const t of m05tools) {
      const cat = M05_TYPE_MAP[t.type] ?? 'analytics';
      tools.push(tool(t.name, cat, t.confidence, 'M05', 'global', t.id));
    }
  }

  const consent = data['consent'] as { consentPlatform?: string | null } | undefined;
  if (consent?.consentPlatform) {
    tools.push(tool(consent.consentPlatform, 'consent', 0.9, 'M05', 'global'));
  }

  if (data['serverSideTracking']) {
    tools.push(tool('Server-Side GTM (sGTM)', 'tag_manager', 0.85, 'M05', 'network'));
  }

  return tools;
}

function extractM06(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const pixels = data['pixels'] as Array<{
    name: string;
    id: string | null;
    confidence: number;
  }> | undefined;

  if (pixels) {
    for (const p of pixels) {
      tools.push(tool(p.name, 'advertising', p.confidence, 'M06', 'network', p.id ?? undefined));
    }
  }

  if (data['capiDetected']) {
    tools.push(tool('Conversions API (CAPI)', 'advertising', 0.9, 'M06', 'network'));
  }

  return tools;
}

function extractM07(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const M07_CATEGORY_MAP: Record<string, DetectedToolCategory> = {
    crm: 'crm_marketing_automation',
    marketing_automation: 'crm_marketing_automation',
    email_marketing: 'crm_marketing_automation',
    chat: 'chat_support',
    live_chat: 'chat_support',
    support: 'chat_support',
    forms: 'crm_marketing_automation',
    personalization: 'ab_testing',
    analytics: 'analytics',
    social: 'social',
    push: 'push_notifications',
    scheduling: 'other',
  };

  const m07tools = data['tools'] as Array<{
    name: string;
    category: string;
    confidence: number;
    source: string;
  }> | undefined;

  if (m07tools) {
    for (const t of m07tools) {
      const cat = M07_CATEGORY_MAP[t.category] ?? 'crm_marketing_automation';
      const evidence: DetectedToolEvidenceType =
        t.source === 'cookie' ? 'cookie' :
        t.source === 'network' ? 'network' :
        t.source === 'dom' ? 'dom' : 'global';
      tools.push(tool(t.name, cat, t.confidence, 'M07', evidence));
    }
  }

  // Unique tools from martech cookies not already in tools[]
  const toolNames = new Set((m07tools ?? []).map(t => t.name.toLowerCase()));
  const cookies = data['martechCookies'] as Array<{ tool: string }> | undefined;
  if (cookies) {
    for (const c of cookies) {
      if (c.tool && !toolNames.has(c.tool.toLowerCase())) {
        toolNames.add(c.tool.toLowerCase());
        tools.push(tool(c.tool, 'crm_marketing_automation', 0.7, 'M07', 'cookie'));
      }
    }
  }

  return tools;
}

function extractM08(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const tms = data['tms'] as Array<{
    name: string;
    containers: string[];
    confidence: number;
  }> | undefined;

  if (tms) {
    for (const tm of tms) {
      const id = tm.containers.length > 0 ? tm.containers[0] : undefined;
      tools.push(tool(tm.name, 'tag_manager', tm.confidence, 'M08', 'global', id));
    }
  }

  // ThirdPartyProfiler category → DetectedToolCategory
  const PROFILE_CATEGORY_MAP: Record<string, DetectedToolCategory> = {
    analytics: 'analytics',
    advertising: 'advertising',
    tag_manager: 'tag_manager',
    martech: 'crm_marketing_automation',
    social: 'social',
    cdn: 'cdn',
    font: 'other',
    other: 'other',
  };

  const profiles = data['thirdPartyProfiles'] as Array<{
    toolName: string | null;
    category: string;
    domain: string;
  }> | undefined;

  if (profiles) {
    const seen = new Set((tms ?? []).map(t => t.name.toLowerCase()));
    for (const p of profiles) {
      // Use toolName if known, otherwise use the domain itself
      const name = p.toolName ?? p.domain;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const cat = PROFILE_CATEGORY_MAP[p.category] ?? 'other';
      const confidence = p.toolName ? 0.7 : 0.5;
      tools.push(tool(name, cat, confidence, 'M08', 'network'));
    }
  }

  return tools;
}

function extractM09(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const behavioral = data['behavioral'] as {
    experiments?: string[];
    sessionRecording?: string[];
  } | undefined;

  if (behavioral?.experiments) {
    for (const name of behavioral.experiments) {
      // Strip " (cookie)" suffix
      const clean = name.replace(/\s*\(cookie\)$/i, '');
      tools.push(tool(clean, 'ab_testing', 0.85, 'M09', 'global'));
    }
  }

  if (behavioral?.sessionRecording) {
    for (const name of behavioral.sessionRecording) {
      tools.push(tool(name, 'session_replay', 0.85, 'M09', 'global'));
    }
  }

  const push = data['pushNotifications'] as { sdkDetected?: boolean; sdkName?: string | null } | undefined;
  if (push?.sdkDetected && push.sdkName) {
    tools.push(tool(push.sdkName, 'push_notifications', 0.85, 'M09', 'global'));
  }

  const gating = data['contentGating'] as { paywallProvider?: string | null } | undefined;
  if (gating?.paywallProvider) {
    tools.push(tool(gating.paywallProvider, 'other', 0.8, 'M09', 'global'));
  }

  return tools;
}

function extractM10(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const a11y = data['a11y'] as { overlays?: string[] } | undefined;
  if (a11y?.overlays) {
    for (const name of a11y.overlays) {
      if (name !== 'Unknown overlay') {
        tools.push(tool(name, 'accessibility', 0.9, 'M10', 'dom'));
      }
    }
  }

  return tools;
}

function extractM11(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const errorTools = data['errorTools'] as string[] | undefined;
  if (errorTools) {
    for (const name of errorTools) {
      tools.push(tool(name, 'error_monitoring', 0.85, 'M11', 'global'));
    }
  }

  // SDK init logs may confirm tools not in errorTools
  const seen = new Set((errorTools ?? []).map(t => t.toLowerCase()));
  const sdkLogs = data['sdkInitLogs'] as Array<{ tool?: string }> | undefined;
  if (sdkLogs) {
    for (const log of sdkLogs) {
      if (log.tool && !seen.has(log.tool.toLowerCase())) {
        seen.add(log.tool.toLowerCase());
        tools.push(tool(log.tool, 'other', 0.7, 'M11', 'global'));
      }
    }
  }

  return tools;
}

function extractM12(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const banner = data['consentBanner'] as { platform?: string | null } | undefined;
  if (banner?.platform) {
    tools.push(tool(banner.platform, 'consent', 0.9, 'M12', 'dom'));
  }

  return tools;
}

function extractM13(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const provider = data['greenProvider'] as string | null | undefined;
  if (provider) {
    tools.push(tool(provider, 'hosting', 0.8, 'M13', 'header'));
  }

  return tools;
}

function extractM15(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const social = data['socialData'] as {
    hasShareThis?: boolean;
    hasAddThis?: boolean;
  } | undefined;

  if (social?.hasShareThis) tools.push(tool('ShareThis', 'social', 0.85, 'M15', 'dom'));
  if (social?.hasAddThis) tools.push(tool('AddThis', 'social', 0.85, 'M15', 'dom'));

  return tools;
}

function extractM16(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const services = data['wire_services'] as string[] | undefined;
  if (services) {
    for (const name of services) {
      tools.push(tool(name, 'other', 0.8, 'M16', 'meta'));
    }
  }

  return tools;
}

function extractM17(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const provider = data['ats_provider'] as string | null | undefined;
  if (provider) {
    tools.push(tool(provider, 'other', 0.85, 'M17', 'dom'));
  }

  return tools;
}

function extractM19(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const helpCenter = data['help_center_provider'] as string | null | undefined;
  if (helpCenter) {
    tools.push(tool(helpCenter, 'chat_support', 0.85, 'M19', 'dom'));
  }

  const statusPage = data['status_page'] as { provider?: string | null } | undefined;
  if (statusPage?.provider) {
    tools.push(tool(statusPage.provider, 'other', 0.8, 'M19', 'dom'));
  }

  const forum = data['community_forum'] as { provider?: string | null } | undefined;
  if (forum?.provider) {
    tools.push(tool(forum.provider, 'other', 0.8, 'M19', 'dom'));
  }

  return tools;
}

function extractM20(data: Record<string, unknown>): DetectedTool[] {
  const tools: DetectedTool[] = [];

  const ecom = data['ecommerce'] as { platform?: string | null } | undefined;
  if (ecom?.platform) {
    tools.push(tool(ecom.platform, 'ecommerce', 0.9, 'M20', 'dom'));
  }

  const payments = data['paymentProviders'] as string[] | null | undefined;
  if (payments) {
    for (const name of payments) {
      tools.push(tool(name, 'payment', 0.85, 'M20', 'dom'));
    }
  }

  const auth = data['authProviders'] as string[] | null | undefined;
  if (auth) {
    for (const name of auth) {
      tools.push(tool(name, 'auth', 0.85, 'M20', 'dom'));
    }
  }

  const formSecurity = data['formSecurity'] as { captchaType?: string | null } | undefined;
  if (formSecurity?.captchaType) {
    tools.push(tool(formSecurity.captchaType, 'security', 0.9, 'M20', 'dom'));
  }

  return tools;
}

// ── Extractor registry ──────────────────────────────────────────────────

const EXTRACTORS: Record<string, Extractor> = {
  M01: extractM01,
  M02: extractM02,
  M05: extractM05,
  M06: extractM06,
  M07: extractM07,
  M08: extractM08,
  M09: extractM09,
  M10: extractM10,
  M11: extractM11,
  M12: extractM12,
  M13: extractM13,
  M15: extractM15,
  M16: extractM16,
  M17: extractM17,
  M19: extractM19,
  M20: extractM20,
};

/**
 * Extract DetectedTool[] from a module's output data.
 * Returns empty array for modules without an extractor or on error.
 */
export function extractDetectedTools(moduleId: string, data: Record<string, unknown>): DetectedTool[] {
  const extractor = EXTRACTORS[moduleId];
  if (!extractor) return [];
  try {
    return extractor(data);
  } catch {
    return [];
  }
}
