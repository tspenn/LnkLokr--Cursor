-- Link saves require public.users (links.user_id FK).
-- Sister apps overwrote handle_new_user to insert profiles only, and
-- public.users has no INSERT policy, so the client fallback never persists.
-- Keep sister-app profile branches: this function is shared across Skyland apps.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  signup_app text := coalesce(new.raw_user_meta_data->>'signup_app', '');
  initial_tier text := 'support';
begin
  if signup_app = 'secret-agent' then
    initial_tier := 'sa_free';
  elsif signup_app = 'goshop' then
    initial_tier := 'goshop_free';
  elsif signup_app = 'my-support-agent' then
    initial_tier := 'msa-trial';
  elsif signup_app = 'toc' then
    initial_tier := 'toc_free';
  elsif signup_app = 'friday_canvas' then
    initial_tier := 'trial-fc';
  elsif signup_app = 'notie' then
    initial_tier := 'notie_free';
  elsif signup_app = 'my_lokr' then
    initial_tier := 'my_lokr_free';
  elsif signup_app = 'chkchk' then
    initial_tier := 'chkchk_free';
  elsif signup_app = 'gonews' then
    initial_tier := 'gonews_free';
  elsif signup_app = 'gotrvl' then
    initial_tier := 'trvl_free';
  elsif signup_app = 'lnklokr' then
    initial_tier := 'lnklokr_free';
  end if;

  insert into public.profiles (id, email, tier)
  values (new.id, new.email, initial_tier)
  on conflict (id) do nothing;

  insert into public.users (id, email, is_premium, subscription_tier, premium_until)
  values (new.id, coalesce(new.email, ''), false, 'free', null)
  on conflict (id) do nothing;

  return new;
end;
$function$;

DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
CREATE POLICY "Users can insert own data"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND is_premium = false
    AND subscription_tier = 'free'
  );

INSERT INTO public.users (id, email, is_premium, subscription_tier, premium_until)
SELECT au.id, coalesce(au.email, ''), false, 'free', null
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;
