import { isComplimentaryOrder } from '../coupons';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { createAdminClient, mollieConfiguration } from './admin-server';
import { guestCookieName, guestPaymentMatches, guestResumeCheckout, payFirstEnabled, validGuestOrderId, type GuestOrder, type GuestPayment } from '../guest-payment-policy';
import { paymentAccessDecision } from '../payment-policy';
import { revokeEntitlementSource } from '../entitlements';

export function guestClaimHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
export async function readGuestOrder(orderId: unknown): Promise<GuestOrder | null> {
  if (!payFirstEnabled() || !validGuestOrderId(orderId)) return null;
  const secret = (await cookies()).get(guestCookieName(orderId))?.value;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return null;
  const { data, error } = await createAdminClient().from('ra_guest_payment_orders').select('*')
    .eq('order_id', orderId).eq('claim_hash', guestClaimHash(secret)).maybeSingle<GuestOrder>();
  if (error) throw Error('Guest order storage unavailable');
  return data;
}
export async function claimGuestOrders(userId: string): Promise<number> {
  if (!payFirstEnabled()) return 0;
  const { data, error } = await createAdminClient().rpc('ra_claim_guest_orders', { account: userId });
  if (error) throw Error('Purchase access unavailable');
  return typeof data === 'number' ? data : 0;
}
export async function reconcileGuestPayment(order: GuestOrder) {
  if (order.payment_id?.startsWith('tr_coupon')) {
    if (!isComplimentaryOrder(order)) throw Error('Complimentary order verification failed');
    await ensurePaidGuestAccount(order);
    return { ...order, activationDelayed: false };
  }
  const { apiKey, checkoutAvailable } = mollieConfiguration();
  if (!checkoutAvailable || !order.payment_id) throw Error('Payment verification unavailable');
  const response = await fetch('https://api.mollie.com/v2/payments/' + encodeURIComponent(order.payment_id), { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
  const payment = await response.json().catch(() => null) as GuestPayment | null;
  if (!response.ok || !payment || !guestPaymentMatches(payment, order)) throw Error('Payment verification failed');
  const decision = paymentAccessDecision(payment);
  const admin = createAdminClient();
  let update = admin.from('ra_guest_payment_orders').update({ status: payment.status, access_allowed: decision === 'grant', ...(decision === 'revoke' ? {revoked_at:new Date().toISOString()}:{}), updated_at: new Date().toISOString() }).eq('order_id', order.order_id).eq('payment_id', payment.id);
  if(decision==='grant')update=update.is('revoked_at',null);
  const { data: written, error } = await update.select('order_id').maybeSingle();
  if (error) throw Error('Payment storage unavailable');
  const current = { ...order, status: payment.status, access_allowed: decision === 'grant' && !!written, resume_checkout_url: guestResumeCheckout(payment, order) };
  if (decision === 'revoke' && order.claimed_by) await revokeEntitlementSource(order.claimed_by, order.product_id, 'mollie:' + payment.id);
  if (current.access_allowed) {
    try {
      await ensurePaidGuestAccount(current);
    } catch (error) {
      console.error('Special activation delivery failed', error instanceof Error ? error.message : 'Unknown error');
      return { ...current, activationDelayed: true };
    }
  }
  return { ...current, activationDelayed: false };
}
export async function ensurePaidGuestAccount(order: GuestOrder) {
  if (!order.access_allowed || order.status !== 'paid') return;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('ra_guest_customer', { order_reference: order.order_id });
  if (error) throw Error('Account lookup unavailable');
  const customer = Array.isArray(data) ? data[0] as { user_id: string; confirmed: boolean } | undefined : undefined;
  if (customer?.confirmed) { await claimGuestOrders(customer.user_id); return; }
  if (order.invited_at) return;
  // This is the first operation that can create an auth user, strictly AFTER
  // server-side Mollie paid/amount/order verification. Email failures are retried.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(order.email, {
    redirectTo: (process.env.ROOTED_APP_ORIGIN || 'https://audio.rooted-within.nl') + '/auth/activate',
    data: { language: order.language, paid_activation_pending: true },
  });
  if (inviteError) throw Error('Activation email unavailable (' + (inviteError.code || inviteError.status || 'unknown') + ')');
  const { error: saved } = await admin.from('ra_guest_payment_orders').update({ invited_at: new Date().toISOString() }).eq('order_id', order.order_id);
  if (saved) throw Error('Activation status unavailable');
}
