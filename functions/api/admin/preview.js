/**
 * Link-preview images for products without a photo (login required).
 * The Stock page draws the product picture in the browser and saves a JPG here,
 * so WhatsApp / Facebook previews of shared links show the bracelet, not the logo.
 *   GET  /api/admin/preview            → { prev: { ITEM: updated_at }, staticAt }
 *   POST /api/admin/preview { id, data }
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

// previews in assets/img/og were made at this time; items edited later get a fresh one
export const STATIC_AT = 1794555084523;

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ prev: {}, staticAt: STATIC_AT });
  const D = await db(env);
  const { results } = await D.prepare("SELECT item_id, updated_at FROM images WHERE item_id LIKE 'prev-%'").all();
  return json({ prev: Object.fromEntries(results.map((r) => [r.item_id.slice(5), r.updated_at])), staticAt: STATIC_AT });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const m = String(b.data || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: "Bad image." }, 400);
  const bin = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  if (bin.length > 400_000) return json({ error: "Too large." }, 413);
  const item = await D.prepare("SELECT id FROM items WHERE id = ?").bind(String(b.id || "")).first();
  if (!item) return json({ error: "Item not found." }, 404);
  await D.prepare("INSERT INTO images (item_id, mime, data, updated_at) VALUES (?, 'image/jpeg', ?, ?) ON CONFLICT(item_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind("prev-" + item.id, bin, Date.now()).run();
  return json({ ok: true });
}
