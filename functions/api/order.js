/**
 * GET /api/order?session_id=cs_...  (Cloudflare Pages Function)
 * Used by the thank-you screen after Stripe sends the customer back.
 * Returns only what that screen needs (no address or card details).
 */
import { stripe, toOrder, json } from "../_lib/stripe.js";
import { db, hasDB } from "../_lib/db.js";
import { recordSession } from "../_lib/inventory.js";
import { notifyOrder } from "../_lib/notify.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Order not found." }, 404);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments are not switched on yet." }, 503);

  try {
    const p = new URLSearchParams();
    p.append("expand[]", "line_items");
    p.append("expand[]", "payment_intent");
    const s = await stripe(env, `checkout/sessions/${id}`, { params: p });
    // deduct stock right away for this order (safe to repeat)
    if (hasDB(env)) {
      const D = await db(env);
      try { await recordSession(D, s); } catch (e) { console.error("stock", e.message); }
      // team email (backup for the Stripe webhook; sent once per order)
      try { await notifyOrder(env, D, s); } catch (e) { console.error("notify", e.message); }
    }
    const o = toOrder(s);
    const key = s.metadata?.track_key || "";
    return json({
      ...o,
      email: s.customer_details?.email || "",
      trackUrl: key ? `/track?o=${encodeURIComponent(o.orderNo)}&k=${encodeURIComponent(key)}` : "/track",
    });
  } catch {
    return json({ error: "Order not found." }, 404);
  }
}
