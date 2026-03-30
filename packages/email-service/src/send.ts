import { Resend } from 'resend';
import { render } from '@react-email/render';
import { getServiceClient } from './supabase';
import { checkSuppression } from './suppression';
import { checkRateLimit } from './rate-limit';
import { checkDedup } from './dedup';
import type { SendEmailOptions, SendEmailResult } from './types';
import { EMAIL_ATTACHMENTS } from './images';

let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'alpha@marketingalphascan.com';
const REPLY_TO = process.env.RESEND_REPLY_TO_EMAIL ?? 'support@marketingalphascan.com';

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    userId,
    template,
    subject,
    react,
    referenceId,
    headers,
    tags = [],
    critical = false,
  } = options;

  try {
    // 1. Check suppression list
    const suppressed = await checkSuppression(to);
    if (suppressed) {
      console.log(`[email] Suppressed: ${template} to ${to}`);
      return { success: false, skipped: 'suppressed' };
    }

    // 2. Check rate limit
    if (userId) {
      const rateLimited = await checkRateLimit(userId, template);
      if (rateLimited) {
        console.log(`[email] Rate limited: ${template} for user ${userId}`);
        return { success: false, skipped: 'rate_limited' };
      }
    }

    // 3. Check dedup
    if (userId && referenceId) {
      const duplicate = await checkDedup(userId, template, referenceId);
      if (duplicate) {
        console.log(`[email] Duplicate: ${template} ref=${referenceId}`);
        return { success: false, skipped: 'duplicate' };
      }
    }

    // 4. Render and send
    const html = await render(react);
    const { data, error } = await getResend().emails.send({
      from: `MarketingAlphaScan <${FROM}>`,
      replyTo: REPLY_TO,
      to,
      subject,
      html,
      headers,
      tags: [{ name: 'template', value: template }, ...tags],
      attachments: EMAIL_ATTACHMENTS,
    });

    if (error) throw error;

    // 5. Log to database (non-blocking)
    const supabase = getServiceClient();
    Promise.resolve(
      supabase.from('email_log').insert({
        user_id: userId ?? null,
        to_email: to,
        template_id: template,
        subject,
        reference_id: referenceId ?? null,
        resend_id: data?.id ?? null,
        status: 'sent',
      }),
    ).catch((err: unknown) => console.error('[email] Log insert failed:', err));

    console.log(`[email] Sent: ${template} to ${to} (${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error(`[email] Send failed [${template}] to ${to}:`, error);
    if (critical) throw error;
    return { success: false, error: String(error) };
  }
}
