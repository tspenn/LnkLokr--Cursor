import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/stripe/webhook
 *
 * Verifies the Stripe webhook signature, then updates the `users` row in
 * Supabase based on the tier purchased:
 *
 *   - one-device / five-device  → one-time payment, sets `is_premium = true`
 *                                 and bumps `device_limit` (1 or 5).
 *   - cloud-monthly / cloud-yearly → recurring subscription, toggles
 *                                 `is_premium`, `cloud_sync` and
 *                                 `premium_until` based on subscription state.
 *
 * Required Vercel env vars:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 *   - VITE_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Configure the endpoint in the Stripe Dashboard:
 *   https://dashboard.stripe.com/webhooks → Add endpoint
 *   URL: https://<your-app>.vercel.app/api/stripe/webhook
 *   Events: checkout.session.completed,
 *           customer.subscription.created,
 *           customer.subscription.updated,
 *           customer.subscription.deleted
 */

// Stripe needs the raw body to verify signatures. Tell Vercel not to parse.
export const config = {
  api: {
    bodyParser: false,
  },
}

type TierId = 'one-device' | 'five-device' | 'cloud-monthly' | 'cloud-yearly'

const DEVICE_LIMITS: Partial<Record<TierId, number>> = {
  'one-device': 1,
  'five-device': 5,
}

const CLOUD_TIERS = new Set<TierId>(['cloud-monthly', 'cloud-yearly'])

function isTier(value: unknown): value is TierId {
  return (
    value === 'one-device' ||
    value === 'five-device' ||
    value === 'cloud-monthly' ||
    value === 'cloud-yearly'
  )
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

  if (!stripeSecret || !webhookSecret) {
    return res.status(500).send('Stripe webhook is not configured')
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).send('Supabase service role is not configured')
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
  const signature = req.headers['stripe-signature']

  if (!signature || Array.isArray(signature)) {
    return res.status(400).send('Missing stripe-signature header')
  }

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email || session.customer_email
        const tier = isTier(session.metadata?.tier) ? (session.metadata!.tier as TierId) : null
        const customerId = typeof session.customer === 'string' ? session.customer : null

        if (!email) break

        if (tier && DEVICE_LIMITS[tier]) {
          // One-time purchase (One Device / 5-Device pack).
          await supabase
            .from('users')
            .update({
              is_premium: true,
              device_limit: DEVICE_LIMITS[tier],
              stripe_customer_id: customerId,
              last_purchase_tier: tier,
            })
            .eq('email', email)
        } else if (tier && CLOUD_TIERS.has(tier)) {
          // Cloud subscription kicked off — flip premium + cloud sync.
          await supabase
            .from('users')
            .update({
              is_premium: true,
              cloud_sync: true,
              stripe_customer_id: customerId,
              last_purchase_tier: tier,
            })
            .eq('email', email)
        } else {
          // Fallback: treat any successful checkout as premium.
          await supabase
            .from('users')
            .update({
              is_premium: true,
              stripe_customer_id: customerId,
            })
            .eq('email', email)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const isActive = ['active', 'trialing', 'past_due'].includes(sub.status)
        const tier = isTier(sub.metadata?.tier) ? (sub.metadata!.tier as TierId) : null

        await supabase
          .from('users')
          .update({
            is_premium: isActive,
            cloud_sync: isActive && (!tier || CLOUD_TIERS.has(tier)),
            premium_until: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            last_purchase_tier: tier,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        await supabase
          .from('users')
          .update({
            is_premium: false,
            cloud_sync: false,
            premium_until: null,
          })
          .eq('stripe_customer_id', customerId)
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
