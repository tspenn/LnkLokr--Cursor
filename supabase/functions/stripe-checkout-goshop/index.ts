/**
 * stripe-checkout-goshop — Create a Stripe Checkout Session for Go Shop.
 *
 * Guard: explicitly rejects free-tier tier_ids before any Stripe API call.
 * Previously the guard was implicit (free tier has no stripe_price_id
 * configured, so the price lookup would fail). An explicit check is more
 * robust and clearer in error messages.
 *
 * Upgrade path: free users upgrading to Pro/Family pass through because they
 * supply a paid tier_id. The guard only fires when the resolved tier is free.
 */

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFreeTierId, freeTierResponse } from '../_shared/freeUserGuard.ts'

const GOSHOP_APP_KEY = 'goshop'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 })

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: {
    tier_id?: string
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

  const { tier_id, billing_cycle = 'monthly', user_id, email, success_url, cancel_url } = body

  if (!tier_id) {
    return new Response(JSON.stringify({ error: 'tier_id is required' }), { status: 400 })
  }

  // ── Free-tier guard ───────────────────────────────────────────────────────
  const isFree = await isFreeTierId(supabase, tier_id)
  if (isFree) {
    console.log(`[stripe-checkout-goshop] tier_id=${tier_id} is free — returning early`)
    return freeTierResponse()
  }

  // ── Look up tier ──────────────────────────────────────────────────────────
  const { data: tier, error: tierErr } = await supabase
    .from('subscription_tiers')
    .select('id, name, app_key, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('id', tier_id)
    .maybeSingle()

  if (tierErr || !tier) {
    return new Response(JSON.stringify({ error: 'Invalid tier_id' }), { status: 400 })
  }
  if (tier.app_key !== GOSHOP_APP_KEY) {
    return new Response(JSON.stringify({ error: 'Tier does not belong to Go Shop' }), { status: 400 })
  }

  // ── Resolve price ID ──────────────────────────────────────────────────────
  const priceId = billing_cycle === 'yearly'
    ? (tier.stripe_price_id_yearly?.trim() || null)
    : (tier.stripe_price_id_monthly?.trim() || null)

  if (!priceId) {
    // Fallback: search Stripe products by metadata
    let resolvedPrice: string | null = null
    const desiredInterval = billing_cycle === 'yearly' ? 'year' : 'month'
    const allPrices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })

    for (const price of allPrices.data) {
      const product = price.product as Stripe.Product | null
      if (!product || typeof product === 'string') continue
      const meta = product.metadata ?? {}
      if (
        meta.app_key === GOSHOP_APP_KEY &&
        (meta.tier_key === tier.name.toLowerCase().replace(/\s+/g, '_') || product.name === tier.name) &&
        price.recurring?.interval === desiredInterval
      ) {
        resolvedPrice = price.id
        break
      }
    }

    if (!resolvedPrice) {
      return new Response(
        JSON.stringify({ error: `No Stripe price found for GoShop ${tier.name} ${billing_cycle}` }),
        { status: 400 },
      )
    }
    // Use the resolved price
    const sessionParams = buildSessionParams(resolvedPrice, billing_cycle, tier_id, user_id, email, success_url, cancel_url)
    return createSession(stripe, sessionParams, user_id)
  }

  const sessionParams = buildSessionParams(priceId, billing_cycle, tier_id, user_id, email, success_url, cancel_url)
  return createSession(stripe, sessionParams, user_id)
})

function buildSessionParams(
  priceId: string,
  billingCycle: string,
  tierId: string,
  userId?: string,
  email?: string,
  successUrl?: string,
  cancelUrl?: string,
): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl ?? `${Deno.env.get('GOSHOP_APP_URL') ?? 'https://goshop.app'}/success`,
    cancel_url: cancelUrl ?? `${Deno.env.get('GOSHOP_APP_URL') ?? 'https://goshop.app'}/pricing`,
    metadata: {
      app_key: 'goshop',
      tier_id: tierId,
      billing_cycle: billingCycle,
      user_id: userId ?? '',
    },
  }
  if (userId) params.client_reference_id = userId
  if (email) params.customer_email = email
  return params
}

async function createSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  userId?: string,
): Promise<Response> {
  try {
    const session = await stripe.checkout.sessions.create(params)
    console.log(`[stripe-checkout-goshop] created session=${session.id} user=${userId ?? 'unknown'}`)
    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-checkout-goshop] failed:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
