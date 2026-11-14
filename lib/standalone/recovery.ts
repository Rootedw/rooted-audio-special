// Recovery links must survive a browser/device change and GET-only mail scanners.
export function recoveryTokenHash(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,256}$/.test(value) ? value : null;
}
export async function verifyRecoveryToken(
  client: { auth: { verifyOtp: (params: {token_hash: string; type: 'recovery'}) => Promise<{data: {user: {email?: string; email_confirmed_at?: string} | null}; error: unknown}>; signOut: (params: {scope: 'local'}) => Promise<unknown> } },
  token: unknown,
  emailAllowed: (email: unknown) => boolean,
): Promise<boolean> {
  const tokenHash = recoveryTokenHash(token);
  if (!tokenHash) return false;
  const {data,error} = await client.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});
  if (error || !data.user?.email_confirmed_at || !emailAllowed(data.user.email)) {
    if (!error && data.user) await client.auth.signOut({scope:'local'});
    return false;
  }
  return true;
}
