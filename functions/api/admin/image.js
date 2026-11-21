/**
 * Product photo upload (login required).
 *   POST   /api/admin/image   { id, data: "data:image/jpeg;base64,..." }  (resized in the browser)
 *     orig: optional full original photo, kept so "Adjust photo" can always start from the whole picture
 *     slot: "new" adds an extra angle (up to 5), or the key of an extra photo to replace it
 *   POST   /api/admin/image   { id, action: "move", k, d: -1 | 1 }   reorder the extra angles
 *   GET    /api/admin/image?id=ITEM&orig=1[&k=KEY]   → the kept original (404 if none)
 *   DELETE /api/admin/image?id=ITEM&k=KEY   → remove one extra angle
 *   DELETE /api/admin/image?id=ITEM
 */
import { realImage, b64 } from "../../_lib/upload.js";
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  if (b.action === "move") return moveAngle(D, b);
  const m = String(b.data || "").match(/^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: "Please choose a JPG, PNG or WebP photo." }, 400);
  const bin = b64(m[2]);
  if (bin.length > 1_500_000) return json({ error: "That photo is too large. Please try another." }, 413);
  if (!realImage(bin, m[1])) return json({ error: "That file is not a real JPG, PNG or WebP photo." }, 400);
  const item = await D.prepare("SELECT id, gallery FROM items WHERE id = ?").bind(String(b.id || "")).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const now = Date.now();
  const UPSERT = "INSERT INTO images (item_id, mime, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at";
  // main photo, or one of up to 5 extra angles (kept in items.gallery as [{k, v}])
  let key = item.id, st;
  if (b.slot) {
    const g = gal(item);
    if (b.slot === "new") {
      if (g.length >= 5) return json({ error: "Up to 5 extra photos. Remove one first." }, 400);
      key = `g-${item.id}-${now.toString(36)}`; g.push({ k: key, v: now });
    } else {
      const x = g.find((p) => p.k === b.slot);
      if (!x) return json({ error: "That photo was removed. Please add it again." }, 404);
      key = x.k; x.v = now;
    }
    st = [D.prepare(UPSERT).bind(key, m[1], bin, now), D.prepare("UPDATE items SET gallery = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(g), now, item.id)];
  } else {
    st = [D.prepare(UPSERT).bind(item.id, m[1], bin, now), D.prepare("UPDATE items SET image_v = ?, updated_at = ? WHERE id = ?").bind(now, now, item.id)];
  }
  try { await D.batch(st); }
  catch (e) { console.error("photo save", e && e.message); return json({ error: "Couldn't save the photo. Please try a smaller photo." }, 500); }
  // the kept original goes in its own write (one big batch can exceed the database's size limit); the photo is already saved
  const o = b.orig ? String(b.orig).match(/^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (o) {
    try {
      const ob = b64(o[2]);
      if (ob.length <= 1_900_000 && realImage(ob, o[1])) await D.prepare(UPSERT).bind(`orig-${key}`, o[1], ob, now).run();
    } catch (e) { console.error("photo original", e && e.message); }
  }
  return json({ ok: true, image_v: now, key });
}

const gal = (r) => { try { const g = JSON.parse(r.gallery || "[]"); return Array.isArray(g) ? g.filter((p) => p && p.k) : []; } catch { return []; } };

async function moveAngle(D, b) {
  const item = await D.prepare("SELECT id, gallery FROM items WHERE id = ?").bind(String(b.id || "")).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const g = gal(item), i = g.findIndex((p) => p.k === b.k), j = i + (+b.d < 0 ? -1 : 1);
  if (i >= 0 && j >= 0 && j < g.length) [g[i], g[j]] = [g[j], g[i]];
  await D.prepare("UPDATE items SET gallery = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(g), Date.now(), item.id).run();
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const k = new URL(request.url).searchParams.get("k");
  const r = await D.prepare("SELECT mime, data FROM images WHERE item_id = ?").bind(`orig-${k && k.startsWith(`g-${id}-`) ? k : id}`).first();
  if (!r) return json({ error: "No original kept." }, 404);
  return new Response(r.data instanceof ArrayBuffer || ArrayBuffer.isView(r.data) ? r.data : new Uint8Array(r.data), { headers: { "Content-Type": r.mime, "Cache-Control": "no-store" } });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const k = new URL(request.url).searchParams.get("k");
  if (k) {
    const item = await D.prepare("SELECT id, gallery FROM items WHERE id = ?").bind(id).first();
    if (!item) return json({ error: "Item not found." }, 404);
    const g = gal(item).filter((p) => p.k !== k);
    await D.batch([
      D.prepare("DELETE FROM images WHERE item_id = ? OR item_id = ?").bind(k, `orig-${k}`),
      D.prepare("UPDATE items SET gallery = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(g), Date.now(), id),
    ]);
    return json({ ok: true });
  }
  await D.batch([
    D.prepare("DELETE FROM images WHERE item_id = ? OR item_id = ?").bind(id, `orig-${id}`),
    D.prepare("UPDATE items SET image_v = 0, updated_at = ? WHERE id = ?").bind(Date.now(), id),
  ]);
  return json({ ok: true });
}
