import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendEmail } from '@marketing-alpha/email-service';
import type { SendEmailHookPayload } from '@marketing-alpha/email-service';
import {
  VerificationEmail,
  MagicLinkEmail,
  RecoveryEmail,
} from '@marketing-alpha/email-templates';

/** POST — Supabase Send Email Hook handler */
export async function POST(request: NextRequest) {
  // 1. Verify webhook signature
  const signature = request.headers.get('x-supabase-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const body = await request.text();
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET!)
    .update(body)
    .digest('base64');

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload: SendEmailHookPayload = JSON.parse(body);
  const { user, email_data } = payload;

  // 2. Select template and build confirmation URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';

  switch (email_data.email_action_type) {
    case 'signup': {
      const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=signup&redirect_to=/dashboard`;
      await sendEmail({
        to: user.email,
        userId: user.id,
        template: 'verification',
        subject: 'Verify your email to unlock Full Scan access',
        react: VerificationEmail({ email: user.email, confirmationUrl: confirmUrl }),
        critical: true,
      });
      break;
    }
    case 'magiclink': {
      const magicUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=magiclink&redirect_to=/dashboard`;
      await sendEmail({
        to: user.email,
        userId: user.id,
        template: 'magic-link',
        subject: 'Your login link for MarketingAlphaScan',
        react: MagicLinkEmail({ email: user.email, magicLinkUrl: magicUrl }),
        critical: true,
      });
      break;
    }
    case 'recovery': {
      const recoveryUrl = `${baseUrl}/auth/confirm?token_hash=${email_data.token_hash}&type=recovery&redirect_to=/auth/reset-password`;
      await sendEmail({
        to: user.email,
        userId: user.id,
        template: 'recovery',
        subject: 'Reset your MarketingAlphaScan password',
        react: RecoveryEmail({ email: user.email, recoveryUrl }),
        critical: true,
      });
      break;
    }
    default:
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
