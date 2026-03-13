/**
 * FormCollector — One-shot snapshot of all <form> elements on the page.
 *
 * Captures form metadata (fields, builder detection, type classification)
 * via a single page.evaluate() call. Caps at 30 forms, 50 fields per form.
 *
 * Consumers: M05 (analytics/tool detection), M07 (martech confirmation),
 *            M09 (behavioral analysis), M20 (ecommerce/SaaS audit)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldInfo {
  type: string;                // text/email/tel/password/checkbox/radio/select/textarea/hidden/number/date/file
  name: string;
  required: boolean;
  hasLabel: boolean;
  hasPlaceholder: boolean;
  autocomplete: string | null;
  hasPattern: boolean;
  hasAriaLabel: boolean;
}

export interface FormInfo {
  action: string;              // relative or absolute
  method: string;              // GET or POST
  id: string | null;
  formBuilder: string | null;  // HubSpot, Marketo, Typeform, Pardot, Gravity Forms, WPForms, etc.
  fields: FieldInfo[];         // capped at 50 per form
  hasValidation: boolean;      // any field with required, pattern, or type validation
  hasHiddenFields: boolean;
  hiddenFieldCount: number;
  isMultiStep: boolean;        // detects multi-step wizard patterns
}

export interface FormSnapshot {
  forms: FormInfo[];           // capped at 30
  totalForms: number;
  totalFields: number;
  hasSearchForm: boolean;
  hasLoginForm: boolean;
  hasSignupForm: boolean;
  hasContactForm: boolean;
  hasCheckoutForm: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FORMS = 30;
const MAX_FIELDS_PER_FORM = 50;

// ---------------------------------------------------------------------------
// FormCollector
// ---------------------------------------------------------------------------

export class FormCollector {
  /**
   * Take a one-shot snapshot of all forms on the page.
   * Returns form metadata including builder detection and type classification.
   */
  static async snapshot(page: Page): Promise<FormSnapshot> {
    return page.evaluate(
      ({ maxForms, maxFields }: { maxForms: number; maxFields: number }) => {
        const allForms = document.querySelectorAll('form');
        const totalForms = allForms.length;
        const formsToProcess = Array.from(allForms).slice(0, maxForms);

        let totalFields = 0;
        let hasSearchForm = false;
        let hasLoginForm = false;
        let hasSignupForm = false;
        let hasContactForm = false;
        let hasCheckoutForm = false;

        // -----------------------------------------------------------------
        // Validation type set for hasValidation check
        // -----------------------------------------------------------------
        const validationTypes = new Set(['email', 'url', 'number', 'tel', 'date']);

        // -----------------------------------------------------------------
        // Helper: detect form builder
        // -----------------------------------------------------------------
        function detectFormBuilder(form: HTMLFormElement): string | null {
          const formAction = form.getAttribute('action') ?? '';
          const formId = form.id ?? '';
          const formClasses = form.className ?? '';

          // HubSpot
          if (
            form.classList.contains('hs-form') ||
            formId.includes('hsForm') ||
            form.querySelector('input[name^="hs_"]')
          ) {
            return 'HubSpot';
          }

          // Marketo
          if (
            form.classList.contains('mktoForm') ||
            form.querySelector('input[name^="mkto"]')
          ) {
            return 'Marketo';
          }

          // Pardot
          if (
            form.classList.contains('pardot-form') ||
            formAction.includes('pardot') ||
            formAction.includes('pi.pardot')
          ) {
            return 'Pardot';
          }

          // Gravity Forms
          const wrapper = form.closest('.gform_wrapper');
          if (
            wrapper ||
            (form.querySelector('.gfield') && form.querySelector('input[name^="input_"]'))
          ) {
            return 'Gravity Forms';
          }

          // WPForms
          if (form.classList.contains('wpforms-form')) {
            return 'WPForms';
          }

          // Formidable Forms
          if (form.closest('.frm_forms')) {
            return 'Formidable';
          }

          // Ninja Forms
          if (form.closest('.nf-form-cont')) {
            return 'Ninja Forms';
          }

          // Contact Form 7
          if (form.classList.contains('wpcf7-form')) {
            return 'Contact Form 7';
          }

          // Mailchimp
          if (formAction.includes('list-manage.com')) {
            return 'Mailchimp';
          }

          // ActiveCampaign
          if (
            formClasses.includes('_form') &&
            formAction.includes('activehosted.com')
          ) {
            return 'ActiveCampaign';
          }

          // ConvertKit
          if (form.querySelector('[data-sv-form]') || form.hasAttribute('data-sv-form')) {
            return 'ConvertKit';
          }

          // Typeform (check iframes and data attributes on the page near the form)
          if (form.querySelector('[data-tf-widget]')) {
            return 'Typeform';
          }

          return null;
        }

        // -----------------------------------------------------------------
        // Helper: extract fields from a form
        // -----------------------------------------------------------------
        function extractFields(form: HTMLFormElement): FieldInfo[] {
          const elements = form.querySelectorAll('input, select, textarea');
          const fields: FieldInfo[] = [];

          const limit = Math.min(elements.length, maxFields);
          for (let i = 0; i < limit; i++) {
            const el = elements[i]! as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            const tagName = el.tagName.toLowerCase();

            let type: string;
            if (tagName === 'select') {
              type = 'select';
            } else if (tagName === 'textarea') {
              type = 'textarea';
            } else {
              type = (el as HTMLInputElement).type || 'text';
            }

            const name = el.name || '';
            const required = el.required || el.hasAttribute('required');
            const autocomplete = el.getAttribute('autocomplete') || null;
            const hasPattern = el.hasAttribute('pattern');
            const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
            const hasPlaceholder = el.hasAttribute('placeholder') && (el.getAttribute('placeholder') ?? '').length > 0;

            // Label detection: explicit for= or wrapping <label>
            let hasLabel = false;
            if (el.id) {
              hasLabel = !!document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            }
            if (!hasLabel) {
              hasLabel = !!el.closest('label');
            }

            fields.push({
              type,
              name,
              required,
              hasLabel,
              hasPlaceholder,
              autocomplete,
              hasPattern,
              hasAriaLabel,
            });
          }

          return fields;
        }

        // -----------------------------------------------------------------
        // Helper: detect multi-step form
        // -----------------------------------------------------------------
        function detectMultiStep(form: HTMLFormElement): boolean {
          const html = form.innerHTML.toLowerCase();

          // Check for step/wizard/multistep class names
          const stepIndicators = form.querySelectorAll(
            '[class*="step"], [class*="wizard"], [class*="multistep"], [class*="multi-step"]'
          );
          if (stepIndicators.length > 1) return true;

          // Multiple fieldsets with next/prev buttons
          const fieldsets = form.querySelectorAll('fieldset');
          if (fieldsets.length > 1) {
            const hasNavButtons =
              html.includes('next') || html.includes('prev') || html.includes('continue');
            if (hasNavButtons) return true;
          }

          // Multiple sections with navigation
          const sections = form.querySelectorAll('[class*="section"], [data-step]');
          if (sections.length > 1) {
            const hasNavButtons =
              html.includes('next') || html.includes('prev') || html.includes('continue');
            if (hasNavButtons) return true;
          }

          return false;
        }

        // -----------------------------------------------------------------
        // Process each form
        // -----------------------------------------------------------------
        const forms: FormInfo[] = [];

        for (const form of formsToProcess) {
          const fields = extractFields(form);
          totalFields += fields.length;

          const hiddenFields = fields.filter((f) => f.type === 'hidden');
          const visibleFields = fields.filter((f) => f.type !== 'hidden' && f.type !== 'submit');

          const hasValidation = fields.some(
            (f) => f.required || f.hasPattern || validationTypes.has(f.type)
          );

          const formInfo: FormInfo = {
            action: form.getAttribute('action') ?? '',
            method: (form.getAttribute('method') ?? 'GET').toUpperCase(),
            id: form.id || null,
            formBuilder: detectFormBuilder(form),
            fields,
            hasValidation,
            hasHiddenFields: hiddenFields.length > 0,
            hiddenFieldCount: hiddenFields.length,
            isMultiStep: detectMultiStep(form),
          };

          forms.push(formInfo);

          // ---------------------------------------------------------------
          // Form type classification
          // ---------------------------------------------------------------
          const hasPassword = visibleFields.some((f) => f.type === 'password');
          const hasEmail = visibleFields.some(
            (f) => f.type === 'email' || f.name.toLowerCase().includes('email')
          );
          const hasUsername = visibleFields.some(
            (f) =>
              f.name.toLowerCase().includes('user') ||
              f.name.toLowerCase().includes('login')
          );
          const hasTextarea = visibleFields.some(
            (f) =>
              f.type === 'textarea' ||
              f.name.toLowerCase().includes('message') ||
              f.name.toLowerCase().includes('comment')
          );
          const hasNameField = visibleFields.some(
            (f) =>
              f.name.toLowerCase().includes('name') &&
              !f.name.toLowerCase().includes('user')
          );
          const hasTerms = visibleFields.some(
            (f) =>
              f.type === 'checkbox' &&
              (f.name.toLowerCase().includes('terms') ||
                f.name.toLowerCase().includes('agree') ||
                f.name.toLowerCase().includes('tos'))
          );
          const hasCCField = fields.some(
            (f) =>
              f.autocomplete === 'cc-number' ||
              f.autocomplete === 'cc-name' ||
              f.autocomplete === 'cc-exp' ||
              f.name.toLowerCase().includes('card') ||
              f.name.toLowerCase().includes('payment')
          );
          const formAction = form.getAttribute('action') ?? '';
          const formRole = form.getAttribute('role') ?? '';
          const hasSearchInput = !!form.querySelector('input[type="search"]');

          // Search form
          if (
            formRole === 'search' ||
            hasSearchInput ||
            formAction.toLowerCase().includes('search')
          ) {
            hasSearchForm = true;
          }

          // Login form: password + email/username, few visible fields
          if (hasPassword && (hasEmail || hasUsername) && visibleFields.length <= 4) {
            hasLoginForm = true;
          }

          // Signup form: password + email + (name or terms), more fields
          if (hasPassword && hasEmail && (hasNameField || hasTerms) && visibleFields.length > 3) {
            hasSignupForm = true;
          }

          // Contact form: email + textarea/message, no password
          if (hasEmail && hasTextarea && !hasPassword) {
            hasContactForm = true;
          }

          // Checkout form: credit card fields or payment classes
          if (hasCCField) {
            hasCheckoutForm = true;
          }
        }

        // Also check for Typeform iframes outside forms
        if (!forms.some((f) => f.formBuilder === 'Typeform')) {
          const typeformIframes = document.querySelectorAll('iframe[src*="typeform.com"]');
          const typeformWidgets = document.querySelectorAll('[data-tf-widget]');
          if (typeformIframes.length > 0 || typeformWidgets.length > 0) {
            // Note: Typeform detected but not as a <form> element
          }
        }

        return {
          forms,
          totalForms,
          totalFields,
          hasSearchForm,
          hasLoginForm,
          hasSignupForm,
          hasContactForm,
          hasCheckoutForm,
        };
      },
      { maxForms: MAX_FORMS, maxFields: MAX_FIELDS_PER_FORM },
    );
  }
}
