import { readAccountEntitlements } from "./standalone/preferences";
import type { ChatGPTUser } from "../app/chatgpt-auth";

import { SPECIAL_PRODUCT } from "./special-sales";
import { AUDIOBOOK_PRODUCT, DEEPENING_PRODUCT } from "./products";
export { AUDIOBOOK_PRODUCT, DEEPENING_PRODUCT } from "./products";

export function isOwner(user: ChatGPTUser) {
  const owner = process.env.ROOTED_AUDIO_OWNER_EMAIL;
  return Boolean(owner && user.email.toLowerCase() === owner.toLowerCase());
}

export async function getEntitlements(user: ChatGPTUser) {
  try { return await readAccountEntitlements(user.userId); } catch { return []; }
}
export async function hasEntitlement(user: ChatGPTUser, productId: string) {
  const products = await getEntitlements(user);
  return products.includes(productId) ||
    (productId === AUDIOBOOK_PRODUCT && (products.includes(DEEPENING_PRODUCT) || products.includes(SPECIAL_PRODUCT)));
}
