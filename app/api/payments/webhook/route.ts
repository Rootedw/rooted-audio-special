import { createAdminClient, mollieConfiguration } from "../../../../lib/standalone/admin-server";
import { grantEntitlement, revokeEntitlementSource } from "../../../../lib/entitlements";
import { isProductId } from "../../../../lib/products";
import { paymentAccessDecision, paymentMatchesOrder, type VerifiedPayment, type PaymentOrder } from "../../../../lib/payment-policy";
import { payFirstEnabled, type GuestOrder } from "../../../../lib/guest-payment-policy";
import { reconcileGuestPayment } from "../../../../lib/standalone/guest-payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { apiKey, checkoutAvailable } = mollieConfiguration();
  if (!checkoutAvailable) return new Response("Unavailable", { status: 503 });
  const form = await request.formData().catch(() => null);
  const paymentId = form?.get("id");
  if (typeof paymentId !== "string" || !/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
    return new Response("Invalid", { status: 400 });
  }

  const response = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const payment = await response.json().catch(() => null) as VerifiedPayment | null;
  if (!response.ok || !payment || payment.id !== paymentId) return new Response("Unavailable", { status: 502 });

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("ra_payment_orders")
    .select("payment_id,email,user_id,product_id,amount,currency")
    .eq("payment_id", paymentId)
    .maybeSingle<PaymentOrder>();
  if (error) return new Response("Unavailable", { status: 503 });
  if (!order && payFirstEnabled()) {
    const {data:guest,error:guestError}=await admin.from('ra_guest_payment_orders').select('*').eq('payment_id',paymentId).maybeSingle<GuestOrder>();
    if(guestError)return new Response('Unavailable',{status:503});
    if(!guest)return new Response('Unknown',{status:404});
    try { await reconcileGuestPayment(guest); return new Response('OK',{status:200}); }
    catch { return new Response('Unavailable',{status:503}); }
  }
  if (!order || !isProductId(order.product_id)) return new Response("Unknown", { status: 404 });
  if (!paymentMatchesOrder(payment, order)) return new Response("Mismatch", { status: 409 });

  const { error: updateError } = await admin
    .from("ra_payment_orders")
    .update({ status: payment.status, updated_at: new Date().toISOString() })
    .eq("payment_id", paymentId);
  if (updateError) return new Response("Unavailable", { status: 503 });

  const decision = paymentAccessDecision(payment);
  if (decision === "grant") {
    await grantEntitlement(order.user_id, order.product_id, `mollie:${paymentId}`);
  } else if (decision === "revoke") {
    await revokeEntitlementSource(order.user_id, order.product_id, `mollie:${paymentId}`);
  }
  return new Response("OK", { status: 200 });
}
