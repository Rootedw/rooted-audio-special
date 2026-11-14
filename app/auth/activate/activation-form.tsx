"use client";
import { useActionState, useState } from 'react';
import { requestGuestActivation } from './resend';
export default function ActivationForm({ lang, token }: { lang: 'nl' | 'en'; token?: string }) {
  const nl = lang === 'nl'; const [pending, setPending] = useState(false);
  const [state, action, sending] = useActionState(requestGuestActivation, { message: '' });
  if (!token) return <form action={action} className="ra-account-form"><input type="hidden" name="lang" value={lang} /><div className="ra-field"><label htmlFor="activation-email">{nl ? 'Het e-mailadres van je aankoop' : 'Your purchase email address'}</label><div className="ra-input-wrap"><input id="activation-email" type="email" name="email" autoComplete="email" required maxLength={254} /></div></div><button className="ra-primary" disabled={sending}>{sending ? (nl ? 'Even geduld…' : 'Please wait…') : (nl ? 'NIEUWE ACTIVATIEMAIL AANVRAGEN' : 'REQUEST NEW ACTIVATION EMAIL')}</button>{state.message && <div role="status" className="ra-alert ra-alert-success">{state.message}</div>}<a href={'/auth/login?lang=' + lang}>{nl ? 'Inloggen met een bestaand account' : 'Sign in to an existing account'}</a></form>;
  return <form method="post" action="/auth/activate/confirm" className="ra-account-form" onSubmit={event => { if (pending) { event.preventDefault(); return; } setPending(true); }}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="token_hash" value={token} /><button className="ra-primary" disabled={pending}>{pending ? (nl ? 'Even geduld…' : 'Please wait…') : (nl ? 'DOORGAAN NAAR MIJN WACHTWOORD' : 'CONTINUE TO MY PASSWORD')}</button></form>;
}
