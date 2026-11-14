import { redirect } from 'next/navigation';
import AccountFrame from '../auth/account-frame';
import { readPurchaseIntent } from '../../lib/purchase-intent';
import { payFirstEnabled } from '../../lib/guest-payment-policy';
import { applyCoupon } from '../../lib/coupons';
import { PRODUCTS } from '../../lib/products';
import { SPECIAL_PRODUCT, specialSalesOpen } from '../../lib/special-sales';
import CheckoutForm from './checkout-form';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['purchase', 'coupon', 'lang']) if (typeof params[key] === 'string') query.set(key, params[key] as string);
  const intent = readPurchaseIntent('/?' + query.toString());
  if (!intent || intent.productId !== SPECIAL_PRODUCT || !payFirstEnabled() || !specialSalesOpen()) redirect('/shop');
  if (intent.couponCode !== 'ROOTED27') redirect('/shop');
  const nl = intent.lang === 'nl';
  const quote = applyCoupon(PRODUCTS[intent.productId].amount, false, '');
  const free = !quote.error && quote.amount === '0.00';
  return <AccountFrame lang={intent.lang} mode="checkout" productId={intent.productId}>
    <ol className="ra-account-steps" aria-label={nl ? 'De aankooproute' : 'Your purchase journey'}><li>01 {nl ? 'Jouw keuze' : 'Your choice'}</li><li aria-current="step">02 {nl ? 'Betalen' : 'Payment'}</li><li>03 {nl ? 'Activeren' : 'Activate'}</li></ol>
    <div className="ra-form-heading"><p className="ra-eyebrow">GO BLUEPRINT · {nl ? 'JOUW VOLGENDE STAP' : 'YOUR NEXT STEP'}</p><h1>{nl ? 'Jouw luisterervaring.' : 'Your listening experience.'}</h1><p>{free ? (nl ? 'Vul je e-mailadres in om je gratis bestelling af te ronden. Je ontvangt daarna een activatiemail voor je account.' : 'Enter your email to complete your free order. Your account activation email will follow.') : nl ? 'Vul je e-mailadres in en betaal veilig via Mollie. Pas na een geslaagde betaling activeer je jouw account en kies je een wachtwoord.' : 'Enter your email address and pay securely with Mollie. After successful payment, activate your account and choose a password.'}</p></div>
    <div className="ra-purchase-reminder"><div><span>{nl ? 'JOUW KEUZE' : 'YOUR SELECTION'}</span><strong>{PRODUCTS[intent.productId].name}</strong><p className="ra-code-tag">ROOTED27 · {nl ? '27% verjaardagskorting toegepast' : '27% birthday discount applied'}</p><strong>€{nl ? quote.amount.replace('.', ',') : quote.amount}</strong></div></div>
    {quote.error ? <div className="ra-alert ra-alert-error" role="alert">{nl ? 'Je kortingscode is niet geldig of verlopen. Ga terug en controleer je keuze.' : 'Your discount code is invalid or expired. Go back and review your selection.'}</div> : <CheckoutForm intent={intent} amount={quote.amount} />}
    <div className="ra-form-bottom"><a href={'/shop?' + query.toString()}>{nl ? 'Keuze wijzigen' : 'Change selection'}</a><p>{nl ? 'Heb je al betaald? Gebruik de activatielink uit je e-mail of log in met je bestaande account.' : 'Already paid? Use the activation link in your email or sign in to your existing account.'}</p><a href={'/auth/login?lang=' + intent.lang}>{nl ? 'Inloggen' : 'Sign in'}</a></div>
  </AccountFrame>;
}
