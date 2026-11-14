-- Additive migration for the existing rooted-audio-test project.
-- No existing account, entitlement, progress or writing is changed.
begin;
-- Private recovery snapshot, in the same transaction as this additive setup.
-- This schema is not exposed through the application API; no client gets access.
create schema ra_recovery_20261011_media;
revoke all on schema ra_recovery_20261011_media from public,anon,authenticated;
create table ra_recovery_20261011_media.account_security as table public.ra_account_security;
create table ra_recovery_20261011_media.profiles as table public.ra_profiles;
create table ra_recovery_20261011_media.entitlements as table public.ra_entitlements;
create table ra_recovery_20261011_media.preferences as table public.ra_user_preferences;
create table ra_recovery_20261011_media.identity_map as table public.ra_legacy_identity_map;
revoke all on all tables in schema ra_recovery_20261011_media from public,anon,authenticated;
alter table ra_recovery_20261011_media.account_security enable row level security;
alter table ra_recovery_20261011_media.profiles enable row level security;
alter table ra_recovery_20261011_media.entitlements enable row level security;
alter table ra_recovery_20261011_media.preferences enable row level security;
alter table ra_recovery_20261011_media.identity_map enable row level security;
create table public.ra_trusted_devices (
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id text not null check(device_id ~ '^[A-Za-z0-9_-]{16,96}$'),
 label text not null check(length(label) between 1 and 60),
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(user_id,device_id)
);
create table public.ra_listening_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 device_id text not null,
 track_id text not null,
 last_seen_at timestamptz not null default now(),
 foreign key(user_id,device_id) references public.ra_trusted_devices(user_id,device_id) on delete cascade
);
alter table public.ra_trusted_devices enable row level security;
alter table public.ra_listening_sessions enable row level security;
revoke all on public.ra_trusted_devices,public.ra_listening_sessions from public,anon,authenticated;
grant all on public.ra_trusted_devices,public.ra_listening_sessions to service_role;

-- Product selection is an exact server catalogue, not a caller-supplied product.
create function public.ra_track_product(track text) returns text
language sql immutable set search_path='' as $$
 select case when track='foreword' or track ~ '^chapter-(0[1-9]|1[0-3])$'
 then 'go-blueprint-audiobook'
 when track ~ '^bonus-0[1-3]$' then 'go-blueprint-deepening' else null end;
$$;
revoke all on function public.ra_track_product(text) from public,anon;
grant execute on function public.ra_track_product(text) to authenticated;

create function public.ra_claim_listening_session(device text,track text,device_label text default 'Personal device')
returns text language plpgsql security definer set search_path='' as $$
declare identity uuid := auth.uid(); active public.ra_listening_sessions%rowtype;
begin
 if identity is null or not public.ra_account_is_active() then return 'UNAUTHORIZED'; end if;
 if device is null or device !~ '^[A-Za-z0-9_-]{16,96}$' then return 'INVALID_DEVICE'; end if;
 if public.ra_track_product(track) is null then return 'INVALID_TRACK'; end if;
 if not public.ra_has_product(public.ra_track_product(track)) then return 'PRODUCT_ACCESS_REQUIRED'; end if;
 -- Serializes registration and lease claims for this account across requests.
 perform 1 from public.ra_account_security where user_id=identity for update;
 if not exists(select 1 from public.ra_trusted_devices d where d.user_id=identity and d.device_id=device)
 and (select count(*) from public.ra_trusted_devices d where d.user_id=identity)>=2
 then return 'DEVICE_LIMIT_REACHED'; end if;
 select * into active from public.ra_listening_sessions s where s.user_id=identity;
 if found and active.device_id<>device and active.last_seen_at>clock_timestamp()-interval '90 seconds'
 then return 'ANOTHER_DEVICE_IS_LISTENING'; end if;
 insert into public.ra_trusted_devices(user_id,device_id,label,last_seen_at)
 values(identity,device,left(coalesce(nullif(trim(device_label),''),'Personal device'),60),clock_timestamp())
 on conflict(user_id,device_id) do update set label=excluded.label,last_seen_at=excluded.last_seen_at;
 insert into public.ra_listening_sessions(user_id,device_id,track_id,last_seen_at)
 values(identity,device,track,clock_timestamp())
 on conflict(user_id) do update set device_id=excluded.device_id,track_id=excluded.track_id,last_seen_at=excluded.last_seen_at;
 return 'OK';
end;
$$;

create function public.ra_release_listening_session(device text) returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.ra_listening_sessions s where s.user_id=auth.uid() and s.device_id=device;
end;
$$;
create function public.ra_list_trusted_devices()
returns table(device_id text,label text,created_at timestamptz,last_seen_at timestamptz)
language sql stable security definer set search_path='' as $$
 select d.device_id,d.label,d.created_at,d.last_seen_at from public.ra_trusted_devices d
 where d.user_id=auth.uid() and public.ra_account_is_active() order by d.last_seen_at desc;
$$;
create function public.ra_remove_trusted_device(device text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.ra_account_security where user_id=auth.uid() for update;
 delete from public.ra_trusted_devices d where d.user_id=auth.uid() and d.device_id=device;
end;
$$;
revoke all on function public.ra_claim_listening_session(text,text,text),
 public.ra_release_listening_session(text),public.ra_list_trusted_devices(),public.ra_remove_trusted_device(text)
 from public,anon;
grant execute on function public.ra_claim_listening_session(text,text,text),
 public.ra_release_listening_session(text),public.ra_list_trusted_devices(),public.ra_remove_trusted_device(text)
 to authenticated;

-- These are private buckets. There are no client upload/delete policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('go-blueprint-audio','go-blueprint-audio',false,52428800,array['audio/mpeg']),
 ('go-blueprint-workbooks','go-blueprint-workbooks',false,10485760,array['application/pdf']);
create policy ra_owned_audio_read on storage.objects for select to authenticated
using(bucket_id='go-blueprint-audio'
 and name ~ '^(foreword|chapter-(0[1-9]|1[0-3])|bonus-0[1-3])\.mp3$'
 and public.ra_has_product(public.ra_track_product(regexp_replace(name,'\.mp3$',''))));
create policy ra_owned_workbook_read on storage.objects for select to authenticated
using(bucket_id='go-blueprint-workbooks'
 and name in ('GO_BLUEPRINT_Workbook_Invulbaar.pdf','GO_BLUEPRINT_Workbook_Printversie.pdf')
 and public.ra_has_product('go-blueprint-deepening'));
commit;
