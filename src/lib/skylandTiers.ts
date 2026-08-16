/**
 * Shared Skyland `profiles.tier` ids.
 * Customer-facing label stays "Free"; only the stored id is app-specific.
 */

export const LNKLOKR_SIGNUP_APP = 'lnklokr'

/** profiles.tier written on LnkLokr signup (via handle_new_user + signup_app). */
export const LNKLOKR_FREE_TIER_ID = 'lnklokr_free'

export const LNKLOKR_FREE_TIER_LABEL = 'Free'

/** Sister-app free ids — unpaid here; never overwrite on shared accounts. */
const SISTER_FREE_TIER_IDS = new Set([
  'support',
  'free',
  'sa_free',
  'goshop_free',
  'msa-trial',
  'toc_free',
  'trial-fc',
  'notie_free',
  'my_lokr_free',
  'chkchk_free',
  'gonews_free',
  'trvl_free',
  'gotrvl_free',
])

export function isLnklokrFreeTier(tier: string | null | undefined): boolean {
  if (!tier) return true
  return tier.toLowerCase() === LNKLOKR_FREE_TIER_ID
}

/** True for this app's free id and any unpaid sister-app tier. */
export function isUnpaidProfilesTier(tier: string | null | undefined): boolean {
  if (!tier) return true
  const t = tier.toLowerCase()
  if (t === LNKLOKR_FREE_TIER_ID) return true
  if (SISTER_FREE_TIER_IDS.has(t)) return true
  return t.endsWith('_free') || t.endsWith('-trial') || t.startsWith('trial-')
}

export function profilesTierDisplayName(tier: string | null | undefined): string {
  if (!tier || isUnpaidProfilesTier(tier)) return LNKLOKR_FREE_TIER_LABEL
  return tier
}

/** True when this account already has another product's free tier. */
export function shouldPreserveSisterProfilesTier(tier: string | null | undefined): boolean {
  if (!tier) return false
  const t = tier.toLowerCase()
  if (t === LNKLOKR_FREE_TIER_ID) return false
  return isUnpaidProfilesTier(t)
}
