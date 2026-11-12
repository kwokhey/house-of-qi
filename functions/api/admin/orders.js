/**
 * GET /api/admin/orders?after=cs_...   (login required)
 * Lists paid orders from Stripe, newest first, 30 at a time.
 */
import { isAdmin } from "../../_lib/auth.js";
import { stripe, toOrder, json } from "../../_lib/stripe.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe is not connected." }, 503);

  const after = new URL(request.url).searchParams.get("after") || "";
  const p = new URLSearchParams({ limit: "30", status: "complete" });
  p.append("expand[]", "data.line_items");
  p.append("expand[]", "data.payment_intent");
  if (/^cs_(test|live)_[A-Za-z0-9]+$/.test(after)) p.set("starting_after", after);

  try {
    const list = await stripe(env, "checkout/sessions", { params: p });
    const orders = list.data
      .filter((s) => (s.metadata || {}).order_no) // only House of Qi shop orders
      .map((s) => toOrder(s, { full: true }));
    const last = list.data[list.data.length - 1];
    return json({ orders, more: list.has_more, next: last ? last.id : null, mode: env.STRIPE_SECRET_KEY.includes("_test_") ? "test" : "live" });
  } catch (e) {
    console.error("orders", e.message);
    return json({ error: "Couldn't load orders from Stripe. Please refresh." }, 502);
  }
}
