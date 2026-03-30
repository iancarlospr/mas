import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import type { ResendWebhookEvent } from '@marketing-alpha/email-service';

/**
 * POST /api/webhooks/resend — Resend webhook handler.
 * Handles delivery events, bounces, complaints.
 * Resend signs webhooks using Svix, but we do a simpler HMAC check here
 * using the webhook secret.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify signature (Resend uses Svix headers)
  const svixId = request.headers.get('svix-id') ?? '';
  const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
  const svixSignature = request.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
  }

  // Verify Svix signature
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  // Svix secret is base64-encoded, prefixed with "whsec_"
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice(6) : secret,
    'base64',
  );
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // Svix sends multiple signatures separated by spaces, each prefixed with "v1,"
  const signatures = svixSignature.split(' ').map((s) => s.replace('v1,', ''));
  const valid = signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig, 'base64'),
        Buffer.from(expectedSignature, 'base64'),
      );
    } catch {
      return false;
    }
  });

  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event: ResendWebhookEvent = JSON.parse(body);
  const supabase = createServiceClient();

  // Handle events
  switch (event.type) {
    case 'email.delivered': {
      const resendId = event.data.id;
      if (resendId) {
        await supabase
          .from('email_log')
          .update({ status: 'delivered' })
          .eq('resend_id', resendId);
      }
      break;
    }

    case 'email.opened': {
      const resendId = event.data.id;
      if (resendId) {
        await supabase
          .from('email_log')
          .update({ status: 'opened' })
          .eq('resend_id', resendId);
      }
      break;
    }

    case 'email.clicked': {
      const resendId = event.data.id;
      if (resendId) {
        await supabase
          .from('email_log')
          .update({ status: 'clicked' })
          .eq('resend_id', resendId);
      }
      break;
    }

    case 'email.bounced': {
      const resendId = event.data.id;
      if (resendId) {
        await supabase
          .from('email_log')
          .update({ status: 'bounced' })
          .eq('resend_id', resendId);
      }

      // Hard bounce → add to suppression list
      if (event.data.bounce?.type === 'hard') {
        const toEmail = event.data.to[0];
        if (toEmail) {
          await supabase.from('email_suppression_list').upsert(
            {
              email: toEmail,
              reason: 'hard_bounce',
              details: event.data.bounce.message,
            },
            { onConflict: 'email' },
          );
        }
      }
      break;
    }

    case 'email.complained': {
      const resendId = event.data.id;
      if (resendId) {
        await supabase
          .from('email_log')
          .update({ status: 'complained' })
          .eq('resend_id', resendId);
      }

      // Complaint → suppress ALL future emails
      const toEmail = event.data.to[0];
      if (toEmail) {
        await supabase.from('email_suppression_list').upsert(
          {
            email: toEmail,
            reason: 'complaint',
          },
          { onConflict: 'email' },
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
