/**
 * stripe-webhook-lnklokr — Handles Stripe webhook events for LnkLokr.
 *
 * Free-tier safety notes:
 *   • This webhook only fires when Stripe sends an event. Stripe only sends
 *     events for users who have an active Stripe subscription. Free users
 *     have no Stripe subscription, so they will never trigger this webhook.
 *   • On cancellation / deletion, this function explicitly downgrades the user
 *     to is_premium=false and subscription_tier='free'. This is the correct
 *     upgrade-path reversal.
 *   • The DB trigger `enforce_no_stripe_for_free` provides a belt-and-suspenders
 *     guarantee: even if this function somehow tried to write stripe_customer_id
 *     to a free-tier user_subscriptions row, the DB would reject it.
 *
 * Upgrade path (Free → Paid):
 *   1. Free user opens checkout → create-checkout-session creates a Stripe session.
 *   2. User pays → Stripe fires checkout.session.completed.
 *   3. This function receives the event and calls activateUser(), which sets
 *      is_premium=true, subscription_tier='solo'|'pro', and upserts
 *      user_subscriptions with the new plan_name and stripe_customer_id.
 *   4. The DB trigger allows this because the new tier_id is paid (price > 0).
 */

import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_KEY = 'lnklokr'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
})

type TierKey = 'solo' | 'pro'

function resolveTierKey(meta: Record<string, string> | null | undefined): TierKey | null {
  const v = meta?.tier_key?.trim()
  if (v === 'solo' || v === 'pro') return v
  return null
}

function resolveBillingCycle(meta: Record<string, string> | null | undefined): string {
  const v = meta?.billing_cycle?.trim().toLowerCase()
  if (v === 'yearly' || v === 'annual') return 'yearly'
  return 'monthly'
}

function resolvePlanName(tierKey: TierKey | null): string {
  if (tierKey === 'pro') return 'LnkLokr Pro'
  return 'LnkLokr Solo'
}

/** Find user ID from Stripe session — tries client_reference_id, metadata.user_id, then email fallback */
async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  clientReferenceId: string | null | undefined,
  metaUserId: string | null | undefined,
  email: string | null | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (clientReferenceId) return clientReferenceId
  if (metaUserId) return metaUserId

  if (email) {
    const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
    if (data?.id) return data.id
  }

  if (customerId) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  return null
}

async function activateUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tierKey: TierKey | null,
  billingCycle: string,
  customerId: string,
  subscriptionId: string,
  priceId: string | null,
  periodEnd: string | null,
) {
  const planName = resolvePlanName(tierKey)

  // Update users table — this is what the app reads for is_premium gate
  await supabase
    .from('users')
    .update({
      is_premium: true,
      subscription_tier: tierKey ?? 'solo',
      stripe_customer_id: customerId,
      premium_until: periodEnd,
    })
    .eq('id', userId)

  // Upsert user_subscriptions — matches the pattern used by all other Skyland apps
  await supabase.from('user_subscriptions').upsert(
    {
      user_id: userId,
      app_key: APP_KEY,
      plan_name: planName,
      status: 'active',
      billing_cycle: billingCycle,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,app_key' },
  )

  console.log(`[stripe-webhook-lnklokr] activated user=${userId} tier=${tierKey} cycle=${billingCycle}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  const webhookSecret =
    Deno.env.get('STRIPE_WEBHOOK_SECRET_LNKLOKR') ||
    Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!webhookSecret) {
    console.error('[stripe-webhook-lnklokr] missing webhook secret')
    return new Response('Missing webhook secret', { status: 500 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook-lnklokr] signature verification failed:', msg)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break

        const meta = (session.metadata ?? {}) as Record<string, string>
        if (meta.app_key && meta.app_key !== APP_KEY) break

        const customerId = session.customer as string
        const email = session.customer_details?.email || session.customer_email

        const userId = await resolveUserId(
          supabase,
          session.client_reference_id,
          meta.user_id,
          email,
          customerId,
        )

        if (!userId) {
          console.error('[stripe-webhook-lnklokr] could not resolve user for session', session.id)
          break
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items.data[0]?.price?.id ?? null
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null

        await activateUser(
          supabase,
          userId,
          resolveTierKey(meta),
          resolveBillingCycle(meta),
          customerId,
          subscription.id,
          priceId,
          periodEnd,
        )
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const meta = (sub.metadata ?? {}) as Record<string, string>
        if (meta.app_key && meta.app_key !== APP_KEY) break

        const customerId = sub.customer as string
        const userId = await resolveUserId(supabase, null, meta.user_id, null, customerId)

        if (!userId) {
          console.warn('[stripe-webhook-lnklokr] subscription.updated unknown customer', customerId)
          break
        }

        const isActive = ['active', 'trialing', 'past_due'].includes(sub.status)
        const tierKey = resolveTierKey(meta)
        const billingCycle = resolveBillingCycle(meta)
        const priceId = sub.items.data[0]?.price?.id ?? null
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null

        if (isActive) {
          await activateUser(supabase, userId, tierKey, billingCycle, customerId, sub.id, priceId, periodEnd)
        } else {
          await supabase
            .from('users')
            .update({ is_premium: false, subscription_tier: 'free', premium_until: null })
            .eq('id', userId)

          await supabase
            .from('user_subscriptions')
            .update({ status: sub.status === 'canceled' ? 'cancelled' : sub.status, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('app_key', APP_KEY)

          console.log(`[stripe-webhook-lnklokr] deactivated user=${userId} status=${sub.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const meta = (sub.metadata ?? {}) as Record<string, string>
        if (meta.app_key && meta.app_key !== APP_KEY) break

        const customerId = sub.customer as string
        const userId = await resolveUserId(supabase, null, meta.user_id, null, customerId)

        if (!userId) {
          console.warn('[stripe-webhook-lnklokr] subscription.deleted unknown customer', customerId)
          break
        }

        await supabase
          .from('users')
          .update({ is_premium: false, subscription_tier: 'free', premium_until: null })
          .eq('id', userId)

        await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('app_key', APP_KEY)

        console.log(`[stripe-webhook-lnklokr] cancelled user=${userId}`)
        break
      }

      default:
        console.log(`[stripe-webhook-lnklokr] ignored event ${event.type}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook-lnklokr] handler error:', msg)
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
