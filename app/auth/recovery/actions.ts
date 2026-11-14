"use server";
import {redirect} from 'next/navigation';
import {createAccountClient} from '../../../lib/standalone/auth-server';
import {accountLanguage} from '../../../lib/standalone/auth-policy';
import {accountEmailAllowed,registrationMode} from '../../../lib/standalone/test-access';
import {verifyRecoveryToken} from '../../../lib/standalone/recovery';
export async function confirmRecovery(form:FormData) {
  const lang=accountLanguage(form.get('lang'));
  let verified=false;
  try {
    const client=await createAccountClient();
    verified=await verifyRecoveryToken(client,form.get('token_hash'),email=>accountEmailAllowed(
      email,registrationMode(process.env.ROOTED_REGISTRATION_MODE),process.env.ROOTED_TEST_ALLOWED_EMAILS,
    ));
  } catch { /* A fresh email can be requested without exposing auth details. */ }
  redirect(verified?'/auth/password?lang='+lang:'/auth/recovery?lang='+lang+'&error=verification');
}
