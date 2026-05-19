/*
  # Keep is_premium and subscription_tier in sync

  Updates handle_new_user() so new signups get both columns set.
  Also updates is_user_premium() to check both columns for safety.
*/

-- Update new-user trigger to set both columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, is_premium, subscription_tier, premium_until)
  VALUES (
    new.id,
    new.email,
    false,
    'free'::subscription_tier,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Update is_user_premium() to check either column for backward compat
CREATE OR REPLACE FUNCTION is_user_premium(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        is_premium = true
        OR subscription_tier IN ('standard', 'premium', 'complimentary')
      FROM public.users
      WHERE id = user_id
    ),
    false
  );
$$;
