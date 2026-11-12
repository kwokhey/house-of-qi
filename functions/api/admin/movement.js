/**
 * Change stock (login required).
 *   POST /api/admin/movement
 *     { itemId, kind: "sale" | "restock" | "adjust", qty, price?, cost?, channel?, note? }
 *     sale    → offline sale (Instagram, WhatsApp, bazaar…): stock goes down by qty
 *     restock → new stock arrived: stock goes up by qty (cost updates the item's cost)
 *     adjust  → set the counted stock to qty (e.g. after a stock take)
 *   GET  /api/admin/movement?id=ITEM  → history for one item
 *   DELETE /api/admin/movement?mid=N  → undo an offline sale, restock or adjustment
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  return null;
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const item = await D.prepare("SELECT * FROM items WHERE id = ?").bind(String(b.itemId || "")).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const qty = Math.floor(Number(b.qty));
  const now = Date.now();
  const channel = String(b.channel || "").slice(0, 40);
  const note = String(b.note || "").trim().slice(0, 200);

  if (b.kind === "sale") {
    if (!(qty >= 1)) return json({ error: "Enter how many were sold." }, 400);
    if (qty > item.stock) return json({ error: `Only ${item.stock} in stock. Use Adjust if the count is wrong.` }, 400);
    const price = Number.isFinite(Number(b.price)) && b.price !== "" ? Number(b.price) : item.price;
    await D.batch([
      D.prepare("INSERT INTO movements (item_id, kind, qty, unit_price, unit_cost, channel, note, created_at) VALUES (?, 'sale', ?, ?, ?, ?, ?, ?)").bind(item.id, -qty, price, item.cost, channel || "Offline", note, now),
      D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(qty, now, item.id),
    ]);
  } else if (b.kind === "restock") {
    if (!(qty >= 1)) return json({ error: "Enter how many arrived." }, 400);
    const cost = Number.isFinite(Number(b.cost)) && b.cost !== "" ? Number(b.cost) : item.cost;
    await D.batch([
      D.prepare("INSERT INTO movements (item_id, kind, qty, unit_cost, channel, note, created_at) VALUES (?, 'restock', ?, ?, ?, ?, ?)").bind(item.id, qty, cost, channel, note, now),
      D.prepare("UPDATE items SET stock = stock + ?, stock_in = stock_in + ?, cost = ?, updated_at = ? WHERE id = ?").bind(qty, qty, cost, now, item.id),
    ]);
  } else if (b.kind === "adjust") {
    if (!(qty >= 0)) return json({ error: "Enter the number you counted." }, 400);
    const diff = qty - item.stock;
    if (!diff) return json({ ok: true, item });
    await D.batch([
      D.prepare("INSERT INTO movements (item_id, kind, qty, channel, note, created_at) VALUES (?, 'adjust', ?, '', ?, ?)").bind(item.id, diff, note || "Stock count", now),
      D.prepare("UPDATE items SET stock = ?, updated_at = ? WHERE id = ?").bind(qty, now, item.id),
    ]);
  } else {
    return json({ error: "Unknown change." }, 400);
  }
  return json({ ok: true, item: await D.prepare("SELECT * FROM items WHERE id = ?").bind(item.id).first() });
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const { results } = await D.prepare("SELECT * FROM movements WHERE item_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").bind(id).all();
  return json({ movements: results });
}

export async function onRequestDelete({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const mid = Number(new URL(request.url).searchParams.get("mid"));
  const m = await D.prepare("SELECT * FROM movements WHERE id = ?").bind(mid).first();
  if (!m) return json({ error: "Not found." }, 404);
  if (m.ref) return json({ error: "Website orders can't be undone here. Use Adjust to correct the stock (e.g. after a refund)." }, 400);
  const now = Date.now();
  const back = m.kind === "restock" ? "stock = stock - ?, stock_in = stock_in - ?" : "stock = stock - ?";
  const vals = m.kind === "restock" ? [m.qty, m.qty] : [m.qty];
  await D.batch([
    D.prepare("DELETE FROM movements WHERE id = ?").bind(mid),
    D.prepare(`UPDATE items SET ${back}, updated_at = ? WHERE id = ?`).bind(...vals, now, m.item_id),
  ]);
  return json({ ok: true });
}
