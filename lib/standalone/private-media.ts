import { createAccountClient } from './auth-server';

// The user's verified Supabase session stays server-side. No public or signed
// media URLs are returned to the player. Storage applies its own product RLS.
export async function fetchPrivateMedia(bucket: string, file: string, request: Request) {
  const client = await createAccountClient();
  const { data, error } = await client.auth.getSession();
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (error || !data.session?.access_token || !origin || !key) {
    throw new Error('Media service unavailable');
  }
  const headers = new Headers({
    apikey: key,
    Authorization: `Bearer ${data.session.access_token}`,
  });
  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);
  const path = [bucket, file].map(encodeURIComponent).join('/');
  return fetch(`${origin.replace(/\/$/, '')}/storage/v1/object/authenticated/${path}`, {
    headers, cache: 'no-store', redirect: 'error', signal: request.signal,
  });
}
