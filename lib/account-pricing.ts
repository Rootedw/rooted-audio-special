import { AUDIOBOOK_PRODUCT, DEEPENING_PRODUCT, PRODUCTS, DEEPENING_UPGRADE_AMOUNT } from "./products";

export type PurchasePrices = {
  audiobook: string;
  deepening: string;
  upgrade: string;
  privateTest: boolean;
};

// The temporary one-cent exception has been removed after the live purchase test.
// All accounts now receive the normal catalogue prices.
export const STANDARD_PURCHASE_PRICES: PurchasePrices = {
  audiobook: PRODUCTS[AUDIOBOOK_PRODUCT].amount,
  deepening: PRODUCTS[DEEPENING_PRODUCT].amount,
  upgrade: DEEPENING_UPGRADE_AMOUNT,
  privateTest: false,
};

export function expectedPriceMatches(expected: unknown, actual: string) {
  return expected === undefined || expected === actual;
}
