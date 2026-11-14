import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createAccountClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Account service is not configured");
  const store = await cookies();
  const client = createServerClient(url,key,{
    cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV === 'production',sameSite:'lax',path:'/'},
    cookies:{getAll:()=>store.getAll(),setAll:values=>{
      try { for (const {name,value,options} of values) store.set(name,value,options); } catch {
        // Server Components cannot set cookies. The proxy refreshes them first.
      }
    }},
  });
  return client;
}
export async function getVerifiedAccount() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const client = await createAccountClient();
  const {data,error} = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at || !data.user.email) return null;
  const active=await client.rpc('ra_account_is_active');
  if(active.error || active.data !== true) return null;
  return {userId:data.user.id,email:data.user.email,fullName:null,displayName:data.user.email};
}
