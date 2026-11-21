/**
 * GET /img/<item id>.jpg — product photo from the inventory database.
 * The shop links include ?v=<version>, so photos can be cached for a long time.
 */
import { db, hasDB } from "../_lib/db.js";
import { readPhoto } from "../_lib/photos.js";

export async function onRequestGet({ params, env }) {
  const id = decodeURIComponent(String(params.file || "")).replace(/\.jpg$/i, "");
  if (!hasDB(env) || !id || id.startsWith("orig-")) return new Response("Not found", { status: 404 }); // originals are for admin only
  const D = await db(env);
  const p = await readPhoto(env, D, id);
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(p.body, {
    headers: { "Content-Type": p.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
