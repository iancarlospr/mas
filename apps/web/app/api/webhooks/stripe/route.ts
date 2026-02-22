import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { engineFetch } from '@/lib/engine';
import { sendPaymentReceiptEmail } from '@/lib/email';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { product, scanId, userId } = session.metadata ?? {};

    if (!product || !scanId || !userId) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Dedup: only process if payment is still pending
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('status')
      .eq('stripe_session_id', session.id)
      .single();

    if (existingPayment?.status === 'completed') {
      // Already processed — skip to prevent double credits
      return NextResponse.json({ received: true });
    }

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        stripe_payment_intent: session.payment_intent as string,
      })
      .eq('stripe_session_id', session.id);

    if (product === 'alpha_brief') {
      // Upgrade scan tier to paid — no chat credits included
      await supabase
        .from('scans')
        .update({ tier: 'paid' })
        .eq('id', scanId);

      // Trigger synthesis on engine
      await engineFetch('/engine/scans', {
        method: 'POST',
        body: JSON.stringify({
          scanId,
          url: '', // Engine reads from DB
          domain: '',
          tier: 'paid',
          synthesisOnly: true,
        }),
      });
    } else if (product === 'chat_activation') {
      // First-time chat activation: 15 credits
      await supabase
        .from('chat_credits')
        .upsert(
          { user_id: userId, remaining: 15, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
    } else if (product === 'chat_credits') {
      // Top-up: +100 credits
      const { data: existing } = await supabase
        .from('chat_credits')
        .select('remaining')
        .eq('user_id', userId)
        .single();

      const current = existing?.remaining ?? 0;
      await supabase
        .from('chat_credits')
        .upsert(
          { user_id: userId, remaining: current + 100, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
    }

    // Send receipt email
    const email = session.customer_details?.email ?? session.customer_email;
    const amountMap: Record<string, number> = {
      alpha_brief: 999,
      chat_activation: 100,
      chat_credits: 499,
    };
    const amountCents = amountMap[product] ?? 0;
    if (email) {
      await sendPaymentReceiptEmail(
        email,
        product as 'alpha_brief' | 'chat_activation' | 'chat_credits',
        amountCents,
      ).catch((err) => {
        console.error('[stripe-webhook] Failed to send receipt email:', err);
      });
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'payment_completed',
      resource: scanId,
      metadata: { product, amount: session.amount_total, session_id: session.id },
    });
  }

  return NextResponse.json({ received: true });
}
