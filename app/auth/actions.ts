"use server";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { PURCHASE_INTENT_COOKIE, purchaseContinuation, readPurchaseIntent } from '../../lib/purchase-intent';
import { createAccountClient } from '../../lib/standalone/auth-server';
import { accountLanguage, safeReturnPath } from '../../lib/standalone/auth-policy';
import { accountEmailAllowed, registrationMode } from '../../lib/standalone/test-access';
import { payFirstEnabled } from '../../lib/guest-payment-policy';
import { claimGuestOrders } from '../../lib/standalone/guest-payments';
export type AccountResult = { status: 'idle'|'error'|'sent'; message: string };
export async function accountAction(_: AccountResult, form: FormData): Promise<AccountResult> {
  const lang = accountLanguage(form.get('lang'));
  const fail = (nl: string, en: string): AccountResult => ({status:'error',message:lang==='nl'?nl:en});
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const mode = String(form.get('mode'));
  if (!['login','register','reset','password','activate'].includes(mode)) return fail('Ongeldige aanvraag.','Invalid request.');
  if (mode === 'register' && payFirstEnabled()) return fail('Kies en betaal eerst je product. Daarna ontvang je de activatielink voor je account.','Choose and pay for your product first. Your account activation link follows after payment.');
  if (!['password','activate'].includes(mode) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return fail('Vul een geldig e-mailadres in.','Enter a valid email address.');
  const accessMode = registrationMode(process.env.ROOTED_REGISTRATION_MODE);
  if (!['password','activate'].includes(mode) && !accountEmailAllowed(email,accessMode,process.env.ROOTED_TEST_ALLOWED_EMAILS)) return fail('Deze testomgeving is alleen op uitnodiging beschikbaar.','This test environment is available by invitation only.');
  if (mode !== 'reset' && (password.length < 12 || password.length > 128)) return fail('Gebruik een wachtwoord van 12 tot 128 tekens.','Use a password with 12 to 128 characters.');
  let success = false;
  let returnTo = safeReturnPath(form.get('return_to'));
  try {
    const client = await createAccountClient();
    const origin = process.env.ROOTED_APP_ORIGIN;
    if (!origin || new URL(origin).protocol !== 'https:') return fail('Accountbeheer is nog niet aangesloten.','Account services are not connected yet.');
    const cookieStore = await cookies();
    returnTo = purchaseContinuation(returnTo, cookieStore.get(PURCHASE_INTENT_COOKIE)?.value) || returnTo;
    if ((mode === 'login' || mode === 'register') && readPurchaseIntent(returnTo)) cookieStore.set(PURCHASE_INTENT_COOKIE, returnTo, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 });
    const callback = new URL('/auth/callback', origin); callback.searchParams.set('lang',lang);
    if (mode === 'login') {
      const {data,error} = await client.auth.signInWithPassword({email,password});
      if (error || !data.user?.email_confirmed_at) return fail('Inloggen lukt niet. Controleer je gegevens en bevestig je e-mail.','Unable to sign in. Check your details and confirm your email.');
      returnTo = purchaseContinuation(returnTo, data.user.user_metadata?.purchase_return_to) || returnTo;
      const active=await client.rpc('ra_account_is_active');
      if(active.error || active.data!==true){
        await client.auth.signOut({scope:'local'});
        return fail('Je account is momenteel niet beschikbaar. Neem contact met ons op.','Your account is currently unavailable. Please contact us.');
      }
      success = true;
    } else if (mode === 'register') {
      const {error} = await client.auth.signUp({email,password,options:{emailRedirectTo:callback.toString(),data:{language:lang,...(readPurchaseIntent(returnTo)?{purchase_return_to:returnTo}:{})}}});
      if (error) return fail('Registratie lukt nu niet. Probeer het later opnieuw.','Registration is unavailable. Please try again later.');
    } else if (mode === 'reset') {
      callback.searchParams.set('next','/auth/password?lang='+lang);
      // Generic response prevents account enumeration.
      await client.auth.resetPasswordForEmail(email,{redirectTo:callback.toString()});
    } else if (mode === 'activate') {
      const {data,error} = await client.auth.getUser();
      if (!payFirstEnabled() || error || !data.user?.email_confirmed_at || !accountEmailAllowed(data.user.email,accessMode,process.env.ROOTED_TEST_ALLOWED_EMAILS) || !data.user.user_metadata?.paid_activation_pending) return fail('Open eerst je activatielink.','Open your activation link first.');
      if (!(await claimGuestOrders(data.user.id))) return fail('Er is nog geen bevestigde aankoop voor dit account.','No confirmed purchase is available for this account yet.');
      const changed = await client.auth.updateUser({password,data:{paid_activation_pending:false}});
      if (changed.error) return fail('Activeren lukt nu niet. Probeer opnieuw.','Unable to activate right now. Please try again.');
      returnTo='/'; success=true;
    } else {
      const {data,error} = await client.auth.getUser();
      if (error || !data.user?.email_confirmed_at || !accountEmailAllowed(data.user.email,accessMode,process.env.ROOTED_TEST_ALLOWED_EMAILS)) return fail('Open eerst de link uit je herstelmail.','Open the link in your recovery email first.');
      const changed = await client.auth.updateUser({password});
      if (changed.error) return fail('Wijzigen lukt nu niet. Probeer opnieuw.','Unable to update your password. Please retry.');
      await client.rpc('ra_release_all_listening_sessions');
      const revoked = await client.rpc('ra_revoke_account_sessions');
      if (revoked.error) return fail('Sessies intrekken lukt nu niet. Probeer opnieuw.','Unable to revoke active sessions. Please retry.');
      await client.auth.signOut({scope:'global'});
      success = true;
    }
  } catch { return fail('Accountbeheer is tijdelijk niet beschikbaar.','Account services are temporarily unavailable.'); }
  if (success) redirect(mode==='password'?'/auth/login?lang='+lang:returnTo);
  return {status:'sent',message:lang==='nl'?'Controleer je e-mail. Als de aanvraag kan worden verwerkt, ontvang je een link.':'Check your email. If the request can be processed, you will receive a link.'};
}
export async function signOutAccount(form: FormData) {
  const lang = accountLanguage(form.get('lang'));
  try {
    const client = await createAccountClient();
    await client.rpc('ra_release_all_listening_sessions');
    const revoked = await client.rpc('ra_revoke_account_sessions');
    if (revoked.error) throw revoked.error;
    await client.auth.signOut({scope:'global'});
  } catch { throw new Error('Sign out could not be completed. Please retry.'); }
  redirect('/auth/login?lang='+lang);
}
