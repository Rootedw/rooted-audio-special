// Server-side catalogue: never import this module into the client bundle.
const PR_CODES = new Set([
  "GERANY", "SHEARYSA", "SHENAILY", "ASHLEY", "DOMINIQUE",
  "LETICIA", "YORVIQ", "RIVALDO", "SHANTASIA", "RAMONA",
].map((name) => `RW4U26-${name}`));
// Valid through 31 March 2027 in the Netherlands (CEST).
export const PR_COUPON_EXPIRES_AT = Date.parse("2027-04-01T00:00:00+02:00");
export const OWNER_COUPON = "RW4U26-SHORAIFA";
export function ownerCouponEmailAllowed(code: string | null, email: string) {
  return code !== OWNER_COUPON || email.trim().toLowerCase() === "rooted-within@hotmail.com";
}
// Internal order reference, never a Mollie payment. Retains the existing
// service-only entitlement claim contract without a database migration.
export function complimentaryReference(orderId: string) { return "tr_coupon" + orderId.replaceAll("-", ""); }
export function isComplimentaryOrder(order: { order_id: string; payment_id: string | null; email: string; amount: string; currency: string; coupon_code?: string | null; status: string; access_allowed: boolean; revoked_at: string | null }) {
  return order.coupon_code === OWNER_COUPON && ownerCouponEmailAllowed(order.coupon_code, order.email)
    && order.amount === "0.00" && order.currency === "EUR" && order.status === "paid"
    && order.access_allowed && !order.revoked_at && order.payment_id === complimentaryReference(order.order_id);
}
export function applyCoupon(amount: string, upgrade: boolean, input: unknown, now = Date.now()) {
  if (input === undefined || input === "") return { amount, code: null, error: null };
  if (typeof input !== "string" || input.length > 80) return { amount, code: null, error: "COUPON_INVALID" };
  const code = input.trim().toUpperCase();
  if (!code) return { amount, code: null, error: null };
  if (code !== OWNER_COUPON && !PR_CODES.has(code)) return { amount, code: null, error: "COUPON_INVALID" };
  if (now >= PR_COUPON_EXPIRES_AT) return { amount, code: null, error: "COUPON_EXPIRED" };
  if (code === OWNER_COUPON) return { amount: "0.00", code, error: null };
  const cents = Math.round(Number(amount) * 100);
  return { amount: (Math.round(cents * 85 / 100) / 100).toFixed(2), code, error: null };
}
