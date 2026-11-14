import { isSameOriginMutation } from "../../../../lib/request-security";
import { createAdminClient, mollieConfiguration } from "../../../../lib/standalone/admin-server";
import { grantEntitlement, revokeEntitlementSource } from "../../../../lib/entitlements";
import { isProductId } from "../../../../lib/products";
import { paymentAccessDecision, paymentMatchesOrder, type PaymentOrder, type VerifiedPayment } from "../../../../lib/payment-policy";
import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { apiKey, checkoutAvailable } = mollieConfiguration();
  if (!checkoutAvailable) return Response.json({ error: "PAYMENT_STATUS_UNAVAILABLE" }, { status: 503 });

  const body = await request.json().catch(() => null) as { paymentId?: unknown } | null;
  const paymentId = body?.paymentId;
  if (paymentId != null && (typeof paymentId !== "string" || !/^tr_[A-Za-z0-9]+$/.test(paymentId))) {
    return Response.json({ error: "INVALID_PAYMENT" }, { status: 400 });
  }
  const admin = createAdminClient();
  let query = admin.from("ra_payment_orders")
    .select("payment_id,email,user_id,product_id,amount,currency")
    .eq("user_id", user.userId);
  // Always scope to the signed-in account, including when the caller selects an order.
  if (typeof paymentId === "string") query = query.eq("payment_id", paymentId);
  const { data: order, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PaymentOrder>();
  if (error || !order || !isProductId(order.product_id)) {
    return Response.json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
  }

  const mollie = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(order.payment_id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const payment = await mollie.json().catch(() => null) as VerifiedPayment | null;
  if (!mollie.ok || !payment || !paymentMatchesOrder(payment, order)) {
    return Response.json({ error: "PAYMENT_VERIFICATION_FAILED" }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("ra_payment_orders")
    .update({ status: payment.status, updated_at: new Date().toISOString() })
    .eq("payment_id", order.payment_id)
    .eq("user_id", user.userId);
  if (updateError) return Response.json({ error: "PAYMENT_STATUS_UNAVAILABLE" }, { status: 503 });

  const decision = paymentAccessDecision(payment);
  if (decision === "grant") await grantEntitlement(order.user_id, order.product_id, `mollie:${order.payment_id}`);
  if (decision === "revoke") await revokeEntitlementSource(order.user_id, order.product_id, `mollie:${order.payment_id}`);

  return Response.json({ status: payment.status, access: decision === "grant" }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
