-- Additive TEST migration for Mollie payment orders and entitlement sources.
-- Apply to the test project first. Existing accounts and writing are preserved.
begin;

create table public.ra_payment_orders (
  payment_id text primary key check (payment_id ~ '^tr_[A-Za-z0-9]+$'),
  email text not null check (length(email) between 3 and 254),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('go-blueprint-audiobook','go-blueprint-deepening','rooted-audio-special')),
  status text not null check (length(status) between 2 and 40),
  amount text not null check (amount ~ '^\d+\.\d{2}$'),
  currency text not null check (currency = 'EUR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ra_entitlement_sources (
  source_id text primary key check (length(source_id) between 3 and 300),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('go-blueprint-audiobook','go-blueprint-deepening','rooted-audio-special')),
  created_at timestamptz not null default now()
);
create index ra_entitlement_sources_account_product
  on public.ra_entitlement_sources(user_id, product_id);

-- Preserve all access that existed before source tracking was introduced.
insert into public.ra_entitlement_sources(source_id,user_id,product_id)
select 'legacy:' || user_id::text || ':' || product_id,user_id,product_id
from public.ra_entitlements
on conflict do nothing;

alter table public.ra_payment_orders enable row level security;
alter table public.ra_entitlement_sources enable row level security;
revoke all on public.ra_payment_orders, public.ra_entitlement_sources from public,anon,authenticated;
grant all on public.ra_payment_orders, public.ra_entitlement_sources to service_role;

create function public.ra_grant_entitlement(account uuid, product text, source text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if product not in ('go-blueprint-audiobook','go-blueprint-deepening','rooted-audio-special') then
    raise exception 'invalid product';
  end if;
  insert into public.ra_entitlement_sources(source_id,user_id,product_id)
  values(source,account,product) on conflict(source_id) do nothing;
  insert into public.ra_entitlements(user_id,product_id)
  values(account,product) on conflict(user_id,product_id) do nothing;
end;
$$;

create function public.ra_revoke_entitlement_source(account uuid, product text, source text)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.ra_entitlement_sources s
   where s.source_id=source and s.user_id=account and s.product_id=product;
  if not exists(
    select 1 from public.ra_entitlement_sources s
     where s.user_id=account and s.product_id=product
  ) then
    delete from public.ra_entitlements e
     where e.user_id=account and e.product_id=product;
  end if;
  delete from public.ra_listening_sessions s where s.user_id=account;
end;
$$;

revoke all on function public.ra_grant_entitlement(uuid,text,text),
 public.ra_revoke_entitlement_source(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ra_grant_entitlement(uuid,text,text),
 public.ra_revoke_entitlement_source(uuid,text,text) to service_role;

create function public.ra_release_all_listening_sessions()
returns void language sql security definer set search_path='' as $$
  delete from public.ra_listening_sessions where user_id=auth.uid();
$$;
revoke all on function public.ra_release_all_listening_sessions() from public,anon;
grant execute on function public.ra_release_all_listening_sessions() to authenticated;

commit;