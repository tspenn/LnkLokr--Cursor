import { APP_KEY } from './appKey'

/**
 * LnkLokr subscription tiers.
 *
 * Free  — mobile, 30-item cloud sync, links only (no image storage), ads
 * Solo  — all mobile devices, unlimited cloud, 2 GB image storage, no ads
 * Pro   — all devices incl. PC/Mac/Chromebook, Chrome extension, 10 GB, no ads
 */

export type TierKey = 'free' | 'solo' | 'pro'
export type BillingCycle = 'monthly' | 'yearly'
export type TierId = 'solo-monthly' | 'solo-yearly' | 'pro-monthly' | 'pro-yearly'

export interface Tier {
  id: TierId
  tierKey: Exclude<TierKey, 'free'>
  billingCycle: BillingCycle
  name: string
  priceLabel: string
  yearlyEquivalent?: string   // e.g. "$2.08 / mo" shown under yearly price
  annualSavings?: string      // e.g. "Save $11"
  description: string
  features: string[]
  priceEnvVar: string
  storageGB: number
  maxDevices: number | 'unlimited'
  includesExtension: boolean
}

export const TIERS: Record<TierId, Tier> = {
  'solo-monthly': {
    id: 'solo-monthly',
    tierKey: 'solo',
    billingCycle: 'monthly',
    name: 'LnkLokr Solo',
    priceLabel: '$2.99 / mo',
    description: 'All your mobile devices. No ads. Cloud backup.',
    features: [
      'All mobile devices (iOS & Android)',
      'Unlimited links + image saves',
      '2 GB cloud storage',
      'No ads',
      'Full Keep / Borrow / Share / Bury workflow',
    ],
    priceEnvVar: 'STRIPE_PRICE_ID_SOLO_MONTHLY',
    storageGB: 2,
    maxDevices: 'unlimited',
    includesExtension: false,
  },
  'solo-yearly': {
    id: 'solo-yearly',
    tierKey: 'solo',
    billingCycle: 'yearly',
    name: 'LnkLokr Solo',
    priceLabel: '$24.99 / yr',
    yearlyEquivalent: '$2.08 / mo',
    annualSavings: 'Save $11',
    description: 'All your mobile devices. No ads. Cloud backup.',
    features: [
      'All mobile devices (iOS & Android)',
      'Unlimited links + image saves',
      '2 GB cloud storage',
      'No ads',
      'Full Keep / Borrow / Share / Bury workflow',
    ],
    priceEnvVar: 'STRIPE_PRICE_ID_SOLO_YEARLY',
    storageGB: 2,
    maxDevices: 'unlimited',
    includesExtension: false,
  },
  'pro-monthly': {
    id: 'pro-monthly',
    tierKey: 'pro',
    billingCycle: 'monthly',
    name: 'LnkLokr Pro',
    priceLabel: '$5.99 / mo',
    description: 'Every device including PC & Mac. Chrome extension. Maximum storage.',
    features: [
      'All mobile + PC / Mac / Chromebook',
      'Chrome extension — one-click save from any page',
      'Unlimited links + image saves',
      '10 GB cloud storage',
      'No ads',
      'Full Keep / Borrow / Share / Bury workflow',
    ],
    priceEnvVar: 'STRIPE_PRICE_ID_PRO_MONTHLY',
    storageGB: 10,
    maxDevices: 'unlimited',
    includesExtension: true,
  },
  'pro-yearly': {
    id: 'pro-yearly',
    tierKey: 'pro',
    billingCycle: 'yearly',
    name: 'LnkLokr Pro',
    priceLabel: '$49.99 / yr',
    yearlyEquivalent: '$4.17 / mo',
    annualSavings: 'Save $22',
    description: 'Every device including PC & Mac. Chrome extension. Maximum storage.',
    features: [
      'All mobile + PC / Mac / Chromebook',
      'Chrome extension — one-click save from any page',
      'Unlimited links + image saves',
      '10 GB cloud storage',
      'No ads',
      'Full Keep / Borrow / Share / Bury workflow',
    ],
    priceEnvVar: 'STRIPE_PRICE_ID_PRO_YEARLY',
    storageGB: 10,
    maxDevices: 'unlimited',
    includesExtension: true,
  },
}

export const TIER_ORDER: TierId[] = [
  'solo-monthly',
  'solo-yearly',
  'pro-monthly',
  'pro-yearly',
]

export const FREE_TIER = {
  tierKey: 'free' as TierKey,
  name: 'LnkLokr Free',
  priceLabel: 'Free forever',
  description: 'Save links with images on your phone. Try the full LnkLokr workflow.',
  features: [
    'One mobile device',
    'Save links with images',
    'Last 30 items synced to cloud',
    'Full Keep / Borrow / Share / Bury workflow',
    'Ad-supported',
  ],
  storageGB: 0,
  maxDevices: 1,
  includesExtension: false,
}

/** Start a Stripe Checkout Session for a paid tier. */
export async function startCheckout(tierId: TierId, email?: string): Promise<string | null> {
  try {
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: tierId, email, app_key: APP_KEY }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Checkout session failed: ${res.status} ${detail}`)
    }

    const { url } = (await res.json()) as { url?: string }
    return url ?? null
  } catch (error) {
    console.error('Failed to start Stripe checkout:', error)
    return null
  }
}

/** Open the Stripe Billing Portal for an existing subscriber. */
export async function openBillingPortal(email: string): Promise<void> {
  try {
    const res = await fetch('/api/stripe/billing-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) throw new Error(`Portal request failed: ${res.status}`)

    const { url } = (await res.json()) as { url?: string }
    if (url) window.location.href = url
  } catch (error) {
    console.error('Failed to open billing portal:', error)
    alert('Could not open billing portal. Please try again.')
  }
}

/** Resolve the current user's tier from their Supabase is_premium + subscription data. */
export function resolveTierKey(isPremium: boolean, planName?: string | null): TierKey {
  if (!isPremium) return 'free'
  if (planName?.toLowerCase().includes('pro')) return 'pro'
  return 'solo'
}

export const PURCHASE_URL = '/api/stripe/create-checkout-session?tier=solo-monthly'
