/**
 * POST /api/stripe-webhook  (Stripe → shop, when a checkout is paid)
 * Deducts stock and emails the team about the new order.
 * Security: the Stripe-Signature header is checked with the Cloudflare secret STRIPE_WEBHOOK_SECRET
 * (whsec_…, from the webhook destination in Stripe), and the event is then re-fetched from Stripe
 * with the shop's own key, so a fake request can't trigger anything.
 */
import { stripe, json } from "../_lib/stripe.js";
import { db, hasDB } from "../_lib/db.js";
import { recordSession } from "../_lib/inventory.js";
import { notifyOrder, balancePaidAlert } from "../_lib/notify.js";

const TYPES = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false }, 503);
  const raw = await request.text();
  // one signing secret per Stripe account (House of Qi's own, and the earlier shared one)
  const clean = (x) => String(x || "").trim().replace(/^["']|["']$/g, "");
  const secrets = [clean(env.STRIPE_WEBHOOK_SECRET), clean(env.STRIPE_OLD_WEBHOOK_SECRET)].filter(Boolean);
  const whsec = secrets[0] || "";
  let okSig = !secrets.length;
  for (const sec of secrets) if (await validSignature(sec, request.headers.get("Stripe-Signature") || "", raw)) { okSig = true; break; }
  if (!okSig) {
    console.error("webhook: bad signature", (request.headers.get("Stripe-Signature") || "").slice(0, 20), "secret length", whsec.length, "starts", whsec.slice(0, 6));
    return json({ error: "bad signature" }, 400);
  }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad request" }, 400); }
  if (!body || !/^evt_[A-Za-z0-9]+$/.test(body.id || "") || !TYPES.includes(body.type)) return json({ ok: true, ignored: true });
  let ev;
  try { ev = await stripe(env, `events/${body.id}`); } catch { return json({ error: "unknown event" }, 400); }
  const sid = ev?.data?.object?.id;
  if (!TYPES.includes(ev.type) || !/^cs_/.test(sid || "")) return json({ ok: true, ignored: true });
  const p = new URLSearchParams();
  p.append("expand[]", "line_items");
  p.append("expand[]", "payment_intent");
  const s = await stripe(env, `checkout/sessions/${sid}`, { params: p });
  if (s.payment_status !== "paid") return json({ ok: true, paid: false });
  // the Stripe account is shared with another business: only House of Qi payments are handled here
  if (!(s.metadata || {}).order_no && !(s.metadata || {}).hq_balance) return json({ ok: true, ignored: "not a House of Qi payment" });
  // a pre-order balance was paid: mark the original order, tell the team
  if ((s.metadata || {}).hq_balance) {
    const m = s.metadata, u = new URLSearchParams();
    u.append("metadata[balance_status]", "paid");
    u.append("metadata[balance_paid_at]", String(s.created || Math.floor(Date.now() / 1000)));
    try { if (/^pi_/.test(m.parent_pi || "")) await stripe(env, `payment_intents/${m.parent_pi}`, { method: "POST", params: u }); } catch (e) { console.error("balance paid", e.message); }
    try { if (hasDB(env)) await balancePaidAlert(env, await db(env), s); } catch (e) { console.error("balance alert", e.message); }
    return json({ ok: true, balance: true });
  }
  if (!hasDB(env)) return json({ ok: true, paid: true });
  const D = await db(env);
  try { await recordSession(D, s); } catch (e) { console.error("stock", e.message); }
  let sent = false;
  try { sent = await notifyOrder(env, D, s); } catch (e) { console.error("notify", e.message); }
  return json({ ok: true, emailed: sent });
}

/** Stripe signature: header "t=<time>,v1=<hex>"; v1 = HMAC-SHA256(secret, "<time>.<raw body>"); reject if older than 5 minutes */
async function validSignature(secret, header, raw) {
  const parts = Object.fromEntries(header.split(",").map((x) => x.split("=")).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(",").filter((x) => x.trim().startsWith("v1=")).map((x) => x.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const want = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === want.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0);
}
