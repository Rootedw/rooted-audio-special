-- Additive TEST migration. Original D1 data remains untouched.
-- Apply only to rooted-audio-test after backup and review.
begin;
create table public.ra_account_security (
 user_id uuid primary key references auth.users(id) on delete cascade,
 blocked boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.ra_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '' check (length(first_name)<=100),
 language text not null default 'nl' check (language in ('nl','en')),
 updated_at timestamptz not null default now()
);
create table public.ra_entitlements (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null check(product_id in ('go-blueprint-audiobook','go-blueprint-deepening','rooted-audio-special')),
 granted_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
create table public.ra_user_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 preference_key text not null check(preference_key in (
 'ra-language','ra-name','ra-onboarded','ra-intro-seen','ra-active-track',
 'ra-favorites','ra-reflections','ra-reflection-times','ra-workbook',
 'ra-listening-ritual','ra-auto-continue','ra-sleep-timer','ra-volume',
 'ra-playback-speed','ra-playback','ra-saved-moments','ra-workbook-section')),
 value jsonb not null check(octet_length(value::text)<=1000000),
 updated_at timestamptz not null default now(),
 primary key(user_id,preference_key)
);
-- No automatic email matching: existing IDs require an explicit verified mapping.
create table public.ra_legacy_identity_map (
 legacy_user_id text primary key,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 verified_at timestamptz not null,
 verified_by text not null
);

alter table public.ra_account_security enable row level security;
alter table public.ra_profiles enable row level security;
alter table public.ra_entitlements enable row level security;
alter table public.ra_user_preferences enable row level security;
alter table public.ra_legacy_identity_map enable row level security;
revoke all on public.ra_account_security,public.ra_profiles,public.ra_entitlements,
 public.ra_user_preferences,public.ra_legacy_identity_map from public,anon,authenticated;
grant all on public.ra_account_security,public.ra_profiles,public.ra_entitlements,
 public.ra_user_preferences,public.ra_legacy_identity_map to service_role;

-- Return only current identity's security status; never accept a caller's user_id.
create function public.ra_account_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ra_account_security s
 where s.user_id=(select auth.uid()) and not s.blocked);
$$;
revoke all on function public.ra_account_is_active() from public,anon;
grant execute on function public.ra_account_is_active() to authenticated;

create function public.ra_has_product(product text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.ra_account_is_active() and exists(
 select 1 from public.ra_entitlements e where e.user_id=(select auth.uid())
 and (e.product_id=product or (product='go-blueprint-audiobook' and e.product_id in ('go-blueprint-deepening','rooted-audio-special'))));
$$;
revoke all on function public.ra_has_product(text) from public,anon;
grant execute on function public.ra_has_product(text) to authenticated;

create function public.ra_preference_allowed(key text) returns boolean
language sql stable security invoker set search_path='' as $$
 select public.ra_account_is_active() and case
 when key in ('ra-language','ra-name','ra-onboarded') then true
 when key in ('ra-workbook','ra-workbook-section') then public.ra_has_product('rooted-audio-special')
 else public.ra_has_product('go-blueprint-audiobook') end;
$$;
revoke all on function public.ra_preference_allowed(text) from public,anon;
grant execute on function public.ra_preference_allowed(text) to authenticated;

grant select on public.ra_entitlements to authenticated;
create policy ra_entitlements_read on public.ra_entitlements for select to authenticated
 using (user_id=(select auth.uid()) and public.ra_account_is_active());
grant select,insert,update on public.ra_profiles to authenticated;
create policy ra_profile_read on public.ra_profiles for select to authenticated
 using(user_id=(select auth.uid()) and public.ra_account_is_active());
create policy ra_profile_insert on public.ra_profiles for insert to authenticated
 with check(user_id=(select auth.uid()) and public.ra_account_is_active());
create policy ra_profile_update on public.ra_profiles for update to authenticated
 using(user_id=(select auth.uid()) and public.ra_account_is_active())
 with check(user_id=(select auth.uid()) and public.ra_account_is_active());
grant select,insert,update,delete on public.ra_user_preferences to authenticated;
create policy ra_preferences_read on public.ra_user_preferences for select to authenticated
 using(user_id=(select auth.uid()) and public.ra_preference_allowed(preference_key));
create policy ra_preferences_insert on public.ra_user_preferences for insert to authenticated
 with check(user_id=(select auth.uid()) and public.ra_preference_allowed(preference_key));
create policy ra_preferences_update on public.ra_user_preferences for update to authenticated
 using(user_id=(select auth.uid()) and public.ra_preference_allowed(preference_key))
 with check(user_id=(select auth.uid()) and public.ra_preference_allowed(preference_key));
create policy ra_preferences_delete on public.ra_user_preferences for delete to authenticated
 using(user_id=(select auth.uid()) and public.ra_preference_allowed(preference_key));

create function public.ra_initialize_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.ra_account_security(user_id) values(new.id);
 insert into public.ra_profiles(user_id,language) values(new.id,
 case when new.raw_user_meta_data->>'language'='en' then 'en' else 'nl' end);
 return new;
end;
$$;
revoke all on function public.ra_initialize_account() from public,anon,authenticated;
create trigger ra_new_account after insert on auth.users
 for each row execute function public.ra_initialize_account();
-- Initialize existing TEST identities only; deliberately grants no product access.
insert into public.ra_account_security(user_id) select id from auth.users on conflict do nothing;
insert into public.ra_profiles(user_id) select id from auth.users on conflict do nothing;
commit;
