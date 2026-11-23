/**
 * Product video (login required). Stored in Cloudflare R2 (bucket bound as PHOTOS) under "vid/<key>".
 *   POST   /api/admin/video?id=ITEM   body = the video file itself (MP4, MOV or WebM, up to 90 MB)
 *   DELETE /api/admin/video?id=ITEM   → removes the video
 * items.video keeps {k, v, t, s}: R2 key, version, type, size in bytes.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

const MAX = 90 * 1024 * 1024;
const TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "mp4" };

// checks the first bytes really are a video (MP4/MOV "ftyp"/"moov"…, WebM EBML)
function realVideo(b) {
  if (b.length < 12) return false;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  const box = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box)) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return false;
}

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  if (!env.PHOTOS) return json({ error: "Video storage (R2) isn't connected." }, 503);
  return null;
}
const old = (r) => { try { return JSON.parse(r.video || "null"); } catch { return null; } };

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const item = await D.prepare("SELECT id, video FROM items WHERE id = ?").bind(id).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX) return json({ error: "That video is too large (over 90 MB). Please trim it or record a shorter clip." }, 413);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return json({ error: "The video didn't upload. Please try again." }, 400);
  if (buf.length > MAX) return json({ error: "That video is too large (over 90 MB). Please trim it or record a shorter clip." }, 413);
  const t = realVideo(buf);
  if (!t) return json({ error: "Please choose an MP4, MOV or WebM video." }, 400);
  const now = Date.now();
  const k = `vid/${item.id.replace(/[^A-Za-z0-9_-]/g, "_")}-${now.toString(36)}.${TYPES[t] || "mp4"}`;
  await env.PHOTOS.put(k, buf, { httpMetadata: { contentType: t, cacheControl: "public, max-age=31536000, immutable" } });
  const v = { k, v: now, t, s: buf.length };
  await D.prepare("UPDATE items SET video = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(v), now, item.id).run();
  const o = old(item); if (o && o.k && o.k !== k) { try { await env.PHOTOS.delete(o.k); } catch {} }
  return json({ ok: true, video: v });
}

export async function onRequestDelete({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  const item = await D.prepare("SELECT id, video FROM items WHERE id = ?").bind(id).first();
  if (!item) return json({ error: "Item not found." }, 404);
  const o = old(item); if (o && o.k) { try { await env.PHOTOS.delete(o.k); } catch {} }
  await D.prepare("UPDATE items SET video = '', updated_at = ? WHERE id = ?").bind(Date.now(), item.id).run();
  return json({ ok: true });
}
