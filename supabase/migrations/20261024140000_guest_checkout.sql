-- Guest orders are stored before any customer account is created.
begin;
create table public.ra_guest_payment_orders (
  order_id uuid primary key,
  claim_hash text not null check (claim_hash ~ '^[a-f0-9]{64}$'),
  payment_id text unique check (payment_id ~ '^tr_[A-Za-z0-9]+$'),
  email text not null check (email=lower(trim(email)) and length(email) between 3 and 254),
  product_id text not null check (product_id in ('go-blueprint-audiobook','go-blueprint-deepening','rooted-audio-special')),
  amount text not null check (amount ~ '^\d+\.\d{2}$'),
  currency text not null default 'EUR' check (currency='EUR'),
  status text not null default 'creating',
  access_allowed boolean not null default false,
  revoked_at timestamptz,
  language text not null default 'nl' check (language in ('nl','en')),
  coupon_code text,
  invited_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ra_guest_orders_email_time on public.ra_guest_payment_orders(email,created_at);
alter table public.ra_guest_payment_orders enable row level security;
revoke all on public.ra_guest_payment_orders from public,anon,authenticated;
grant all on public.ra_guest_payment_orders to service_role;

-- Service-only claim: confirmed email ownership is mandatory. Row locks make
-- repeated callbacks/webhooks idempotent and prevent claims by another account.
create function public.ra_claim_guest_orders(account uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare customer_email text; item public.ra_guest_payment_orders%rowtype; claimed integer:=0;
begin
  select lower(u.email) into customer_email from auth.users u
    where u.id=account and u.email_confirmed_at is not null;
  if customer_email is null then return 0; end if;
  for item in select * from public.ra_guest_payment_orders g
    where g.email=customer_email and g.status='paid' and g.access_allowed and g.revoked_at is null
      and (g.claimed_by is null or g.claimed_by=account)
    for update
  loop
    perform public.ra_grant_entitlement(account,item.product_id,'mollie:'||item.payment_id);
    update public.ra_guest_payment_orders set claimed_by=account,updated_at=now() where order_id=item.order_id;
    claimed:=claimed+1;
  end loop;
  return claimed;
end;
$$;
create function public.ra_guest_customer(order_reference uuid)
returns table(user_id uuid,confirmed boolean) language sql security definer set search_path='' as $$
  select u.id,(u.email_confirmed_at is not null) from auth.users u
  join public.ra_guest_payment_orders g on lower(u.email)=g.email
  where g.order_id=order_reference and g.status='paid' and g.access_allowed and g.revoked_at is null
  limit 1;
$$;
revoke all on function public.ra_claim_guest_orders(uuid),public.ra_guest_customer(uuid) from public,anon,authenticated;
grant execute on function public.ra_claim_guest_orders(uuid),public.ra_guest_customer(uuid) to service_role;
commit;
