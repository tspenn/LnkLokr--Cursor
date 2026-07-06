/**
 * stripe-portal — Open a Stripe Billing Portal session.
 *
 * Guard: free-tier users (no active paid subscription with a stripe_customer_id)
 * are rejected before any Stripe API call is made.  Previously a user who had
 * ever subscribed and then cancelled could still trigger a portal session
 * because their stripe_customer_id remained on the users table.
 *
 * Upgrade path note:
 *   Free users are directed to the checkout flow (create-checkout-session),
 *   NOT the billing portal.  This function is only called for users who are
 *   already on a paid plan and want to manage / cancel their subscription.
 */

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  getPaidSubscription,
  requiresPaidResponse,
  freeTierResponse,
} from '../_shared/freeUserGuard.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { user_id?: string; app_key?: string; return_url?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { user_id, app_key = 'friday_canvas', return_url, email } = body

  // ── Resolve user_id from email if not provided ────────────────────────────
  let resolvedUserId = user_id
  if (!resolvedUserId && email) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    resolvedUserId = data?.id ?? null
  }

  if (!resolvedUserId) {
    return new Response(JSON.stringify({ error: 'user_id or email required' }), { status: 400 })
  }

  // ── Free-tier guard ───────────────────────────────────────────────────────
  const paidSub = await getPaidSubscription(supabase, resolvedUserId, app_key)

  if (!paidSub) {
    console.log(`[stripe-portal] user=${resolvedUserId} app=${app_key} is on free tier — skipping portal`)
    // Return a clear error: free users should be sent to checkout, not portal
    return requiresPaidResponse(
      'No active paid subscription found. To upgrade, use the checkout flow.',
    )
  }

  const customerId = paidSub.stripe_customer_id

  // ── Double-check the customer still exists in Stripe ─────────────────────
  try {
    await stripe.customers.retrieve(customerId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-portal] customer ${customerId} not found in Stripe:`, msg)
    return new Response(
      JSON.stringify({ error: 'Stripe customer not found', detail: msg }),
      { status: 404 },
    )
  }

  // ── Create billing portal session ─────────────────────────────────────────
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: return_url ?? `${Deno.env.get('APP_URL') ?? 'https://lnklokr.vercel.app'}/`,
    })

    console.log(`[stripe-portal] created session for user=${resolvedUserId} customer=${customerId}`)
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-portal] failed to create portal session:', msg)
    return new Response(JSON.stringify({ error: 'Failed to create portal session', detail: msg }), {
      status: 500,
    })
  }
})
