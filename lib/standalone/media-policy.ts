export const AUDIO_BUCKET = 'go-blueprint-audio';
export const WORKBOOK_BUCKET = 'go-blueprint-workbooks';
export const WORKBOOK_FILES: Record<string, string> = {
  fillable: 'GO_BLUEPRINT_Workbook_Invulbaar.pdf',
  print: 'GO_BLUEPRINT_Workbook_Printversie.pdf',
};

// A successful upstream body is forwarded without re-encoding or full buffering.
// Never forward storage credentials, locations, cookies, or public cache headers.
export function privateMediaResponse(upstream: Response, type: string, disposition?: string) {
  if (upstream.status === 416) {
    const headers = new Headers({ 'Cache-Control': 'private, no-store' });
    const range = upstream.headers.get('Content-Range');
    if (range) headers.set('Content-Range', range);
    return new Response(null, { status: 416, headers });
  }
  if (upstream.status !== 200 && upstream.status !== 206) {
    return Response.json({ error: 'MEDIA_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  });
  for (const key of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (disposition) headers.set('Content-Disposition', disposition);
  return new Response(upstream.body, { status: upstream.status, headers });
}

export function mediaError(status: number, code: string) {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
