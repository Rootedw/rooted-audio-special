import {NextRequest,NextResponse} from 'next/server';
import {createAccountClient} from '../../../lib/standalone/auth-server';
import {safeReturnPath,accountLanguage} from '../../../lib/standalone/auth-policy';
import {cookies} from 'next/headers';
import {PURCHASE_INTENT_COOKIE,purchaseContinuation} from '../../../lib/purchase-intent';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code'); const lang=accountLanguage(request.nextUrl.searchParams.get('lang'));
 const origin=process.env.ROOTED_APP_ORIGIN;
 if(!origin)return new NextResponse('Account service unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
 const tokenHash=request.nextUrl.searchParams.get('token_hash');
 const remembered=(await cookies()).get(PURCHASE_INTENT_COOKIE)?.value;
 const returnTo=purchaseContinuation(request.nextUrl.searchParams.get('next'),remembered)||safeReturnPath(request.nextUrl.searchParams.get('next'));
 if(tokenHash && request.nextUrl.searchParams.get('type')==='recovery'){
   const destination=new URL('/auth/recovery',origin);
   destination.searchParams.set('lang',lang);
   destination.searchParams.set('token_hash',tokenHash);
   const response=NextResponse.redirect(destination);
   response.headers.set('Cache-Control','private, no-store');
   response.headers.set('Referrer-Policy','no-referrer');
   return response;
 }
 try{if(code){const {data,error}=await(await createAccountClient()).auth.exchangeCodeForSession(code);if(!error){const destination=purchaseContinuation(returnTo,data?.user?.user_metadata?.purchase_return_to)||returnTo;const response=NextResponse.redirect(new URL(destination,origin));response.headers.set('Cache-Control','private, no-store');return response;}}}catch{}
 const failed=new URL('/auth/login',origin);failed.searchParams.set('lang',lang);failed.searchParams.set('error','verification');if(returnTo!=='/')failed.searchParams.set('return_to',returnTo);
 return NextResponse.redirect(failed);
}
