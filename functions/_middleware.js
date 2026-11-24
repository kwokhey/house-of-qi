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

/**
 * House of Qi has its own Stripe account since 25 Nov 2026. Its keys are saved as
 * STRIPE_HQ_SECRET_KEY / STRIPE_HQ_WEBHOOK_SECRET; the existing STRIPE_SECRET_KEY /
 * STRIPE_WEBHOOK_SECRET stay as the earlier shared account (for older orders).
 * Here they're arranged so the rest of the code sees the new account as the main one.
 */
function stripeAccounts(env) {
  if (!env || env.__hqStripe || !env.STRIPE_HQ_SECRET_KEY) return;
  const oldKey = env.STRIPE_SECRET_KEY, oldHook = env.STRIPE_WEBHOOK_SECRET;
  env.STRIPE_SECRET_KEY = env.STRIPE_HQ_SECRET_KEY;
  env.STRIPE_OLD_SECRET_KEY = env.STRIPE_OLD_SECRET_KEY || oldKey;
  if (env.STRIPE_HQ_WEBHOOK_SECRET) {
    env.STRIPE_WEBHOOK_SECRET = env.STRIPE_HQ_WEBHOOK_SECRET;
    env.STRIPE_OLD_WEBHOOK_SECRET = env.STRIPE_OLD_WEBHOOK_SECRET || oldHook;
  }
  env.__hqStripe = true;
}

export async function onRequest({ request, next, env }) {
  stripeAccounts(env);
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
