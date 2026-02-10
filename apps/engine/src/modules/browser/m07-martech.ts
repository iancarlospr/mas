/**
 * M07 - MarTech Orchestration
 *
 * Detects marketing automation, CRM integrations, email capture forms,
 * live chat widgets, popup tools, scheduling tools, and other marketing
 * technology from window globals, DOM inspection, and network requests.
 *
 * Checkpoints:
 *   1. Marketing automation present
 *   2. Email capture forms
 *   3. CRM integration signals
 *   4. Live chat / support widget
 *   5. Form builder quality
 *   6. Popup/modal tools
 *   7. Cookie inventory coherence
 *   8. Tool integration depth
 *   9. Push notification setup
 *  10. Scheduling/booking tool
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MartechTool {
  name: string;
  category: 'marketing_automation' | 'crm' | 'live_chat' | 'popup' | 'push' | 'scheduling' | 'form_builder' | 'cdp' | 'personalization' | 'referral' | 'review' | 'video' | 'sms';
  confidence: number;
  details: Record<string, unknown>;
}

interface FormInfo {
  action: string;
  method: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hiddenFields: string[];
  formBuilder: string | null;
  inputCount: number;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page) {
    return {
      moduleId: 'M07' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M07',
    };
  }

  // ─── Step 1: Detect MarTech tools via window globals ─────────────────────
  const evalResult = await page.evaluate((): { tools: MartechTool[]; forms: FormInfo[] } => {
    const tools: MartechTool[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- Marketing Automation ---
    // HubSpot
    if (w['_hsq'] || w['hbspt'] || w['HubSpotConversations']) {
      tools.push({ name: 'HubSpot', category: 'marketing_automation', confidence: 0.95, details: {} });
    }
    // Marketo
    if (w['Munchkin'] || w['mktoForm'] || w['MktoForms2']) {
      tools.push({ name: 'Marketo', category: 'marketing_automation', confidence: 0.95, details: {} });
    }
    // Pardot
    if (w['piAId'] || w['piCId'] || w['piTracker']) {
      tools.push({ name: 'Pardot', category: 'marketing_automation', confidence: 0.9, details: {} });
    }
    // ActiveCampaign
    if (w['trackcmp_url'] || w['vgo']) {
      tools.push({ name: 'ActiveCampaign', category: 'marketing_automation', confidence: 0.85, details: {} });
    }
    // Mailchimp
    if (document.querySelector('script[src*="chimpstatic"]') || document.querySelector('form[action*="mailchimp"]')) {
      tools.push({ name: 'Mailchimp', category: 'marketing_automation', confidence: 0.9, details: {} });
    }
    // Klaviyo
    if (w['klaviyo'] || w['_learnq']) {
      tools.push({ name: 'Klaviyo', category: 'marketing_automation', confidence: 0.9, details: {} });
    }
    // Braze
    if (w['appboy'] || w['braze']) {
      tools.push({ name: 'Braze', category: 'marketing_automation', confidence: 0.9, details: {} });
    }
    // Customer.io
    if (w['_cio']) {
      tools.push({ name: 'Customer.io', category: 'marketing_automation', confidence: 0.85, details: {} });
    }
    // Drip
    if (w['_dcq'] || w['_dcs']) {
      tools.push({ name: 'Drip', category: 'marketing_automation', confidence: 0.85, details: {} });
    }
    // ConvertKit
    if (document.querySelector('form[action*="convertkit"]') || document.querySelector('script[src*="convertkit"]')) {
      tools.push({ name: 'ConvertKit', category: 'marketing_automation', confidence: 0.85, details: {} });
    }
    // Iterable
    if (w['_iaq']) {
      tools.push({ name: 'Iterable', category: 'marketing_automation', confidence: 0.85, details: {} });
    }

    // --- CRM ---
    const hasSfdc = document.querySelector('input[name*="sfdc"]') || document.querySelector('form[action*="salesforce"]');
    if (hasSfdc) tools.push({ name: 'Salesforce', category: 'crm', confidence: 0.8, details: {} });

    // --- Live Chat ---
    if (w['Intercom'] || w['intercomSettings']) {
      tools.push({ name: 'Intercom', category: 'live_chat', confidence: 0.95, details: {} });
    }
    if (w['drift'] || w['driftt']) {
      tools.push({ name: 'Drift', category: 'live_chat', confidence: 0.9, details: {} });
    }
    if (w['zE'] || w['zESettings'] || document.querySelector('#launcher[data-product="chat"]')) {
      tools.push({ name: 'Zendesk', category: 'live_chat', confidence: 0.9, details: {} });
    }
    if (w['$crisp'] || w['CRISP_WEBSITE_ID']) {
      tools.push({ name: 'Crisp', category: 'live_chat', confidence: 0.9, details: {} });
    }
    if (w['Tawk_API'] || w['Tawk_LoadStart']) {
      tools.push({ name: 'Tawk.to', category: 'live_chat', confidence: 0.9, details: {} });
    }
    if (w['LiveChatWidget'] || w['__lc']) {
      tools.push({ name: 'LiveChat', category: 'live_chat', confidence: 0.9, details: {} });
    }
    if (w['tidioChatApi'] || document.querySelector('#tidio-chat')) {
      tools.push({ name: 'Tidio', category: 'live_chat', confidence: 0.85, details: {} });
    }
    if (w['olark']) {
      tools.push({ name: 'Olark', category: 'live_chat', confidence: 0.85, details: {} });
    }
    if (w['fcWidget'] || document.querySelector('#fc_frame')) {
      tools.push({ name: 'Freshchat', category: 'live_chat', confidence: 0.85, details: {} });
    }

    // --- Popup/Modal Tools ---
    if (w['om5'] || document.querySelector('.om-holder, #om-*')) {
      tools.push({ name: 'OptinMonster', category: 'popup', confidence: 0.85, details: {} });
    }
    if (w['sumo'] || w['__sumo']) {
      tools.push({ name: 'Sumo', category: 'popup', confidence: 0.85, details: {} });
    }
    if (document.querySelector('[class*="hellobar"]') || w['hellobar']) {
      tools.push({ name: 'Hello Bar', category: 'popup', confidence: 0.8, details: {} });
    }
    if (w['Privy'] || document.querySelector('[class*="privy"]')) {
      tools.push({ name: 'Privy', category: 'popup', confidence: 0.8, details: {} });
    }
    if (w['wisepops']) {
      tools.push({ name: 'Wisepops', category: 'popup', confidence: 0.85, details: {} });
    }
    if (w['justuno'] || w['juapp']) {
      tools.push({ name: 'Justuno', category: 'popup', confidence: 0.8, details: {} });
    }

    // --- Push Notifications ---
    if (w['OneSignal']) {
      tools.push({ name: 'OneSignal', category: 'push', confidence: 0.9, details: {} });
    }
    if (w['PushEngage']) {
      tools.push({ name: 'PushEngage', category: 'push', confidence: 0.85, details: {} });
    }

    // --- Scheduling/Booking ---
    if (document.querySelector('div[class*="calendly"], a[href*="calendly.com"]')) {
      tools.push({ name: 'Calendly', category: 'scheduling', confidence: 0.9, details: {} });
    }
    if (document.querySelector('[data-meetings-iframe-url], a[href*="meetings.hubspot"]')) {
      tools.push({ name: 'HubSpot Meetings', category: 'scheduling', confidence: 0.85, details: {} });
    }
    if (document.querySelector('a[href*="acuityscheduling"]')) {
      tools.push({ name: 'Acuity Scheduling', category: 'scheduling', confidence: 0.8, details: {} });
    }
    if (document.querySelector('a[href*="savvycal"]')) {
      tools.push({ name: 'SavvyCal', category: 'scheduling', confidence: 0.8, details: {} });
    }

    // --- CDP ---
    if (w['rudderanalytics']) {
      tools.push({ name: 'RudderStack', category: 'cdp', confidence: 0.9, details: {} });
    }
    if (w['mParticle']) {
      tools.push({ name: 'mParticle', category: 'cdp', confidence: 0.9, details: {} });
    }
    // Tealium AudienceStream
    if (w['utag_data'] || w['utag']) {
      tools.push({ name: 'Tealium', category: 'cdp', confidence: 0.85, details: {} });
    }

    // --- Personalization ---
    if (w['optimizely'] || w['optimizelyEdge']) {
      tools.push({ name: 'Optimizely', category: 'personalization', confidence: 0.9, details: {} });
    }
    if (w['DY'] || w['DYO']) {
      tools.push({ name: 'Dynamic Yield', category: 'personalization', confidence: 0.85, details: {} });
    }
    if (w['VWO'] || w['_vwo_code']) {
      tools.push({ name: 'VWO', category: 'personalization', confidence: 0.9, details: {} });
    }
    if (w['_ABTasty'] || w['ABTasty']) {
      tools.push({ name: 'AB Tasty', category: 'personalization', confidence: 0.85, details: {} });
    }

    // --- Reviews/Testimonials ---
    if (document.querySelector('[class*="trustpilot"], script[src*="trustpilot"]')) {
      tools.push({ name: 'Trustpilot', category: 'review', confidence: 0.9, details: {} });
    }
    if (document.querySelector('a[href*="g2.com/products"], img[src*="g2crowd"], [class*="g2-badge"]')) {
      tools.push({ name: 'G2', category: 'review', confidence: 0.8, details: {} });
    }
    if (document.querySelector('[class*="yotpo"], script[src*="yotpo"]')) {
      tools.push({ name: 'Yotpo', category: 'review', confidence: 0.85, details: {} });
    }
    if (document.querySelector('[class*="bazaarvoice"], script[src*="bazaarvoice"]')) {
      tools.push({ name: 'Bazaarvoice', category: 'review', confidence: 0.85, details: {} });
    }

    // --- Video ---
    if (w['Wistia'] || document.querySelector('.wistia_embed, script[src*="wistia"]')) {
      tools.push({ name: 'Wistia', category: 'video', confidence: 0.9, details: {} });
    }
    if (w['Vidyard'] || document.querySelector('script[src*="vidyard"]')) {
      tools.push({ name: 'Vidyard', category: 'video', confidence: 0.85, details: {} });
    }

    // --- SMS ---
    if (w['attentive'] || document.querySelector('script[src*="attentive"]')) {
      tools.push({ name: 'Attentive', category: 'sms', confidence: 0.85, details: {} });
    }
    if (w['Postscript'] || document.querySelector('script[src*="postscript"]')) {
      tools.push({ name: 'Postscript', category: 'sms', confidence: 0.8, details: {} });
    }

    // --- Form Detection ---
    const formElements = document.querySelectorAll('form');
    const forms: FormInfo[] = [];
    formElements.forEach((form) => {
      const hasEmail = !!form.querySelector('input[type="email"], input[name*="email"]');
      const hasPhone = !!form.querySelector('input[type="tel"], input[name*="phone"]');
      const hiddenFields = Array.from(form.querySelectorAll('input[type="hidden"]'))
        .map(i => (i as HTMLInputElement).name)
        .filter(Boolean);

      let formBuilder: string | null = null;
      const action = form.action || '';
      if (action.includes('hubspot') || form.querySelector('[class*="hs-form"]')) formBuilder = 'HubSpot Forms';
      else if (action.includes('marketo') || form.querySelector('.mktoForm')) formBuilder = 'Marketo Forms';
      else if (action.includes('typeform') || form.closest('[data-tf-widget]')) formBuilder = 'Typeform';
      else if (action.includes('jotform')) formBuilder = 'JotForm';
      else if (action.includes('google.com/forms')) formBuilder = 'Google Forms';
      else if (form.querySelector('.gform_wrapper')) formBuilder = 'Gravity Forms';
      else if (form.querySelector('.wpforms-form')) formBuilder = 'WPForms';
      else if (action.includes('formstack')) formBuilder = 'Formstack';

      forms.push({
        action: action.slice(0, 200),
        method: form.method || 'GET',
        hasEmail,
        hasPhone,
        hiddenFields: hiddenFields.slice(0, 10),
        formBuilder,
        inputCount: form.querySelectorAll('input, select, textarea').length,
      });
    });

    return { tools, forms };
  });

  data.tools = evalResult.tools;
  data.forms = evalResult.forms;

  // ─── Step 2: Enrich from network ─────────────────────────────────────────
  const martechRequests = nc?.getMartechRequests() ?? [];
  data.martechRequestCount = martechRequests.length;

  // Network-based tool detection
  const networkPatterns: Array<{ pattern: RegExp; name: string; category: MartechTool['category'] }> = [
    { pattern: /hs-scripts\.com|hs-analytics\.net/, name: 'HubSpot', category: 'marketing_automation' },
    { pattern: /munchkin\.marketo\.net/, name: 'Marketo', category: 'marketing_automation' },
    { pattern: /pi\.pardot\.com/, name: 'Pardot', category: 'marketing_automation' },
    { pattern: /widget\.intercom\.io/, name: 'Intercom', category: 'live_chat' },
    { pattern: /js\.driftt\.com/, name: 'Drift', category: 'live_chat' },
    { pattern: /static\.zdassets\.com/, name: 'Zendesk', category: 'live_chat' },
    { pattern: /static\.klaviyo\.com/, name: 'Klaviyo', category: 'marketing_automation' },
    { pattern: /cdn\.optimizely\.com/, name: 'Optimizely', category: 'personalization' },
  ];

  const existingNames = new Set(evalResult.tools.map(t => t.name));
  for (const req of martechRequests) {
    for (const { pattern, name, category } of networkPatterns) {
      if (pattern.test(req.url) && !existingNames.has(name)) {
        existingNames.add(name);
        evalResult.tools.push({ name, category, confidence: 0.8, details: { source: 'network' } });
      }
    }
  }

  // ─── Step 3: Cookie analysis for MarTech attribution ─────────────────────
  let martechCookies: Array<{ name: string; tool: string | null }> = [];
  try {
    const rawCookies = await page.context().cookies();
    const martechCookiePatterns: Array<{ pattern: RegExp; tool: string }> = [
      { pattern: /^__hs/, tool: 'HubSpot' },
      { pattern: /^hubspotutk/, tool: 'HubSpot' },
      { pattern: /^_mkto_/, tool: 'Marketo' },
      { pattern: /^pardot/, tool: 'Pardot' },
      { pattern: /^__kla_id/, tool: 'Klaviyo' },
      { pattern: /^intercom-/, tool: 'Intercom' },
      { pattern: /^drift_/, tool: 'Drift' },
    ];
    martechCookies = rawCookies.map(c => {
      let tool: string | null = null;
      for (const { pattern, tool: t } of martechCookiePatterns) {
        if (pattern.test(c.name)) { tool = t; break; }
      }
      return { name: c.name, tool };
    }).filter(c => c.tool !== null);
  } catch {
    // Non-fatal
  }
  data.martechCookies = martechCookies;

  // ─── Step 4: Build signals ───────────────────────────────────────────────
  for (const tool of evalResult.tools) {
    signals.push(
      createSignal({
        type: `martech_${tool.category}`,
        name: tool.name,
        confidence: tool.confidence,
        evidence: `${tool.name} (${tool.category})`,
        category: 'martech',
      }),
    );
  }

  // ─── Step 5: Build checkpoints ───────────────────────────────────────────
  const maTools = evalResult.tools.filter(t => t.category === 'marketing_automation');
  const chatTools = evalResult.tools.filter(t => t.category === 'live_chat');
  const popupTools = evalResult.tools.filter(t => t.category === 'popup');
  const pushTools = evalResult.tools.filter(t => t.category === 'push');
  const schedulingTools = evalResult.tools.filter(t => t.category === 'scheduling');
  const emailForms = evalResult.forms.filter(f => f.hasEmail);

  // CP1: Marketing automation present
  {
    let health: CheckpointHealth;
    let evidence: string;

    const enterprise = maTools.filter(t => ['HubSpot', 'Marketo', 'Pardot', 'ActiveCampaign'].includes(t.name));

    if (enterprise.length > 0) {
      health = 'excellent';
      evidence = `Enterprise marketing automation: ${enterprise.map(t => t.name).join(', ')}`;
    } else if (maTools.length > 0) {
      health = 'good';
      evidence = `Marketing automation: ${maTools.map(t => t.name).join(', ')}`;
    } else {
      health = 'good'; // Info only — not every site needs MA
      evidence = 'No marketing automation platform detected (not required for all sites)';
    }

    checkpoints.push(createCheckpoint({ id: 'm07-ma', name: 'Marketing Automation', weight: 0.6, health, evidence }));
  }

  // CP2: Email capture forms
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (emailForms.length > 0 && emailForms.some(f => f.action && !f.action.includes('mailto:'))) {
      health = 'excellent';
      evidence = `${emailForms.length} email capture form(s) with proper action URLs`;
    } else if (emailForms.length > 0) {
      health = 'good';
      evidence = `${emailForms.length} email capture form(s) detected`;
    } else {
      health = 'warning';
      evidence = 'No email capture forms detected on this page';
      recommendation = 'Add an email capture form or newsletter signup to build your marketing list.';
    }

    checkpoints.push(createCheckpoint({ id: 'm07-email-forms', name: 'Email Capture Forms', weight: 0.7, health, evidence, recommendation }));
  }

  // CP3: CRM integration signals
  {
    const crmTools = evalResult.tools.filter(t => t.category === 'crm');
    const crmForms = evalResult.forms.filter(f =>
      f.hiddenFields.some(h => /sfdc|hubspot|marketo|zoho/.test(h.toLowerCase())),
    );

    checkpoints.push(
      (crmTools.length > 0 || crmForms.length > 0)
        ? createCheckpoint({ id: 'm07-crm', name: 'CRM Integration', weight: 0.4, health: 'excellent', evidence: `CRM signals detected: ${[...crmTools.map(t => t.name), ...crmForms.map(() => 'form hidden fields')].join(', ')}` })
        : infoCheckpoint({ id: 'm07-crm', name: 'CRM Integration', weight: 0.4, evidence: 'No CRM integration signals detected' }),
    );
  }

  // CP4: Live chat / support widget
  {
    checkpoints.push(
      chatTools.length > 0
        ? createCheckpoint({ id: 'm07-chat', name: 'Live Chat Widget', weight: 0.4, health: 'excellent', evidence: `Chat widget: ${chatTools.map(t => t.name).join(', ')}` })
        : infoCheckpoint({ id: 'm07-chat', name: 'Live Chat Widget', weight: 0.4, evidence: 'No live chat widget detected' }),
    );
  }

  // CP5: Form builder quality
  {
    const builderForms = evalResult.forms.filter(f => f.formBuilder);
    const brokenForms = evalResult.forms.filter(f => !f.action || f.action.includes('mailto:'));

    let health: CheckpointHealth;
    let evidence: string;

    if (builderForms.length > 0) {
      health = 'excellent';
      evidence = `Professional form builder: ${[...new Set(builderForms.map(f => f.formBuilder))].join(', ')}`;
    } else if (evalResult.forms.length > 0 && brokenForms.length === 0) {
      health = 'good';
      evidence = `${evalResult.forms.length} form(s) with standard HTML elements`;
    } else if (brokenForms.length > 0) {
      health = 'warning';
      evidence = `${brokenForms.length} form(s) with missing or broken action URLs`;
    } else {
      health = 'good';
      evidence = 'No forms detected on this page';
    }

    checkpoints.push(createCheckpoint({ id: 'm07-forms', name: 'Form Builder Quality', weight: 0.5, health, evidence }));
  }

  // CP6: Popup/modal tools
  {
    checkpoints.push(
      popupTools.length > 0
        ? createCheckpoint({ id: 'm07-popups', name: 'Popup/Modal Tools', weight: 0.3, health: 'good', evidence: `Popup tool detected: ${popupTools.map(t => t.name).join(', ')}` })
        : infoCheckpoint({ id: 'm07-popups', name: 'Popup/Modal Tools', weight: 0.3, evidence: 'No popup tools detected' }),
    );
  }

  // CP7: Cookie inventory coherence
  {
    const totalMartechCookies = martechCookies.length;
    let health: CheckpointHealth;
    let evidence: string;

    if (totalMartechCookies > 0) {
      health = 'good';
      evidence = `${totalMartechCookies} MarTech cookies identified and attributed: ${[...new Set(martechCookies.map(c => c.tool))].join(', ')}`;
    } else {
      health = 'good';
      evidence = 'No MarTech-specific cookies detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm07-cookies', name: 'Cookie Inventory Coherence', weight: 0.6, health, evidence }));
  }

  // CP8: Tool integration depth
  {
    const categories = new Set(evalResult.tools.map(t => t.category));

    let health: CheckpointHealth;
    let evidence: string;

    if (categories.size >= 4) {
      health = 'excellent';
      evidence = `Deep MarTech integration: ${categories.size} categories (${Array.from(categories).join(', ')})`;
    } else if (categories.size >= 2) {
      health = 'good';
      evidence = `${categories.size} MarTech categories: ${Array.from(categories).join(', ')}`;
    } else if (categories.size === 1) {
      health = 'good';
      evidence = `Single MarTech category: ${Array.from(categories)[0]}`;
    } else {
      health = 'good';
      evidence = 'Minimal MarTech stack (may be intentional)';
    }

    checkpoints.push(createCheckpoint({ id: 'm07-depth', name: 'Tool Integration Depth', weight: 0.5, health, evidence }));
  }

  // CP9: Push notification setup
  {
    checkpoints.push(
      pushTools.length > 0
        ? createCheckpoint({ id: 'm07-push', name: 'Push Notification Setup', weight: 0.2, health: 'good', evidence: `Push notification: ${pushTools.map(t => t.name).join(', ')}` })
        : infoCheckpoint({ id: 'm07-push', name: 'Push Notification Setup', weight: 0.2, evidence: 'No push notification tools detected' }),
    );
  }

  // CP10: Scheduling/booking tool
  {
    checkpoints.push(
      schedulingTools.length > 0
        ? createCheckpoint({ id: 'm07-scheduling', name: 'Scheduling/Booking Tool', weight: 0.2, health: 'good', evidence: `Scheduling tool: ${schedulingTools.map(t => t.name).join(', ')}` })
        : infoCheckpoint({ id: 'm07-scheduling', name: 'Scheduling/Booking Tool', weight: 0.2, evidence: 'No scheduling tools detected' }),
    );
  }

  data.toolCount = evalResult.tools.length;
  data.toolNames = evalResult.tools.map(t => t.name);
  data.formCount = evalResult.forms.length;
  data.emailFormCount = emailForms.length;
  data.categories = [...new Set(evalResult.tools.map(t => t.category))];

  return {
    moduleId: 'M07' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

registerModuleExecutor('M07' as ModuleId, execute);
