"use client";
import { useActionState } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { beginGuestPayment } from './actions';
import type { PurchaseIntent } from '../../lib/purchase-intent';
export default function CheckoutForm({ intent, amount }: { intent: PurchaseIntent; amount: string }) {
  const free = amount === '0.00';
  const nl = intent.lang === 'nl';
  const [state, action, pending] = useActionState(beginGuestPayment, { error: '' });
  return <form action={action} className="ra-account-form" aria-busy={pending}>
    <input type="hidden" name="productId" value={intent.productId} /><input type="hidden" name="couponCode" value={intent.couponCode} /><input type="hidden" name="expectedAmount" value={amount} /><input type="hidden" name="lang" value={intent.lang} />
    <div className="ra-field"><label htmlFor="purchase-email">{nl ? 'E-mailadres' : 'Email address'}</label><div className="ra-input-wrap"><Mail size={18} aria-hidden="true" /><input id="purchase-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} /></div><small>{free ? (nl ? 'Je ontvangt op dit adres de activatielink voor je gratis bestelling.' : 'Your free order activation link will arrive at this address.') : nl ? 'Na betaling ontvang je op dit adres de activatielink voor je account. Controleer het zorgvuldig.' : 'After payment, your account activation link will arrive at this address. Please check it carefully.'}</small></div>
    <button className="ra-primary" disabled={pending}>{pending ? (free ? (nl ? 'Bestelling voorbereiden…' : 'Preparing order…') : (nl ? 'Betaling voorbereiden…' : 'Preparing payment…')) : <>{free ? (nl ? 'GRATIS BESTELLEN' : 'COMPLETE FREE ORDER') : (nl ? 'VEILIG BETALEN' : 'SECURE PAYMENT')} · €{nl ? amount.replace('.', ',') : amount}<ArrowUpRight size={19} aria-hidden="true" /></>}</button>
    {state.error && <div className="ra-alert ra-alert-error" role="alert"><p>{state.error}</p></div>}
  </form>;
}
