/**
 * POST /api/stripe-webhook  (Stripe → shop, when a checkout is paid)
 * Deducts stock and emails the team about the new order.
 * The event is re-fetched from Stripe with the shop's own key, so a fake request can't trigger anything.
 */
import { stripe, json } from "../_lib/stripe.js";
import { db, hasDB } from "../_lib/db.js";
import { recordSession } from "../_lib/inventory.js";
import { notifyOrder } from "../_lib/notify.js";

const TYPES = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  if (!body || !/^evt_[A-Za-z0-9]+$/.test(body.id || "") || !TYPES.includes(body.type)) return json({ ok: true, ignored: true });
  let ev;
  try { ev = await stripe(env, `events/${body.id}`); } catch { return json({ error: "unknown event" }, 400); }
  const sid = ev?.data?.object?.id;
  if (!TYPES.includes(ev.type) || !/^cs_/.test(sid || "")) return json({ ok: true, ignored: true });
  const p = new URLSearchParams();
  p.append("expand[]", "line_items");
  p.append("expand[]", "payment_intent");
  const s = await stripe(env, `checkout/sessions/${sid}`, { params: p });
  if (s.payment_status !== "paid" || !hasDB(env)) return json({ ok: true, paid: s.payment_status === "paid" });
  const D = await db(env);
  try { await recordSession(D, s); } catch (e) { console.error("stock", e.message); }
  let sent = false;
  try { sent = await notifyOrder(env, D, s); } catch (e) { console.error("notify", e.message); }
  return json({ ok: true, emailed: sent });
}
