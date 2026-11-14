-- TEST ONLY: privileged server functions. No client can register verified devices.
-- Server must verify owner email challenge before registration. Not wired yet.
begin;
create table public.ra_devices(
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 proof_hash text not null check(proof_hash ~ '^[a-f0-9]{64}$'),
 label text not null check(length(label) between 1 and 100),
 verified_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(user_id,device_id)
);
create table public.ra_stream_leases(
 user_id uuid primary key references auth.users(id) on delete cascade,
 device_id uuid not null,
 stream_id uuid not null,
 product_id text not null,
 expires_at timestamptz not null,
 foreign key(user_id,device_id) references public.ra_devices(user_id,device_id)
);
alter table public.ra_devices enable row level security;
alter table public.ra_stream_leases enable row level security;
revoke all on public.ra_devices,public.ra_stream_leases from public,anon,authenticated;
grant all on public.ra_devices,public.ra_stream_leases to service_role;

create function public.ra_register_verified_device(account uuid,device uuid,proof text,device_label text) returns text
language plpgsql security definer set search_path='' as $$
declare previous public.ra_devices;
begin
 perform 1 from public.ra_account_security where user_id=account and not blocked for update;
 if not found then return 'ACCOUNT_UNAVAILABLE';end if;
 select * into previous from public.ra_devices where user_id=account and device_id=device;
 if found then
  if previous.revoked_at is not null then return 'DEVICE_REVOKED';end if;
  if previous.proof_hash<>proof then return 'DEVICE_PROOF_INVALID';end if;
  return 'OK';
 end if;
 if (select count(*) from public.ra_devices where user_id=account and revoked_at is null)>=2 then return 'DEVICE_LIMIT';end if;
 insert into public.ra_devices(user_id,device_id,proof_hash,label) values(account,device,proof,device_label);
 return 'OK';
end;
$$;
create function public.ra_claim_stream(account uuid,device uuid,proof text,stream uuid,product text) returns text
language plpgsql security definer set search_path='' as $$
declare previous public.ra_stream_leases;
begin
 perform 1 from public.ra_account_security where user_id=account and not blocked for update;
 if not found then return 'ACCOUNT_UNAVAILABLE';end if;
 if not exists(select 1 from public.ra_devices where user_id=account and device_id=device and proof_hash=proof and revoked_at is null) then return 'DEVICE_UNVERIFIED';end if;
 if not exists(select 1 from public.ra_entitlements where user_id=account and (product_id=product or (product='go-blueprint-audiobook' and product_id in ('go-blueprint-deepening','rooted-audio-special')))) then return 'PRODUCT_REQUIRED';end if;
 select * into previous from public.ra_stream_leases where user_id=account;
 if found and previous.expires_at>now() and (previous.stream_id<>stream or previous.device_id<>device) then return 'STREAM_ACTIVE';end if;
 insert into public.ra_stream_leases(user_id,device_id,stream_id,product_id,expires_at)
 values(account,device,stream,product,now()+interval '60 seconds')
 on conflict(user_id) do update set device_id=excluded.device_id,stream_id=excluded.stream_id,product_id=excluded.product_id,expires_at=excluded.expires_at;
 return 'OK';
end;
$$;
create function public.ra_check_stream(account uuid,device uuid,proof text,stream uuid,product text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ra_account_security s
 join public.ra_devices d on d.user_id=s.user_id
 join public.ra_stream_leases l on l.user_id=s.user_id and l.device_id=d.device_id
 where s.user_id=account and not s.blocked and d.device_id=device and d.proof_hash=proof
 and d.revoked_at is null and l.stream_id=stream and l.product_id=product and l.expires_at>now())
 and exists(select 1 from public.ra_entitlements where user_id=account and (product_id=product or (product='go-blueprint-audiobook' and product_id in ('go-blueprint-deepening','rooted-audio-special'))));
$$;
create function public.ra_revoke_device(account uuid,device uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.ra_account_security where user_id=account for update;
 update public.ra_devices set revoked_at=now() where user_id=account and device_id=device;
 delete from public.ra_stream_leases where user_id=account and device_id=device;
end;
$$;
create function public.ra_release_stream(account uuid,device uuid,proof text,stream uuid) returns void
language sql security definer set search_path='' as $$
 delete from public.ra_stream_leases l where l.user_id=account and l.device_id=device and l.stream_id=stream
 and exists(select 1 from public.ra_devices d where d.user_id=account and d.device_id=device and d.proof_hash=proof and d.revoked_at is null);
$$;
revoke all on function public.ra_register_verified_device(uuid,uuid,text,text),public.ra_claim_stream(uuid,uuid,text,uuid,text),public.ra_check_stream(uuid,uuid,text,uuid,text),public.ra_revoke_device(uuid,uuid),public.ra_release_stream(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.ra_register_verified_device(uuid,uuid,text,text),public.ra_claim_stream(uuid,uuid,text,uuid,text),public.ra_check_stream(uuid,uuid,text,uuid,text),public.ra_revoke_device(uuid,uuid),public.ra_release_stream(uuid,uuid,text,uuid) to service_role;
commit;
