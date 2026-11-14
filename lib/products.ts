import { SPECIAL_AMOUNT, SPECIAL_PRODUCT } from "./special-sales";

export const AUDIOBOOK_PRODUCT = "go-blueprint-audiobook";
export const DEEPENING_PRODUCT = "go-blueprint-deepening";

export const PRODUCTS = {
  [SPECIAL_PRODUCT]: { name: "ROOTED AUDIO SPECIAL", amount: SPECIAL_AMOUNT },
  [AUDIOBOOK_PRODUCT]: { name: "GO BLUEPRINT — Audiobook", amount: "17.99" },
  [DEEPENING_PRODUCT]: { name: "GO BLUEPRINT — Deepening Bundle", amount: "24.95" },
} as const;
export type ProductId = keyof typeof PRODUCTS;
export function isProductId(value: string): value is ProductId {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, value);
}
function cents(amount: string): number {
  const [whole, fraction] = amount.split(".");
  return Number(whole) * 100 + Number(fraction);
}
export const DEEPENING_UPGRADE_AMOUNT =
  ((cents(PRODUCTS[DEEPENING_PRODUCT].amount) - cents(PRODUCTS[AUDIOBOOK_PRODUCT].amount)) / 100).toFixed(2);

// Owned products must come from the authenticated account, never the request body.
export function purchaseQuote(productId: ProductId, owned: readonly string[]) {
  if (productId === SPECIAL_PRODUCT) {
    return owned.includes(SPECIAL_PRODUCT) ? null : { ...PRODUCTS[SPECIAL_PRODUCT], upgrade: false };
  }
  if (owned.includes(DEEPENING_PRODUCT) || owned.includes(productId)) return null;
  const product = PRODUCTS[productId];
  const upgrade = productId === DEEPENING_PRODUCT && owned.includes(AUDIOBOOK_PRODUCT);
  return {
    amount: upgrade ? DEEPENING_UPGRADE_AMOUNT : product.amount,
    name: upgrade ? "GO BLUEPRINT — Deepening Bundle (upgrade)" : product.name,
    upgrade,
  };
}
