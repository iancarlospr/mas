import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { engineFetch } from '@/lib/engine';
import { sendPaymentReceiptEmail } from '@/lib/email';
import { getPostHog } from '@/lib/posthog-server';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

/** Products that upgrade the scan tier and trigger a full scan */
const UPGRADE_PRODUCTS = new Set(['alpha_brief', 'alpha_brief_plus']);

/** Chat credits granted per upgrade product */
const UPGRADE_CHAT_CREDITS: Record<string, number> = {
  alpha_brief: 25,
  alpha_brief_plus: 200,
};

/** Scan credits granted per upgrade product */
const UPGRADE_SCAN_CREDITS: Record<string, number> = {
  alpha_brief: 1,
  alpha_brief_plus: 3,
};

/** Chat credit top-up amounts */
const TOPUP_CREDITS: Record<string, number> = {
  chat_credits_15: 15,
  chat_credits: 100,
};

const AMOUNT_MAP: Record<string, number> = {
  alpha_brief: 2499,
  alpha_brief_plus: 3495,
  chat_credits_15: 100,
  chat_credits: 499,
};

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

    if (!product || !userId) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Atomic dedup: claim this payment by transitioning pending → completed.
    // Only one concurrent webhook can succeed (PostgreSQL row-level locking).
    const { data: claimed } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        stripe_payment_intent: session.payment_intent as string,
      })
      .eq('stripe_session_id', session.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (!claimed) {
      // Already processed by another webhook delivery — safe to return
      return NextResponse.json({ received: true });
    }

    // Track payment in PostHog (server-side — no client context available)
    const ph = getPostHog();
    if (ph) {
      const amountCents = AMOUNT_MAP[product] ?? session.amount_total ?? 0;
      ph.capture({
        distinctId: userId,
        event: 'payment_completed',
        properties: {
          product,
          scan_id: scanId ?? undefined,
          amount_cents: amountCents,
          revenue: amountCents / 100,
          stripe_session_id: session.id,
          $set: {
            ...(UPGRADE_PRODUCTS.has(product) ? { tier: 'paid' } : {}),
            last_payment_product: product,
          },
          $set_once: {
            first_payment_at: new Date().toISOString(),
            first_payment_product: product,
          },
        },
      });
    }

    if (UPGRADE_PRODUCTS.has(product)) {
      // Grant scan + chat credits atomically (parallel, no race conditions)
      const scanCreditsToAdd = UPGRADE_SCAN_CREDITS[product] ?? 0;
      const chatCreditsToAdd = UPGRADE_CHAT_CREDITS[product] ?? 0;

      await Promise.all([
        scanCreditsToAdd > 0
          ? supabase.rpc('add_scan_credits', { p_user_id: userId, p_amount: scanCreditsToAdd })
          : Promise.resolve(),
        chatCreditsToAdd > 0
          ? supabase.rpc('add_chat_credits', { p_user_id: userId, p_amount: chatCreditsToAdd })
          : Promise.resolve(),
      ]);

      // Auto-unlock the scan that triggered the purchase (deduct 1 scan credit)
      if (scanId) {
        const { data: targetScan } = await supabase
          .from('scans')
          .select('tier')
          .eq('id', scanId)
          .single();

        if (targetScan?.tier === 'full') {
          // Atomic decrement — safe against concurrent requests
          const { error: decrError } = await supabase
            .rpc('decrement_scan_credits', { p_user_id: userId, p_amount: 1 });

          if (!decrError) {
            await supabase
              .from('scans')
              .update({ tier: 'paid' })
              .eq('id', scanId);

            await engineFetch('/engine/scans', {
              method: 'POST',
              body: JSON.stringify({
                scanId,
                url: '',
                domain: '',
                tier: 'paid',
                synthesisOnly: false,
              }),
            });
          }
        }
      }
    } else if (product in TOPUP_CREDITS) {
      // Chat credits top-up — atomic add
      const creditsToAdd = TOPUP_CREDITS[product] ?? 0;
      if (creditsToAdd > 0) {
        await supabase.rpc('add_chat_credits', { p_user_id: userId, p_amount: creditsToAdd });
      }
    }

    // Email + audit log in parallel (both fire-and-forget)
    const email = session.customer_details?.email ?? session.customer_email;
    const amountCents = AMOUNT_MAP[product] ?? 0;

    await Promise.allSettled([
      email
        ? sendPaymentReceiptEmail(email, product as string, amountCents)
        : Promise.resolve(),
      supabase.from('audit_log').insert({
        user_id: userId,
        action: 'payment_completed',
        resource: scanId ?? null,
        metadata: { product, amount: session.amount_total, session_id: session.id },
      }),
    ]);
  }

  return NextResponse.json({ received: true });
}
