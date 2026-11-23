/**
 * POST /api/admin/refund { id: "cs_...", restock: true }   (login required)
 * Refunds a website order in full through Stripe: the payment, and for a pre-order also the balance if it was paid.
 * With restock, the pieces go back into stock and the sale comes off the Sold counts, coupon uses and seller sales
 * (rows are kept, marked refunded, so the automatic stock sync can't record the order again).
 * The order stays in Orders under "Refunded".
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { stripe, json } from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe is not connected." }, 503);
  const b = await request.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Unknown order." }, 400);

  let s;
  try {
    const p = new URLSearchParams(); p.append("expand[]", "payment_intent.latest_charge");
    s = await stripe(env, `checkout/sessions/${id}`, { params: p });
  } catch (e) { return json({ error: "Couldn't load this order from Stripe." }, 502); }
  if (s.payment_status !== "paid" || !s.payment_intent || typeof s.payment_intent !== "object") return json({ error: "This order has no payment to refund." }, 400);
  const pi = s.payment_intent;

  // the order's payment, plus a paid pre-order balance (its payment carries parent_pi = this payment)
  const pis = [pi];
  if ((s.metadata || {}).preorder === "1") {
    try {
      const q = new URLSearchParams({ query: `metadata['parent_pi']:'${pi.id}' AND status:'succeeded'` });
      q.append("expand[]", "data.latest_charge");
      const r = await stripe(env, "payment_intents/search", { params: q });
      pis.push(...(r.data || []));
    } catch (e) { console.error("balance search", e.message); }
  }

  let refunded = 0;
  const done = [];
  for (const x of pis) {
    const ch = x.latest_charge && typeof x.latest_charge === "object" ? x.latest_charge : null;
    const left = ch ? ch.amount - (ch.amount_refunded || 0) : x.amount_received || 0;
    if (left <= 0) continue; // already refunded
    try {
      const rp = new URLSearchParams({ payment_intent: x.id, reason: "requested_by_customer" });
      rp.append("metadata[order_no]", (s.metadata || {}).order_no || "");
      const rf = await stripe(env, "refunds", { method: "POST", params: rp });
      refunded += (rf.amount || 0) / 100;
      done.push(rf.status);
    } catch (e) {
      console.error("refund", e.message);
      return json({ error: `Stripe couldn't refund it: ${e.message}`, refunded }, 502);
    }
  }
  if (!done.length) return json({ error: "This order was already refunded." }, 400);

  // remember on the order
  try {
    const u = new URLSearchParams();
    u.append("metadata[refunded_at]", String(Math.floor(Date.now() / 1000)));
    u.append("metadata[refunded_amount]", String(Math.round(refunded * 100) / 100));
    await stripe(env, `payment_intents/${pi.id}`, { method: "POST", params: u });
  } catch (e) { console.error("refund mark", e.message); }

  // the sale comes off the records; pieces go back into stock unless the customer keeps them
  let restocked = 0;
  if (hasDB(env)) {
    const restock = b.restock !== false;
    const D = await db(env);
    const { results } = await D.prepare("SELECT id, item_id, qty FROM movements WHERE kind = 'sale' AND ref = ?").bind(id).all();
    for (const m of results) {
      if (restock) await D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(m.qty, Date.now(), m.item_id).run(); // qty is negative for a sale
      // kept as a 'refund' row (not deleted), so the stock sync never records this order again
      await D.prepare("UPDATE movements SET kind = 'refund', note = TRIM(note || ' · refunded') WHERE id = ?").bind(m.id).run();
      if (restock) restocked += -m.qty;
    }
    // same idea: keep the rows so they aren't added back, but they no longer count
    await D.prepare("UPDATE coupon_uses SET code = code || ' (refunded)', discount = 0, total = 0 WHERE ref = ? AND code NOT LIKE '% (refunded)'").bind(id).run();
    await D.prepare("UPDATE aff_sales SET amount = 0, commission = 0, pieces = 0, detail = 'Refunded · ' || detail WHERE ref = ? AND detail NOT LIKE 'Refunded · %'").bind(id).run();
  }
  return json({ ok: true, refunded: Math.round(refunded * 100) / 100, restocked, pending: done.some((x) => x === "pending") });
}
