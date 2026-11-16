/**
 * Consignment: pieces given to a seller (affiliate) to sell for the shop (login required).
 *   GET  /api/admin/consign?aff=N                         → what they hold + history
 *   POST /api/admin/consign { action: "give",   aff, item, qty, note? }        pieces leave shop stock, now with the seller
 *   POST /api/admin/consign { action: "sold",   aff, item, qty, price?, note? } seller sold them; she keeps her commission and owes the rest
 *   POST /api/admin/consign { action: "return", aff, item, qty, note? }        unsold pieces come back into shop stock
 *   POST /api/admin/consign { action: "undo",   id }                            reverse one entry
 *   POST /api/admin/consign { action: "received", aff }                        seller has paid what she owed
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB, itemName, itemDetails } from "../../_lib/db.js";
import { creditSale, holdings } from "../../_lib/affiliates.js";
import { json } from "../../_lib/stripe.js";

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The database isn't connected yet." }, 503);
  return null;
}
const held = async (D, aff, item) => (await D.prepare("SELECT COALESCE(SUM(CASE kind WHEN 'give' THEN qty ELSE -qty END),0) AS n FROM consign WHERE aff_id = ? AND item_id = ?").bind(aff, item).first()).n;
const label = (i) => `${itemName(i)}${itemDetails(i) ? " · " + itemDetails(i) : ""}`;

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const aff = Number(new URL(request.url).searchParams.get("aff"));
  const { results: log } = await D.prepare(`SELECT c.*, i.stone, i.type, i.variant, i.size_mm FROM consign c LEFT JOIN items i ON i.id = c.item_id
    WHERE c.aff_id = ? ORDER BY c.created_at DESC, c.id DESC LIMIT 200`).bind(aff).all();
  return json({ holding: await holdings(D, aff), log });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const b = await request.json().catch(() => ({}));
  const now = Date.now();
  const note = String(b.note || "").trim().slice(0, 200);

  if (b.action === "received") {
    const r = await D.prepare("UPDATE aff_sales SET paid_at = ? WHERE aff_id = ? AND channel = 'Consignment' AND paid_at = 0").bind(now, Number(b.aff)).run();
    return json({ ok: true, marked: r.meta.changes });
  }

  if (b.action === "undo") {
    const c = await D.prepare("SELECT * FROM consign WHERE id = ?").bind(Number(b.id)).first();
    if (!c) return json({ error: "Already undone." }, 404);
    const item = await D.prepare("SELECT * FROM items WHERE id = ?").bind(c.item_id).first();
    if (c.kind === "give" && (await held(D, c.aff_id, c.item_id)) < c.qty) return json({ error: "Some of these pieces were already sold or returned. Undo those first." }, 400);
    if (c.kind === "return" && item && item.stock < c.qty) return json({ error: "Those pieces have already sold from the shop, so the return can't be undone." }, 400);
    if (c.kind === "sold") {
      const s = await D.prepare("SELECT paid_at FROM aff_sales WHERE ref = ?").bind(`cn-${c.id}`).first();
      if (s && s.paid_at) return json({ error: "The money for this sale was already marked as received. Undo that first." }, 400);
    }
    const st = [D.prepare("DELETE FROM consign WHERE id = ?").bind(c.id)];
    if (c.mv_id) st.push(D.prepare("DELETE FROM movements WHERE id = ?").bind(c.mv_id));
    if (c.kind === "give") st.push(D.prepare("UPDATE items SET stock = stock + ?, updated_at = ? WHERE id = ?").bind(c.qty, now, c.item_id));
    if (c.kind === "return") st.push(D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(c.qty, now, c.item_id));
    if (c.kind === "sold") st.push(D.prepare("DELETE FROM aff_sales WHERE ref = ?").bind(`cn-${c.id}`));
    await D.batch(st);
    return json({ ok: true });
  }

  const aff = await D.prepare("SELECT * FROM affiliates WHERE id = ?").bind(Number(b.aff)).first();
  if (!aff) return json({ error: "Seller not found." }, 404);
  const item = await D.prepare("SELECT * FROM items WHERE id = ?").bind(String(b.item || "")).first();
  if (!item) return json({ error: "Please choose a piece." }, 400);
  const qty = Math.floor(Number(b.qty));
  if (!(qty >= 1)) return json({ error: "Please enter how many pieces." }, 400);

  if (b.action === "give") {
    if (qty > item.stock) return json({ error: `Only ${item.stock} of ${label(item)} in stock.` }, 400);
    const r = await D.batch([
      D.prepare("INSERT INTO movements (item_id, kind, qty, channel, note, created_at) VALUES (?, 'consign', ?, ?, ?, ?)").bind(item.id, -qty, aff.name, [`Given to ${aff.name} to sell`, note].filter(Boolean).join(" · "), now),
      D.prepare("UPDATE items SET stock = stock - ?, updated_at = ? WHERE id = ?").bind(qty, now, item.id),
    ]);
    await D.prepare("INSERT INTO consign (aff_id, item_id, kind, qty, unit_price, mv_id, note, created_at) VALUES (?, ?, 'give', ?, ?, ?, ?, ?)").bind(aff.id, item.id, qty, item.price, r[0].meta.last_row_id, note, now).run();
    return json({ ok: true });
  }

  const has = await held(D, aff.id, item.id);
  if (qty > has) return json({ error: `${aff.name} has ${has} of ${label(item)}.` }, 400);

  if (b.action === "sold") {
    const price = Number.isFinite(Number(b.price)) && b.price !== "" && b.price != null ? Number(b.price) : item.price;
    // the pieces already left shop stock when they were given, so stock doesn't change again
    const r = await D.prepare("INSERT INTO movements (item_id, kind, qty, unit_price, unit_cost, channel, note, created_at) VALUES (?, 'sale', ?, ?, ?, 'Consignment', ?, ?)")
      .bind(item.id, -qty, price, item.cost, [`Sold by ${aff.name} (her pieces)`, note].filter(Boolean).join(" · "), now).run();
    const c = await D.prepare("INSERT INTO consign (aff_id, item_id, kind, qty, unit_price, mv_id, note, created_at) VALUES (?, ?, 'sold', ?, ?, ?, ?, ?)").bind(aff.id, item.id, qty, price, r.meta.last_row_id, note, now).run();
    await creditSale(D, aff, { ref: `cn-${c.meta.last_row_id}`, channel: "Consignment", detail: `${qty}× ${label(item)}`, pieces: qty, amount: price * qty, created_at: now });
    return json({ ok: true });
  }

  if (b.action === "return") {
    const r = await D.batch([
      D.prepare("INSERT INTO movements (item_id, kind, qty, channel, note, created_at) VALUES (?, 'consign', ?, ?, ?, ?)").bind(item.id, qty, aff.name, [`Returned by ${aff.name}`, note].filter(Boolean).join(" · "), now),
      D.prepare("UPDATE items SET stock = stock + ?, updated_at = ? WHERE id = ?").bind(qty, now, item.id),
    ]);
    await D.prepare("INSERT INTO consign (aff_id, item_id, kind, qty, unit_price, mv_id, note, created_at) VALUES (?, ?, 'return', ?, ?, ?, ?, ?)").bind(aff.id, item.id, qty, item.price, r[0].meta.last_row_id, note, now).run();
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
}
