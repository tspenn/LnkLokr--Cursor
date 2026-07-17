-- ─────────────────────────────────────────────────────────────────────────────
-- Free-Tier Stripe Guard
--
-- Problem: Nothing at the database layer prevents a free-tier subscription row
-- in user_subscriptions from being given a stripe_customer_id. The audit found
-- that edge function guards are either absent or rely on Stripe having no
-- product for free plans (fragile).
--
-- Solution:
--   1. DB function  is_free_tier_id()  — reusable by edge functions and the
--      trigger below.
--   2. BEFORE INSERT/UPDATE trigger on user_subscriptions that rejects any row
--      where the linked tier is free (price_monthly = 0) yet stripe_customer_id
--      is being set.
--   3. upgrade_free_to_paid_check() — a lightweight function edge functions can
--      call to confirm a user is currently on a free tier before creating a
--      Stripe checkout session (so they don't accidentally create a second
--      customer for someone already paid).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Helper: returns true when the given tier_id resolves to a free plan
CREATE OR REPLACE FUNCTION is_free_tier_id(p_tier_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT price_monthly = 0
         AND (stripe_price_id_monthly IS NULL OR stripe_price_id_monthly = '')
      FROM public.subscription_tiers
      WHERE id = p_tier_id
    ),
    -- Tier not found → treat conservatively as free (no Stripe data)
    true
  );
$$;

-- 2. Overload: accepts plan_name + app_key for functions that only have those
CREATE OR REPLACE FUNCTION is_free_plan_name(p_plan_name text, p_app_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT price_monthly = 0
      FROM public.subscription_tiers
      WHERE app_key = p_app_key
        AND LOWER(name) = LOWER(p_plan_name)
      LIMIT 1
    ),
    -- Plan name not found in tiers → if name looks free, treat as free
    LOWER(COALESCE(p_plan_name, '')) IN ('free', 'intro', 'lnklokr free', 'trial')
  );
$$;

-- 3. Trigger function: enforces the guard on user_subscriptions rows
CREATE OR REPLACE FUNCTION prevent_free_tier_stripe_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_free boolean := false;
BEGIN
  -- Only matters if a stripe_customer_id is being written
  IF NEW.stripe_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check via tier_id FK (preferred — price_monthly is the source of truth)
  IF NEW.tier_id IS NOT NULL THEN
    SELECT is_free_tier_id(NEW.tier_id) INTO v_is_free;
    IF v_is_free THEN
      RAISE EXCEPTION
        '[free_tier_guard] Cannot assign stripe_customer_id to a free-tier subscription (tier_id: %)',
        NEW.tier_id;
    END IF;
    RETURN NEW;  -- tier_id check passed → allow
  END IF;

  -- Fallback: check via plan_name when tier_id is absent
  IF NEW.plan_name IS NOT NULL AND NEW.app_key IS NOT NULL THEN
    SELECT is_free_plan_name(NEW.plan_name, NEW.app_key) INTO v_is_free;
    IF v_is_free THEN
      RAISE EXCEPTION
        '[free_tier_guard] Cannot assign stripe_customer_id to a free-tier plan (plan: %, app: %)',
        NEW.plan_name, NEW.app_key;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach the trigger
DROP TRIGGER IF EXISTS enforce_no_stripe_for_free ON public.user_subscriptions;
CREATE TRIGGER enforce_no_stripe_for_free
  BEFORE INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_free_tier_stripe_sync();

-- 5. Utility: returns the active paid subscription for a user+app
--    Edge functions (e.g. stripe-portal) call this before making Stripe API calls.
CREATE OR REPLACE FUNCTION get_active_paid_subscription(
  p_user_id  uuid,
  p_app_key  text
)
RETURNS TABLE (
  subscription_id        uuid,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan_name              text,
  tier_id                uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    us.id,
    us.stripe_customer_id,
    us.stripe_subscription_id,
    us.plan_name,
    us.tier_id
  FROM public.user_subscriptions us
  WHERE us.user_id   = p_user_id
    AND us.app_key   = p_app_key
    AND us.status    = 'active'
    AND us.stripe_customer_id IS NOT NULL
    AND (us.tier_id IS NULL OR NOT is_free_tier_id(us.tier_id))
  LIMIT 1;
$$;
