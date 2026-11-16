/**
 * Product photo upload (login required).
 *   POST   /api/admin/image   { id, data: "data:image/jpeg;base64,..." }  (resized in the browser)
 *     orig: optional full original photo, kept so "Adjust photo" can always start from the whole picture
 *   GET    /api/admin/image?id=ITEM&orig=1   → the kept original (404 if none)
 *   DELETE /api/admin/image?id=ITEM
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const m = String(b.data || "").match(/^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: "Please choose a JPG, PNG or WebP photo." }, 400);
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bin.length > 1_500_000) return json({ error: "That photo is too large. Please try another." }, 413);
  const item = await D.prepare("SELECT id FROM items WHERE id = ?").bind(String(b.id || "")).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const now = Date.now();
  const UPSERT = "INSERT INTO images (item_id, mime, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at";
  const st = [
    D.prepare(UPSERT).bind(item.id, m[1], bin, now),
    D.prepare("UPDATE items SET image_v = ?, updated_at = ? WHERE id = ?").bind(now, now, item.id),
  ];
  const o = b.orig ? String(b.orig).match(/^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (o) {
    const ob = Uint8Array.from(atob(o[2]), (c) => c.charCodeAt(0));
    if (ob.length <= 1_900_000) st.push(D.prepare(UPSERT).bind(`orig-${item.id}`, o[1], ob, now));
  }
  await D.batch(st);
  return json({ ok: true, image_v: now });
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const r = await D.prepare("SELECT mime, data FROM images WHERE item_id = ?").bind(`orig-${id}`).first();
  if (!r) return json({ error: "No original kept." }, 404);
  return new Response(r.data instanceof ArrayBuffer || ArrayBuffer.isView(r.data) ? r.data : new Uint8Array(r.data), { headers: { "Content-Type": r.mime, "Cache-Control": "no-store" } });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  await D.batch([
    D.prepare("DELETE FROM images WHERE item_id = ? OR item_id = ?").bind(id, `orig-${id}`),
    D.prepare("UPDATE items SET image_v = 0, updated_at = ? WHERE id = ?").bind(Date.now(), id),
  ]);
  return json({ ok: true });
}
