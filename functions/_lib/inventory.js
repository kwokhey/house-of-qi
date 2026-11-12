/**
 * Keeps stock in step with Stripe.
 * Paid website orders are read from Stripe and deducted from stock once
 * (each order is recorded by its Checkout Session id, so running this twice is safe).
 * It runs automatically when the shop, the thank-you screen or the order page loads.
 */
import { db, hasDB, getSetting, setSetting } from "./db.js";
import { stripe } from "./stripe.js";

/** Item ids and quantities stored on the session, e.g. metadata s1 = "LRM-1001:1" */
export function stockLines(meta = {}) {
  const out = [];
  for (const [k, v] of Object.entries(meta)) {
    if (!/^s\d+$/.test(k)) continue;
    const m = String(v).match(/^(.+):(\d+)$/);
    if (m) out.push({ id: m[1], qty: Number(m[2]) });
  }
  return out;
}

/** Record one paid session against stock. Returns the number of lines recorded. */
export async function recordSession(D, s) {
  if (!(s.payment_status === "paid" || s.payment_status === "no_payment_required")) return 0;
  const lines = stockLines(s.metadata);
  if (!lines.length) return 0;
  const now = Date.now();
  let n = 0;
  for (const l of lines) {
    const item = await D.prepare("SELECT price, cost FROM items WHERE id = ?").bind(l.id).first();
    const ins = await D.prepare(
      "INSERT OR IGNORE INTO movements (item_id, kind, qty, unit_price, unit_cost, channel, ref, note, created_at) VALUES (?, 'sale', ?, ?, ?, 'Website', ?, ?, ?)"
    ).bind(l.id, -l.qty, item ? item.price : null, item ? item.cost : null, s.id, s.metadata?.order_no || "", (s.created || 0) * 1000 || now).run();
    if (ins.meta.changes > 0) {
      await D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(l.qty, now, l.id).run();
      n++;
    }
  }
  return n;
}

/** Look through recent paid Stripe orders and deduct any not yet recorded. */
export async function syncSales(env, { force = false } = {}) {
  if (!hasDB(env) || !env.STRIPE_SECRET_KEY) return 0;
  const D = await db(env);
  const now = Date.now();
  const lastRun = Number(await getSetting(D, "sync_run")) || 0;
  if (!force && now - lastRun < 30_000) return 0;
  await setSetting(D, "sync_run", now);

  const since = Number(await getSetting(D, "sync_since")) || Math.floor(now / 1000) - 30 * 86400;
  let after = null, newest = since, recorded = 0;
  for (let page = 0; page < 5; page++) {
    const p = new URLSearchParams({ limit: "100", status: "complete" });
    p.set("created[gte]", String(since - 3600));
    if (after) p.set("starting_after", after);
    const list = await stripe(env, "checkout/sessions", { params: p });
    for (const s of list.data) {
      if (!s.metadata?.order_no) continue;
      recorded += await recordSession(D, s);
      if (s.created > newest) newest = s.created;
    }
    if (!list.has_more) break;
    after = list.data[list.data.length - 1].id;
  }
  await setSetting(D, "sync_since", newest);
  return recorded;
}
