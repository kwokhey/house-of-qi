/**
 * Request protection used by functions/_middleware.js:
 *  - rate limits per visitor IP (counts kept in D1, table "ratelimit")
 *  - admin writes must come from this site (blocks cross-site form posts)
 *  - security headers on every response
 */
const RULES = [
  // [method, path test, bucket, max requests, window in seconds]
  ["POST", (p) => p === "/api/admin/login", "login", 8, 15 * 60],
  ["POST", (p) => p === "/api/checkout", "checkout", 20, 10 * 60],
  ["POST", (p) => p === "/api/coupon", "coupon", 40, 10 * 60],
  ["POST", (p) => p === "/api/admin/test-email", "testmail", 10, 60 * 60],
  ["GET", (p) => p === "/api/order" || p === "/api/track" || p.startsWith("/a/"), "lookup", 60, 10 * 60],
  ["*", (p) => p.startsWith("/api/admin/"), "admin", 600, 10 * 60],
  ["POST", (p) => p.startsWith("/api/") && p !== "/api/stripe-webhook", "api", 120, 10 * 60],
];

let tableReady = false;

/** Returns a 429 Response when over the limit, otherwise null. Fails open if the database is unavailable. */
export async function rateLimit(env, request, path) {
  const rule = RULES.find(([m, test]) => (m === "*" || m === request.method) && test(path));
  if (!rule || !env.DB) return null;
  const [, , bucket, max, win] = rule;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const key = `${bucket}:${ip}`;
  try {
    if (!tableReady) {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS ratelimit (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)").run();
      tableReady = true;
    }
    const row = await env.DB.prepare(
      `INSERT INTO ratelimit (k, n, reset) VALUES (?, 1, ?)
       ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset <= ? THEN 1 ELSE n + 1 END,
                                    reset = CASE WHEN reset <= ? THEN ? ELSE reset END
       RETURNING n, reset`
    ).bind(key, now + win, now, now, now + win).first();
    if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM ratelimit WHERE reset < ?").bind(now).run(); // tidy up now and then
    if (row && row.n > max) {
      const wait = Math.max(1, row.reset - now);
      return new Response(JSON.stringify({ error: "Too many attempts. Please wait a few minutes and try again." }), {
        status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(wait), "Cache-Control": "no-store" },
      });
    }
  } catch (e) {
    console.error("ratelimit", e.message);
  }
  return null;
}

/** Admin changes must come from a page on this site (the login cookie is also SameSite=Strict). */
export function crossSiteAdminWrite(request, url) {
  if (!url.pathname.startsWith("/api/admin/") || request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("Origin");
  if (!origin) return request.headers.get("Sec-Fetch-Site") === "cross-site";
  try { return new URL(origin).host !== url.host; } catch { return true; }
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

/** Add security headers to a response (HTML pages get the content security policy) */
export function secure(res) {
  const r = new Response(res.body, res);
  const h = r.headers;
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  if ((h.get("Content-Type") || "").includes("text/html")) h.set("Content-Security-Policy", CSP);
  return r;
}
