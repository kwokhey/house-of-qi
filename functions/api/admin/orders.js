/**
 * GET  /api/admin/orders?after=cs_...   (login required)
 *   Lists paid orders from Stripe, newest first, 30 at a time.
 * POST /api/admin/orders { action: "clearTest" }   (test mode only)
 *   Hides every test order placed so far and takes its sales off the stock records.
 *   A piece goes back into stock unless a stock import has reset that item's count since.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB, getSetting, setSetting } from "../../_lib/db.js";
import { stripe, toOrder, json } from "../../_lib/stripe.js";
import { syncSales } from "../../_lib/inventory.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe is not connected." }, 503);

  const after = new URL(request.url).searchParams.get("after") || "";
  const p = new URLSearchParams({ limit: "30", status: "complete" });
  p.append("expand[]", "data.line_items");
  p.append("expand[]", "data.payment_intent");
  if (/^cs_(test|live)_[A-Za-z0-9]+$/.test(after)) p.set("starting_after", after);

  try { await syncSales(env); } catch (e) { console.error("sync", e.message); }
  const hiddenBefore = hasDB(env) ? Number(await getSetting(await db(env), "orders_hidden_before")) || 0 : 0;
  try {
    const list = await stripe(env, "checkout/sessions", { params: p });
    const orders = list.data
      .filter((s) => (s.metadata || {}).order_no) // only House of Qi shop orders
      .filter((s) => s.created > hiddenBefore) // test orders that were cleared
      .map((s) => toOrder(s, { full: true }));
    const last = list.data[list.data.length - 1];
    return json({ orders, more: list.has_more, next: last ? last.id : null, mode: env.STRIPE_SECRET_KEY.includes("_test_") ? "test" : "live" });
  } catch (e) {
    console.error("orders", e.message);
    return json({ error: "Couldn't load orders from Stripe. Please refresh." }, 502);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.action !== "clearTest") return json({ error: "Unknown action." }, 400);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_SECRET_KEY.includes("_test_")) return json({ error: "Only test orders can be cleared, and the shop is taking real payments." }, 400);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  try { await syncSales(env, { force: true }); } catch (e) { console.error("sync", e.message); }
  const D = await db(env);
  const now = Date.now();
  const { results } = await D.prepare("SELECT id, item_id, qty, created_at FROM movements WHERE kind = 'sale' AND ref LIKE 'cs_test_%'").all();
  let restocked = 0, kept = 0;
  for (const m of results) {
    const reset = await D.prepare("SELECT 1 FROM movements WHERE item_id = ? AND kind = 'adjust' AND note = 'Imported count' AND created_at > ? LIMIT 1").bind(m.item_id, m.created_at).first();
    if (reset) kept++;
    else { await D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(m.qty, now, m.item_id).run(); restocked++; } // qty is negative for a sale
    await D.prepare("DELETE FROM movements WHERE id = ?").bind(m.id).run();
  }
  await D.prepare("DELETE FROM coupon_uses WHERE ref LIKE 'cs_test_%'").run();
  await setSetting(D, "orders_hidden_before", Math.floor(now / 1000));
  return json({ ok: true, cleared: results.length, restocked, kept });
}
