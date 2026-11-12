/**
 * Save a product photo from an image link (login required).
 *   POST /api/admin/image-url  { ids: ["AMET-1-6", ...], url: "https://...cdninstagram.com/..." }
 * The server downloads the image, so it works for links the browser can't read directly
 * (e.g. the shop's own Instagram photos). Only image hosts on the list below are accepted.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

const HOSTS = [/\.cdninstagram\.com$/i, /\.fbcdn\.net$/i];

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  let b = {};
  try { b = await request.json(); } catch {}
  let u;
  try { u = new URL(String(b.url || "")); } catch { return json({ error: "That isn't a valid link." }, 400); }
  if (u.protocol !== "https:" || !HOSTS.some((re) => re.test(u.hostname))) return json({ error: "Only Instagram image links are supported." }, 400);
  const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x) => String(x || "")).filter(Boolean).slice(0, 50);
  if (!ids.length) return json({ error: "No item chosen." }, 400);

  const res = await fetch(u.toString(), { redirect: "follow" });
  if (!res.ok) return json({ error: `Couldn't download the photo (${res.status}).` }, 502);
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!/^image\/(jpeg|webp|png)$/.test(mime)) return json({ error: "That link isn't a JPG, PNG or WebP photo." }, 400);
  const bin = new Uint8Array(await res.arrayBuffer());
  if (bin.length > 1_500_000) return json({ error: "That photo is too large. Use a smaller version of the image." }, 413);

  const D = await db(env);
  const now = Date.now(), done = [];
  for (const id of ids) {
    const item = await D.prepare("SELECT id FROM items WHERE id = ?").bind(id).first();
    if (!item) continue;
    await D.batch([
      D.prepare("INSERT INTO images (item_id, mime, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at").bind(item.id, mime, bin, now),
      D.prepare("UPDATE items SET image_v = ?, updated_at = ? WHERE id = ?").bind(now, now, item.id),
    ]);
    done.push(item.id);
  }
  return json({ ok: true, saved: done, bytes: bin.length });
}
