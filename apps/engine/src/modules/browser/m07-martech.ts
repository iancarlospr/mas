/**
 * M07 — MarTech Orchestration
 *
 * Detects the full marketing technology stack from window globals, DOM
 * inspection, network requests, and cookies.  Categories include marketing
 * automation, CRM, live chat, popups, push notifications, scheduling,
 * form builders, CDPs, personalization / A-B testing, session recording,
 * feedback / survey tools, product onboarding, notification / changelog,
 * reviews, video, SMS, and referral / loyalty.
 *
 * Checkpoints (10):
 *   1. Marketing Automation platform
 *   2. Lead Capture infrastructure
 *   3. CRM Integration signals
 *   4. Visitor Engagement (chat + popup + push)
 *   5. Behavioral Analytics (session recording)
 *   6. Form Builder Quality
 *   7. Personalization & Testing
 *   8. Stack Breadth
 *   9. Stack Coherence (cookie attribution)
 *  10. MarTech Performance Impact
 *
 * DRY with M05 (analytics tools), M06 (ad pixels), M08 (TMS containers).
 * Tools detected by those modules are not duplicated here.
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type {
  ModuleResult,
  ModuleId,
  Signal,
  Checkpoint,
  CheckpointHealth,
} from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MartechCategory =
  | 'marketing_automation'
  | 'crm'
  | 'live_chat'
  | 'popup'
  | 'push'
  | 'scheduling'
  | 'form_builder'
  | 'cdp'
  | 'personalization'
  | 'referral'
  | 'review'
  | 'video'
  | 'sms'
  | 'session_recording'
  | 'feedback'
  | 'onboarding'
  | 'notification'
  | 'abm';

interface MartechTool {
  name: string;
  category: MartechCategory;
  confidence: number;
  details: Record<string, unknown>;
  source: 'globals' | 'dom' | 'network' | 'cookie';
}

interface FormInfo {
  action: string;
  method: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasName: boolean;
  hiddenFields: string[];
  formBuilder: string | null;
  inputCount: number;
}

// ---------------------------------------------------------------------------
// Network detection patterns — scanned against ALL request URLs
// ---------------------------------------------------------------------------

interface NetworkToolPattern {
  pattern: RegExp;
  name: string;
  category: MartechCategory;
  idExtractor?: RegExp; // capture group 1 = ID
}

const NETWORK_PATTERNS: NetworkToolPattern[] = [
  // Marketing Automation
  { pattern: /js\.hs-scripts\.com|hs-analytics\.net/, name: 'HubSpot', category: 'marketing_automation', idExtractor: /(?:hs-scripts\.com|hs-analytics\.net\/analytics\/\d+)\/(\d+)\.js/ },
  { pattern: /munchkin\.marketo\.net/, name: 'Marketo', category: 'marketing_automation', idExtractor: /munchkin\.marketo\.net\/(\d+)\/munchkin/ },
  { pattern: /pi\.pardot\.com|go\.pardot\.com/, name: 'Pardot', category: 'marketing_automation' },
  { pattern: /static\.klaviyo\.com|a\.klaviyo\.com/, name: 'Klaviyo', category: 'marketing_automation' },
  { pattern: /sdk\.braze\.com|js\.appboycdn\.com/, name: 'Braze', category: 'marketing_automation' },
  { pattern: /customeriojs\.com|track\.customer\.io/, name: 'Customer.io', category: 'marketing_automation' },
  { pattern: /tag\.getdrip\.com/, name: 'Drip', category: 'marketing_automation' },
  { pattern: /f\.convertkit\.com|convertkit\.com\/builds/, name: 'ConvertKit', category: 'marketing_automation' },
  { pattern: /sibautomation\.com|sib-conversations\.com/, name: 'Brevo', category: 'marketing_automation' },
  { pattern: /omnisnippet1\.com|omnisrc\.com/, name: 'Omnisend', category: 'marketing_automation' },
  { pattern: /app\.getresponse\.com|getresponse\.com\/script/, name: 'GetResponse', category: 'marketing_automation' },
  { pattern: /(?:static|assets)\.mailerlite\.com/, name: 'MailerLite', category: 'marketing_automation' },
  { pattern: /cdn\.moosend\.com/, name: 'Moosend', category: 'marketing_automation' },
  { pattern: /chimpstatic\.com|mailchimp\.com/, name: 'Mailchimp', category: 'marketing_automation' },
  { pattern: /trackcmp\.net|trackcmp_url/, name: 'ActiveCampaign', category: 'marketing_automation' },

  // Live Chat
  { pattern: /usemessages\.com|hubble\.js/, name: 'HubSpot Conversations', category: 'live_chat' },
  { pattern: /widget\.intercom\.io|intercomcdn\.com/, name: 'Intercom', category: 'live_chat', idExtractor: /widget\.intercom\.io\/widget\/(\w+)/ },
  { pattern: /js\.driftt\.com/, name: 'Drift', category: 'live_chat', idExtractor: /include\/(\w+)\/drift/ },
  { pattern: /static\.zdassets\.com|ekr\.zdassets\.com/, name: 'Zendesk Chat', category: 'live_chat' },
  { pattern: /client\.crisp\.chat/, name: 'Crisp', category: 'live_chat' },
  { pattern: /embed\.tawk\.to/, name: 'Tawk.to', category: 'live_chat' },
  { pattern: /cdn\.livechatinc\.com/, name: 'LiveChat', category: 'live_chat' },
  { pattern: /code\.tidio\.co/, name: 'Tidio', category: 'live_chat' },
  { pattern: /static\.olark\.com/, name: 'Olark', category: 'live_chat' },
  { pattern: /wchat\.freshchat\.com/, name: 'Freshchat', category: 'live_chat' },
  { pattern: /js\.qualified\.com/, name: 'Qualified', category: 'live_chat' },
  { pattern: /config\.gorgias\.chat/, name: 'Gorgias', category: 'live_chat' },
  { pattern: /beacon-v2\.helpscout\.net/, name: 'Help Scout Beacon', category: 'live_chat' },

  // Session Recording
  { pattern: /static\.hotjar\.com/, name: 'Hotjar', category: 'session_recording', idExtractor: /hotjar[.-](\d+)/ },
  { pattern: /fullstory\.com\/s\/fs\.js|edge\.fullstory\.com/, name: 'FullStory', category: 'session_recording' },
  { pattern: /clarity\.ms\/tag/, name: 'Microsoft Clarity', category: 'session_recording', idExtractor: /clarity\.ms\/tag\/(\w+)/ },
  { pattern: /script\.crazyegg\.com/, name: 'Crazy Egg', category: 'session_recording' },
  { pattern: /d10lpsik1i8c69\.cloudfront\.net.*luckyorange|luckyorange\.com/, name: 'Lucky Orange', category: 'session_recording' },
  { pattern: /cdn\.mouseflow\.com/, name: 'MouseFlow', category: 'session_recording' },
  { pattern: /web-sdk\.smartlook\.com/, name: 'Smartlook', category: 'session_recording' },
  { pattern: /cdn\.logrocket\.io/, name: 'LogRocket', category: 'session_recording' },

  // Feedback / Survey
  { pattern: /siteintercept\.qualtrics\.com/, name: 'Qualtrics', category: 'feedback' },
  { pattern: /neb\.medallia\.com/, name: 'Medallia', category: 'feedback' },
  { pattern: /survey\.survicate\.com/, name: 'Survicate', category: 'feedback' },
  { pattern: /d2yyd1h5u9mauk\.cloudfront\.net.*delighted|web\.delighted\.com/, name: 'Delighted', category: 'feedback' },
  { pattern: /hubspotfeedback\.com/, name: 'HubSpot Feedback', category: 'feedback' },

  // Product Onboarding
  { pattern: /cdn\.pendo\.io/, name: 'Pendo', category: 'onboarding', idExtractor: /agent\/static\/(\w+)\// },
  { pattern: /cdn\.walkme\.com/, name: 'WalkMe', category: 'onboarding' },
  { pattern: /fast\.appcues\.com/, name: 'Appcues', category: 'onboarding' },
  { pattern: /js\.userpilot\.io/, name: 'Userpilot', category: 'onboarding' },
  { pattern: /fast\.trychameleon\.com/, name: 'Chameleon', category: 'onboarding' },

  // Notification / Changelog
  { pattern: /app\.getbeamer\.com/, name: 'Beamer', category: 'notification' },
  { pattern: /canny\.io\/sdk/, name: 'Canny', category: 'notification' },
  { pattern: /cdn\.headwayapp\.co/, name: 'Headway', category: 'notification' },

  // Personalization / A-B Testing
  { pattern: /cdn\.optimizely\.com/, name: 'Optimizely', category: 'personalization' },
  { pattern: /cdn-3\.convertexperiments\.com/, name: 'Convert', category: 'personalization' },
  { pattern: /dev\.visualwebsiteoptimizer\.com|vwo\.com\/lib/, name: 'VWO', category: 'personalization' },
  { pattern: /abtasty\.com\//, name: 'AB Tasty', category: 'personalization' },
  { pattern: /cdn\.mutinyhq\.com/, name: 'Mutiny', category: 'personalization' },
  { pattern: /cdn\.intellimize\.co/, name: 'Intellimize', category: 'personalization' },

  // CDP
  { pattern: /cdn\.segment\.com|api\.segment\.io/, name: 'Segment', category: 'cdp' },
  { pattern: /cdn\.rudderstack\.com/, name: 'RudderStack', category: 'cdp' },
  { pattern: /jssdkcdns\.mparticle\.com/, name: 'mParticle', category: 'cdp' },
  { pattern: /tags\.tiqcdn\.com|collect\.tealiumiq\.com/, name: 'Tealium', category: 'cdp' },
  { pattern: /cdn\.exponea\.com/, name: 'Bloomreach', category: 'cdp' },

  // Popup / Modal
  { pattern: /a\.omappapi\.com/, name: 'OptinMonster', category: 'popup' },
  { pattern: /load\.sumo\.com/, name: 'Sumo', category: 'popup' },
  { pattern: /assets\.hellobar\.com/, name: 'Hello Bar', category: 'popup' },
  { pattern: /widget\.privy\.com/, name: 'Privy', category: 'popup' },
  { pattern: /loader\.wisepops\.com/, name: 'Wisepops', category: 'popup' },
  { pattern: /cdn\.justuno\.com/, name: 'Justuno', category: 'popup' },
  { pattern: /cdn\.convertflow\.com/, name: 'ConvertFlow', category: 'popup' },

  // Push Notifications
  { pattern: /cdn\.onesignal\.com/, name: 'OneSignal', category: 'push' },
  { pattern: /clientcdn\.pushengage\.com/, name: 'PushEngage', category: 'push' },
  { pattern: /pushcrew\.com/, name: 'PushCrew', category: 'push' },

  // Scheduling
  { pattern: /assets\.calendly\.com/, name: 'Calendly', category: 'scheduling' },
  { pattern: /static\.hsappstatic\.net.*MeetingsEmbed|meetings\.hubspot\.com/, name: 'HubSpot Meetings', category: 'scheduling' },
  { pattern: /acuityscheduling\.com\//, name: 'Acuity Scheduling', category: 'scheduling' },
  { pattern: /js\.chilipiper\.com/, name: 'Chili Piper', category: 'scheduling' },

  // Form Builder
  { pattern: /js\.hsforms\.net|hsforms\.com/, name: 'HubSpot Forms', category: 'form_builder' },
  { pattern: /embed\.typeform\.com/, name: 'Typeform', category: 'form_builder' },
  { pattern: /cdn\.jotfor\.ms/, name: 'JotForm', category: 'form_builder' },

  // Review / Testimonials
  { pattern: /widget\.trustpilot\.com/, name: 'Trustpilot', category: 'review' },
  { pattern: /staticw2\.yotpo\.com/, name: 'Yotpo', category: 'review' },
  { pattern: /display\.ugc\.bazaarvoice\.com/, name: 'Bazaarvoice', category: 'review' },

  // Video
  { pattern: /fast\.wistia\.(com|net)/, name: 'Wistia', category: 'video' },
  { pattern: /play\.vidyard\.com/, name: 'Vidyard', category: 'video' },
  { pattern: /players\.brightcove\.net/, name: 'Brightcove', category: 'video' },

  // SMS
  { pattern: /cdn\.attn\.tv|tag\.attentivemobile\.com/, name: 'Attentive', category: 'sms' },
  { pattern: /sdk\.postscript\.io/, name: 'Postscript', category: 'sms' },

  // Referral / Loyalty
  { pattern: /js\.smile\.io/, name: 'Smile.io', category: 'referral' },
  { pattern: /cdn\.loyaltylion\.net/, name: 'LoyaltyLion', category: 'referral' },
  { pattern: /cdn\.referralcandy\.com/, name: 'ReferralCandy', category: 'referral' },

  // ABM / B2B Intent Data
  { pattern: /tag\.demandbase\.com|demandbase\.com\//, name: 'Demandbase', category: 'abm' },
  { pattern: /zi-scripts\.com|ws\.zoominfo\.com/, name: 'ZoomInfo', category: 'abm' },
  { pattern: /j\.6sc\.co|6sense\.com\//, name: '6sense', category: 'abm' },
  { pattern: /tag\.clearbitscripts\.com|reveal\.clearbit\.com/, name: 'Clearbit', category: 'abm' },
  { pattern: /js\.rbcdn\.com|rollworks\.com/, name: 'RollWorks', category: 'abm' },
  { pattern: /cdn\.terminus\.services|tag\.terminus\.services/, name: 'Terminus', category: 'abm' },
  { pattern: /cdn\.leadfeeder\.com|t\.dealfront\.com/, name: 'Dealfront', category: 'abm' },
  { pattern: /cdn\.bizible\.com/, name: 'Marketo Measure', category: 'abm' },
];

// ---------------------------------------------------------------------------
// Cookie attribution patterns
// ---------------------------------------------------------------------------

interface CookieToolPattern {
  pattern: RegExp;
  tool: string;
}

const COOKIE_PATTERNS: CookieToolPattern[] = [
  // Marketing Automation
  { pattern: /^__hs/, tool: 'HubSpot' },
  { pattern: /^hubspotutk$/, tool: 'HubSpot' },
  { pattern: /^_mkto_/, tool: 'Marketo' },
  { pattern: /^pardot/, tool: 'Pardot' },
  { pattern: /^__kla_id/, tool: 'Klaviyo' },
  { pattern: /^_drip_/, tool: 'Drip' },
  { pattern: /^_braze_/, tool: 'Braze' },
  { pattern: /^omnisendSessionID/, tool: 'Omnisend' },
  { pattern: /^_mailerlite/, tool: 'MailerLite' },

  // Live Chat
  { pattern: /^intercom-/, tool: 'Intercom' },
  { pattern: /^drift_/, tool: 'Drift' },
  { pattern: /^__zlcmid$/, tool: 'Zendesk Chat' },
  { pattern: /^__lc_/, tool: 'LiveChat' },
  { pattern: /^crisp-client/, tool: 'Crisp' },
  { pattern: /^tawk/, tool: 'Tawk.to' },

  // Session Recording
  { pattern: /^_hj/, tool: 'Hotjar' },
  { pattern: /^fs_uid/, tool: 'FullStory' },
  { pattern: /^_clck$|^_clsk$/, tool: 'Microsoft Clarity' },
  { pattern: /^_ceir?$/, tool: 'Crazy Egg' },
  { pattern: /^_lo/, tool: 'Lucky Orange' },
  { pattern: /^mf_/, tool: 'MouseFlow' },
  { pattern: /^SL_/, tool: 'Smartlook' },

  // CDP
  { pattern: /^ajs_/, tool: 'Segment' },
  { pattern: /^rl_/, tool: 'RudderStack' },
  { pattern: /^utag_/, tool: 'Tealium' },

  // Personalization
  { pattern: /^optimizelyEndUserId/, tool: 'Optimizely' },
  { pattern: /^_vis_opt_/, tool: 'VWO' },
  { pattern: /^ABTasty/, tool: 'AB Tasty' },
  { pattern: /^_dy_/, tool: 'Dynamic Yield' },

  // Onboarding
  { pattern: /^_pendo_/, tool: 'Pendo' },

  // Popup
  { pattern: /^om-/, tool: 'OptinMonster' },
  { pattern: /^__ss_/, tool: 'Sumo' },

  // Review
  { pattern: /^_yotpo/, tool: 'Yotpo' },
];

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

  // ─── Step 1: Detect tools via window globals + DOM ─────────────────────
  const evalResult = await page.evaluate(() => {
    const tools: Array<{ name: string; category: string; confidence: number; details: Record<string, unknown> }> = [];
    const w = window as unknown as Record<string, unknown>;
    const d = document;

    // --- Marketing Automation ---
    if (w['_hsq'] != null || w['hbspt'] != null) {
      const details: Record<string, unknown> = {};
      const hbspt = w['hbspt'] as Record<string, unknown> | undefined;
      if (hbspt && typeof hbspt === 'object') details.hasFormsSDK = !!(hbspt)['forms'];
      tools.push({ name: 'HubSpot', category: 'marketing_automation', confidence: 0.95, details });
    }
    if (w['Munchkin'] != null || w['mktoForm'] != null || w['MktoForms2'] != null)
      tools.push({ name: 'Marketo', category: 'marketing_automation', confidence: 0.95, details: {} });
    if (w['piAId'] != null || w['piCId'] != null || w['piTracker'] != null)
      tools.push({ name: 'Pardot', category: 'marketing_automation', confidence: 0.9, details: {} });
    if (w['trackcmp_url'] != null || w['vgo'] != null)
      tools.push({ name: 'ActiveCampaign', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (d.querySelector('script[src*="chimpstatic"]') || d.querySelector('form[action*="mailchimp"]'))
      tools.push({ name: 'Mailchimp', category: 'marketing_automation', confidence: 0.9, details: {} });
    if (w['klaviyo'] != null || w['_learnq'] != null)
      tools.push({ name: 'Klaviyo', category: 'marketing_automation', confidence: 0.9, details: {} });
    if (w['appboy'] != null || w['braze'] != null)
      tools.push({ name: 'Braze', category: 'marketing_automation', confidence: 0.9, details: {} });
    if (w['_cio'] != null)
      tools.push({ name: 'Customer.io', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['_dcq'] != null || w['_dcs'] != null)
      tools.push({ name: 'Drip', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (d.querySelector('form[action*="convertkit"]') || d.querySelector('script[src*="convertkit"]'))
      tools.push({ name: 'ConvertKit', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['_iaq'] != null)
      tools.push({ name: 'Iterable', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['SibConversations'] != null || d.querySelector('script[src*="sibautomation"]') || d.querySelector('.sib-form'))
      tools.push({ name: 'Brevo', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['omnisend'] != null)
      tools.push({ name: 'Omnisend', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['GrTracking'] != null || d.querySelector('script[src*="getresponse.com"]'))
      tools.push({ name: 'GetResponse', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['ml'] != null || w['MailerLiteObject'] != null || d.querySelector('script[src*="mailerlite"]'))
      tools.push({ name: 'MailerLite', category: 'marketing_automation', confidence: 0.85, details: {} });
    if (w['mootrack'] != null)
      tools.push({ name: 'Moosend', category: 'marketing_automation', confidence: 0.85, details: {} });

    // --- Live Chat ---
    if (w['HubSpotConversations'] != null || d.querySelector('#hubspot-messages-iframe-container'))
      tools.push({ name: 'HubSpot Conversations', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['Intercom'] != null || w['intercomSettings'] != null)
      tools.push({ name: 'Intercom', category: 'live_chat', confidence: 0.95, details: {} });
    if (w['drift'] != null || w['driftt'] != null)
      tools.push({ name: 'Drift', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['zE'] != null || w['zESettings'] != null || d.querySelector('#launcher[data-product="chat"]'))
      tools.push({ name: 'Zendesk Chat', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['$crisp'] != null || w['CRISP_WEBSITE_ID'] != null)
      tools.push({ name: 'Crisp', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['Tawk_API'] != null || w['Tawk_LoadStart'] != null)
      tools.push({ name: 'Tawk.to', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['LiveChatWidget'] != null || w['__lc'] != null)
      tools.push({ name: 'LiveChat', category: 'live_chat', confidence: 0.9, details: {} });
    if (w['tidioChatApi'] != null || d.querySelector('#tidio-chat'))
      tools.push({ name: 'Tidio', category: 'live_chat', confidence: 0.85, details: {} });
    if (w['olark'] != null)
      tools.push({ name: 'Olark', category: 'live_chat', confidence: 0.85, details: {} });
    if (w['fcWidget'] != null || d.querySelector('#fc_frame'))
      tools.push({ name: 'Freshchat', category: 'live_chat', confidence: 0.85, details: {} });
    if (w['qualified'] != null)
      tools.push({ name: 'Qualified', category: 'live_chat', confidence: 0.85, details: {} });
    if (d.querySelector('.gorgias-chat-container'))
      tools.push({ name: 'Gorgias', category: 'live_chat', confidence: 0.85, details: {} });
    if (w['Beacon'] != null)
      tools.push({ name: 'Help Scout Beacon', category: 'live_chat', confidence: 0.8, details: {} });

    // --- Session Recording ---
    if (w['hj'] != null || w['_hjSettings'] != null) {
      const hjSettings = w['_hjSettings'] as Record<string, unknown> | undefined;
      tools.push({ name: 'Hotjar', category: 'session_recording', confidence: 0.9, details: hjSettings?.['hjid'] ? { siteId: hjSettings['hjid'] } : {} });
    }
    if (w['FS'] != null || w['_fs_debug_exception'] != null)
      tools.push({ name: 'FullStory', category: 'session_recording', confidence: 0.9, details: {} });
    if (w['clarity'] != null)
      tools.push({ name: 'Microsoft Clarity', category: 'session_recording', confidence: 0.9, details: {} });
    if (w['CE2'] != null || w['ceCurrentVideo'] != null)
      tools.push({ name: 'Crazy Egg', category: 'session_recording', confidence: 0.85, details: {} });
    if (w['__lo_cs_added'] != null || w['_loq'] != null)
      tools.push({ name: 'Lucky Orange', category: 'session_recording', confidence: 0.85, details: {} });
    if (w['_mfq'] != null || w['mouseflow'] != null)
      tools.push({ name: 'MouseFlow', category: 'session_recording', confidence: 0.85, details: {} });
    if (w['smartlook'] != null)
      tools.push({ name: 'Smartlook', category: 'session_recording', confidence: 0.85, details: {} });
    if (w['LogRocket'] != null)
      tools.push({ name: 'LogRocket', category: 'session_recording', confidence: 0.85, details: {} });

    // --- Feedback / Survey ---
    if (w['QSI'] != null)
      tools.push({ name: 'Qualtrics', category: 'feedback', confidence: 0.9, details: {} });
    if (w['KAMPYLE_ONSITE_SDK'] != null || w['kampyle'] != null)
      tools.push({ name: 'Medallia', category: 'feedback', confidence: 0.85, details: {} });
    if (w['_sva'] != null || d.querySelector('script[src*="survicate"]'))
      tools.push({ name: 'Survicate', category: 'feedback', confidence: 0.85, details: {} });
    if (w['delighted'] != null)
      tools.push({ name: 'Delighted', category: 'feedback', confidence: 0.85, details: {} });

    // --- Product Onboarding ---
    if (w['pendo'] != null)
      tools.push({ name: 'Pendo', category: 'onboarding', confidence: 0.9, details: {} });
    if (w['walkme'] != null || w['_walkmeConfig'] != null)
      tools.push({ name: 'WalkMe', category: 'onboarding', confidence: 0.85, details: {} });
    if (w['Appcues'] != null)
      tools.push({ name: 'Appcues', category: 'onboarding', confidence: 0.85, details: {} });
    if (w['userpilot'] != null)
      tools.push({ name: 'Userpilot', category: 'onboarding', confidence: 0.85, details: {} });
    if (w['chmln'] != null)
      tools.push({ name: 'Chameleon', category: 'onboarding', confidence: 0.85, details: {} });

    // --- Notification / Changelog ---
    if (w['beamer_config'] != null || d.querySelector('#beamerSelector'))
      tools.push({ name: 'Beamer', category: 'notification', confidence: 0.85, details: {} });
    if (w['Canny'] != null || d.querySelector('[data-canny-changelog]'))
      tools.push({ name: 'Canny', category: 'notification', confidence: 0.85, details: {} });
    if (w['HW_config'] != null)
      tools.push({ name: 'Headway', category: 'notification', confidence: 0.85, details: {} });

    // --- CRM ---
    if (d.querySelector('input[name*="sfdc"]') || d.querySelector('form[action*="salesforce"]') || d.querySelector('input[name*="oid"]'))
      tools.push({ name: 'Salesforce', category: 'crm', confidence: 0.8, details: {} });
    if (w['$zoho'] != null || d.querySelector('form[action*="zoho"]'))
      tools.push({ name: 'Zoho CRM', category: 'crm', confidence: 0.8, details: {} });
    if (w['LeadBooster'] != null || d.querySelector('.pipedrive-webforms, script[src*="pipedrive"]'))
      tools.push({ name: 'Pipedrive', category: 'crm', confidence: 0.8, details: {} });

    // --- Personalization / A-B Testing ---
    if (w['optimizely'] != null || w['optimizelyEdge'] != null)
      tools.push({ name: 'Optimizely', category: 'personalization', confidence: 0.9, details: {} });
    if (w['DY'] != null || w['DYO'] != null)
      tools.push({ name: 'Dynamic Yield', category: 'personalization', confidence: 0.85, details: {} });
    if (w['VWO'] != null || w['_vwo_code'] != null)
      tools.push({ name: 'VWO', category: 'personalization', confidence: 0.9, details: {} });
    if (w['_ABTasty'] != null || w['ABTasty'] != null)
      tools.push({ name: 'AB Tasty', category: 'personalization', confidence: 0.85, details: {} });
    if (w['google_optimize'] != null)
      tools.push({ name: 'Google Optimize', category: 'personalization', confidence: 0.85, details: {} });
    if (w['mutiny'] != null)
      tools.push({ name: 'Mutiny', category: 'personalization', confidence: 0.85, details: {} });

    // --- CDP ---
    const analyticsObj = w['analytics'] as Record<string, unknown> | undefined;
    if (analyticsObj && typeof analyticsObj === 'object' && typeof analyticsObj['identify'] === 'function' && typeof analyticsObj['track'] === 'function' && typeof analyticsObj['alias'] === 'function' && typeof analyticsObj['group'] === 'function')
      tools.push({ name: 'Segment', category: 'cdp', confidence: 0.85, details: {} });
    if (w['rudderanalytics'] != null)
      tools.push({ name: 'RudderStack', category: 'cdp', confidence: 0.9, details: {} });
    if (w['mParticle'] != null)
      tools.push({ name: 'mParticle', category: 'cdp', confidence: 0.9, details: {} });
    if (w['utag_data'] != null || w['utag'] != null)
      tools.push({ name: 'Tealium', category: 'cdp', confidence: 0.85, details: {} });
    if (w['exponea'] != null)
      tools.push({ name: 'Bloomreach', category: 'cdp', confidence: 0.85, details: {} });

    // --- Popup / Modal ---
    if (w['om5'] != null || d.querySelector('.om-holder, [id^="om-"]'))
      tools.push({ name: 'OptinMonster', category: 'popup', confidence: 0.85, details: {} });
    if (w['sumo'] != null || w['__sumo'] != null)
      tools.push({ name: 'Sumo', category: 'popup', confidence: 0.85, details: {} });
    if (d.querySelector('[class*="hellobar"]') || w['hellobar'] != null)
      tools.push({ name: 'Hello Bar', category: 'popup', confidence: 0.8, details: {} });
    if (w['Privy'] != null || d.querySelector('[class*="privy"]'))
      tools.push({ name: 'Privy', category: 'popup', confidence: 0.8, details: {} });
    if (w['wisepops'] != null)
      tools.push({ name: 'Wisepops', category: 'popup', confidence: 0.85, details: {} });
    if (w['justuno'] != null || w['juapp'] != null)
      tools.push({ name: 'Justuno', category: 'popup', confidence: 0.8, details: {} });

    // --- Push Notifications ---
    if (w['OneSignal'] != null)
      tools.push({ name: 'OneSignal', category: 'push', confidence: 0.9, details: {} });
    if (w['PushEngage'] != null)
      tools.push({ name: 'PushEngage', category: 'push', confidence: 0.85, details: {} });

    // --- Scheduling ---
    if (d.querySelector('div[class*="calendly"], a[href*="calendly.com"]'))
      tools.push({ name: 'Calendly', category: 'scheduling', confidence: 0.9, details: {} });
    if (d.querySelector('[data-meetings-iframe-url], a[href*="meetings.hubspot"]'))
      tools.push({ name: 'HubSpot Meetings', category: 'scheduling', confidence: 0.85, details: {} });
    if (d.querySelector('a[href*="acuityscheduling"]'))
      tools.push({ name: 'Acuity Scheduling', category: 'scheduling', confidence: 0.8, details: {} });
    if (d.querySelector('a[href*="savvycal"]'))
      tools.push({ name: 'SavvyCal', category: 'scheduling', confidence: 0.8, details: {} });
    if (w['ChiliPiper'] != null)
      tools.push({ name: 'Chili Piper', category: 'scheduling', confidence: 0.85, details: {} });
    if (w['Cal'] != null && d.querySelector('script[src*="cal.com"]'))
      tools.push({ name: 'Cal.com', category: 'scheduling', confidence: 0.8, details: {} });

    // --- Reviews ---
    if (d.querySelector('[class*="trustpilot"], script[src*="trustpilot"]'))
      tools.push({ name: 'Trustpilot', category: 'review', confidence: 0.9, details: {} });
    if (d.querySelector('a[href*="g2.com/products"], img[src*="g2crowd"], [class*="g2-badge"]'))
      tools.push({ name: 'G2', category: 'review', confidence: 0.8, details: {} });
    if (d.querySelector('[class*="yotpo"], script[src*="yotpo"]'))
      tools.push({ name: 'Yotpo', category: 'review', confidence: 0.85, details: {} });
    if (d.querySelector('[class*="bazaarvoice"], script[src*="bazaarvoice"]'))
      tools.push({ name: 'Bazaarvoice', category: 'review', confidence: 0.85, details: {} });

    // --- Video ---
    if (w['Wistia'] != null || d.querySelector('.wistia_embed, script[src*="wistia"]'))
      tools.push({ name: 'Wistia', category: 'video', confidence: 0.9, details: {} });
    if (w['Vidyard'] != null || d.querySelector('script[src*="vidyard"]'))
      tools.push({ name: 'Vidyard', category: 'video', confidence: 0.85, details: {} });

    // --- SMS ---
    if (w['attentive'] != null || d.querySelector('script[src*="attentive"]'))
      tools.push({ name: 'Attentive', category: 'sms', confidence: 0.85, details: {} });
    if (w['Postscript'] != null || d.querySelector('script[src*="postscript"]'))
      tools.push({ name: 'Postscript', category: 'sms', confidence: 0.8, details: {} });

    // --- Referral / Loyalty ---
    if (w['SmileUI'] != null || d.querySelector('script[src*="smile.io"]'))
      tools.push({ name: 'Smile.io', category: 'referral', confidence: 0.85, details: {} });
    if (d.querySelector('[class*="loyaltylion"], script[src*="loyaltylion"]'))
      tools.push({ name: 'LoyaltyLion', category: 'referral', confidence: 0.8, details: {} });

    // --- ABM / B2B Intent Data ---
    if (w['Demandbase'] != null || w['DBAnalytics'] != null)
      tools.push({ name: 'Demandbase', category: 'abm', confidence: 0.9, details: {} });
    if (w['ZoomInfo'] != null || w['_zi_'] != null)
      tools.push({ name: 'ZoomInfo', category: 'abm', confidence: 0.9, details: {} });
    if (w['_6si'] != null || d.querySelector('script[src*="6sc.co"]'))
      tools.push({ name: '6sense', category: 'abm', confidence: 0.85, details: {} });
    if (w['clearbit'] != null || w['reveal'] != null)
      tools.push({ name: 'Clearbit', category: 'abm', confidence: 0.85, details: {} });

    // ─── Form Detection ────────────────────────────────────────────────────
    const formEls = d.querySelectorAll('form');
    const forms: Array<{ action: string; method: string; hasEmail: boolean; hasPhone: boolean; hasName: boolean; hiddenFields: string[]; formBuilder: string | null; inputCount: number }> = [];
    formEls.forEach((form) => {
      const emailField = !!(
        form.querySelector('input[type="email"], input[name*="email"], input[autocomplete="email"], input[placeholder*="email" i], input[aria-label*="email" i]') ||
        (() => {
          // Check labels containing "email" that reference an input
          const labels = form.querySelectorAll('label');
          for (const lbl of labels) {
            if (/email/i.test(lbl.textContent || '')) {
              const forId = lbl.getAttribute('for');
              if ((forId && form.querySelector('#' + CSS.escape(forId))) || lbl.querySelector('input')) return true;
            }
          }
          // Check data-* attributes containing "email" on text inputs (e.g. data-ryder-field-name="emailAddress")
          const textInputs = form.querySelectorAll('input[type="text"], input:not([type])');
          for (const inp of textInputs) {
            for (const attr of (inp as Element).getAttributeNames()) {
              if (attr.startsWith('data-') && /email/i.test((inp as Element).getAttribute(attr) || '')) return true;
            }
          }
          return false;
        })()
      );
      const phoneField = !!form.querySelector('input[type="tel"], input[name*="phone"], input[autocomplete="tel"]');
      const nameField = !!form.querySelector('input[name*="name"], input[autocomplete="name"], input[autocomplete="given-name"]');
      const hidden = Array.from(form.querySelectorAll('input[type="hidden"]')).map((i) => (i as HTMLInputElement).name).filter(Boolean);

      let fb: string | null = null;
      const act = typeof form.action === 'string' ? form.action : (form.getAttribute('action') ?? '');
      const cls = typeof form.className === 'string' ? form.className : '';
      if (act.includes('hubspot') || cls.includes('hs-form') || form.querySelector('[class*="hs-form"]')) fb = 'HubSpot Forms';
      else if (act.includes('marketo') || form.querySelector('.mktoForm')) fb = 'Marketo Forms';
      else if (act.includes('typeform') || form.closest('[data-tf-widget]')) fb = 'Typeform';
      else if (act.includes('jotform') || cls.includes('jotform')) fb = 'JotForm';
      else if (act.includes('google.com/forms')) fb = 'Google Forms';
      else if (form.querySelector('.gform_wrapper')) fb = 'Gravity Forms';
      else if (form.querySelector('.wpforms-form') || cls.includes('wpforms')) fb = 'WPForms';
      else if (act.includes('formstack')) fb = 'Formstack';
      else if (act.includes('pardot') || cls.includes('pardot')) fb = 'Pardot Forms';
      else if (act.includes('zoho') || cls.includes('zf-')) fb = 'Zoho Forms';
      else if (cls.includes('formidable') || form.querySelector('.frm_form_fields')) fb = 'Formidable Forms';

      forms.push({
        action: act.slice(0, 200), method: form.method || 'GET',
        hasEmail: emailField, hasPhone: phoneField, hasName: nameField,
        hiddenFields: hidden.slice(0, 10), formBuilder: fb,
        inputCount: form.querySelectorAll('input, select, textarea').length,
      });
    });

    return { tools, forms };
  });

  // Typed tool list
  const tools: MartechTool[] = evalResult.tools.map((t) => ({
    name: t.name,
    category: t.category as MartechCategory,
    confidence: t.confidence,
    details: t.details,
    source: 'globals' as const,
  }));

  const existingNames = new Set(tools.map((t) => t.name));

  // ─── Step 2: Network scan — all requests against expanded patterns ─────
  const allRequests = nc?.getAllRequests() ?? [];
  let martechNetworkHits = 0;
  const extractedIds: Record<string, string> = {};

  for (const req of allRequests) {
    for (const np of NETWORK_PATTERNS) {
      if (np.pattern.test(req.url)) {
        martechNetworkHits++;
        // Extract ID if available
        if (np.idExtractor) {
          const idMatch = req.url.match(np.idExtractor);
          if (idMatch?.[1]) {
            extractedIds[np.name] = idMatch[1];
          }
        }
        // Add tool if not already detected from globals
        if (!existingNames.has(np.name)) {
          existingNames.add(np.name);
          tools.push({
            name: np.name,
            category: np.category,
            confidence: 0.8,
            details: { source: 'network' },
            source: 'network',
          });
        }
      }
    }
  }

  // Enrich existing tools with extracted IDs
  for (const tool of tools) {
    if (extractedIds[tool.name]) {
      tool.details.id = extractedIds[tool.name];
    }
  }

  // ─── Step 3: Cookie attribution ────────────────────────────────────────
  let martechCookies: Array<{ name: string; tool: string; domain: string }> = [];
  const cookieToolsDetected = new Set<string>();
  try {
    const rawCookies = await page.context().cookies();
    for (const c of rawCookies) {
      for (const { pattern, tool } of COOKIE_PATTERNS) {
        if (pattern.test(c.name)) {
          martechCookies.push({ name: c.name, tool, domain: c.domain });
          cookieToolsDetected.add(tool);
          // Add tool if not already detected
          if (!existingNames.has(tool)) {
            existingNames.add(tool);
            tools.push({
              name: tool,
              category: inferCategoryFromCookieTool(tool),
              confidence: 0.7,
              details: { source: 'cookie' },
              source: 'cookie',
            });
          }
          break;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // ─── Step 3b: Storage + frame enrichment ────────────────────────────────
  // Cross-reference martech detection with storage keys
  const storageConfirmedTools: string[] = [];
  if (ctx.storageSnapshot) {
    const allStorageMatches = [
      ...ctx.storageSnapshot.localStorage.sdkMatches,
      ...ctx.storageSnapshot.sessionStorage.sdkMatches,
    ];
    for (const match of allStorageMatches) {
      if (!existingNames.has(match.tool)) {
        existingNames.add(match.tool);
        tools.push({
          name: match.tool,
          category: inferCategoryFromCookieTool(match.tool),
          confidence: 0.65,
          details: { source: 'storage', key: match.key },
          source: 'cookie', // storage is similar detection vector to cookie
        });
      }
      storageConfirmedTools.push(match.tool);
    }
  }
  data.storageConfirmedTools = [...new Set(storageConfirmedTools)];

  // Iframe-detected tools (Drift, Intercom, Calendly, Typeform, Trustpilot, etc.)
  const iframeWidgets: Array<{ tool: string; src: string }> = [];
  if (ctx.frameSnapshot) {
    for (const frame of ctx.frameSnapshot.toolFrames) {
      if (!existingNames.has(frame.tool)) {
        existingNames.add(frame.tool);
        tools.push({
          name: frame.tool,
          category: inferCategoryFromCookieTool(frame.tool),
          confidence: 0.7,
          details: { source: 'iframe' },
          source: 'dom',
        });
      }
      iframeWidgets.push(frame);
    }
  }
  data.iframeWidgets = iframeWidgets;

  // ─── Step 3c: WebSocket tool confirmation (Layer 6) ─────────────────────
  const websocketTools: Array<{ tool: string; url: string }> = [];
  if (nc) {
    const wsByTool = nc.getWebSocketsByTool();
    for (const ws of wsByTool) {
      if (!existingNames.has(ws.tool)) {
        existingNames.add(ws.tool);
        tools.push({
          name: ws.tool,
          category: inferCategoryFromCookieTool(ws.tool),
          confidence: 0.75,
          details: { source: 'websocket', url: ws.url },
          source: 'network',
        });
      }
      websocketTools.push({ tool: ws.tool, url: ws.url });
    }
  }
  data.websocketTools = websocketTools.length > 0 ? websocketTools : null;

  // ─── Step 4: Calculate MarTech script performance impact ───────────────
  // Only count bytes for responses that matched a known MarTech network pattern.
  // Do NOT match the target domain itself to avoid inflating with first-party assets.
  let martechBytes = 0;
  const allResponses = nc?.getAllResponses() ?? [];
  const martechUrlSet = new Set<string>();

  // Collect URLs that matched MarTech patterns during Step 2
  for (const req of allRequests) {
    for (const np of NETWORK_PATTERNS) {
      if (np.pattern.test(req.url)) {
        martechUrlSet.add(req.url);
        break; // only count once per request
      }
    }
  }

  for (const resp of allResponses) {
    if (martechUrlSet.has(resp.url) || (resp.requestUrl && martechUrlSet.has(resp.requestUrl))) {
      const cl = resp.headers?.['content-length'];
      martechBytes += cl ? parseInt(cl, 10) : 8000;
    }
  }

  // ─── Step 5: DRY — read M05/M06 for cross-reference ───────────────────
  let m05Ref: Record<string, unknown> | null = null;
  try {
    const m05 = ctx.previousResults?.get('M05' as ModuleId);
    if (m05?.data) m05Ref = m05.data as Record<string, unknown>;
  } catch { /* standalone test */ }

  // Note sGTM / consent from M05 in data for cross-reference
  if (m05Ref) {
    data.m05ServerSide = m05Ref['serverSideTracking'] ?? false;
  }

  // ─── Step 6: Build signals ─────────────────────────────────────────────
  for (const tool of tools) {
    signals.push(
      createSignal({
        type: `martech_${tool.category}`,
        name: tool.name,
        confidence: tool.confidence,
        evidence: `${tool.name} (${tool.category})${tool.details.id ? ` [ID: ${tool.details.id as string}]` : ''}`,
        category: 'martech',
      }),
    );
  }

  // ─── Step 7: Build data payload ────────────────────────────────────────
  data.tools = tools;
  data.forms = evalResult.forms;
  data.martechNetworkHits = martechNetworkHits;
  data.martechCookies = martechCookies;
  data.martechBytes = martechBytes;
  data.toolCount = tools.length;
  data.toolNames = tools.map((t) => t.name);
  data.formCount = evalResult.forms.length;
  data.emailFormCount = evalResult.forms.filter((f) => f.hasEmail).length;
  data.categories = [...new Set(tools.map((t) => t.category))];
  data.extractedIds = extractedIds;

  // ─── Step 8: Build checkpoints ─────────────────────────────────────────
  const byCategory = (cat: MartechCategory) => tools.filter((t) => t.category === cat);
  const maTools = byCategory('marketing_automation');
  const chatTools = byCategory('live_chat');
  const popupTools = byCategory('popup');
  const pushTools = byCategory('push');
  const schedulingTools = byCategory('scheduling');
  const sessionTools = byCategory('session_recording');
  const feedbackTools = byCategory('feedback');
  const personalizationTools = byCategory('personalization');
  const cdpTools = byCategory('cdp');
  const onboardingTools = byCategory('onboarding');
  const emailForms = evalResult.forms.filter((f) => f.hasEmail);
  const categories = new Set(tools.map((t) => t.category));

  // CP1: Marketing Automation
  {
    let health: CheckpointHealth;
    let evidence: string;

    const enterprise = maTools.filter((t) =>
      ['HubSpot', 'Marketo', 'Pardot', 'ActiveCampaign', 'Braze', 'Klaviyo'].includes(t.name),
    );

    if (enterprise.length > 0) {
      health = 'excellent';
      evidence = `Enterprise marketing automation: ${enterprise.map((t) => t.name).join(', ')}`;
    } else if (maTools.length > 0) {
      health = 'good';
      evidence = `Marketing automation: ${maTools.map((t) => t.name).join(', ')}`;
    } else {
      health = 'good';
      evidence = 'No marketing automation platform detected (not required for all sites)';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm07-ma', name: 'Marketing Automation', weight: 0.7, health, evidence }),
    );
  }

  // CP2: Lead Capture infrastructure
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const hasFormBuilder = evalResult.forms.some((f) => f.formBuilder);
    const hasFormSdkNetwork = tools.some((t) => t.category === 'form_builder');

    if (emailForms.length > 0 && (hasFormBuilder || hasFormSdkNetwork)) {
      health = 'excellent';
      evidence = `${emailForms.length} email form(s) with professional form builder`;
    } else if (emailForms.length > 0) {
      health = 'good';
      evidence = `${emailForms.length} email capture form(s) detected`;
    } else if (hasFormSdkNetwork) {
      health = 'good';
      evidence = `Form SDK loaded (${tools.filter((t) => t.category === 'form_builder').map((t) => t.name).join(', ')}) but no forms visible on this page`;
    } else {
      health = 'warning';
      evidence = 'No email capture forms or form SDK detected on this page';
      recommendation =
        'Add an email capture form or newsletter signup to convert visitors into leads.';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm07-lead-capture',
        name: 'Lead Capture Infrastructure',
        weight: 0.8,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP3: CRM Integration
  {
    const crmTools = byCategory('crm');
    const crmForms = evalResult.forms.filter((f) =>
      f.hiddenFields.some((h) => /sfdc|hubspot|marketo|zoho|pipedrive/i.test(h)),
    );
    // HubSpot MA implies HubSpot CRM integration
    const hubspotMA = maTools.some((t) => t.name === 'HubSpot');

    if (crmTools.length > 0 || crmForms.length > 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-crm',
          name: 'CRM Integration',
          weight: 0.5,
          health: 'excellent',
          evidence: `CRM signals: ${[...crmTools.map((t) => t.name), ...crmForms.map(() => 'form hidden fields')].join(', ')}`,
        }),
      );
    } else if (hubspotMA) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-crm',
          name: 'CRM Integration',
          weight: 0.5,
          health: 'good',
          evidence: 'HubSpot CRM implied by HubSpot Marketing Hub presence',
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm07-crm',
          name: 'CRM Integration',
          weight: 0.5,
          evidence: 'No CRM integration signals detected',
        }),
      );
    }
  }

  // CP4: Visitor Engagement (chat + popup + push combined)
  {
    const engagementTools = [...chatTools, ...popupTools, ...pushTools];

    if (engagementTools.length >= 2) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-engagement',
          name: 'Visitor Engagement',
          weight: 0.5,
          health: 'excellent',
          evidence: `Multiple engagement tools: ${engagementTools.map((t) => `${t.name} (${t.category})`).join(', ')}`,
        }),
      );
    } else if (engagementTools.length === 1) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-engagement',
          name: 'Visitor Engagement',
          weight: 0.5,
          health: 'good',
          evidence: `Engagement tool: ${engagementTools[0]!.name} (${engagementTools[0]!.category})`,
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm07-engagement',
          name: 'Visitor Engagement',
          weight: 0.5,
          evidence: 'No live chat, popup, or push notification tools detected',
        }),
      );
    }
  }

  // CP5: Behavioral Analytics (session recording)
  {
    if (sessionTools.length > 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-behavioral',
          name: 'Behavioral Analytics',
          weight: 0.5,
          health: sessionTools.length >= 2 ? 'excellent' : 'good',
          evidence: `Session recording: ${sessionTools.map((t) => t.name).join(', ')}`,
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm07-behavioral',
          name: 'Behavioral Analytics',
          weight: 0.5,
          evidence:
            'No session recording or heatmap tools detected (Hotjar, FullStory, Clarity, etc.)',
        }),
      );
    }
  }

  // CP6: Form Builder Quality
  {
    const builderForms = evalResult.forms.filter((f) => f.formBuilder);
    const brokenForms = evalResult.forms.filter(
      (f) => !f.action || f.action.includes('mailto:'),
    );

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (builderForms.length > 0) {
      health = 'excellent';
      evidence = `Professional form builder: ${[...new Set(builderForms.map((f) => f.formBuilder))].join(', ')}`;
    } else if (evalResult.forms.length > 0 && brokenForms.length === 0) {
      health = 'good';
      evidence = `${evalResult.forms.length} form(s) with standard HTML elements`;
    } else if (brokenForms.length > 0) {
      health = 'warning';
      evidence = `${brokenForms.length} form(s) with missing or broken action URLs`;
      recommendation = 'Fix broken form actions to ensure lead data is captured properly.';
    } else {
      health = 'good';
      evidence = 'No forms on this page';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm07-forms',
        name: 'Form Builder Quality',
        weight: 0.5,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP7: Personalization & Testing
  {
    const pTools = [...personalizationTools, ...onboardingTools];

    if (pTools.length > 0) {
      checkpoints.push(
        createCheckpoint({
          id: 'm07-personalization',
          name: 'Personalization & Testing',
          weight: 0.5,
          health: pTools.length >= 2 ? 'excellent' : 'good',
          evidence: `CRO tools: ${pTools.map((t) => t.name).join(', ')}`,
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm07-personalization',
          name: 'Personalization & Testing',
          weight: 0.5,
          evidence:
            'No A/B testing, personalization, or onboarding tools detected',
        }),
      );
    }
  }

  // CP8: Stack Breadth
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (categories.size >= 5) {
      health = 'excellent';
      evidence = `Deep MarTech stack: ${categories.size} categories (${Array.from(categories).join(', ')})`;
    } else if (categories.size >= 3) {
      health = 'good';
      evidence = `${categories.size} MarTech categories: ${Array.from(categories).join(', ')}`;
    } else if (categories.size >= 1) {
      health = 'good';
      evidence = `${categories.size} MarTech ${categories.size === 1 ? 'category' : 'categories'}: ${Array.from(categories).join(', ')}`;
    } else {
      health = 'warning';
      evidence = 'No MarTech tools detected';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm07-breadth',
        name: 'Stack Breadth',
        weight: 0.6,
        health,
        evidence,
      }),
    );
  }

  // CP9: Stack Coherence — cookie attribution + orphan detection
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const toolNamesSet = new Set(tools.map((t) => t.name));
    const orphanCookieTools = [...cookieToolsDetected].filter((t) => !toolNamesSet.has(t));
    const attributedCount = martechCookies.length;

    if (attributedCount > 0 && orphanCookieTools.length === 0) {
      health = 'excellent';
      evidence = `${attributedCount} MarTech cookies fully attributed to detected tools`;
    } else if (attributedCount > 0 && orphanCookieTools.length > 0) {
      health = 'warning';
      evidence = `${attributedCount} cookies attributed, but orphan cookies suggest undetected tools: ${orphanCookieTools.join(', ')}`;
      recommendation = `Investigate orphan MarTech cookies from: ${orphanCookieTools.join(', ')}`;
    } else if (tools.length > 0) {
      health = 'good';
      evidence = `${tools.length} tools detected but no MarTech-specific cookies found (may be first-visit or consent-gated)`;
    } else {
      health = 'good';
      evidence = 'No MarTech cookies to attribute';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm07-coherence',
        name: 'Stack Coherence',
        weight: 0.5,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP10: MarTech Performance Impact
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const martechKB = Math.round(martechBytes / 1024);

    if (martechBytes === 0) {
      health = 'good';
      evidence = 'No measurable MarTech script payload';
    } else if (martechKB < 200) {
      health = 'excellent';
      evidence = `Light MarTech footprint: ${martechKB} KB across ${martechNetworkHits} network requests`;
    } else if (martechKB < 500) {
      health = 'good';
      evidence = `Moderate MarTech footprint: ${martechKB} KB across ${martechNetworkHits} requests`;
    } else if (martechKB < 1000) {
      health = 'warning';
      evidence = `Heavy MarTech footprint: ${martechKB} KB across ${martechNetworkHits} requests`;
      recommendation =
        'Audit MarTech scripts for performance — consider lazy-loading or server-side alternatives.';
    } else {
      health = 'critical';
      evidence = `Excessive MarTech footprint: ${martechKB} KB across ${martechNetworkHits} requests`;
      recommendation =
        'Critical performance concern — audit and consolidate MarTech scripts, remove unused tools.';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm07-performance',
        name: 'MarTech Performance Impact',
        weight: 0.4,
        health,
        evidence,
        recommendation,
      }),
    );
  }

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

// ---------------------------------------------------------------------------
// Helper: infer category from cookie tool name
// ---------------------------------------------------------------------------

function inferCategoryFromCookieTool(toolName: string): MartechCategory {
  const map: Record<string, MartechCategory> = {
    'HubSpot': 'marketing_automation',
    'Marketo': 'marketing_automation',
    'Pardot': 'marketing_automation',
    'Klaviyo': 'marketing_automation',
    'Drip': 'marketing_automation',
    'Braze': 'marketing_automation',
    'Omnisend': 'marketing_automation',
    'MailerLite': 'marketing_automation',
    'Intercom': 'live_chat',
    'Drift': 'live_chat',
    'Zendesk Chat': 'live_chat',
    'LiveChat': 'live_chat',
    'Crisp': 'live_chat',
    'Tawk.to': 'live_chat',
    'Hotjar': 'session_recording',
    'FullStory': 'session_recording',
    'Microsoft Clarity': 'session_recording',
    'Crazy Egg': 'session_recording',
    'Lucky Orange': 'session_recording',
    'MouseFlow': 'session_recording',
    'Smartlook': 'session_recording',
    'Segment': 'cdp',
    'RudderStack': 'cdp',
    'Tealium': 'cdp',
    'Optimizely': 'personalization',
    'VWO': 'personalization',
    'AB Tasty': 'personalization',
    'Dynamic Yield': 'personalization',
    'Pendo': 'onboarding',
    'OptinMonster': 'popup',
    'Sumo': 'popup',
    'Yotpo': 'review',
  };
  return map[toolName] ?? 'marketing_automation';
}

export { execute };
registerModuleExecutor('M07' as ModuleId, execute);
