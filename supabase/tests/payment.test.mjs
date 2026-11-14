import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('PASS ' + name);
}
async function rows(sql, params = []) {
  return (await db.query(sql, params)).rows;
}
async function user(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function admin() {
  await db.exec('reset role');
}

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  await db.exec(await readFile(new URL('../migrations/20261010170000_private_accounts.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)', [first, second]);
  await db.query("insert into public.ra_entitlements(user_id,product_id) values($1,'go-blueprint-audiobook')", [first]);
  await db.exec(`create table public.ra_listening_sessions(
    user_id uuid primary key references auth.users(id) on delete cascade,
    device_id text not null default 'device',
    track_id text not null default 'chapter-01',
    last_seen_at timestamptz not null default now()
  );`);
  await db.exec(await readFile(new URL('../migrations/20261011120000_payments.sql', import.meta.url), 'utf8'));

  await check('existing entitlement receives a legacy source', async () => {
    const result = await rows('select source_id from public.ra_entitlement_sources where user_id=$1', [first]);
    assert.equal(result.length, 1);
    assert.match(result[0].source_id, /^legacy:/);
  });

  await check('duplicate grant source is idempotent', async () => {
    await db.query("select public.ra_grant_entitlement($1,'go-blueprint-deepening','mollie:tr_Test123')", [second]);
    await db.query("select public.ra_grant_entitlement($1,'go-blueprint-deepening','mollie:tr_Test123')", [second]);
    assert.equal((await rows('select * from public.ra_entitlement_sources where user_id=$1', [second])).length, 1);
    assert.equal((await rows('select * from public.ra_entitlements where user_id=$1', [second])).length, 1);
  });

  await check('revoking one source preserves entitlement backed by another source', async () => {
    await db.query("select public.ra_grant_entitlement($1,'go-blueprint-audiobook','mollie:tr_Second')", [first]);
    await db.query("select public.ra_revoke_entitlement_source($1,'go-blueprint-audiobook','mollie:tr_Second')", [first]);
    assert.equal((await rows("select * from public.ra_entitlements where user_id=$1 and product_id='go-blueprint-audiobook'", [first])).length, 1);
  });

  await check('last refunded source removes access and active listening session', async () => {
    await db.query("insert into public.ra_listening_sessions(user_id) values($1)", [second]);
    await db.query("select public.ra_revoke_entitlement_source($1,'go-blueprint-deepening','mollie:tr_Test123')", [second]);
    assert.equal((await rows('select * from public.ra_entitlements where user_id=$1', [second])).length, 0);
    assert.equal((await rows('select * from public.ra_listening_sessions where user_id=$1', [second])).length, 0);
  });

  await check('customer cannot read payment or entitlement-source tables', async () => {
    await user(first);
    await assert.rejects(() => db.query('select * from public.ra_payment_orders'), error => error.code === '42501');
    await assert.rejects(() => db.query('select * from public.ra_entitlement_sources'), error => error.code === '42501');
  });

  await check('global sign-out release removes only current user listening session', async () => {
    await admin();
    await db.query("insert into public.ra_listening_sessions(user_id) values($1),($2)", [first, second]);
    await user(first);
    await db.query('select public.ra_release_all_listening_sessions()');
    await admin();
    assert.equal((await rows('select * from public.ra_listening_sessions where user_id=$1', [first])).length, 0);
    assert.equal((await rows('select * from public.ra_listening_sessions where user_id=$1', [second])).length, 1);
  });

  await db.exec('alter table auth.users add column email text, add column email_confirmed_at timestamptz');
  await db.query('update auth.users set email=$1,email_confirmed_at=now() where id=$2',['first@example.com',first]);
  await db.query('update auth.users set email=$1 where id=$2',['second@example.com',second]);
  await db.exec(await readFile(new URL('../migrations/20261024140000_guest_checkout.sql',import.meta.url),'utf8'));
  const guest='30000000-0000-4000-8000-000000000001';
  await db.query("insert into public.ra_guest_payment_orders(order_id,claim_hash,payment_id,email,product_id,amount) values($1,$2,'tr_GuestPaid','second@example.com','go-blueprint-deepening','21.21')",[guest,'a'.repeat(64)]);
  await check('guest checkout creates no user and unpaid orders cannot grant access',async()=>{
    assert.equal((await rows('select * from auth.users')).length,2);
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[second]))[0].count,0);
    await db.query("update public.ra_guest_payment_orders set status='paid',access_allowed=true where order_id=$1",[guest]);
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[second]))[0].count,0);
  });
  await check('only the confirmed purchasing email can claim paid guest orders; retries stay idempotent',async()=>{
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[first]))[0].count,0);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[second]);
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[second]))[0].count,1);
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[second]))[0].count,1);
    assert.equal((await rows("select * from public.ra_entitlement_sources where source_id='mollie:tr_GuestPaid'")).length,1);
    assert.equal((await rows('select claimed_by from public.ra_guest_payment_orders where order_id=$1',[guest]))[0].claimed_by,second);
  });
  await check('revoked guest order cannot regain access through account activation',async()=>{
    await db.query('update public.ra_guest_payment_orders set access_allowed=false where order_id=$1',[guest]);
    await db.query("select public.ra_revoke_entitlement_source($1,'go-blueprint-deepening','mollie:tr_GuestPaid')",[second]);
    assert.equal((await rows('select public.ra_claim_guest_orders($1) as count',[second]))[0].count,0);
    assert.equal((await rows("select * from public.ra_entitlements where user_id=$1 and product_id='go-blueprint-deepening'",[second])).length,0);
  });
  await check('guest payment data and service-only claim functions are inaccessible to customers',async()=>{
    await user(first);
    await assert.rejects(()=>db.query('select * from public.ra_guest_payment_orders'),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select public.ra_claim_guest_orders($1)',[first]),e=>e.code==='42501');
    await admin();await db.exec('set role anon');
    await assert.rejects(()=>db.query('select * from public.ra_guest_payment_orders'),e=>e.code==='42501');
    await assert.rejects(()=>db.query('select * from public.ra_guest_customer($1)',[guest]),e=>e.code==='42501');
    await admin();
  });

  console.log(`${passed} payment and entitlement database assertions passed locally.`);
} finally {
  await db.close();
}
