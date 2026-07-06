/**
 * stripe-checkout-gonews — Create a Stripe Checkout Session for GoNews.
 *
 * Guard: explicitly rejects free-tier tier_ids before any Stripe API call.
 * Previously the guard was implicit (free tiers have no Stripe product, so
 * the product lookup would fail). An explicit check is safer and gives a
 * clear error message.
 *
 * Upgrade path: free users ARE expected to call this endpoint — that's how
 * they upgrade. The guard only blocks tier_ids that resolve to price_monthly=0.
 * A free user requesting a paid tier_id passes the guard and proceeds normally.
 */

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFreeTierId, freeTierResponse } from '../_shared/freeUserGuard.ts'

const APP_KEY = 'gonews'

const TIER_TO_PRODUCT: Record<string, { monthly?: string; yearly?: string }> = {
  // Populated from environment or Stripe product metadata.
  // Kept as a fallback — prefer Stripe product metadata (app_key + tier_key).
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 })

  const stripeKey = Deno.env.get('GONEWS_STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe key not configured' }), { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: {
    tier_id?: string
    product_id?: string
    billing_cycle?: 'monthly' | 'yearly'
    user_id?: string
    email?: string
    success_url?: string
    cancel_url?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { tier_id, product_id, billing_cycle = 'monthly', user_id, email, success_url, cancel_url } = body

  // ── Free-tier guard ───────────────────────────────────────────────────────
  // Block requests that are explicitly for a free plan.
  // (Free users upgrading TO a paid tier_id pass through — that's the upgrade path.)
  if (tier_id) {
    const isFree = await isFreeTierId(supabase, tier_id)
    if (isFree) {
      console.log(`[stripe-checkout-gonews] tier_id=${tier_id} is free — returning early`)
      return freeTierResponse()
    }
  }

  // ── Resolve Stripe price ID ───────────────────────────────────────────────
  let priceId: string | null = null

  if (product_id) {
    // Caller supplied a direct Stripe product ID
    const prices = await stripe.prices.list({ product: product_id, active: true, limit: 10 })
    const cycle = billing_cycle === 'yearly' ? 'year' : 'month'
    const match = prices.data.find(p => p.recurring?.interval === cycle)
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'No active price found for this product / billing cycle' }),
        { status: 400 },
      )
    }
    priceId = match.id
  } else if (tier_id) {
    // Look up the tier in subscription_tiers to find associated Stripe price IDs
    const { data: tier, error: tierErr } = await supabase
      .from('subscription_tiers')
      .select('id, name, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', tier_id)
      .eq('app_key', APP_KEY)
      .maybeSingle()

    if (tierErr || !tier) {
      return new Response(JSON.stringify({ error: 'Invalid tier_id for GoNews' }), { status: 400 })
    }

    priceId = billing_cycle === 'yearly'
      ? (tier.stripe_price_id_yearly ?? null)
      : (tier.stripe_price_id_monthly ?? null)

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `No Stripe price configured for GoNews ${tier.name} ${billing_cycle}` }),
        { status: 400 },
      )
    }
  } else {
    return new Response(JSON.stringify({ error: 'tier_id or product_id is required' }), { status: 400 })
  }

  // ── Create checkout session ───────────────────────────────────────────────
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: success_url ?? `${Deno.env.get('GONEWS_APP_URL') ?? 'https://gonews.app'}/success`,
    cancel_url: cancel_url ?? `${Deno.env.get('GONEWS_APP_URL') ?? 'https://gonews.app'}/pricing`,
    metadata: {
      app_key: APP_KEY,
      tier_id: tier_id ?? '',
      user_id: user_id ?? '',
    },
  }

  if (user_id) sessionParams.client_reference_id = user_id
  if (email) sessionParams.customer_email = email

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    console.log(`[stripe-checkout-gonews] created session=${session.id} price=${priceId}`)
    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-checkout-gonews] failed:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
