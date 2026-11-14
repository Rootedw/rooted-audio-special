import { NextResponse } from 'next/server';
import { createAccountClient } from '../../../../lib/standalone/auth-server';
import { accountLanguage } from '../../../../lib/standalone/auth-policy';
import { recoveryTokenHash } from '../../../../lib/standalone/recovery';
import { accountEmailAllowed, registrationMode } from '../../../../lib/standalone/test-access';
import { payFirstEnabled } from '../../../../lib/guest-payment-policy';
import { claimGuestOrders } from '../../../../lib/standalone/guest-payments';
export async function POST(request: Request) {
  if (!payFirstEnabled()) return new Response('Unavailable', { status: 403 });
  const configured = process.env.ROOTED_APP_ORIGIN;
  if (!configured) return new Response('Unavailable', { status: 503 });
  let allowedOrigin: string;
  try { allowedOrigin = new URL(configured).origin; } catch { return new Response('Unavailable', { status: 503 }); }
  const requestOrigin = request.headers.get('origin'); const fetchSite = request.headers.get('sec-fetch-site');
  const opaqueSameOrigin = requestOrigin === 'null' && fetchSite === 'same-origin';
  if (fetchSite === 'cross-site' || !requestOrigin || (!opaqueSameOrigin && ![allowedOrigin, new URL(request.url).origin].includes(requestOrigin))) return new Response('Invalid origin', { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response('Invalid', { status: 415 });
  const form = await request.formData().catch(() => null); const lang = accountLanguage(form?.get('lang')); const token = recoveryTokenHash(form?.get('token_hash'));
  let verified = false;
  try {
    if (token) {
      const client = await createAccountClient(); const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: 'invite' });
      verified = !error && !!data.user?.email_confirmed_at && accountEmailAllowed(data.user.email, registrationMode(process.env.ROOTED_REGISTRATION_MODE), process.env.ROOTED_TEST_ALLOWED_EMAILS) && (await claimGuestOrders(data.user.id)) > 0;
      if (!verified) await client.auth.signOut({ scope: 'local' });
    }
  } catch { verified = false; }
  const origin = process.env.ROOTED_APP_ORIGIN;
  if (!origin || new URL(origin).protocol !== 'https:') return new Response('Unavailable', { status: 503 });
  const response = NextResponse.redirect(new URL((verified ? '/auth/activate/password?lang=' : '/auth/activate?error=verification&lang=') + lang, origin), 303);
  response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
