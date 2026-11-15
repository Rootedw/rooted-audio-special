import AccountFrame from '../../auth/account-frame';
import { payFirstEnabled } from '../../../lib/guest-payment-policy';
import { readGuestOrder, reconcileGuestPayment } from '../../../lib/standalone/guest-payments';
import { redirect } from 'next/navigation';
import RefreshStatus from './refresh-status';
export const dynamic = 'force-dynamic';
export const metadata = { referrer: 'no-referrer' as const, robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!payFirstEnabled()) redirect('/shop');
  const params = await searchParams;
  let order = await readGuestOrder(params.order).catch(() => null);
  let delayed = false;
  let activationDelayed = false;
  if (order?.payment_id) { try { const checked = await reconcileGuestPayment(order); order = checked; activationDelayed = checked.activationDelayed; } catch { delayed = true; } }
  const lang = order?.language || 'nl'; const nl = lang === 'nl';
  const free = order?.amount === '0.00';
  const paid = order?.status === 'paid' && order.access_allowed;
  const failed = order && ['failed', 'canceled', 'expired'].includes(order.status);
  const open = order?.status === 'open' && !delayed;
  const resume = open ? order?.resume_checkout_url : undefined;
  const shop = '/shop?' + new URLSearchParams({ lang, ...(order ? { purchase: order.product_id, coupon: order.coupon_code || '' } : {}) }).toString();
  return <AccountFrame lang={lang} mode="checkout">
    <div className="ra-form-heading"><p className="ra-eyebrow">ROOTED AUDIO · GO BLUEPRINT</p><h1>{paid ? (free ? (nl ? 'Je gratis bestelling is gelukt.' : 'Your free order is complete.') : (nl ? 'Je betaling is gelukt.' : 'Your payment is complete.')) : (failed || open) ? (nl ? 'Je betaling is nog niet afgerond.' : 'Your payment is not complete yet.') : (nl ? 'Jouw aankoop.' : 'Your purchase.')}</h1>
      <p>{paid && activationDelayed ? (nl ? 'Je betaling is bevestigd. De activatiemail kon nog niet worden verwerkt. Vraag hieronder een nieuwe activatiemail aan.' : 'Your payment is confirmed. The activation email could not be processed yet. Request another activation email below.') : paid ? (nl ? 'Je aankoop is veilig bewaard. Open de activatiemail om zelf een wachtwoord te kiezen. Heb je al een account met dit e-mailadres? Log dan in om verder te gaan.' : 'Your purchase has been saved. Open your activation email to choose a password. Already have an account with this email address? Sign in to continue.') : open ? (resume ? (nl ? 'Mollie heeft nog geen geslaagde betaling bevestigd. Je kunt dezelfde betaling bij Mollie hervatten. Er is voor deze poging geen nieuw account aangemaakt.' : 'Mollie has not confirmed a successful payment. You can resume the same payment with Mollie. No new account was created for this attempt.') : (nl ? 'Mollie heeft nog geen geslaagde betaling bevestigd. Heb je de betaling afgebroken of is een poging mislukt? Controleer de betaalstatus, of ga terug naar je keuze om opnieuw te beginnen. Er is voor deze poging geen nieuw account aangemaakt.' : 'Mollie has not confirmed a successful payment. Did you leave checkout or did a payment attempt fail? Check the payment status, or return to your selection to start again. No new account was created for this attempt.')) : failed ? (nl ? 'Deze betaling is niet voltooid. Er is voor deze poging geen nieuw account aangemaakt. Je kunt terug naar je keuze om opnieuw te beginnen.' : 'This payment was not completed. No new account was created for this attempt. Return to your selection to start again.') : order ? (nl ? 'Je betaling wordt gecontroleerd. Zodra de betaling is bevestigd, volgt de activatie van je account.' : 'Your payment is being checked. Your account activation follows once payment is confirmed.') : (nl ? 'Open de activatielink uit je e-mail om je aankoop te gebruiken. Je kunt ook inloggen als je al een account hebt. Kun je de mail niet vinden? Neem contact op met info@rooted-within.nl.' : 'Open the activation link in your email to use your purchase, or sign in if you already have an account. Cannot find the email? Contact info@rooted-within.nl.')}</p>
    </div>
    {(delayed || (order && !paid && !failed)) && <RefreshStatus lang={lang} />}
    <div className="ra-form-bottom">
      {resume ? <a className="ra-primary" href={resume} rel="noreferrer">{nl ? 'BETALING HERVATTEN BIJ MOLLIE' : 'RESUME PAYMENT WITH MOLLIE'}</a> : (failed || open) ? <a className="ra-primary" href={shop}>{nl ? 'TERUG NAAR JE KEUZE' : 'BACK TO YOUR SELECTION'}</a> : <a className="ra-primary" href={'/auth/login?lang=' + lang}>{nl ? 'NAAR MIJN ACCOUNT' : 'GO TO MY ACCOUNT'}</a>}
      {paid ? <p>{nl ? 'Controleer ook je ongewenste e-mail. Je hoeft niet opnieuw te betalen om je aankoop later te activeren.' : 'Please also check your junk folder. You do not need to pay again to activate your purchase later.'}</p> : resume ? <p>{nl ? 'Je hervat dezelfde bestelling. Als je al hebt betaald, controleer dan eerst de betaalstatus hierboven.' : 'You are resuming the same order. If you have already paid, check the payment status above first.'}</p> : null}
      {paid && <a href={'/auth/activate?lang=' + lang}>{nl ? 'Nieuwe activatiemail aanvragen' : 'Request another activation email'}</a>}
      <a href="mailto:info@rooted-within.nl">{nl ? 'Hulp nodig?' : 'Need help?'}</a>
    </div>
  </AccountFrame>;
}
