/**
 * M20 - Ecommerce & SaaS Detection
 *
 * Detects ecommerce platforms, SaaS product indicators, pricing pages,
 * payment processing, checkout flows, and product-led growth patterns.
 *
 * Checkpoints:
 *   1. Ecommerce platform detection
 *   2. Payment processor detection
 *   3. Product pricing presence
 *   4. Cart/checkout functionality
 *   5. Product-led growth signals
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

interface EcommerceSignals {
  platform: string | null;
  paymentProcessors: string[];
  hasCart: boolean;
  hasCheckout: boolean;
  hasPricing: boolean;
  hasFreeTrial: boolean;
  hasDemoRequest: boolean;
  productType: 'ecommerce' | 'saas' | 'marketplace' | 'hybrid' | 'unknown';
  plgSignals: string[];
  ecommerceDataLayer: boolean;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M20' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  const ecomData = await page.evaluate((): EcommerceSignals => {
    const w = window as unknown as Record<string, unknown>;
    const doc = document;
    let platform: string | null = null;
    const paymentProcessors: string[] = [];
    const plgSignals: string[] = [];

    // --- Ecommerce platform detection ---
    // Shopify
    if (w['Shopify'] || doc.querySelector('meta[name="shopify-digital-wallet"]') || doc.querySelector('link[href*="cdn.shopify.com"]')) {
      platform = 'Shopify';
    }
    // WooCommerce
    else if (doc.querySelector('.woocommerce, script[src*="woocommerce"], body.woocommerce-page')) {
      platform = 'WooCommerce';
    }
    // Magento
    else if (w['Mage'] || doc.querySelector('script[src*="mage"], .magento')) {
      platform = 'Magento';
    }
    // BigCommerce
    else if (doc.querySelector('script[src*="bigcommerce"]') || w['BCData']) {
      platform = 'BigCommerce';
    }
    // Squarespace Commerce
    else if (w['Static'] && doc.querySelector('meta[content*="Squarespace"]')) {
      platform = 'Squarespace Commerce';
    }
    // PrestaShop
    else if (w['prestashop'] || doc.querySelector('meta[name="generator"][content*="PrestaShop"]')) {
      platform = 'PrestaShop';
    }
    // Salesforce Commerce
    else if (doc.querySelector('script[src*="demandware"], [class*="sfcc"]')) {
      platform = 'Salesforce Commerce Cloud';
    }

    // --- Payment processors ---
    if (doc.querySelector('script[src*="js.stripe.com"], script[src*="stripe"]') || w['Stripe']) {
      paymentProcessors.push('Stripe');
    }
    if (doc.querySelector('script[src*="paypal.com"], [data-partner-attribution-id]') || w['paypal']) {
      paymentProcessors.push('PayPal');
    }
    if (doc.querySelector('script[src*="braintreegateway"], script[src*="braintree"]')) {
      paymentProcessors.push('Braintree');
    }
    if (doc.querySelector('script[src*="squareup.com"], script[src*="square.site"], [data-locationid][class*="square"]')) {
      paymentProcessors.push('Square');
    }
    if (doc.querySelector('script[src*="adyen"], [class*="adyen"]')) {
      paymentProcessors.push('Adyen');
    }
    if (doc.querySelector('link[href*="shopify-pay"], [data-shopify-pay]')) {
      paymentProcessors.push('Shop Pay');
    }
    if (doc.querySelector('[class*="apple-pay"], [data-apple-pay]')) {
      paymentProcessors.push('Apple Pay');
    }
    if (doc.querySelector('[class*="google-pay"], [data-google-pay]')) {
      paymentProcessors.push('Google Pay');
    }
    if (doc.querySelector('script[src*="afterpay"], script[src*="clearpay"]')) {
      paymentProcessors.push('Afterpay/Clearpay');
    }
    if (doc.querySelector('script[src*="klarna"]')) {
      paymentProcessors.push('Klarna');
    }
    if (doc.querySelector('script[src*="affirm"]')) {
      paymentProcessors.push('Affirm');
    }

    // --- Cart/checkout ---
    const hasCart = !!(
      doc.querySelector('[class*="cart"], [id*="cart"], a[href*="/cart"], [data-cart]') ||
      w['cart'] || w['CartJS']
    );
    const hasCheckout = !!(
      doc.querySelector('[class*="checkout"], a[href*="/checkout"], [data-checkout]')
    );

    // --- Pricing/SaaS detection ---
    const hasPricing = !!(
      doc.querySelector('a[href*="/pricing"], a[href*="/plans"], [class*="pricing"]') ||
      doc.querySelector('[class*="price-card"], [class*="plan-card"]')
    );
    const hasFreeTrial = !!(
      doc.querySelector('a[href*="free-trial"], a[href*="free_trial"], a[href*="/trial"], a[href*="get-started-free"], a[href*="start-free"], [class*="free-trial"]') ||
      doc.querySelector('a[href*="signup/free"], a[href*="sign-up/free"], a[href*="/free"]') ||
      !!Array.from(doc.querySelectorAll('a, button')).find((el) => {
        const text = (el.textContent || '').trim().toLowerCase();
        return /\bfree\s*(trial|plan|tier)\b|\bstart\s*free\b|\btry\s*(it\s*)?free\b|\bget\s*started\s*free\b|\bfree\s*sign\s*up\b/.test(text);
      })
    );
    const hasDemoRequest = !!(
      doc.querySelector('a[href*="/demo"], a[href*="request-demo"], [class*="demo"]') ||
      doc.body.textContent?.match(/request\s+a?\s*demo|book\s+a?\s*demo|schedule\s+demo/i)
    );

    // --- Product-led growth signals ---
    if (hasFreeTrial) plgSignals.push('Free trial');
    if (doc.querySelector('a[href*="/signup"], a[href*="/register"], [class*="signup"]')) plgSignals.push('Self-serve signup');
    if (hasPricing) plgSignals.push('Public pricing');
    if (doc.querySelector('[class*="onboarding"], [class*="getting-started"]')) plgSignals.push('Onboarding flow');
    if (doc.querySelector('a[href*="/docs"], a[href*="/documentation"], a[href*="/api"]')) plgSignals.push('Developer docs');
    if (doc.querySelector('a[href*="/changelog"], a[href*="/release-notes"]')) plgSignals.push('Changelog');

    // --- Product type classification ---
    let productType: EcommerceSignals['productType'] = 'unknown';
    if (platform || hasCart) {
      productType = hasPricing || hasFreeTrial ? 'hybrid' : 'ecommerce';
    } else if (hasPricing || hasFreeTrial || hasDemoRequest) {
      productType = 'saas';
    }

    // --- Ecommerce dataLayer ---
    const dl = (w['dataLayer'] as Array<Record<string, unknown>>) || [];
    const ecommerceDataLayer = dl.some(e => e && typeof e === 'object' && ('ecommerce' in e || 'transactionId' in e));

    return {
      platform,
      paymentProcessors,
      hasCart,
      hasCheckout,
      hasPricing,
      hasFreeTrial,
      hasDemoRequest,
      productType,
      plgSignals,
      ecommerceDataLayer,
    };
  });

  // ─── Network-based payment processor detection ─────────────────────────
  const nc = ctx.networkCollector;
  if (nc) {
    const allReqs = nc.getAllRequests();
    const paymentPatterns: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Stripe', pattern: /js\.stripe\.com|m\.stripe\.com|api\.stripe\.com/ },
      { name: 'PayPal', pattern: /paypal\.com\/sdk|paypalobjects\.com/ },
      { name: 'Braintree', pattern: /braintreegateway\.com|braintree-api\.com/ },
      { name: 'Adyen', pattern: /adyen\.com\/checkoutshopper/ },
      { name: 'Square', pattern: /squareup\.com\/payments|square\.site/ },
      { name: 'Paddle', pattern: /paddle\.com\/paddle\.js|cdn\.paddle\.com/ },
      { name: 'Chargebee', pattern: /js\.chargebee\.com/ },
      { name: 'Recurly', pattern: /js\.recurly\.com/ },
      { name: 'FastSpring', pattern: /fastspring\.com\/builder/ },
    ];

    for (const { name, pattern } of paymentPatterns) {
      if (!ecomData.paymentProcessors.includes(name)) {
        if (allReqs.some((r) => pattern.test(r.url))) {
          ecomData.paymentProcessors.push(name);
        }
      }
    }
  }

  data.ecommerce = ecomData;

  // ─── Auth/SSO + Payment iframe + Form security detection ──────────────────
  const authPaymentData = await page.evaluate(() => {
    const doc = document;
    const w = window as unknown as Record<string, unknown>;

    // --- OAuth / SSO Providers ---
    const authProviders: string[] = [];

    // Google Sign-In
    if (doc.querySelector('script[src*="accounts.google.com/gsi"], [data-client_id][data-callback], .g_id_signin, #g_id_onload, meta[name="google-signin-client_id"]')) {
      authProviders.push('Google Sign-In');
    }
    // Facebook Login
    if (doc.querySelector('[data-onlogin], .fb-login-button, [class*="facebook-login"], [data-scope]') && (w['FB'] || doc.querySelector('script[src*="connect.facebook.net"]'))) {
      authProviders.push('Facebook Login');
    }
    // Apple Sign-In
    if (doc.querySelector('script[src*="appleid.auth"], [data-color][data-border][data-type="sign-in"], div#appleid-signin')) {
      authProviders.push('Apple Sign-In');
    }
    // Microsoft / Azure AD
    if (doc.querySelector('script[src*="login.microsoftonline.com"], script[src*="msal"]') || w['msal']) {
      authProviders.push('Microsoft SSO');
    }
    // Auth0
    if (doc.querySelector('script[src*="auth0.com/js"], script[src*="cdn.auth0.com"]') || w['auth0']) {
      authProviders.push('Auth0');
    }
    // Okta
    if (doc.querySelector('script[src*="okta.com"], script[src*="okta-signin-widget"]') || w['OktaSignIn']) {
      authProviders.push('Okta');
    }
    // Firebase Auth
    if (w['firebase'] && typeof (w['firebase'] as Record<string, unknown>)['auth'] === 'function') {
      authProviders.push('Firebase Auth');
    }
    // Clerk
    if (doc.querySelector('script[src*="clerk.com"], [data-clerk-publishable-key]') || w['Clerk']) {
      authProviders.push('Clerk');
    }
    // Supabase Auth
    if (w['supabase'] || doc.querySelector('script[src*="supabase"]')) {
      authProviders.push('Supabase Auth');
    }

    // --- Payment providers (iframe detection) ---
    const iframePayment: string[] = [];
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const src = (iframe.src || iframe.getAttribute('data-src') || '').toLowerCase();
      if (src.includes('js.stripe.com') || src.includes('stripe.com/v3')) iframePayment.push('Stripe Elements');
      if (src.includes('paypal.com/sdk') || src.includes('paypalobjects.com')) iframePayment.push('PayPal');
      if (src.includes('pay.google.com')) iframePayment.push('Google Pay');
      if (src.includes('applepay')) iframePayment.push('Apple Pay');
      if (src.includes('checkout.shopify.com')) iframePayment.push('Shopify Checkout');
    });

    // --- Form Security ---
    const passwordFields = doc.querySelectorAll('input[type="password"]').length;
    const otpFields = doc.querySelectorAll('input[name*="otp"], input[name*="2fa"], input[name*="mfa"], input[name*="verification"], input[autocomplete="one-time-code"], input[inputmode="numeric"][maxlength="6"]').length;

    // CAPTCHA detection
    let captchaType: string | null = null;
    if (doc.querySelector('.g-recaptcha, [data-sitekey], script[src*="recaptcha/api.js"]')) {
      captchaType = doc.querySelector('[data-size="invisible"]') || doc.querySelector('script[src*="recaptcha/api.js?render="]')
        ? 'reCAPTCHA v3'
        : 'reCAPTCHA v2';
    } else if (doc.querySelector('[data-hcaptcha-sitekey], .h-captcha, script[src*="hcaptcha.com"]')) {
      captchaType = 'hCaptcha';
    } else if (doc.querySelector('[data-turnstile-sitekey], .cf-turnstile, script[src*="challenges.cloudflare.com/turnstile"]')) {
      captchaType = 'Cloudflare Turnstile';
    }

    return {
      authProviders: [...new Set(authProviders)],
      iframePayment: [...new Set(iframePayment)],
      formSecurity: {
        passwordFields,
        has2FA: otpFields > 0,
        captchaType,
      },
    };
  });

  data.authProviders = authPaymentData.authProviders.length > 0 ? authPaymentData.authProviders : null;
  data.paymentProviders = authPaymentData.iframePayment.length > 0 ? authPaymentData.iframePayment : null;
  data.formSecurity = authPaymentData.formSecurity;

  // Also enrich from frame snapshot
  if (ctx.frameSnapshot) {
    for (const tf of ctx.frameSnapshot.toolFrames) {
      const tool = tf.tool.toLowerCase();
      if ((tool.includes('stripe') || tool.includes('paypal') || tool.includes('braintree')) &&
          !ecomData.paymentProcessors.includes(tf.tool)) {
        ecomData.paymentProcessors.push(tf.tool);
      }
    }
  }

  // Add auth provider signals
  for (const ap of authPaymentData.authProviders) {
    signals.push(createSignal({ type: 'auth_provider', name: ap, confidence: 0.85, evidence: `Auth: ${ap}`, category: 'security' }));
  }

  // ─── Build signals ───────────────────────────────────────────────────────
  if (ecomData.platform) {
    signals.push(createSignal({ type: 'ecommerce_platform', name: ecomData.platform, confidence: 0.9, evidence: `Ecommerce: ${ecomData.platform}`, category: 'ecommerce' }));
  }
  for (const pp of ecomData.paymentProcessors) {
    signals.push(createSignal({ type: 'payment_processor', name: pp, confidence: 0.85, evidence: `Payment: ${pp}`, category: 'ecommerce' }));
  }
  if (ecomData.productType !== 'unknown') {
    signals.push(createSignal({ type: 'product_type', name: ecomData.productType, confidence: 0.8, evidence: `Product type: ${ecomData.productType}`, category: 'business_model' }));
  }

  // ─── Build checkpoints ───────────────────────────────────────────────────

  // CP1: Ecommerce platform
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (ecomData.platform) {
      health = 'excellent';
      evidence = `Ecommerce platform: ${ecomData.platform}`;
    } else if (ecomData.hasCart || ecomData.hasCheckout) {
      health = 'good';
      evidence = 'Cart/checkout elements detected but platform not identified';
    } else {
      health = 'good';
      evidence = 'No ecommerce platform detected (may be SaaS or non-commerce)';
    }

    checkpoints.push(createCheckpoint({ id: 'm20-platform', name: 'Ecommerce Platform', weight: 0.6, health, evidence }));
  }

  // CP2: Payment processor
  {
    if (ecomData.paymentProcessors.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm20-payments',
        name: 'Payment Processor',
        weight: 0.5,
        health: 'excellent',
        evidence: `Payment: ${ecomData.paymentProcessors.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm20-payments', name: 'Payment Processor', weight: 0.5, evidence: 'No payment processor detected on this page' }));
    }
  }

  // CP3: Pricing presence
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (ecomData.hasPricing) {
      health = 'excellent';
      evidence = 'Pricing/plans page linked — transparent pricing increases conversion';
    } else if (ecomData.hasDemoRequest) {
      health = 'good';
      evidence = 'Demo request available (enterprise sales model — no public pricing)';
    } else if (ecomData.productType === 'ecommerce') {
      health = 'good';
      evidence = 'Ecommerce — product prices on individual pages';
    } else {
      health = 'good';
      evidence = 'No pricing page detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm20-pricing', name: 'Product Pricing Presence', weight: 0.4, health, evidence }));
  }

  // CP4: Cart/checkout
  {
    if (ecomData.hasCart && ecomData.hasCheckout) {
      checkpoints.push(createCheckpoint({ id: 'm20-cart', name: 'Cart & Checkout', weight: 0.5, health: 'excellent', evidence: 'Cart and checkout flow present' }));
    } else if (ecomData.hasCart || ecomData.hasCheckout) {
      checkpoints.push(createCheckpoint({ id: 'm20-cart', name: 'Cart & Checkout', weight: 0.5, health: 'good', evidence: `${ecomData.hasCart ? 'Cart' : 'Checkout'} detected` }));
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm20-cart', name: 'Cart & Checkout', weight: 0.5, evidence: 'No cart/checkout on this page (may be on subpages)' }));
    }
  }

  // CP5: Product-led growth signals
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (ecomData.plgSignals.length >= 3) {
      health = 'excellent';
      evidence = `Strong PLG signals: ${ecomData.plgSignals.join(', ')}`;
    } else if (ecomData.plgSignals.length >= 1) {
      health = 'good';
      evidence = `PLG signals: ${ecomData.plgSignals.join(', ')}`;
    } else {
      health = 'good';
      evidence = 'No product-led growth signals (sales-led or non-SaaS)';
    }

    checkpoints.push(createCheckpoint({ id: 'm20-plg', name: 'Product-Led Growth', weight: 0.4, health, evidence }));
  }

  // CP6: Authentication providers
  if (authPaymentData.authProviders.length > 0) {
    checkpoints.push(createCheckpoint({
      id: 'm20-auth',
      name: 'Authentication & SSO',
      weight: 0.3,
      health: authPaymentData.authProviders.length >= 2 ? 'excellent' : 'good',
      evidence: `Auth providers: ${authPaymentData.authProviders.join(', ')}`,
    }));
  }

  // CP7: Form security
  if (authPaymentData.formSecurity.passwordFields > 0) {
    const fs = authPaymentData.formSecurity;
    const securityFeatures: string[] = [];
    if (fs.has2FA) securityFeatures.push('2FA/MFA');
    if (fs.captchaType) securityFeatures.push(fs.captchaType);

    checkpoints.push(createCheckpoint({
      id: 'm20-form-security',
      name: 'Form Security',
      weight: 0.4,
      health: securityFeatures.length >= 2 ? 'excellent' : securityFeatures.length === 1 ? 'good' : 'warning',
      evidence: securityFeatures.length > 0
        ? `${fs.passwordFields} password field(s) with: ${securityFeatures.join(', ')}`
        : `${fs.passwordFields} password field(s) — no CAPTCHA or 2FA detected`,
      recommendation: securityFeatures.length === 0
        ? 'Add CAPTCHA protection and consider 2FA/MFA for login forms to prevent credential stuffing.'
        : undefined,
    }));
  } else if (authPaymentData.formSecurity.captchaType) {
    checkpoints.push(infoCheckpoint({
      id: 'm20-form-security',
      name: 'Form Security',
      weight: 0.4,
      evidence: `CAPTCHA protection active: ${authPaymentData.formSecurity.captchaType}`,
    }));
  }

  // Ecommerce dataLayer bonus info
  if (ecomData.ecommerceDataLayer) {
    checkpoints.push(infoCheckpoint({ id: 'm20-ecom-dl', name: 'Ecommerce DataLayer', weight: 0.3, evidence: 'GA4 ecommerce dataLayer events detected — revenue tracking enabled' }));
  }

  return { moduleId: 'M20' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M20' as ModuleId, execute);
