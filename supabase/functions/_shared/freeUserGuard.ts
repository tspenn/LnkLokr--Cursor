/**
 * Free-User Guard utilities for Skyland Reach edge functions.
 *
 * Every edge function that calls the Stripe API should import and call
 * `assertPaidTier` (or `getPaidSubscription`) before making any Stripe request.
 *
 * Upgrade path (Free → Paid):
 *   Free users have NO stripe_customer_id.  When they choose a paid plan the
 *   checkout function creates a new Stripe session without a pre-existing
 *   customer.  On success, Stripe fires a webhook → the webhook handler sets
 *   stripe_customer_id and updates plan_name / tier_id to the paid value.
 *   The DB trigger `enforce_no_stripe_for_free` then only fires if someone
 *   tries to set stripe_customer_id while keeping a free tier_id — which the
 *   webhook never does (it always upgrades the tier atomically).
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaidSubscription {
  subscription_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  plan_name: string | null
  tier_id: string | null
}

export class FreeTierError extends Error {
  constructor(message = 'Free tier — no Stripe sync needed') {
    super(message)
    this.name = 'FreeTierError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the user's active paid subscription for a given app, or null if
 * they are on a free tier / have no active paid subscription.
 *
 * Uses the DB function `get_active_paid_subscription` which filters by:
 *   - status = 'active'
 *   - stripe_customer_id IS NOT NULL
 *   - is_free_tier_id(tier_id) = false
 */
export async function getPaidSubscription(
  supabase: SupabaseClient,
  userId: string,
  appKey: string,
): Promise<PaidSubscription | null> {
  const { data, error } = await supabase
    .rpc('get_active_paid_subscription', { p_user_id: userId, p_app_key: appKey })
    .maybeSingle()

  if (error) {
    console.error('[freeUserGuard] get_active_paid_subscription error:', error.message)
    return null
  }

  if (!data) return null

  return {
    subscription_id: data.subscription_id,
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    plan_name: data.plan_name ?? null,
    tier_id: data.tier_id ?? null,
  }
}

/**
 * Throws FreeTierError if the user has no active paid subscription.
 * Use this at the top of any edge function that must not run for free users.
 */
export async function assertPaidTier(
  supabase: SupabaseClient,
  userId: string,
  appKey: string,
): Promise<PaidSubscription> {
  const sub = await getPaidSubscription(supabase, userId, appKey)
  if (!sub) {
    throw new FreeTierError(
      `User ${userId} has no active paid subscription for app ${appKey} — Stripe call skipped`,
    )
  }
  return sub
}

/**
 * Checks whether a tier_id is a free tier by calling the DB helper.
 * Returns true (free) on any error to fail safely.
 */
export async function isFreeTierId(supabase: SupabaseClient, tierId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_free_tier_id', { p_tier_id: tierId })
  if (error) {
    console.warn('[freeUserGuard] is_free_tier_id error (treating as free):', error.message)
    return true
  }
  return data === true
}

/**
 * Checks whether a plan_name + app_key corresponds to a free tier.
 */
export async function isFreePlanName(
  supabase: SupabaseClient,
  planName: string,
  appKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_free_plan_name', {
    p_plan_name: planName,
    p_app_key: appKey,
  })
  if (error) {
    console.warn('[freeUserGuard] is_free_plan_name error (treating as free):', error.message)
    return true
  }
  return data === true
}

// ─────────────────────────────────────────────────────────────────────────────
// Response helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Standard JSON response when a free-tier call is intercepted. */
export function freeTierResponse(): Response {
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: 'free_tier' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

/** Standard error response when a paid subscription is required. */
export function requiresPaidResponse(detail?: string): Response {
  return new Response(
    JSON.stringify({
      error: 'active_paid_subscription_required',
      message: detail ?? 'This action requires an active paid subscription.',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  )
}
