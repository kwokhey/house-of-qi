/**
 * Marketing (login required): coupon codes, sales and the shop announcement bar.
 *   GET    /api/admin/marketing                       → everything, with code usage
 *   POST   /api/admin/marketing  { type: "coupon", code, kind, value, min_spend, starts, ends, max_uses, exclude_sale, active, note }
 *                                { type: "sale", id?, name, percent, scope, targets, starts, ends, active }
 *                                { type: "announce", text, link, active, starts, ends }
 *                                { type: "collection", id?, name, zh, blurb, scope, targets, max_price, cover, sort, active }
 *   DELETE /api/admin/marketing?type=coupon&code=QI10 | ?type=sale&id=3 | ?type=collection&id=2
 * Dates are "YYYY-MM-DD" in Malaysia time; a sale/code runs from the start of the first day to the end of the last.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB, getSetting, setSetting } from "../../_lib/db.js";
import { syncSales } from "../../_lib/inventory.js";
import { cleanCode } from "../../_lib/promo.js";
import { json } from "../../_lib/stripe.js";

const MYT = 8 * 3600 * 1000;
const dayStart = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? Date.parse(d + "T00:00:00Z") - MYT : 0);
const dayEnd = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? Date.parse(d + "T23:59:59Z") - MYT : 0);
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
  const { results: coupons } = await D.prepare(`
    SELECT c.*, COUNT(u.ref) AS uses, COALESCE(SUM(u.discount), 0) AS given, COALESCE(SUM(u.total), 0) AS revenue, MAX(u.created_at) AS last_used
    FROM coupons c LEFT JOIN coupon_uses u ON u.code = c.code GROUP BY c.code ORDER BY c.active DESC, c.created_at DESC`).all();
  const { results: sales } = await D.prepare("SELECT * FROM sales ORDER BY active DESC, created_at DESC").all();
  const { results: stones } = await D.prepare("SELECT stone, COUNT(*) AS n FROM items WHERE published = 1 GROUP BY stone ORDER BY stone").all();
  const { results: items } = await D.prepare("SELECT id, stone, type, variant, size_mm, price, stock, collection, image_v FROM items WHERE published = 1 AND stock > 0 ORDER BY sort, id").all();
  const { results: collections } = await D.prepare("SELECT * FROM collections ORDER BY sort, id").all();
  let announce = null;
  try { announce = JSON.parse((await getSetting(D, "announce")) || "null"); } catch {}
  const t = (r) => ({ ...r, targets: JSON.parse(r.targets || "[]") });
  return json({ coupons, sales: sales.map(t), collections: collections.map(t), stones, items, announce, now: Date.now() });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const now = Date.now();

  if (b.type === "coupon") {
    const code = cleanCode(b.code);
    if (code.length < 3) return json({ error: "The code needs at least 3 letters or numbers (e.g. QI10)." }, 400);
    const kind = ["percent", "amount"].includes(b.kind) ? b.kind : "percent"; // no free-delivery codes
    const value = kind === "freeship" ? 0 : num(b.value);
    if (kind === "percent" && !(value >= 1 && value <= 90)) return json({ error: "Percent off must be between 1 and 90." }, 400);
    if (kind === "amount" && !(value >= 1)) return json({ error: "Enter how many ringgit off." }, 400);
    const starts = dayStart(b.starts), ends = dayEnd(b.ends);
    if (starts && ends && ends < starts) return json({ error: "The end date is before the start date." }, 400);
    const f = [kind, value, Math.max(0, num(b.min_spend)), starts, ends, Math.max(0, Math.floor(num(b.max_uses))), b.exclude_sale ? 1 : 0, b.active === false ? 0 : 1, str(b.note, 120)];
    const orig = cleanCode(b.orig);
    if (orig && orig !== code) {
      const used = await D.prepare("SELECT COUNT(*) AS n FROM coupon_uses WHERE code = ?").bind(orig).first();
      if (used.n) return json({ error: `${orig} has already been used, so it can't be renamed. Make a new code instead.` }, 409);
      await D.prepare("DELETE FROM coupons WHERE code = ?").bind(orig).run();
    }
    const exists = await D.prepare("SELECT code FROM coupons WHERE code = ?").bind(code).first();
    if (exists && b.isNew) return json({ error: `${code} already exists.` }, 409);
    if (exists) {
      await D.prepare("UPDATE coupons SET kind=?, value=?, min_spend=?, starts_at=?, ends_at=?, max_uses=?, exclude_sale=?, active=?, note=?, updated_at=? WHERE code=?").bind(...f, now, code).run();
    } else {
      await D.prepare("INSERT INTO coupons (kind, value, min_spend, starts_at, ends_at, max_uses, exclude_sale, active, note, created_at, updated_at, code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(...f, now, now, code).run();
    }
    return json({ ok: true, code });
  }

  if (b.type === "sale") {
    const name = str(b.name, 60);
    if (!name) return json({ error: "Give the sale a name, e.g. 11.11 Sale." }, 400);
    const percent = num(b.percent);
    if (!(percent >= 1 && percent <= 90)) return json({ error: "Percent off must be between 1 and 90." }, 400);
    const scope = ["all", "collection", "stones", "items"].includes(b.scope) ? b.scope : "all";
    const targets = scope === "all" ? [] : (Array.isArray(b.targets) ? b.targets : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 200);
    if (scope !== "all" && !targets.length) return json({ error: "Choose what the sale applies to." }, 400);
    const starts = dayStart(b.starts), ends = dayEnd(b.ends);
    if (starts && ends && ends < starts) return json({ error: "The end date is before the start date." }, 400);
    const f = [name, percent, scope, JSON.stringify(targets), starts, ends, b.active === false ? 0 : 1];
    const id = Math.floor(num(b.id));
    if (id) await D.prepare("UPDATE sales SET name=?, percent=?, scope=?, targets=?, starts_at=?, ends_at=?, active=?, updated_at=? WHERE id=?").bind(...f, now, id).run();
    else await D.prepare("INSERT INTO sales (name, percent, scope, targets, starts_at, ends_at, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(...f, now, now).run();
    return json({ ok: true });
  }

  if (b.type === "collection") {
    const name = str(b.name, 50);
    if (!name) return json({ error: "Give the collection a name, e.g. Rare Finds." }, 400);
    const scope = ["all", "collection", "stones", "items"].includes(b.scope) ? b.scope : "stones";
    const targets = scope === "all" ? [] : (Array.isArray(b.targets) ? b.targets : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 300);
    if (scope !== "all" && !targets.length) return json({ error: "Choose which stones or pieces are in this collection." }, 400);
    const f = [name, str(b.zh, 30), str(b.blurb, 160), scope, JSON.stringify(targets), Math.max(0, num(b.max_price)), str(b.cover, 40), Math.floor(num(b.sort)), b.active === false ? 0 : 1];
    const id = Math.floor(num(b.id));
    if (id) await D.prepare("UPDATE collections SET name=?, zh=?, blurb=?, scope=?, targets=?, max_price=?, cover=?, sort=?, active=?, updated_at=? WHERE id=?").bind(...f, now, id).run();
    else await D.prepare("INSERT INTO collections (name, zh, blurb, scope, targets, max_price, cover, sort, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(...f, now, now).run();
    return json({ ok: true });
  }

  if (b.type === "collCover") {
    const id = Math.floor(num(b.id));
    const c = await D.prepare("SELECT id FROM collections WHERE id = ?").bind(id).first();
    if (!c) return json({ error: "Save the collection first, then add its cover photo." }, 404);
    if (!b.data) {
      await D.batch([D.prepare("DELETE FROM images WHERE item_id = ?").bind(`coll-${id}`), D.prepare("UPDATE collections SET cover_v = 0, updated_at = ? WHERE id = ?").bind(now, id)]);
      return json({ ok: true, cover_v: 0 });
    }
    const m = String(b.data).match(/^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return json({ error: "Please choose a JPG, PNG or WebP photo." }, 400);
    const bin = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
    if (bin.length > 1_500_000) return json({ error: "That photo is too large. Please try another." }, 413);
    await D.batch([
      D.prepare("INSERT INTO images (item_id, mime, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at").bind(`coll-${id}`, m[1], bin, now),
      D.prepare("UPDATE collections SET cover_v = ?, updated_at = ? WHERE id = ?").bind(now, now, id),
    ]);
    return json({ ok: true, cover_v: now });
  }

  if (b.type === "announce") {
    const a = { text: str(b.text, 140), link: str(b.link, 300), active: !!b.active && !!str(b.text), starts_at: dayStart(b.starts), ends_at: dayEnd(b.ends) };
    await setSetting(D, "announce", JSON.stringify(a));
    return json({ ok: true, announce: a });
  }
  return json({ error: "Unknown request." }, 400);
}

export async function onRequestDelete({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const q = new URL(request.url).searchParams;
  if (q.get("type") === "coupon") {
    const code = cleanCode(q.get("code"));
    const used = await D.prepare("SELECT COUNT(*) AS n FROM coupon_uses WHERE code = ?").bind(code).first();
    if (used.n) return json({ error: `${code} has been used on ${used.n} order${used.n === 1 ? "" : "s"}, so it's kept for your records. Switch it off instead.` }, 409);
    await D.prepare("DELETE FROM coupons WHERE code = ?").bind(code).run();
    return json({ ok: true });
  }
  if (q.get("type") === "collection") {
    const cid = Math.floor(num(q.get("id")));
    await D.batch([D.prepare("DELETE FROM collections WHERE id = ?").bind(cid), D.prepare("DELETE FROM images WHERE item_id = ?").bind(`coll-${cid}`)]);
    return json({ ok: true });
  }
  if (q.get("type") === "sale") {
    await D.prepare("DELETE FROM sales WHERE id = ?").bind(Math.floor(num(q.get("id")))).run();
    return json({ ok: true });
  }
  return json({ error: "Unknown request." }, 400);
}
