-- LnkLokr signups set profiles.tier = lnklokr_free so they can be filtered
-- separately from FRIDAY (support) and sister apps (e.g. sa_free).
-- Customer-facing label stays Free; only the stored id changes.
-- ON CONFLICT DO NOTHING preserves existing shared-account tiers.
-- Keep sister-app branches: this function is shared across Skyland apps.

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

  return new;
end;
$function$;
