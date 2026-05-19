import { User } from '@/types'

/** Fill defaults when shared Supabase user row is missing LnkLokr-specific columns. */
export function normalizeUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    is_premium: Boolean(row.is_premium),
    subscription_tier:
      (row.subscription_tier as User['subscription_tier']) ?? 'free',
    premium_until: (row.premium_until as string | null) ?? null,
    cloud_sync: Boolean(row.cloud_sync),
    device_limit: typeof row.device_limit === 'number' ? row.device_limit : 1,
    stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
    last_purchase_tier: (row.last_purchase_tier as string | null) ?? null,
    bury_password: (row.bury_password as string | null) ?? null,
    storage_used: typeof row.storage_used === 'number' ? row.storage_used : 0,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}
