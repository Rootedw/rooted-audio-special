import AccountFrame from '../account-frame';
import ActivationForm from './activation-form';
import { accountLanguage } from '../../../lib/standalone/auth-policy';
import { recoveryTokenHash } from '../../../lib/standalone/recovery';
import { payFirstEnabled } from '../../../lib/guest-payment-policy';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!payFirstEnabled()) redirect('/shop');
  const params = await searchParams; const lang = accountLanguage(params.lang); const nl = lang === 'nl';
  const token = recoveryTokenHash(params.token_hash); const valid = token && !params.error;
  return <AccountFrame lang={lang} mode="activate"><div className="ra-form-heading"><p className="ra-eyebrow">ROOTED AUDIO · YOUR SPACE</p><h1>{nl ? 'Jouw luisterplek wacht op je.' : 'Your listening space is waiting.'}</h1><p>{valid ? (nl ? 'Bevestig je activatiemail. Daarna kies je zelf een wachtwoord en krijg je toegang tot je aankoop.' : 'Confirm your activation email. Then choose your password and access your purchase.') : (nl ? 'Deze activatielink is ongeldig of verlopen. Je aankoop blijft bewaard. Vraag een nieuwe activatiemail aan of neem contact op met info@rooted-within.nl.' : 'This activation link is invalid or expired. Your purchase remains saved. Request a new activation email or contact info@rooted-within.nl.')}</p></div>{valid ? <ActivationForm lang={lang} token={token} /> : <ActivationForm lang={lang} />}</AccountFrame>;
}
