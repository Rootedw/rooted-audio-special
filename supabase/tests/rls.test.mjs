import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
async function user(id,iat=Math.floor(Date.now()/1000)-60){await db.exec('reset role; set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,iat})]);}
async function admin(){await db.exec('reset role');}
async function rows(sql,params=[]){return (await db.query(sql,params)).rows;}
async function denied(sql,params=[]){await assert.rejects(()=>db.query(sql,params),e=>e.code==='42501');}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../migrations/20261010170000_private_accounts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../migrations/20261012203000_session_revocation.sql',import.meta.url),'utf8'));
 await check('migration enables RLS on all five private tables',async()=>{const r=await rows("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ra_%' and c.relkind='r'");assert.equal(r.length,5);assert.ok(r.every(x=>x.relrowsecurity));});
 for(let i=0;i<3;i++)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[ids[i],{language:i===1?'en':'nl'}]);
 await db.query('insert into public.ra_entitlements(user_id,product_id) values($1,$2),($3,$4)',[ids[0],'go-blueprint-audiobook',ids[1],'go-blueprint-deepening']);
 await db.query('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[1],'ra-workbook',{answer:'PRIVATE B'}]);
 await check('new account trigger initializes language',async()=>assert.equal((await rows('select language from public.ra_profiles where user_id=$1',[ids[1]]))[0].language,'en'));
 await user(ids[0]);
 await check('audiobook owner has main access',async()=>assert.equal((await rows("select public.ra_has_product('go-blueprint-audiobook') as ok"))[0].ok,true));
 await check('audiobook owner has no bundle access',async()=>assert.equal((await rows("select public.ra_has_product('go-blueprint-deepening') as ok"))[0].ok,false));
 await check('A cannot read B private writing',async()=>assert.equal((await rows('select * from public.ra_user_preferences where user_id=$1',[ids[1]])).length,0));
 await check('A cannot read B profile',async()=>assert.equal((await rows('select * from public.ra_profiles where user_id=$1',[ids[1]])).length,0));
 await check('A can save own reflections',async()=>{await db.query('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[0],'ra-reflections',{text:'PRIVATE A'}]);assert.equal((await rows("select value from public.ra_user_preferences where preference_key='ra-reflections'"))[0].value.text,'PRIVATE A');});
 await check('A can edit and retrieve own reflections',async()=>{await db.query("update public.ra_user_preferences set value=$1 where preference_key='ra-reflections'",[{text:'EDITED A'}]);assert.equal((await rows("select value from public.ra_user_preferences where preference_key='ra-reflections'"))[0].value.text,'EDITED A');});
 await check('A cannot write B reflections',()=>denied('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[1],'ra-reflections',{}]));
 await check('A cannot open own workbook without bundle',()=>denied('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[0],'ra-workbook',{}]));
 await check('A cannot grant self paid bundle',()=>denied('insert into public.ra_entitlements(user_id,product_id) values($1,$2)',[ids[0],'go-blueprint-deepening']));
 await check('customer cannot change blocked state',()=>denied('update public.ra_account_security set blocked=false'));
 await check('customer cannot read legacy mapping',()=>denied('select * from public.ra_legacy_identity_map'));
 await check('A cannot edit B profile',async()=>{await db.query('update public.ra_profiles set first_name=$1 where user_id=$2',['BAD',ids[1]]);});
 await admin();await check('B profile remained untouched',async()=>assert.equal((await rows('select first_name from public.ra_profiles where user_id=$1',[ids[1]]))[0].first_name,''));
 await user(ids[1]);
 await check('bundle includes main and deepening',async()=>{for(const p of ['go-blueprint-audiobook','go-blueprint-deepening'])assert.equal((await rows('select public.ra_has_product($1) as ok',[p]))[0].ok,true);});
 await check('B cannot read A reflection',async()=>assert.equal((await rows('select * from public.ra_user_preferences where user_id=$1',[ids[0]])).length,0));
 await check('B can edit and retrieve workbook',async()=>{await db.query("update public.ra_user_preferences set value=$1 where preference_key='ra-workbook'",[{answer:'UPDATED B'}]);assert.equal((await rows("select value from public.ra_user_preferences where preference_key='ra-workbook'"))[0].value.answer,'UPDATED B');});
 await user(ids[2]);
 await check('new unpaid account receives no product access',async()=>assert.equal((await rows("select public.ra_has_product('go-blueprint-audiobook') as ok"))[0].ok,false));
 await check('unpaid account can save language',()=>db.query('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[2],'ra-language',JSON.stringify('en')]));
 await check('unpaid account cannot save paid writing',()=>denied('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[2],'ra-reflections',{}]));
 await admin();await db.query('update public.ra_account_security set blocked=true where user_id=$1',[ids[1]]);await user(ids[1]);
 await check('blocked account loses product access',async()=>assert.equal((await rows("select public.ra_has_product('go-blueprint-audiobook') as ok"))[0].ok,false));
 await check('blocked account cannot read private writing',async()=>assert.equal((await rows('select * from public.ra_user_preferences')).length,0));
 await check('blocked account cannot edit profile',async()=>assert.equal((await rows("update public.ra_profiles set first_name='BAD' returning user_id")).length,0));
 await admin();await db.exec('set role anon');
 await check('anonymous cannot read private writing',()=>denied('select * from public.ra_user_preferences'));
 await check('anonymous cannot use entitlement function',()=>denied("select public.ra_has_product('go-blueprint-audiobook')"));
 await admin();await user(ids[0]);
 await check('customer can delete own reflection',async()=>{await db.query("delete from public.ra_user_preferences where preference_key='ra-reflections'");assert.equal((await rows("select * from public.ra_user_preferences where preference_key='ra-reflections'")).length,0);});
 await check('customer cannot write unknown preference key',async()=>assert.rejects(()=>db.query('insert into public.ra_user_preferences(user_id,preference_key,value) values($1,$2,$3)',[ids[0],'admin-access',{}]),e=>e.code==='23514'));
 await check('global session revocation immediately rejects the current token',async()=>{await db.query('select public.ra_revoke_account_sessions()');assert.equal((await rows('select public.ra_account_is_active() as ok'))[0].ok,false);});
 await user(ids[0],Math.floor(Date.now()/1000)+60);
 await check('a newly issued token works after global session revocation',async()=>assert.equal((await rows('select public.ra_account_is_active() as ok'))[0].ok,true));
 console.log(`${passed} database assertions passed. Local PostgreSQL engine with synthetic auth identities; not a hosted Supabase integration test.`);
}finally{await db.close();}
