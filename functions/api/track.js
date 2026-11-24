/**
 * Order tracking for customers.
 *   GET  /api/track?o=HQ-...&k=<key>     (link from the thank-you screen)
 *   POST /api/track  { order, email }    (typed in on the Track page)
 * Returns progress and items only, never the address or payment details.
 */
import { stripe, stripeKeys, toOrder, json } from "../_lib/stripe.js";

const ORDER_RE = /^HQ-\d{6}-[A-Z0-9]{4}$/;

async function findSession(env, orderNo) {
  for (const key of stripeKeys(env)) { // House of Qi's own account, then the earlier shared one
    const q = new URLSearchParams({ query: `metadata['order_no']:'${orderNo}'`, limit: "1" });
    const found = await stripe(env, "payment_intents/search", { params: q, key });
    const pi = found.data[0];
    if (!pi) continue;
    const p = new URLSearchParams({ payment_intent: pi.id, limit: "1" });
    p.append("expand[]", "data.line_items");
    const list = await stripe(env, "checkout/sessions", { params: p, key });
    const s = list.data[0];
    if (!s) continue;
    s.payment_intent = pi;
    return s;
  }
  return null;
}

async function lookup(env, orderNo, check) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Tracking is not available right now." }, 503);
  orderNo = String(orderNo || "").trim().toUpperCase();
  if (!ORDER_RE.test(orderNo)) return json({ error: "Please check the order number. It looks like HQ-261112-AB12." }, 400);
  try {
    const s = await findSession(env, orderNo);
    if (!s || !check(s)) return json({ error: "We couldn't find that order. Check the order number and email, or contact us." }, 404);
    const o = toOrder(s);
    return json(o);
  } catch (e) {
    console.error("track", e.message);
    return json({ error: "Tracking is not available right now. Please try again shortly." }, 502);
  }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const k = u.searchParams.get("k") || "";
  return lookup(env, u.searchParams.get("o"), (s) => k.length >= 12 && (s.metadata?.track_key === k || s.payment_intent?.metadata?.track_key === k));
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const email = String(b.email || "").trim().toLowerCase();
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  return lookup(env, b.order, (s) => !!email && (s.customer_details?.email || "").toLowerCase() === email);
}
