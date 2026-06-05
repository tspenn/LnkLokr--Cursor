import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/stripe/webhook
 *
 * Verifies the Stripe webhook signature, then:
 *   1. Upserts a row in user_subscriptions (app_key = APP_KEY) — source of truth
 *   2. Updates users.is_premium / subscription_tier — used by in-app gate checks
 *
 * Required Vercel env vars:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * Stripe Dashboard → Webhooks → events to enable:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 */

export const config = { api: { bodyParser: false } }

const APP_KEY: string = process.env.VITE_APP_KEY ?? 'lnklokr'

type TierKey = 'solo' | 'pro'
const VALID_TIER_KEYS = new Set<TierKey>(['solo', 'pro'])

function isTierKey(v: unknown): v is TierKey {
  return typeof v === 'string' && VALID_TIER_KEYS.has(v as TierKey)
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method Not Allowed')
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecret || !webhookSecret) return res.status(500).send('Stripe webhook is not configured')
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).send('Supabase service role is not configured')

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
  const signature = req.headers['stripe-signature']

  if (!signature || Array.isArray(signature)) return res.status(400).send('Missing stripe-signature header')

  let event: Stripe.Event
  try {
    const rawBody = await readRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature'
    console.error('Stripe webhook signature verification failed:', message)
    return res.status(400).send(`Webhook Error: ${message}`)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  /** Look up the internal user id by email via the users table. */
  async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    return data?.id ?? null
  }

  /** Look up user id by stripe_customer_id. */
  async function getUserIdByCustomer(customerId: string): Promise<string | null> {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return data?.id ?? null
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email || session.customer_email
        const tierKey = isTierKey(session.metadata?.tier_key) ? session.metadata!.tier_key as TierKey : null
        const billingCycle = session.metadata?.billing_cycle ?? null
        const customerId = typeof session.customer === 'string' ? session.customer : null
        const subId = typeof session.subscription === 'string' ? session.subscription : null
        const priceId = session.metadata?.stripe_price_id ?? null

        if (!email) break

        const userId = await getUserIdByEmail(email)

        // 1. Update users table (in-app gate)
        await supabase
          .from('users')
          .update({
            is_premium: true,
            subscription_tier: tierKey ?? 'premium',
            stripe_customer_id: customerId,
          })
          .eq('email', email)

        // 2. Upsert user_subscriptions (standard)
        if (userId) {
          await supabase
            .from('user_subscriptions')
            .upsert(
              {
                user_id: userId,
                app_key: APP_KEY,
                plan_name: tierKey ? (tierKey === 'pro' ? 'LnkLokr Pro' : 'LnkLokr Solo') : 'LnkLokr Solo',
                status: 'active',
                billing_cycle: billingCycle,
                stripe_customer_id: customerId,
                stripe_subscription_id: subId,
                stripe_price_id: priceId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,app_key' },
            )
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const isActive = ['active', 'trialing', 'past_due'].includes(sub.status)
        const tierKey = isTierKey(sub.metadata?.tier_key) ? sub.metadata!.tier_key as TierKey : null
        const billingCycle = sub.metadata?.billing_cycle ?? null
        const priceId = sub.items.data[0]?.price?.id ?? null

        // 1. Update users table
        await supabase
          .from('users')
          .update({
            is_premium: isActive,
            subscription_tier: isActive ? (tierKey ?? 'premium') : 'free',
            premium_until: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          })
          .eq('stripe_customer_id', customerId)

        // 2. Upsert user_subscriptions
        const userId = await getUserIdByCustomer(customerId)
        if (userId) {
          await supabase
            .from('user_subscriptions')
            .upsert(
              {
                user_id: userId,
                app_key: APP_KEY,
                plan_name: tierKey ? (tierKey === 'pro' ? 'LnkLokr Pro' : 'LnkLokr Solo') : 'LnkLokr Solo',
                status: isActive ? 'active' : sub.status,
                billing_cycle: billingCycle,
                stripe_customer_id: customerId,
                stripe_subscription_id: sub.id,
                stripe_price_id: priceId,
                current_period_start: sub.current_period_start
                  ? new Date(sub.current_period_start * 1000).toISOString()
                  : null,
                current_period_end: sub.current_period_end
                  ? new Date(sub.current_period_end * 1000).toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,app_key' },
            )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        // 1. Update users table
        await supabase
          .from('users')
          .update({ is_premium: false, subscription_tier: 'free', premium_until: null })
          .eq('stripe_customer_id', customerId)

        // 2. Update user_subscriptions
        const userId = await getUserIdByCustomer(customerId)
        if (userId) {
          await supabase
            .from('user_subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('app_key', APP_KEY)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Failed to apply webhook side-effects:', err)
    return res.status(500).send('Webhook handler error')
  }

  return res.status(200).json({ received: true })
}
