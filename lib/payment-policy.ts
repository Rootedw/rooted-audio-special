type Money = { currency?: string; value?: string };
export type VerifiedPayment = {
  id: string;
  status: string;
  mode?: string;
  amount?: Money;
  amountRefunded?: Money;
  amountChargedBack?: Money;
  metadata?: { productId?: string; email?: string; userId?: string };
};
export type PaymentOrder = {
  payment_id: string; email: string; user_id: string;
  product_id: string; amount: string; currency: string;
};
function cents(value?: string): number | null {
  if (!value || !/^\d+\.\d{2}$/.test(value)) return null;
  const [whole, decimal] = value.split(".");
  const result = Number(whole) * 100 + Number(decimal);
  return Number.isSafeInteger(result) ? result : null;
}
export function paymentMatchesOrder(payment: VerifiedPayment, order: PaymentOrder): boolean {
  return Boolean(order.user_id) && payment.id === order.payment_id &&
    payment.metadata?.userId === order.user_id &&
    payment.metadata?.email?.toLowerCase() === order.email.toLowerCase() &&
    payment.metadata?.productId === order.product_id &&
    payment.amount?.currency === order.currency &&
    payment.amount?.value === order.amount;
}
export function paymentAccessDecision(payment: VerifiedPayment): "grant" | "revoke" | "none" {
  const total = cents(payment.amount?.value);
  if (total === null || total <= 0) return "none";
  const refunded = payment.amountRefunded;
  const chargedBack = payment.amountChargedBack;
  // A completed full refund or any chargeback withdraws this payment's access.
  // Partial refunds retain access; support may explicitly revoke if appropriate.
  if ((chargedBack && chargedBack.currency === payment.amount?.currency && (cents(chargedBack.value) ?? 0) > 0) ||
      (refunded && refunded.currency === payment.amount?.currency && (cents(refunded.value) ?? 0) >= total)) return "revoke";
  return payment.status === "paid" ? "grant" : "none";
}