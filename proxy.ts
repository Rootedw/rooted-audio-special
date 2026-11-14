import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {accountEmailAllowed,registrationMode,testEntryPath,paymentWebhookRequest} from './lib/standalone/test-access';
import {readPurchaseIntent,purchaseReturnPath} from './lib/purchase-intent';
export async function proxy(request:NextRequest){
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'};
  const unavailable=()=>new NextResponse('Private test environment',{status:503,headers});
  const token=process.env.ROOTED_TEST_ACCESS_TOKEN;
  const automated=!!token && request.headers.get('x-rooted-test-access')===token;
  const allowed=process.env.ROOTED_TEST_ALLOWED_EMAILS;
  const mode=registrationMode(process.env.ROOTED_REGISTRATION_MODE);
  if(!automated && mode==='invite' && !allowed?.trim()) return unavailable();
  let response=NextResponse.next({request});
  // Mollie has no browser session. Only this exact POST reaches its verifying handler.
  if(paymentWebhookRequest(request.nextUrl.pathname,request.method)){
    for(const [name,value] of Object.entries(headers)) response.headers.set(name,value);
    return response;
  }
  if(!automated && testEntryPath(request.nextUrl.pathname)){
    for(const [name,value] of Object.entries(headers)) response.headers.set(name,value);
    return response;
  }
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url || !key) return unavailable();
  const client=createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:values=>{for(const {name,value} of values)request.cookies.set(name,value);response=NextResponse.next({request});for(const {name,value,options} of values)response.cookies.set(name,value,options);}
  }});
  try{
    const {data,error}=await client.auth.getUser();
    if(!automated){
      const verified=!error && !!data.user?.email_confirmed_at && accountEmailAllowed(data.user?.email,mode,allowed);
      const active=verified ? await client.rpc('ra_account_is_active') : null;
      if(!verified || active?.error || active?.data!==true){
        if(request.nextUrl.pathname.startsWith('/api/'))return new NextResponse('Access unavailable',{status:403,headers});
        const intent=readPurchaseIntent(request.nextUrl.pathname+request.nextUrl.search);
        const destination=new URL(request.nextUrl.pathname==='/'&&!intent?'/shop':'/auth/login',request.url);
        if(request.nextUrl.searchParams.get('lang')==='en')destination.searchParams.set('lang','en');
        if(intent)destination.searchParams.set('return_to',purchaseReturnPath(intent));
        const denied=NextResponse.redirect(destination);
        for(const cookie of response.cookies.getAll())denied.cookies.set(cookie);
        for(const [name,value] of Object.entries(headers))denied.headers.set(name,value);
        return denied;
      }
    }
  }catch{return unavailable();}
  for(const [name,value] of Object.entries(headers))response.headers.set(name,value);
  return response;
}
export const config={matcher:['/:path*']};
