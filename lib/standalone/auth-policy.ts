export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  try { const url = new URL(value, 'https://rooted.invalid'); return url.origin === 'https://rooted.invalid' ? url.pathname + url.search + url.hash : '/'; } catch { return '/'; }
}
export function accountLanguage(value: unknown): 'nl' | 'en' { return value === 'en' ? 'en' : 'nl'; }
