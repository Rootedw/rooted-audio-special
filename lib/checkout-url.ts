// Exact provider-owned checkout hosts. iDEAL may be returned directly by
// Mollie when it is the only available method for a very small payment.
// Official iDEAL security guidance: https://ideal.nl/veiligheid
const CHECKOUT_HOSTS = new Set(["www.mollie.com", "mollie.com", "checkout.mollie.com", "pay.ideal.nl"]);
export function trustedCheckoutUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !CHECKOUT_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
