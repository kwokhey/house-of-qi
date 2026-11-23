/**
 * GET /api/admin/sales?month=2026-11   (login required)
 * Monthly sales report (Malaysia time):
 *   online  — paid website orders from Stripe (orders, pre-order deposits, pre-order balances), with refunds
 *   offline — sales recorded in Stock → Sold offline
 * Test / removed orders (hidden from Orders) are left out.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB, getSetting, itemName, itemDetails } from "../../_lib/db.js";
import { stripe, toOrder, json } from "../../_lib/stripe.js";

const KL = 8 * 3600 * 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  const m = (new URL(request.url).searchParams.get("month") || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return json({ error: "Choose a month." }, 400);
  const y = +m[1], mo = +m[2];
  if (mo < 1 || mo > 12) return json({ error: "Choose a month." }, 400);
  const from = Date.UTC(y, mo - 1, 1) - KL, to = Date.UTC(y, mo, 1) - KL; // month in Malaysia time

  const D = hasDB(env) ? await db(env) : null;

  /* ---------- online (Stripe) ---------- */
  const online = [];
  let onlineError = "";
  if (env.STRIPE_SECRET_KEY) {
    let hiddenBefore = 0, hidden = new Set();
    if (D) {
      hiddenBefore = Number(await getSetting(D, "orders_hidden_before")) || 0;
      try { const v = JSON.parse((await getSetting(D, "orders_hidden_ids")) || "[]"); if (Array.isArray(v)) hidden = new Set(v); } catch {}
    }
    try {
      let after = "";
      for (let page = 0; page < 30; page++) {
        const p = new URLSearchParams({ limit: "100", status: "complete" });
        p.set("created[gte]", String(Math.floor(from / 1000)));
        p.set("created[lt]", String(Math.floor(to / 1000)));
        p.append("expand[]", "data.line_items");
        p.append("expand[]", "data.payment_intent.latest_charge");
        if (after) p.set("starting_after", after);
        const list = await stripe(env, "checkout/sessions", { params: p });
        for (const s of list.data) {
          const md = s.metadata || {};
          if (s.payment_status !== "paid") continue;
          if (!md.order_no && !md.hq_balance) continue; // not a House of Qi shop payment
          if (s.created <= hiddenBefore) continue;
          if (hidden.has(s.id) || (md.parent_session && hidden.has(md.parent_session))) continue; // removed test orders (and their balance)
          const ch = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent.latest_charge : null;
          const refunded = ch && typeof ch === "object" ? (ch.amount_refunded || 0) / 100 : 0;
          const c = s.customer_details || {};
          if (md.hq_balance) {
            online.push({ date: s.created * 1000, orderNo: md.hq_balance, type: "Pre-order balance", customer: c.name || "", email: c.email || "",
              items: "Balance (remaining 50% + delivery)", pieces: 0, subtotal: r2((s.amount_subtotal || 0) / 100), discount: 0, delivery: 0,
              total: r2((s.amount_total || 0) / 100), refunded: r2(refunded) });
            continue;
          }
          const o = toOrder(s, { full: true });
          online.push({
            date: s.created * 1000, orderNo: o.orderNo, type: o.preorder ? "Pre-order deposit" : "Order", customer: o.name || "", email: o.email || "",
            items: o.items.map((it) => `${it.qty}× ${String(it.name).replace(/ · Pre-order 50% deposit$/, "")}`).join(", "),
            pieces: o.items.reduce((a, it) => a + (it.qty || 0), 0),
            subtotal: r2(o.subtotal), discount: r2(o.discount), delivery: r2(o.shipping), total: r2(o.total), refunded: r2(refunded),
            code: o.coupon || "", delivery_to: o.delivery || "",
          });
        }
        if (!list.has_more || !list.data.length) break;
        after = list.data[list.data.length - 1].id;
      }
    } catch (e) {
      console.error("sales online", e.message);
      onlineError = "Couldn't load website orders from Stripe.";
    }
  }
  online.sort((a, b) => a.date - b.date);

  /* ---------- offline (Stock → Sold offline) ---------- */
  let offline = [];
  if (D) {
    const { results } = await D.prepare(
      `SELECT m.id, m.item_id, m.qty, m.unit_price, m.unit_cost, m.channel, m.note, m.invoice, m.created_at, i.stone, i.type, i.variant, i.size_mm
       FROM movements m LEFT JOIN items i ON i.id = m.item_id
       WHERE m.kind = 'sale' AND m.ref NOT LIKE 'cs_%' AND m.created_at >= ? AND m.created_at < ? ORDER BY m.created_at`
    ).bind(from, to).all();
    offline = results.map((r) => {
      const qty = -r.qty, price = r2(r.unit_price), cost = r2(r.unit_cost);
      return {
        date: r.created_at, invoice: r.invoice || "", itemId: r.item_id, item: r.stone ? itemName(r) : r.item_id, details: r.stone ? itemDetails(r) : "",
        qty, price, amount: r2(qty * price), cost, profit: r2(qty * (price - cost)), channel: r.channel || "Offline", note: r.note || "",
      };
    });
  }

  const sum = (a, k) => r2(a.reduce((t, x) => t + (x[k] || 0), 0));
  const on = { count: online.filter((x) => x.type !== "Pre-order balance").length, pieces: sum(online, "pieces"), gross: sum(online, "total"), refunded: sum(online, "refunded") };
  on.net = r2(on.gross - on.refunded);
  const off = { count: offline.length, pieces: sum(offline, "qty"), gross: sum(offline, "amount"), refunded: 0, net: sum(offline, "amount"), profit: sum(offline, "profit") };
  return json({
    month: `${m[1]}-${m[2]}`, online, offline, onlineError,
    summary: { online: on, offline: off, total: { count: on.count + off.count, pieces: on.pieces + off.pieces, gross: r2(on.gross + off.gross), refunded: on.refunded, net: r2(on.net + off.net) } },
  });
}
