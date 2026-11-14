"use server";
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient, mollieConfiguration } from '../../lib/standalone/admin-server';
import { accountEmailAllowed, registrationMode } from '../../lib/standalone/test-access';
import { accountLanguage } from '../../lib/standalone/auth-policy';
import { applyCoupon, complimentaryReference } from '../../lib/coupons';
import { SPECIAL_AMOUNT, SPECIAL_PRODUCT, specialSalesOpen } from "../../lib/special-sales";
import { PRODUCTS, isProductId } from '../../lib/products';
import { trustedCheckoutUrl } from '../../lib/checkout-url';
import { guestCookieName, payFirstEnabled } from '../../lib/guest-payment-policy';
import { guestClaimHash, ensurePaidGuestAccount } from '../../lib/standalone/guest-payments';

export type GuestCheckoutResult = { error: string };
export async function beginGuestPayment(_: GuestCheckoutResult, form: FormData): Promise<GuestCheckoutResult> {
  const lang = accountLanguage(form.get('lang'));
  const fail = (nl: string, en: string) => ({ error: lang === 'nl' ? nl : en });
  if (!payFirstEnabled()) return fail('Deze betaalroute wordt nog voorbereid.', 'This payment route is being prepared.');
  const email = String(form.get('email') || '').trim().toLowerCase();
  const productId = String(form.get('productId') || '');
  if (productId !== SPECIAL_PRODUCT || !isProductId(productId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('Controleer je product en e-mailadres.', 'Please check your product and email address.');
  if (!accountEmailAllowed(email, registrationMode(process.env.ROOTED_REGISTRATION_MODE), process.env.ROOTED_TEST_ALLOWED_EMAILS)) return fail('De verkoop is nog niet geopend. Deze betaling is alleen op uitnodiging beschikbaar.', 'Sales have not opened yet. This payment is available by invitation only.');
  if (!specialSalesOpen()) return fail('De verjaardagsactie is gesloten.', 'The birthday offer is closed.');
  const couponCode = String(form.get('couponCode') ?? '').trim().toUpperCase();
  if (couponCode !== 'ROOTED27') return fail('Gebruik ROOTED27 voor de verjaardagsprijs.', 'Use ROOTED27 for the birthday price.');
  const discount = applyCoupon(SPECIAL_AMOUNT, false, '');
  if (discount.error || form.get('expectedAmount') !== discount.amount) return fail('De prijs of kortingscode is veranderd. Ga terug en controleer je keuze.', 'The price or discount code has changed. Go back and review your selection.');
  const complimentary = discount.amount === '0.00';
  const { apiKey, checkoutAvailable } = mollieConfiguration();
  if (!apiKey?.startsWith('test_')) return fail('Testbetaling is tijdelijk niet beschikbaar.', 'Test payment is temporarily unavailable.');
  const origin = process.env.ROOTED_APP_ORIGIN;
  if ((!complimentary && !checkoutAvailable) || !origin || new URL(origin).protocol !== 'https:') return fail('Betalen is tijdelijk niet beschikbaar.', 'Payment is temporarily unavailable.');
  let checkout = '';
  let paymentId: string | undefined;
  const orderId = crypto.randomUUID();
  try {
    const admin = createAdminClient();
    const { count, error: countError } = await admin.from('ra_guest_payment_orders').select('order_id', { count: 'exact', head: true }).eq('email', email).gte('created_at', new Date(Date.now() - 600000).toISOString());
    if (countError) throw Error('Storage unavailable');
    if ((count || 0) >= 5) return fail('Je hebt meerdere betaalpogingen gestart. Wacht even voordat je opnieuw probeert.', 'You have started several payments. Please wait before trying again.');
    const secret = randomBytes(32).toString('hex');
    const { error: reserved } = await admin.from('ra_guest_payment_orders').insert({ order_id: orderId, claim_hash: guestClaimHash(secret), email, product_id: productId, amount: discount.amount, currency: 'EUR', language: lang, coupon_code: couponCode });
    if (reserved) throw Error('Order unavailable');
    (await cookies()).set(guestCookieName(orderId), secret, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2592000 });
    if (complimentary) {
      const { data: freeOrder, error: freeError } = await admin.from('ra_guest_payment_orders')
        .update({ payment_id: complimentaryReference(orderId), status: 'paid', access_allowed: true, updated_at: new Date().toISOString() })
        .eq('order_id', orderId).eq('amount', '0.00').select('*').single();
      if (freeError || !freeOrder) throw Error('Complimentary order unavailable');
      // Email delivery is retryable on the completion page; never repeat the
      // order or route a zero-total purchase through the payment provider.
      await ensurePaidGuestAccount(freeOrder).catch(() => undefined);
      checkout = origin.replace(/\/$/, '') + '/checkout/complete?order=' + orderId;
    } else {
    const response = await fetch('https://api.mollie.com/v2/payments', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': orderId }, body: JSON.stringify({
      amount: { currency: 'EUR', value: discount.amount }, description: PRODUCTS[productId].name,
      redirectUrl: origin.replace(/\/$/, '') + '/checkout/complete?order=' + orderId,
      webhookUrl: origin.replace(/\/$/, '') + '/api/payments/webhook',
      metadata: { guestOrderId: orderId, email, productId, couponCode: couponCode },
    }) });
    const payment = await response.json().catch(() => null) as { id?: string; status?: string; _links?: { checkout?: { href?: string } } } | null;
    paymentId = payment?.id;
    const target = trustedCheckoutUrl(payment?._links?.checkout?.href);
    if (!response.ok || !payment?.id || !/^tr_[A-Za-z0-9]+$/.test(payment.id) || !target) throw Error('Provider unavailable');
    const { error: saved } = await admin.from('ra_guest_payment_orders').update({ payment_id: payment.id, status: payment.status || 'open', updated_at: new Date().toISOString() }).eq('order_id', orderId);
    if (saved) throw Error('Order unavailable');
    checkout = target.href;
    }
  } catch {
    if (paymentId && /^tr_[A-Za-z0-9]+$/.test(paymentId)) await fetch('https://api.mollie.com/v2/payments/' + paymentId, { method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` } }).catch(() => null);
    return fail('De betaling kon niet worden gestart. Probeer het later opnieuw.', 'The payment could not be started. Please try again later.');
  }
  redirect(checkout);
}
