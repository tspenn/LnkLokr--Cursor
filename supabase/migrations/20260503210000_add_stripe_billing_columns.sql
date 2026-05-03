/*
  # Add Stripe billing columns to users

  The /api/stripe/webhook serverless function (Vercel) updates the
  following columns on the public.users row that matches the Stripe
  customer's email or stripe_customer_id. Add them if they don't already
  exist so the webhook can persist purchase state idempotently.

  Columns:
    - stripe_customer_id  text   - Stripe customer (cus_...) ID, set when
                                   the first checkout session completes.
    - cloud_sync          bool   - Whether the user has an active LokBx
                                   cloud subscription (cloud-monthly /
                                   cloud-yearly).
    - device_limit        int    - 1 for the One Device tier, 5 for the
                                   5-Device pack add-on. Driven by the
                                   one-time purchase tiers.
    - last_purchase_tier  text   - The most recently purchased tier
                                   identifier ("one-device" / "five-device"
                                   / "cloud-monthly" / "cloud-yearly").

  Index:
    - idx_users_stripe_customer_id - speeds up subscription webhook
                                     lookups that filter by stripe customer.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS cloud_sync         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_limit       integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_purchase_tier text;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON users(stripe_customer_id);
