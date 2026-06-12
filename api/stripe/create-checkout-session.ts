import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

/**
 * POST /api/stripe/create-checkout-session   { tier, email? }
 * GET  /api/stripe/create-checkout-session?tier=solo-monthly
 *
 * LnkLokr subscription tiers:
 *   solo-monthly  → $2.99 / month   (STRIPE_PRICE_ID_SOLO_MONTHLY)
 *   solo-yearly   → $24.99 / year   (STRIPE_PRICE_ID_SOLO_YEARLY)
 *   pro-monthly   → $5.99 / month   (STRIPE_PRICE_ID_PRO_MONTHLY)
 *   pro-yearly    → $49.99 / year   (STRIPE_PRICE_ID_PRO_YEARLY)
 *
 * Every Stripe Price must carry metadata:
 *   app_key      = lnklokr
 *   tier_key     = solo | pro
 *   billing_cycle = monthly | yearly
 */

type TierId = 'solo-monthly' | 'solo-yearly' | 'pro-monthly' | 'pro-yearly'

interface TierConfig {
  tierKey: 'solo' | 'pro'
  billingCycle: 'monthly' | 'yearly'
  priceEnvVar: string
}

const TIERS: Record<TierId, TierConfig> = {
  'solo-monthly': { tierKey: 'solo', billingCycle: 'monthly', priceEnvVar: 'STRIPE_PRICE_ID_SOLO_MONTHLY' },
  'solo-yearly':  { tierKey: 'solo', billingCycle: 'yearly',  priceEnvVar: 'STRIPE_PRICE_ID_SOLO_YEARLY' },
  'pro-monthly':  { tierKey: 'pro',  billingCycle: 'monthly', priceEnvVar: 'STRIPE_PRICE_ID_PRO_MONTHLY' },
  'pro-yearly':   { tierKey: 'pro',  billingCycle: 'yearly',  priceEnvVar: 'STRIPE_PRICE_ID_PRO_YEARLY' },
}

const DEFAULT_TIER: TierId = 'solo-monthly'

function isTierId(value: unknown): value is TierId {
  return typeof value === 'string' && value in TIERS
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return handleCreate(req, res, true)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  return handleCreate(req, res, false)
}

const APP_KEY = process.env.VITE_APP_KEY ?? 'lnklokr'

async function handleCreate(req: VercelRequest, res: VercelResponse, redirect: boolean) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.' })
  }

  const body = (typeof req.body === 'object' && req.body) ? (req.body as Record<string, unknown>) : {}

  const rawTier =
    (typeof body.tier === 'string' ? body.tier : undefined) ??
    (typeof req.query.tier === 'string' ? req.query.tier : undefined)

  const tierId: TierId = isTierId(rawTier) ? rawTier : DEFAULT_TIER
  const tier = TIERS[tierId]

  const priceId = process.env[tier.priceEnvVar]
  if (!priceId) {
    return res.status(500).json({
      error: `Missing env var ${tier.priceEnvVar} for tier "${tierId}". Add it in Vercel → Settings → Environment Variables.`,
    })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  const siteUrl =
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const email =
    (typeof body.email === 'string' ? body.email : undefined) ??
    (typeof req.query.email === 'string' ? req.query.email : undefined)

  const userId =
    (typeof body.user_id === 'string' ? body.user_id : undefined) ??
    (typeof req.query.user_id === 'string' ? req.query.user_id : undefined)

  const sharedMeta: Record<string, string> = {
    app_key: APP_KEY,
    tier_key: tier.tierKey,
    billing_cycle: tier.billingCycle,
    tier: tierId,
    ...(userId ? { user_id: userId } : {}),
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // client_reference_id lets the webhook reliably find the Supabase user
      ...(userId ? { client_reference_id: userId } : {}),
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?checkout=success&tier=${tierId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled&tier=${tierId}`,
      metadata: sharedMeta,
      subscription_data: { metadata: sharedMeta },
    })

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL' })
    }

    if (redirect) return res.redirect(303, session.url)

    return res.status(200).json({ id: session.id, tier: tierId, url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Stripe checkout creation failed:', message)
    return res.status(500).json({ error: message })
  }
}
