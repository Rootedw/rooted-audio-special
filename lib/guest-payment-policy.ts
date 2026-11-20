import { paymentAccessDecision, type VerifiedPayment } from './payment-policy';
import { trustedCheckoutUrl } from './checkout-url';
export type GuestPayment = VerifiedPayment & { metadata?: { guestOrderId?: string; email?: string; productId?: string }; _links?: { checkout?: { href?: string } } };
export type GuestOrder = {
  order_id: string; payment_id: string | null; claim_hash: string; email: string;
  product_id: string; amount: string; currency: string; status: string;
  access_allowed: boolean; revoked_at: string | null; language: 'nl' | 'en'; invited_at: string | null; claimed_by: string | null;
  coupon_code?: string | null;
  payment_mode?: 'test' | 'live';
  resume_checkout_url?: string;
};
export function payFirstEnabled(value = process.env.ROOTED_PAY_FIRST_ENABLED) { return value === 'true'; }
export function validGuestOrderId(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function guestCookieName(orderId: string) { return 'ra_guest_' + orderId.replaceAll('-', ''); }
export function guestPaymentMatches(payment: GuestPayment, order: GuestOrder) {
  return Boolean(order.payment_id) && payment.id === order.payment_id && payment.metadata?.guestOrderId === order.order_id
    && payment.metadata.email?.toLowerCase() === order.email && payment.metadata.productId === order.product_id
    && payment.amount?.value === order.amount && payment.amount.currency === order.currency;
}
// Only resume the same verified, unpaid provider order. A paid/revoked order or
// untrusted provider link must never present a second payment opportunity.
export function guestResumeCheckout(payment: GuestPayment, order: GuestOrder): string | undefined {
  if (payment.status !== 'open' || order.revoked_at || order.access_allowed || order.status === 'paid' || paymentAccessDecision(payment) === 'revoke' || !guestPaymentMatches(payment, order)) return;
  return trustedCheckoutUrl(payment._links?.checkout?.href)?.href;
}
