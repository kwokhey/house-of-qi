/**
 * Keeps stock in step with Stripe.
 * Paid website orders are read from Stripe and deducted from stock once
 * (each order is recorded by its Checkout Session id, so running this twice is safe).
 * It runs automatically when the shop, the thank-you screen or the order page loads.
 */
import { db, hasDB, getSetting, setSetting } from "./db.js";
import { stripe } from "./stripe.js";
import { creditSale } from "./affiliates.js";

/** Item ids and quantities stored on the session, e.g. metadata s1 = "LRM-1001:1" */
export function stockLines(meta = {}) {
  const out = [];
  for (const [k, v] of Object.entries(meta)) {
    if (!/^s\d+$/.test(k)) continue;
    // "ID:qty" or, since sales/coupons, "ID:qty:price actually paid per piece"
    const m = String(v).match(/^([^:]+):(\d+)(?::(\d+(?:\.\d+)?))?$/);
    if (m) out.push({ id: m[1], qty: Number(m[2]), price: m[3] != null ? Number(m[3]) : null });
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
    ).bind(l.id, -l.qty, l.price != null ? l.price : item ? item.price : null, item ? item.cost : null, s.id, s.metadata?.order_no || "", (s.created || 0) * 1000 || now).run();
    if (ins.meta.changes > 0) {
      await D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(l.qty, now, l.id).run();
      n++;
    }
  }
  // a friend's (affiliate) sale: what the customer paid for the pieces, delivery not included
  if (s.metadata?.aff) {
    const aff = await D.prepare("SELECT * FROM affiliates WHERE id = ?").bind(Number(s.metadata.aff)).first();
    if (aff) {
      const amount = lines.reduce((t, l) => t + (l.price != null ? l.price : 0) * l.qty, 0);
      const pieces = lines.reduce((t, l) => t + l.qty, 0);
      const detail = Object.keys(s.metadata).filter((k) => /^i\d+$/.test(k)).map((k) => String(s.metadata[k]).split(" · ")[0]).join(", ");
      await creditSale(D, aff, { ref: s.id, order_no: s.metadata.order_no || "", channel: "Website", detail, pieces, amount, created_at: (s.created || 0) * 1000 || now });
    }
  }
  // coupon usage (counts towards the code's limit and shows on the Marketing page)
  if (s.metadata?.coupon) {
    await D.prepare("INSERT OR IGNORE INTO coupon_uses (ref, code, discount, total, order_no, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(s.id, s.metadata.coupon, (s.total_details?.amount_discount ?? (Math.round(Number(s.metadata.coupon_off) * 100) || 0)) / 100,
        (s.amount_total || 0) / 100, s.metadata.order_no || "", (s.created || 0) * 1000 || now).run();
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

  // Only look back a little: the Stripe account also has checkouts from other shops, and reading
  // hundreds of them on every page view uses up the server's time limit.
  const since = Math.max(Number(await getSetting(D, "sync_since")) || 0, Math.floor(now / 1000) - 2 * 86400);
  // orders before a cleared test-order list, or before "Start over" in Stock, don't count towards stock again
  const hiddenBefore = Math.max(Number(await getSetting(D, "orders_hidden_before")) || 0, Number(await getSetting(D, "stock_reset_at")) || 0);
  let after = null, newest = since, recorded = 0;
  for (let page = 0; page < 2; page++) {
    const p = new URLSearchParams({ limit: "50", status: "complete" });
    p.set("created[gte]", String(since - 3600));
    if (after) p.set("starting_after", after);
    const list = await stripe(env, "checkout/sessions", { params: p });
    for (const s of list.data) {
      if (s.created > newest) newest = s.created; // move forward past every checkout seen, ours or not
      if (!s.metadata?.order_no || s.created <= hiddenBefore) continue;
      recorded += await recordSession(D, s);
    }
    if (!list.has_more) break;
    after = list.data[list.data.length - 1].id;
  }
  await setSetting(D, "sync_since", newest);
  return recorded;
}
