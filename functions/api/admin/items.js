/**
 * Stock list and editing (login required).
 *   GET  /api/admin/items            → all items with sold / profit figures
 *   POST /api/admin/items            → create or update one item
 *        { id, stone, type, variant, size_mm, supplier, collection, cost, price,
 *          published, featured, zh, description, meaning, intentions, isNew, stock? }
 *   DELETE /api/admin/items?id=...   → remove an item (and its photo)
 */
import { isAdmin } from "../../_lib/auth.js";
import { itemDetails, setSetting, db, hasDB, cleanId, idOk, idKey } from "../../_lib/db.js";
import { syncSales } from "../../_lib/inventory.js";
import { json } from "../../_lib/stripe.js";
import { COLOURS, autoColour, isColour } from "../../_lib/colours.js";
import { stoneMeaning } from "../../_lib/stones.js";
import { defaultDescription } from "../../_lib/catalog.js";

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet.", setup: true }, 503);
  return null;
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  try { await syncSales(env); } catch (e) { console.error("sync", e.message); }
  const { results } = await D.prepare(`
    SELECT i.*,
      COALESCE((SELECT -SUM(qty) FROM movements m WHERE m.item_id = i.id AND m.kind = 'sale'), 0) AS sold,
      COALESCE((SELECT -SUM(qty) FROM movements m WHERE m.item_id = i.id AND m.kind = 'gift'), 0) AS gifted,
      COALESCE((SELECT MAX(created_at) FROM movements m WHERE m.item_id = i.id AND m.kind = 'gift'), 0) AS last_gift,
      COALESCE((SELECT SUM(-qty * (COALESCE(unit_price,0) - COALESCE(unit_cost, i.cost))) FROM movements m WHERE m.item_id = i.id AND m.kind = 'sale'), 0) AS profit,
      COALESCE((SELECT MAX(created_at) FROM movements m WHERE m.item_id = i.id AND m.kind = 'sale'), 0) AS last_sale,
      COALESCE((SELECT qty FROM printed p WHERE p.item_id = i.id), 0) AS printed,
      COALESCE((SELECT SUM(CASE c.kind WHEN 'give' THEN c.qty ELSE -c.qty END) FROM consign c WHERE c.item_id = i.id), 0) AS with_sellers
    FROM items i ORDER BY i.sort, i.id`).all();
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const m = await D.prepare(`SELECT COALESCE(-SUM(qty),0) AS pcs, COALESCE(SUM(-qty*COALESCE(unit_price,0)),0) AS revenue,
      COALESCE(SUM(-qty*(COALESCE(unit_price,0)-COALESCE(unit_cost,0))),0) AS profit FROM movements WHERE kind='sale' AND created_at >= ?`).bind(month.getTime()).first();
  return json({ items: results.map((r) => ({ ...r, auto_colour: autoColour(r), auto_meaning: r.meaning ? "" : stoneMeaning(r.stone) || "", auto_description: r.description ? "" : (() => { try { return defaultDescription(r, itemDetails(r)); } catch { return ""; } })() })), month: m, colours: COLOURS.map(([id, name, hex]) => ({ id, name, hex })) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  if (b.action === "clearAll") return clearAll(D, b);
  const id = cleanId(b.id);
  if (!idOk(id)) return json({ error: "Please enter an item ID (up to 60 characters, without / \\ ? % < > or quotes)." }, 400);
  const stone = str(b.stone, 80);
  if (!stone) return json({ error: "Please enter the stone name." }, 400);
  const now = Date.now();
  const f = {
    stone, type: str(b.type, 40) || "Bracelet", variant: str(b.variant, 120),
    size_mm: b.size_mm === "" || b.size_mm == null ? null : num(b.size_mm, null),
    supplier: str(b.supplier, 80), collection: str(b.collection, 40) || "bracelets",
    cost: Math.max(0, num(b.cost)), price: Math.max(0, num(b.price)),
    published: b.published ? 1 : 0, featured: Math.max(0, Math.floor(num(b.featured))),
    zh: str(b.zh, 80), description: str(b.description, 1200), meaning: str(b.meaning, 1200),
    intentions: JSON.stringify(Array.isArray(b.intentions) ? b.intentions.map((x) => str(x, 30)).slice(0, 8) : []),
    colour: isColour(b.colour) ? b.colour : "",
    dims: str(b.dims, 120),
  };
  // changing the ID of an existing item: move everything linked to it, then save as usual
  const oldId = b.isNew ? "" : str(b.oldId, 60);
  if (oldId && oldId !== id) {
    if (await D.prepare("SELECT 1 FROM items WHERE id = ?").bind(id).first()) return json({ error: `${id} is already used by another item. Please choose a different ID.` }, 409);
    const was = await D.prepare("SELECT id, gallery FROM items WHERE id = ?").bind(oldId).first();
    if (!was) return json({ error: "Item not found. Please refresh." }, 404);
    await renameItem(D, was, id);
  }
  const exists = await D.prepare("SELECT id FROM items WHERE id = ?").bind(id).first();
  if (b.isNew && exists) return json({ error: `${id} already exists. Use a different item ID.` }, 409);
  if (!exists) {
    const same = (await D.prepare("SELECT id FROM items").all()).results.find((r) => r.id !== oldId && idKey(r.id) === idKey(id));
    if (same) return json({ error: `${same.id} is already in stock. Please use a different item ID.` }, 409);
  }

  if (!exists) {
    const qty = Math.max(0, Math.floor(num(b.stock)));
    await D.batch([
      D.prepare(`INSERT INTO items (id, stone, type, variant, size_mm, supplier, collection, cost, price, stock_in, stock, published, featured, zh, description, meaning, intentions, colour, dims, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort),0)+1 FROM items), ?, ?)`)
        .bind(id, f.stone, f.type, f.variant, f.size_mm, f.supplier, f.collection, f.cost, f.price, qty, qty, f.published, f.featured, f.zh, f.description, f.meaning, f.intentions, f.colour, f.dims, now, now),
      ...(qty ? [D.prepare("INSERT INTO movements (item_id, kind, qty, unit_cost, channel, note, created_at) VALUES (?, 'restock', ?, ?, '', 'Opening stock', ?)").bind(id, qty, f.cost, now)] : []),
    ]);
  } else {
    await D.prepare(`UPDATE items SET stone=?, type=?, variant=?, size_mm=?, supplier=?, collection=?, cost=?, price=?, published=?, featured=?, zh=?, description=?, meaning=?, intentions=?, colour=?, dims=?, updated_at=? WHERE id=?`)
      .bind(f.stone, f.type, f.variant, f.size_mm, f.supplier, f.collection, f.cost, f.price, f.published, f.featured, f.zh, f.description, f.meaning, f.intentions, f.colour, f.dims, now, id).run();
  }
  const item = await D.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
  return json({ ok: true, item });
}

export async function onRequestDelete({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = str(new URL(request.url).searchParams.get("id"), 60);
  const sold = await D.prepare("SELECT COUNT(*) AS n FROM movements WHERE item_id = ? AND kind = 'sale'").bind(id).first();
  if (sold.n) return json({ error: "This item has sales recorded, so it can't be deleted. Hide it from the website instead." }, 409);
  await D.batch([
    D.prepare("DELETE FROM items WHERE id = ?").bind(id),
    D.prepare("DELETE FROM images WHERE item_id = ? OR item_id = ? OR item_id LIKE ? OR item_id LIKE ?").bind(id, `orig-${id}`, `g-${id}-%`, `orig-g-${id}-%`),
    D.prepare("DELETE FROM movements WHERE item_id = ?").bind(id),
  ]);
  return json({ ok: true });
}

/**
 * Start over: delete every stock item with its photos, stock history (sold counts) and pieces with sellers.
 * Kept: orders (they live in Stripe), coupons, sales, collections, banner, affiliates and their commission records.
 * Needs { action: "clearAll", confirm: "DELETE" }.
 */
async function clearAll(D, b) {
  if (b.confirm !== "DELETE") return json({ error: 'Type DELETE to confirm.' }, 400);
  const n = (await D.prepare("SELECT COUNT(*) AS n FROM items").first()).n;
  await D.batch([
    D.prepare("DELETE FROM images WHERE item_id IN (SELECT id FROM items) OR item_id LIKE 'prev-%' OR item_id LIKE 'orig-%' OR item_id LIKE 'g-%'"),
    D.prepare("DELETE FROM movements"),
    D.prepare("DELETE FROM consign"),
    D.prepare("DELETE FROM items"),
  ]);
  await setSetting(D, "stock_reset_at", Math.floor(Date.now() / 1000)); // orders paid before now won't be counted again
  return json({ ok: true, deleted: n });
}

/** Rename an item: photos (main, extra angles, originals), stock history, consignment, and sales/collections that list it. */
async function renameItem(D, was, id) {
  const old = was.id, now = Date.now();
  let gal = [];
  try { gal = JSON.parse(was.gallery || "[]").filter((p) => p && p.k); } catch {}
  const st = [
    D.prepare("UPDATE items SET id = ?, updated_at = ? WHERE id = ?").bind(id, now, old),
    D.prepare("UPDATE images SET item_id = ? WHERE item_id = ?").bind(id, old),
    D.prepare("UPDATE images SET item_id = ? WHERE item_id = ?").bind(`orig-${id}`, `orig-${old}`),
    D.prepare("DELETE FROM images WHERE item_id = ?").bind(`prev-${old}`), // link preview is made again
    D.prepare("UPDATE movements SET item_id = ? WHERE item_id = ?").bind(id, old),
    D.prepare("UPDATE consign SET item_id = ? WHERE item_id = ?").bind(id, old),
  ];
  const newGal = gal.map((p) => {
    const k = p.k.startsWith(`g-${old}-`) ? `g-${id}-${p.k.slice(`g-${old}-`.length)}` : p.k;
    if (k !== p.k) st.push(D.prepare("UPDATE images SET item_id = ? WHERE item_id = ?").bind(k, p.k), D.prepare("UPDATE images SET item_id = ? WHERE item_id = ?").bind(`orig-${k}`, `orig-${p.k}`));
    return { ...p, k };
  });
  st.push(D.prepare("UPDATE items SET gallery = ? WHERE id = ?").bind(JSON.stringify(newGal), id));
  for (const t of ["sales", "collections"]) {
    const { results } = await D.prepare(`SELECT id, targets FROM ${t} WHERE scope = 'items'`).all();
    for (const r of results) {
      let ids = []; try { ids = JSON.parse(r.targets || "[]"); } catch {}
      if (ids.includes(old)) st.push(D.prepare(`UPDATE ${t} SET targets = ? WHERE id = ?`).bind(JSON.stringify(ids.map((x) => (x === old ? id : x))), r.id));
    }
  }
  await D.batch(st);
}
