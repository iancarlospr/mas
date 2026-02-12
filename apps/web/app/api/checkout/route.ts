import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

const CheckoutSchema = z.object({
  product: z.enum(['alpha_brief', 'chat_credits']),
  scanId: z.string().uuid(),
});

const PRICE_MAP = {
  alpha_brief: process.env.STRIPE_ALPHA_BRIEF_PRICE_ID!,
  chat_credits: process.env.STRIPE_CHAT_CREDITS_PRICE_ID!,
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
  const priceId = PRICE_MAP[product];

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

  if (scan.status === 'failed' || scan.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot purchase for a failed scan' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
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
    amount_cents: product === 'alpha_brief' ? 999 : 499,
    status: 'pending',
  });

  return NextResponse.json({ url: session.url });
}
