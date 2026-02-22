import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { z } from 'zod';

const CheckoutSchema = z.object({
  product: z.enum(['alpha_brief', 'chat_activation', 'chat_credits']),
  scanId: z.string().uuid(),
});

function getPriceMap() {
  return {
    alpha_brief: process.env.STRIPE_ALPHA_BRIEF_PRICE_ID!,
    chat_activation: process.env.STRIPE_CHAT_ACTIVATION_PRICE_ID!,
    chat_credits: process.env.STRIPE_CHAT_CREDITS_PRICE_ID!,
  };
}

const AMOUNT_MAP: Record<string, number> = {
  alpha_brief: 999,
  chat_activation: 100,
  chat_credits: 499,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

  // Verify scan ownership
  const { data: scan } = await supabase
    .from('scans')
    .select('id, user_id, tier, status')
    .eq('id', scanId)
    .single();

  if (!scan || (scan.user_id && scan.user_id !== user.id)) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (product === 'alpha_brief' && scan.tier === 'paid') {
    return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
  }

  if (product === 'chat_activation') {
    // Require paid scan for chat activation
    if (scan.tier !== 'paid') {
      return NextResponse.json({ error: 'Alpha Brief required before chat activation' }, { status: 400 });
    }

    // Prevent double activation — user must not already have credits
    const { data: existingCredits } = await supabase
      .from('chat_credits')
      .select('remaining')
      .eq('user_id', user.id)
      .single();

    if (existingCredits) {
      return NextResponse.json({ error: 'Chat already activated' }, { status: 400 });
    }
  }

  if (product === 'chat_credits') {
    // Require paid scan for chat top-up
    if (scan.tier !== 'paid') {
      return NextResponse.json({ error: 'Alpha Brief required for chat credits' }, { status: 400 });
    }
  }

  if (scan.status === 'failed' || scan.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot purchase for a failed scan' }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${request.nextUrl.origin}/scan/${scanId}?payment=success`,
    cancel_url: `${request.nextUrl.origin}/scan/${scanId}?payment=cancelled`,
    client_reference_id: user.id,
    metadata: {
      product,
      scanId,
      userId: user.id,
    },
  });

  // Record pending payment
  await supabase.from('payments').insert({
    user_id: user.id,
    scan_id: scanId,
    stripe_session_id: session.id,
    product,
    amount_cents: AMOUNT_MAP[product] ?? 0,
    status: 'pending',
  });

  return NextResponse.json({ url: session.url });
}
