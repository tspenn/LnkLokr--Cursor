/*
  # Update User Creation Trigger for Tier System
  
  1. Changes
    - Update `handle_new_user()` function to use subscription_tier instead of is_premium
    - New users default to 'free' tier
  
  2. Business Logic
    - All new signups start as 'free' tier (local storage only)
    - Can be upgraded to 'standard', 'premium', or 'complimentary' via payment/admin
*/

-- Update handle_new_user function to use subscription_tier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_tier, premium_until)
  VALUES (
    new.id, 
    new.email, 
    'free'::subscription_tier, 
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
