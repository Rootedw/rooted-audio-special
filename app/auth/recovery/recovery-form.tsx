"use client";
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
export default function RecoveryForm({ lang, token }: { lang: 'nl' | 'en'; token: string }) {
  const [pending, setPending] = useState(false);
  const nl = lang === 'nl';
  return <form method="post" action="/auth/recovery/confirm" className="ra-account-form"
    onSubmit={event => { if (pending) { event.preventDefault(); return; } setPending(true); }}>
    <input type="hidden" name="lang" value={lang} /><input type="hidden" name="token_hash" value={token} />
    <button className="ra-primary" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <><span className="ra-spinner" aria-hidden="true" />{nl ? 'Even geduld…' : 'Please wait…'}</> : <>{nl ? 'DOORGAAN NAAR NIEUW WACHTWOORD' : 'CONTINUE TO NEW PASSWORD'}<ArrowUpRight size={19} aria-hidden="true" /></>}
    </button>
    {pending && <p role="status" className="ra-next-step">{nl ? 'Je herstellink wordt gecontroleerd. Sluit deze pagina niet.' : 'Checking your recovery link. Keep this page open.'}</p>}
  </form>;
}
