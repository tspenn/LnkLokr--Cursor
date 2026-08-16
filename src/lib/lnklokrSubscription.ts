import { APP_KEY } from './appKey'
import { supabase } from './supabase'
import type { User } from '@/types'

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

function tierFromPlanName(planName: string | null | undefined): User['subscription_tier'] {
  const plan = (planName ?? '').toLowerCase()
  if (plan.includes('pro')) return 'pro' as User['subscription_tier']
  return 'solo' as User['subscription_tier']
}

/**
 * Per-app paid status lives in user_subscriptions (app_key = lnklokr).
 * public.users and profiles.tier are shared/legacy and can stay "free"
 * even when LnkLokr Solo is active.
 */
export async function overlayLnklokrSubscription(user: User): Promise<User> {
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('plan_name, status, current_period_end')
    .eq('user_id', user.id)
    .eq('app_key', APP_KEY)
    .maybeSingle()

  if (!sub || !ACTIVE_STATUSES.has((sub.status ?? '').toLowerCase())) {
    return user
  }

  return {
    ...user,
    is_premium: true,
    subscription_tier: tierFromPlanName(sub.plan_name),
    premium_until: sub.current_period_end ?? user.premium_until,
  }
}
