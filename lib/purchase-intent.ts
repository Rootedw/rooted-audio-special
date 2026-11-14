import { isProductId, type ProductId } from './products';

export type PurchaseIntent = { productId: ProductId; couponCode: string; lang: 'nl' | 'en' };
export const PURCHASE_INTENT_COOKIE = 'ra_purchase_intent';
export function readPurchaseIntent(value: unknown): PurchaseIntent | null {
  if (typeof value !== 'string' || value.length > 600 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://rooted.invalid');
    const productId = url.searchParams.get('purchase') || '';
    const couponCode = (url.searchParams.get('coupon') || '').trim().toUpperCase();
    if (url.origin !== 'https://rooted.invalid' || url.pathname !== '/' || !isProductId(productId)
      || couponCode.length > 80 || !/^[A-Z0-9-]*$/.test(couponCode)) return null;
    return { productId, couponCode, lang: url.searchParams.get('lang') === 'en' ? 'en' : 'nl' };
  } catch { return null; }
}
export function purchaseReturnPath(intent: PurchaseIntent): string {
  const query = new URLSearchParams({ purchase: intent.productId, lang: intent.lang });
  if (intent.couponCode) query.set('coupon', intent.couponCode);
  return '/?' + query.toString();
}
export function purchaseContinuation(returnTo: unknown, remembered?: unknown): string | null {
  const intent = readPurchaseIntent(returnTo) || ((returnTo == null || returnTo === '/') ? readPurchaseIntent(remembered) : null);
  return intent ? purchaseReturnPath(intent) : null;
}
export function accountPurchasePath(intent: PurchaseIntent, mode: 'login' | 'register' = 'register'): string {
  return '/auth/' + mode + '?' + new URLSearchParams({ lang: intent.lang, return_to: purchaseReturnPath(intent) }).toString();
}
