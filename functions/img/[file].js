/**
 * GET /img/<item id>.jpg — product photo from the inventory database.
 * The shop links include ?v=<version>, so photos can be cached for a long time.
 */
import { db, hasDB } from "../_lib/db.js";

export async function onRequestGet({ params, env }) {
  const id = decodeURIComponent(String(params.file || "")).replace(/\.jpg$/i, "");
  if (!hasDB(env) || !id || id.startsWith("orig-")) return new Response("Not found", { status: 404 }); // originals are for admin only
  const D = await db(env);
  const row = await D.prepare("SELECT mime, data FROM images WHERE item_id = ?").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
  return new Response(bytes, {
    headers: { "Content-Type": row.mime || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
