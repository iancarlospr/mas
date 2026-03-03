import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const CheckoutSchema = z.object({
  product: z.enum(['alpha_brief', 'alpha_brief_plus', 'chat_credits_15', 'chat_credits']),
  scanId: z.string().uuid().optional(),
});

function getPriceMap() {
  return {
    alpha_brief: process.env.STRIPE_ALPHA_BRIEF_PRICE_ID!,
    alpha_brief_plus: process.env.STRIPE_ALPHA_BRIEF_PLUS_PRICE_ID!,
    chat_credits_15: process.env.STRIPE_CHAT_ACTIVATION_PRICE_ID!,
    chat_credits: process.env.STRIPE_CHAT_CREDITS_PRICE_ID!,
  };
}

const AMOUNT_MAP: Record<string, number> = {
  alpha_brief: 2499,
  alpha_brief_plus: 3495,
  chat_credits_15: 100,
  chat_credits: 499,
};

/** Products that upgrade the scan tier from free to paid */
const UPGRADE_PRODUCTS = new Set(['alpha_brief', 'alpha_brief_plus']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rl = rateLimit(`checkout:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const body = await request.json();
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { product, scanId } = parsed.data;
  const priceId = getPriceMap()[product];

  if (!priceId) {
    return NextResponse.json({ error: 'Product not configured' }, { status: 500 });
  }

  // Chat credits always require a scanId (tied to a paid scan)
  if (product === 'chat_credits_15' || product === 'chat_credits') {
    if (!scanId) {
      return NextResponse.json({ error: 'Scan ID required for chat credits' }, { status: 400 });
    }
  }

  // If scanId provided, verify ownership and validate
  if (scanId) {
    const { data: scan } = await supabase
      .from('scans')
      .select('id, user_id, tier, status')
      .eq('id', scanId)
      .single();

    if (!scan || (scan.user_id && scan.user_id !== user.id)) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (UPGRADE_PRODUCTS.has(product) && scan.tier === 'paid') {
      return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
    }

    if ((product === 'chat_credits_15' || product === 'chat_credits') && scan.tier !== 'paid') {
      return NextResponse.json({ error: 'Alpha Brief required for chat credits' }, { status: 400 });
    }

    if (scan.status === 'failed' || scan.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot purchase for a failed scan' }, { status: 400 });
    }
  }

  // Success URL: open the scan report if scanId exists, otherwise just go home
  const successUrl = scanId
    ? `${request.nextUrl.origin}/?payment_success=${scanId}`
    : `${request.nextUrl.origin}/?credits_purchased=true`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${request.nextUrl.origin}/`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        product,
        scanId: scanId ?? '',
        userId: user.id,
      },
    });

    // Record pending payment (best-effort, don't block checkout)
    await supabase.from('payments').insert({
      user_id: user.id,
      scan_id: scanId ?? null,
      stripe_session_id: session.id,
      product,
      amount_cents: AMOUNT_MAP[product] ?? 0,
      status: 'pending',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Failed:', { product, priceId, scanId, error: message });
    return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 502 });
  }
}
