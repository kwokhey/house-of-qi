/**
 * Runs before every request:
 * 1. One official address: house-of-qi.pages.dev and www.houseofqi.shop send visitors (and
 *    search engines) to https://houseofqi.shop with a permanent redirect. Only page visits
 *    (GET/HEAD) are redirected; preview deployments (xyz.house-of-qi.pages.dev) are left alone.
 * 2. Protection (functions/_lib/guard.js): admin changes only from this site, rate limits,
 *    and security headers.
 */
import { rateLimit, crossSiteAdminWrite, secure } from "./_lib/guard.js";

const OLD = new Set(["house-of-qi.pages.dev", "www.houseofqi.shop"]);

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  if (OLD.has(url.hostname) && (request.method === "GET" || request.method === "HEAD")) {
    url.hostname = "houseofqi.shop"; url.protocol = "https:"; url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  if (crossSiteAdminWrite(request, url)) {
    return new Response(JSON.stringify({ error: "Request blocked." }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const limited = await rateLimit(env, request, url.pathname);
  if (limited) return limited;
  return secure(await next());
}
