import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/stripe/billing-portal   { email }
 *
 * Opens a Stripe Billing Portal session for an existing LnkLokr subscriber.
 * The user is redirected back to the app after managing their subscription.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) return res.status(500).json({ error: 'Stripe not configured' })
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Supabase not configured' })

  const body = (typeof req.body === 'object' && req.body) ? (req.body as Record<string, unknown>) : {}
  const email = typeof body.email === 'string' ? body.email : null

  if (!email) return res.status(400).json({ error: 'email is required' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('email', email)
    .maybeSingle()

  const customerId = userData?.stripe_customer_id
  if (!customerId) {
    return res.status(404).json({ error: 'No Stripe customer found for this account.' })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  const siteUrl =
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/?portal=return`,
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Billing portal error:', message)
    return res.status(500).json({ error: message })
  }
}
