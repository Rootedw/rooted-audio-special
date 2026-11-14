-- Immediately reject access tokens issued before a customer revoked all sessions.
-- Additive: existing accounts remain active until they explicitly revoke sessions.
begin;

alter table public.ra_account_security
  add column if not exists sessions_valid_after timestamptz;

create or replace function public.ra_account_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.ra_account_security s
   where s.user_id=(select auth.uid())
     and not s.blocked
     and (
       s.sessions_valid_after is null
       or to_timestamp(coalesce(nullif(auth.jwt()->>'iat',''),'0')::double precision) >= s.sessions_valid_after
     )
 );
$$;
revoke all on function public.ra_account_is_active() from public,anon;
grant execute on function public.ra_account_is_active() to authenticated;

create function public.ra_revoke_account_sessions() returns void
language sql security definer set search_path='' as $$
 update public.ra_account_security
 set sessions_valid_after=date_trunc('second',clock_timestamp()),updated_at=clock_timestamp()
 where user_id=(select auth.uid());
$$;
revoke all on function public.ra_revoke_account_sessions() from public,anon;
grant execute on function public.ra_revoke_account_sessions() to authenticated;

commit;
