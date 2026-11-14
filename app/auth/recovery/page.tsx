import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, KeyRound } from 'lucide-react';
import { accountLanguage } from '../../../lib/standalone/auth-policy';
import { recoveryTokenHash } from '../../../lib/standalone/recovery';
import AccountFrame from '../account-frame';
import RecoveryForm from './recovery-form';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const lang = accountLanguage(params.lang);
  const nl = lang === 'nl';
  const token = recoveryTokenHash(params.token_hash);
  const valid = Boolean(token) && !params.error;
  const languageLink = (language: string) => '?lang=' + language + (token ? '&token_hash=' + encodeURIComponent(token) : '') + (params.error ? '&error=verification' : '');
  return <AccountFrame lang={lang} mode="recovery" languageLinks={{ nl: languageLink('nl'), en: languageLink('en') }}>
    <div className="ra-form-heading"><p className="ra-eyebrow">ROOTED AUDIO · YOUR SPACE</p><div className="ra-heading-icon"><KeyRound size={24} aria-hidden="true" /></div><h1>{nl ? 'Terug naar je account.' : 'Back to your account.'}</h1><p>{valid ? (nl ? 'Bevestig hieronder je herstelmail. Daarna kies je zelf een nieuw wachtwoord.' : 'Confirm your recovery email below. Then choose your new password.') : (nl ? 'Deze herstellink is niet geldig of is al gebruikt. Vraag een nieuwe herstelmail aan om verder te gaan.' : 'This recovery link is invalid or has already been used. Request a new recovery email to continue.')}</p></div>
    {valid ? <RecoveryForm lang={lang} token={token || ''} /> : <div className="ra-recovery-action"><a className="ra-primary" href={'/auth/reset?lang=' + lang}>{nl ? 'NIEUWE HERSTELMAIL AANVRAGEN' : 'REQUEST A NEW RECOVERY EMAIL'}<ArrowUpRight size={19} aria-hidden="true" /></a></div>}
    <div className="ra-form-bottom">{valid && <p><a href={'/auth/reset?lang=' + lang}>{nl ? 'Nieuwe herstelmail aanvragen' : 'Request a new recovery email'} <ArrowUpRight size={14} aria-hidden="true" /></a></p>}<a className="ra-back-link" href={'/auth/login?lang=' + lang}><ArrowLeft size={14} aria-hidden="true" />{nl ? 'Terug naar inloggen' : 'Back to sign in'}</a></div>
  </AccountFrame>;
}
