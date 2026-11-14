"use server";
import { applyCoupon } from '../../lib/coupons';
import { isProductId, PRODUCTS } from '../../lib/products';

// A price preview only: this action creates no account, payment or product access.
export async function quoteSelection(productId: unknown, couponCode: unknown) {
  if (typeof productId !== 'string' || !isProductId(productId)) return { amount: null, code: null, error: 'UNKNOWN_PRODUCT' };
  const result = applyCoupon(PRODUCTS[productId].amount, false, couponCode);
  return { amount: result.error ? null : result.amount, code: result.code, error: result.error };
}
