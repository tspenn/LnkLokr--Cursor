-- Dedicated LnkLokr signup trigger. Sister apps routinely REPLACE
-- public.handle_new_user(); this function/trigger has a LnkLokr-only name
-- so those overwrites do not drop lnklokr_free or the public.users row.
-- Runs after on_auth_user_created (alphabetical) and only retags Friday
-- defaults (support/free). Sister paid/free tiers are left alone.

CREATE OR REPLACE FUNCTION public.handle_new_lnklokr_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  signup_app text := coalesce(new.raw_user_meta_data->>'signup_app', '');
  existing_tier text;
begin
  insert into public.users (id, email, is_premium, subscription_tier, premium_until)
  values (new.id, coalesce(new.email, ''), false, 'free', null)
  on conflict (id) do nothing;

  if signup_app = 'lnklokr' then
    select p.tier into existing_tier
    from public.profiles p
    where p.id = new.id;

    if existing_tier is null then
      insert into public.profiles (id, email, tier)
      values (new.id, new.email, 'lnklokr_free')
      on conflict (id) do update
        set email = excluded.email,
            tier = excluded.tier
        where public.profiles.tier in ('support', 'free');
    elsif existing_tier in ('support', 'free') then
      update public.profiles
      set tier = 'lnklokr_free'
      where id = new.id
        and tier in ('support', 'free');
    end if;
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_lnklokr ON auth.users;
CREATE TRIGGER on_auth_user_created_lnklokr
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lnklokr_user();
