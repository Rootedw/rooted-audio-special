export function testEmailAllowed(email: unknown, configured: string | undefined): boolean {
  if (typeof email !== 'string' || !configured) return false;
  const candidate = email.trim().toLowerCase();
  return candidate.length > 0 && configured.split(',').some(value => value.trim().toLowerCase() === candidate);
}

export type RegistrationMode = 'invite' | 'public';

export function registrationMode(configured: string | undefined): RegistrationMode {
  return configured?.trim().toLowerCase() === 'public' ? 'public' : 'invite';
}

export function accountEmailAllowed(
  email: unknown,
  mode: RegistrationMode,
  configured: string | undefined,
): boolean {
  if (typeof email !== 'string' || !email.trim()) return false;
  return mode === 'public' || testEmailAllowed(email, configured);
}
const publicBrandAssets = new Set([
  '/assets/rooted-within-logo.png',
  '/assets/go-blueprint-cover.jpeg',
  '/assets/go-blueprint-deepening.jpeg',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/sw.js',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/apple-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/rooted-within-apple-touch-icon.png',
  '/rooted-within-icon-192.png',
  '/rooted-within-icon-512.png',
  '/rooted-within-icon-maskable-512.png',
]);

export function testEntryPath(path: string): boolean {
  return ['/shop', '/checkout', '/checkout/complete', '/auth/activate', '/auth/activate/confirm', '/auth/login', '/auth/register', '/auth/reset', '/auth/callback', '/auth/recovery', '/auth/recovery/confirm'].includes(path)
    || path.startsWith('/_next/static/') || publicBrandAssets.has(path);
}

// No customer routes are public through this exception; the handler verifies Mollie and the stored order.
export function paymentWebhookRequest(path: string, method: string): boolean {
  return method === 'POST' && path === '/api/payments/webhook';
}
