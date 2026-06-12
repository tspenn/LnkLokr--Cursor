-- Add LnkLokr-specific tier values to the shared subscription_tier enum.
-- 'solo' and 'pro' were missing, causing webhook updates to fail silently.
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'solo';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'pro';
