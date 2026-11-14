"use client";
import { useActionState, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { readPurchaseIntent, purchaseReturnPath } from '../../lib/purchase-intent';
import { PRODUCTS } from '../../lib/products';
import { accountAction, type AccountResult } from './actions';
import AccountFrame from './account-frame';

const copy = {
  nl: { login: 'Welkom terug.', register: 'Je eigen luisterplek.', reset: 'Wachtwoord vergeten?', password: 'Een nieuw wachtwoord.', activate: 'Activeer jouw luisterplek.', email: 'E-mailadres', pass: 'Wachtwoord', loginButton: 'INLOGGEN', registerButton: 'ACCOUNT AANMAKEN', resetButton: 'STUUR MIJ EEN HERSTELLINK', passwordButton: 'WACHTWOORD OPSLAAN', activateButton: 'ACTIVEER MIJN ACCOUNT', waiting: 'Even geduld…', forgot: 'Wachtwoord vergeten?', show: 'Wachtwoord tonen', hide: 'Wachtwoord verbergen' },
  en: { login: 'Welcome back.', register: 'Your own listening space.', reset: 'Forgot your password?', password: 'A new password.', activate: 'Activate your listening space.', email: 'Email address', pass: 'Password', loginButton: 'SIGN IN', registerButton: 'CREATE ACCOUNT', resetButton: 'SEND ME A RECOVERY LINK', passwordButton: 'SAVE PASSWORD', activateButton: 'ACTIVATE MY ACCOUNT', waiting: 'Please wait…', forgot: 'Forgot your password?', show: 'Show password', hide: 'Hide password' },
};
export default function AccountForm({ mode, lang, returnTo = '/', verificationError = false }: { mode: 'login' | 'register' | 'reset' | 'password' | 'activate'; lang: 'nl' | 'en'; returnTo?: string; verificationError?: boolean }) {
  const nl = lang === 'nl';
  const t = copy[lang];
  const intent = readPurchaseIntent(returnTo);
  const nextReturnTo = intent ? purchaseReturnPath({ ...intent, lang }) : returnTo;
  const authLink = (path: string) => path + '?lang=' + lang + '&return_to=' + encodeURIComponent(nextReturnTo);
  const shopLink = '/shop?' + new URLSearchParams({ lang, ...(intent ? { purchase: intent.productId, coupon: intent.couponCode } : {}) }).toString();
  const languageLink = (next: 'nl' | 'en') => '?lang=' + next + '&return_to=' + encodeURIComponent(intent ? purchaseReturnPath({ ...intent, lang: next }) : nextReturnTo);
  const [state, action, pending] = useActionState(accountAction, { status: 'idle', message: '' } as AccountResult);
  const [showPassword, setShowPassword] = useState(false);
  const description = mode === 'register' ? (nl ? 'Maak je account aan om straks direct naar je gekozen ervaring te gaan.' : 'Create your account to continue to your chosen experience.') : mode === 'login' ? (nl ? 'Log in en ga verder in jouw persoonlijke ROOTED AUDIO-omgeving.' : 'Sign in and return to your personal ROOTED AUDIO space.') : mode === 'reset' ? (nl ? 'Vul het e-mailadres van je account in. Je ontvangt een link om zelf een nieuw wachtwoord te kiezen.' : 'Enter your account email address. You will receive a link to choose a new password.') : mode === 'activate' ? (nl ? 'Je betaling is gelukt. Kies je wachtwoord en open jouw persoonlijke luisterplek.' : 'Your payment is complete. Choose your password and open your personal listening space.') : (nl ? 'Kies een nieuw wachtwoord voor je account. Je luisterpositie en persoonlijke teksten blijven bewaard.' : 'Choose a new password for your account. Your listening position and personal writing stay with you.');
  return <AccountFrame lang={lang} mode={mode} languageLinks={{ nl: languageLink('nl'), en: languageLink('en') }} productId={intent?.productId}>
    {intent && (mode === 'register' || mode === 'login') && <ol className="ra-account-steps" aria-label={nl ? 'De aankooproute' : 'Your purchase journey'}><li><Check size={12} aria-hidden="true" />{nl ? 'Jouw keuze' : 'Your choice'}</li><li aria-current="step"><span>02</span>{nl ? 'Je account' : 'Your account'}</li><li><span>03</span>{nl ? 'Betalen' : 'Payment'}</li></ol>}
    <div className="ra-form-heading"><p className="ra-eyebrow">{mode === 'register' ? 'YOUR PRIVATE LISTENING SPACE' : 'ROOTED AUDIO · YOUR SPACE'}</p><h1>{t[mode]}</h1><p>{description}</p></div>
    {verificationError && <div className="ra-alert ra-alert-error" role="alert"><p>{nl ? 'Deze bevestigingslink werkt niet meer. Vraag een nieuwe herstelmail aan.' : 'This verification link is no longer valid. Request a new recovery email.'}</p><a href={authLink('/auth/reset')}>{nl ? 'Nieuwe herstelmail aanvragen' : 'Request a new recovery email'} <ArrowUpRight size={14} aria-hidden="true" /></a></div>}
    {intent && <div className="ra-purchase-reminder"><div className="ra-reminder-icon"><Check size={16} aria-hidden="true" /></div><div><span>{nl ? 'JOUW KEUZE' : 'YOUR SELECTION'}</span><strong>{PRODUCTS[intent.productId].name}</strong>{intent.couponCode && <p className="ra-code-tag">{nl ? 'Kortingscode: ' : 'Discount code: '}{intent.couponCode}</p>}<a href={shopLink}>{nl ? 'Keuze wijzigen' : 'Change selection'}</a></div></div>}
    <form action={action} className="ra-account-form" aria-busy={pending}>
      <input type="hidden" name="mode" value={mode} /><input type="hidden" name="lang" value={lang} /><input type="hidden" name="return_to" value={nextReturnTo} />
      {!['password','activate'].includes(mode) && <div className="ra-field"><label htmlFor="account-email">{t.email}</label><div className="ra-input-wrap"><Mail size={18} aria-hidden="true" /><input id="account-email" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={nl ? 'jij@voorbeeld.nl' : 'you@example.com'} /></div></div>}
      {mode !== 'reset' && <div className="ra-field"><div className="ra-label-row"><label htmlFor="account-password">{t.pass}</label>{mode === 'login' && <a href={authLink('/auth/reset')}>{t.forgot}</a>}</div><div className="ra-input-wrap ra-password-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby="password-help" /><button type="button" className="ra-password-toggle" aria-label={showPassword ? t.hide : t.show} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div><small id="password-help">{nl ? 'Minimaal 12 tekens.' : 'At least 12 characters.'}</small></div>}
      <button className="ra-primary" type="submit" disabled={pending}>{pending ? <><span className="ra-spinner" aria-hidden="true" />{t.waiting}</> : <>{t[`${mode}Button`]}<ArrowUpRight size={19} aria-hidden="true" /></>}</button>
      {state.message && <div className={'ra-alert ' + (state.status === 'error' ? 'ra-alert-error' : 'ra-alert-success')} role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite">{state.status === 'sent' && <Mail size={22} aria-hidden="true" />}<p>{state.message}</p>{state.status === 'sent' && <small>{nl ? 'Kijk ook bij ongewenste e-mail.' : 'Please also check your junk folder.'}</small>}</div>}
    </form>
    <div className="ra-form-bottom">
      {(mode === 'register' || (mode === 'login' && intent)) && <p className="ra-next-step"><ShieldCheck size={16} aria-hidden="true" />{nl ? 'Je keuze en kortingscode gaan mee naar je betaaloverzicht.' : 'Your selection and discount code continue to your payment summary.'}</p>}
      {mode === 'login' ? <p>{nl ? 'Nog geen account?' : 'New here?'} <a href={intent ? authLink('/auth/register') : shopLink}>{intent ? (nl ? 'Account aanmaken' : 'Create account') : (nl ? 'Kies jouw ervaring' : 'Choose your experience')} <ArrowUpRight size={14} aria-hidden="true" /></a></p> : <p>{nl ? 'Heb je al een account?' : 'Already have an account?'} <a href={authLink('/auth/login')}>{nl ? 'Inloggen' : 'Sign in'} <ArrowUpRight size={14} aria-hidden="true" /></a></p>}
      <a className="ra-back-link" href={shopLink}><ArrowLeft size={14} aria-hidden="true" />{nl ? 'Terug naar GO BLUEPRINT' : 'Back to GO BLUEPRINT'}</a>
    </div>
  </AccountFrame>;
}
