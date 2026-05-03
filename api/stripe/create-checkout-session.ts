import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

/**
 * POST /api/stripe/create-checkout-session   { tier, email? }
 * GET  /api/stripe/create-checkout-session?tier=cloud-monthly
 *
 * Creates a Stripe Checkout Session for one of the four LnkLokr tiers
 * shown on the product page:
 *
 *   tier=one-device      → $3.99   one-time   (STRIPE_PRICE_ID_ONE_DEVICE)
 *   tier=five-device     → $7.99   one-time   (STRIPE_PRICE_ID_FIVE_DEVICE)
 *   tier=cloud-monthly   → $4.99   monthly    (STRIPE_PRICE_ID_CLOUD_MONTHLY)
 *   tier=cloud-yearly    → $59.00  yearly     (STRIPE_PRICE_ID_CLOUD_YEARLY)
 *
 * Required Vercel env vars:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_PRICE_ID_ONE_DEVICE
 *   - STRIPE_PRICE_ID_FIVE_DEVICE
 *   - STRIPE_PRICE_ID_CLOUD_MONTHLY
 *   - STRIPE_PRICE_ID_CLOUD_YEARLY
 *   - PUBLIC_SITE_URL (or VERCEL_URL is used as a fallback)
 */

type TierId = 'one-device' | 'five-device' | 'cloud-monthly' | 'cloud-yearly'

interface TierConfig {
  mode: 'payment' | 'subscription'
  priceEnvVar: string
}

const TIERS: Record<TierId, TierConfig> = {
  'one-device':    { mode: 'payment',      priceEnvVar: 'STRIPE_PRICE_ID_ONE_DEVICE' },
  'five-device':   { mode: 'payment',      priceEnvVar: 'STRIPE_PRICE_ID_FIVE_DEVICE' },
  'cloud-monthly': { mode: 'subscription', priceEnvVar: 'STRIPE_PRICE_ID_CLOUD_MONTHLY' },
  'cloud-yearly':  { mode: 'subscription', priceEnvVar: 'STRIPE_PRICE_ID_CLOUD_YEARLY' },
}

const DEFAULT_TIER: TierId = 'cloud-monthly'

function isTierId(value: unknown): value is TierId {
  return typeof value === 'string' && value in TIERS
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleCreate(req, res, true)
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  return handleCreate(req, res, false)
}

async function handleCreate(req: VercelRequest, res: VercelResponse, redirect: boolean) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return res.status(500).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.',
    })
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
      error: `Missing Stripe Price ID env var ${tier.priceEnvVar} for tier "${tierId}".`,
    })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  const siteUrl =
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const email =
    (typeof body.email === 'string' ? body.email : undefined) ??
    (typeof req.query.email === 'string' ? req.query.email : undefined)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: tier.mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      allow_promotion_codes: true,
      success_url: `${siteUrl}/?checkout=success&tier=${tierId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled&tier=${tierId}`,
      metadata: { tier: tierId },
      ...(tier.mode === 'subscription'
        ? { subscription_data: { metadata: { tier: tierId } } }
        : {}),
    })

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL' })
    }

    if (redirect) {
      return res.redirect(303, session.url)
    }

    return res.status(200).json({ id: session.id, tier: tierId, url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Stripe checkout creation failed:', message)
    return res.status(500).json({ error: message })
  }
}
