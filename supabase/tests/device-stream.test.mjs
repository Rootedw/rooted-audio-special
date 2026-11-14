import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
async function user(id){await db.exec('reset role; set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function admin(){await db.exec('reset role');}
async function rows(sql,params=[]){return (await db.query(sql,params)).rows;}
async function denied(sql,params=[]){await assert.rejects(()=>db.query(sql,params),e=>e.code==='42501');}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../migrations/20261010170000_private_accounts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/20261010173000_device_stream_security.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users(id) values($1)',[ids[0]]);
 await db.query('insert into public.ra_entitlements(user_id,product_id) values($1,$2)',[ids[0],'go-blueprint-audiobook']);
 const d1='20000000-0000-4000-8000-000000000001',d2='20000000-0000-4000-8000-000000000002',d3='20000000-0000-4000-8000-000000000003';
 const s1='30000000-0000-4000-8000-000000000001',s2='30000000-0000-4000-8000-000000000002',proof='a'.repeat(64),bad='b'.repeat(64),product='go-blueprint-audiobook';
 async function register(d,p=proof){return (await rows('select public.ra_register_verified_device($1,$2,$3,$4) as result',[ids[0],d,p,'Test device']))[0].result;}
 async function claim(d,s,p=proof,prod=product){return (await rows('select public.ra_claim_stream($1,$2,$3,$4,$5) as result',[ids[0],d,p,s,prod]))[0].result;}
 async function valid(d,s,p=proof,prod=product){return (await rows('select public.ra_check_stream($1,$2,$3,$4,$5) as ok',[ids[0],d,p,s,prod]))[0].ok;}
 await db.exec('set role service_role');
 await check('first verified device admitted',async()=>assert.equal(await register(d1),'OK'));
 await check('second verified device admitted',async()=>assert.equal(await register(d2),'OK'));
 await check('third device refused',async()=>assert.equal(await register(d3),'DEVICE_LIMIT'));
 await check('device proof cannot be replaced',async()=>assert.equal(await register(d1,bad),'DEVICE_PROOF_INVALID'));
 await check('first stream starts',async()=>assert.equal(await claim(d1,s1),'OK'));
 await check('stream authorization valid',async()=>assert.equal(await valid(d1,s1),true));
 await check('second device stream refused',async()=>assert.equal(await claim(d2,s2),'STREAM_ACTIVE'));
 await check('second tab on same device refused',async()=>assert.equal(await claim(d1,s2),'STREAM_ACTIVE'));
 await check('same stream heartbeat renews',async()=>assert.equal(await claim(d1,s1),'OK'));
 await check('wrong device proof refused',async()=>assert.equal(await claim(d1,s1,bad),'DEVICE_UNVERIFIED'));
 await check('bundle stream denied to audiobook owner',async()=>assert.equal(await claim(d1,s1,proof,'go-blueprint-deepening'),'PRODUCT_REQUIRED'));
 await check('wrong stream cannot release current lease',async()=>{await db.query('select public.ra_release_stream($1,$2,$3,$4)',[ids[0],d1,proof,s2]);assert.equal(await valid(d1,s1),true);});
 await check('device revocation immediately invalidates lease',async()=>{await db.query('select public.ra_revoke_device($1,$2)',[ids[0],d1]);assert.equal(await valid(d1,s1),false);});
 await check('revoked device cannot re-register itself',async()=>assert.equal(await register(d1),'DEVICE_REVOKED'));
 await check('revoked device cannot listen',async()=>assert.equal(await claim(d1,s1),'DEVICE_UNVERIFIED'));
 await check('replacement device allowed after revocation',async()=>assert.equal(await register(d3),'OK'));
 await check('other verified device can start after revocation',async()=>assert.equal(await claim(d2,s2),'OK'));
 await db.query('delete from public.ra_entitlements where user_id=$1',[ids[0]]);
 await check('refund removes valid stream authorization',async()=>assert.equal(await valid(d2,s2),false));
 await check('refunded account cannot renew',async()=>assert.equal(await claim(d2,s2),'PRODUCT_REQUIRED'));
 await db.query('insert into public.ra_entitlements(user_id,product_id) values($1,$2)',[ids[0],product]);
 await db.query('update public.ra_account_security set blocked=true where user_id=$1',[ids[0]]);
 await check('blocked account invalidates stream',async()=>assert.equal(await valid(d2,s2),false));
 await check('blocked account cannot claim',async()=>assert.equal(await claim(d2,s2),'ACCOUNT_UNAVAILABLE'));
 await admin();await user(ids[0]);
 await check('customer cannot directly register verified device',()=>denied('select public.ra_register_verified_device($1,$2,$3,$4)',[ids[0],d1,proof,'Fake']));
 await check('customer cannot directly claim server lease',()=>denied('select public.ra_claim_stream($1,$2,$3,$4,$5)',[ids[0],d2,proof,s2,product]));
 await check('customer cannot read device secret hashes',()=>denied('select * from public.ra_devices'));
 console.log(`${passed} device/stream database assertions passed locally; provider email verification, endpoint integration, real concurrent requests and media playback are NOT tested.`);
}finally{await db.close();}
