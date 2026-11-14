import {NextResponse} from 'next/server';
import {createAccountClient} from '../../../../lib/standalone/auth-server';
import {accountLanguage} from '../../../../lib/standalone/auth-policy';
import {accountEmailAllowed,registrationMode} from '../../../../lib/standalone/test-access';
import {verifyRecoveryToken} from '../../../../lib/standalone/recovery';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const configured=process.env.ROOTED_APP_ORIGIN;
 if(!configured)return new Response('Account service unavailable',{status:503});
 let origin:string;
 try {origin=new URL(configured).origin;} catch {return new Response('Account service unavailable',{status:503});}
 const requestOrigin=request.headers.get('origin');
 const fetchSite=request.headers.get('sec-fetch-site');
 // Referrer-Policy:no-referrer makes native form navigation use Origin:null.
 // Accept it only with browser-controlled, explicitly same-origin Fetch Metadata.
 const opaqueSameOrigin=requestOrigin==='null' && fetchSite==='same-origin';
 if(fetchSite==='cross-site' || !requestOrigin ||
    (!opaqueSameOrigin && ![origin,new URL(request.url).origin].includes(requestOrigin)))
   return new Response('Invalid origin',{status:403});
 if(request.headers.get('content-type')?.split(';',1)[0].trim()!=='application/x-www-form-urlencoded')
   return new Response('Invalid form',{status:415});
 const form=await request.formData().catch(()=>null);
 const lang=accountLanguage(form?.get('lang'));
 let verified=false;
 try {
   const client=await createAccountClient();
   verified=await verifyRecoveryToken(client,form?.get('token_hash'),email=>accountEmailAllowed(
     email,registrationMode(process.env.ROOTED_REGISTRATION_MODE),process.env.ROOTED_TEST_ALLOWED_EMAILS));
 }catch { /* Never include recovery secrets in the response or logs. */ }
 const path=verified?'/auth/password?lang='+lang:'/auth/recovery?lang='+lang+'&error=verification';
 const response=NextResponse.redirect(new URL(path,origin),303);
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('Referrer-Policy','no-referrer');
 return response;
}
