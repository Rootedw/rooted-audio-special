"use server";
import { accountLanguage } from '../../../lib/standalone/auth-policy';
import { accountEmailAllowed, registrationMode } from '../../../lib/standalone/test-access';
import { createAdminClient } from '../../../lib/standalone/admin-server';
import { ensurePaidGuestAccount } from '../../../lib/standalone/guest-payments';
import { payFirstEnabled, type GuestOrder } from '../../../lib/guest-payment-policy';
export async function requestGuestActivation(_: { message: string }, form: FormData) {
  const lang = accountLanguage(form.get('lang'));
  const result = { message: lang === 'nl' ? 'Als er een aankoop klaarstaat om te activeren, ontvang je een nieuwe e-mail. Heb je al een geactiveerd account? Log dan in of vraag een wachtwoordherstellink aan.' : 'If a purchase is awaiting activation, you will receive a new email. Already have an activated account? Sign in or request a password recovery link.' };
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!payFirstEnabled() || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !accountEmailAllowed(email, registrationMode(process.env.ROOTED_REGISTRATION_MODE), process.env.ROOTED_TEST_ALLOWED_EMAILS)) return result;
  let reservation: { orderId: string; at: string; previous: string | null } | undefined;
  try {
    const admin = createAdminClient();
    const { data: order, error } = await admin.from('ra_guest_payment_orders').select('*').eq('email', email).eq('status', 'paid').eq('access_allowed', true).is('revoked_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle<GuestOrder>();
    if (error || !order || (order.invited_at && Date.now() - Date.parse(order.invited_at) < 60000)) return result;
    const since = new Date(Date.now() - 60000).toISOString();
    const at = new Date().toISOString();
    const { data: reserved } = await admin.from('ra_guest_payment_orders').update({ invited_at: at }).eq('order_id', order.order_id).or('invited_at.is.null,invited_at.lt.' + since).select('order_id').maybeSingle();
    if (reserved) {
      reservation = { orderId: order.order_id, at, previous: order.invited_at ?? null };
      await ensurePaidGuestAccount({ ...order, invited_at: null }, true);
    }
  } catch (error) {
    console.error('Special activation resend failed', error instanceof Error ? error.message : 'Unknown error');
    if (reservation) {
      await createAdminClient().from('ra_guest_payment_orders')
        .update({ invited_at: reservation.previous })
        .eq('order_id', reservation.orderId)
        .eq('invited_at', reservation.at);
    }
  }
  return result;
}
