// Cookie-authenticated mutations require JSON and reject cross-site requests.
// Netlify can reconstruct request.url with an internal host. The configured
// application origin is trusted deployment configuration, never a client header.
export function isSameOriginMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = new Set([new URL(request.url).origin]);
    const configured = process.env.ROOTED_APP_ORIGIN;
    if (configured) {
      try { allowedOrigins.add(new URL(configured).origin); } catch { /* Invalid configuration is not trusted. */ }
    }
    if (!allowedOrigins.has(origin)) return false;
  }
  return request.headers.get("content-type")?.split(";", 1)[0].trim() === "application/json";
}
