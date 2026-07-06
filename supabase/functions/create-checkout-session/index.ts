/**
 * create-checkout-session — Shared checkout session creator (Friday Canvas & others).
 *
 * Guard: free-tier plans are blocked explicitly before any Stripe API call.
 * The "Intro" tier for Friday Canvas was previously blocked by name check.
 * This version uses the DB `is_free_tier_id()` function for a robust check
 * that works regardless of plan name.
 *
 * Upgrade path: free users supply a PAID tier_id to upgrade. The guard checks
 * the tier_id they requested, not their current tier. So a free user requesting
 * the "Lite" or "Busy" tier_id will pass through correctly.
 */

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFreeTierId, freeTierResponse } from '../_shared/freeUserGuard.ts'

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
    app_key?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const {
    tier_id,
    billing_cycle = 'monthly',
    user_id,
    email,
    success_url,
    cancel_url,
    app_key = 'friday_canvas',
  } = body

  if (!tier_id) {
    return new Response(JSON.stringify({ error: 'tier_id is required' }), { status: 400 })
  }

  // ── Free-tier guard ───────────────────────────────────────────────────────
  const isFree = await isFreeTierId(supabase, tier_id)
  if (isFree) {
    console.log(`[create-checkout-session] tier_id=${tier_id} is free (app=${app_key}) — no Stripe session needed`)
    return freeTierResponse()
  }

  // ── Look up tier ──────────────────────────────────────────────────────────
  const { data: tier, error: tierErr } = await supabase
    .from('subscription_tiers')
    .select('id, name, app_key, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('id', tier_id)
    .maybeSingle()

  if (tierErr || !tier) {
    return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400 })
  }
  if (app_key && tier.app_key !== app_key) {
    return new Response(JSON.stringify({ error: 'Tier does not belong to this app' }), { status: 400 })
  }

  // ── Resolve price ID ──────────────────────────────────────────────────────
  let priceId = billing_cycle === 'yearly'
    ? (tier.stripe_price_id_yearly?.trim() || null)
    : (tier.stripe_price_id_monthly?.trim() || null)

  if (!priceId) {
    // Fallback: search Stripe products by tier name and app_key metadata
    const desiredInterval = billing_cycle === 'yearly' ? 'year' : 'month'
    const allPrices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })

    for (const price of allPrices.data) {
      const product = price.product as Stripe.Product | null
      if (!product || typeof product === 'string') continue
      const meta = product.metadata ?? {}
      const appMatch = !meta.app_key || meta.app_key === tier.app_key
      const nameMatch = product.name === tier.name
      const tierIdMatch = meta.tier_id === tier_id
      if ((tierIdMatch || nameMatch) && appMatch && price.recurring?.interval === desiredInterval) {
        priceId = price.id
        break
      }
    }
  }

  if (!priceId) {
    return new Response(
      JSON.stringify({ error: `No active Stripe ${billing_cycle} price found for tier: ${tier.name}` }),
      { status: 400 },
    )
  }

  // ── Create checkout session ───────────────────────────────────────────────
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: success_url ?? `${Deno.env.get('APP_URL') ?? 'https://friday.ai'}/success`,
    cancel_url: cancel_url ?? `${Deno.env.get('APP_URL') ?? 'https://friday.ai'}/pricing`,
    metadata: {
      app_key,
      tier_id,
      tier_name: tier.name,
      user_id: user_id ?? '',
    },
  }

  if (user_id) sessionParams.client_reference_id = user_id
  if (email) sessionParams.customer_email = email

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    console.log(`[create-checkout-session] created session=${session.id} tier=${tier.name} app=${app_key}`)
    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[create-checkout-session] failed:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
