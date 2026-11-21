/**
 * Photo storage (login required).
 *   GET  /api/admin/dbsize                 → database size, photos still in the database, whether R2 is connected
 *   POST /api/admin/dbsize { move: true }  → moves a batch of photos from the database to R2 (repeat until left = 0)
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
import { hasR2, movePhotosToR2 } from "../../_lib/photos.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "No database" }, 503);
  const D = await db(env);
  const meta = (await D.prepare("SELECT 1").run()).meta || {};
  const inDb = (await D.prepare("SELECT COUNT(*) AS n FROM images WHERE r2 = ''").first()).n;
  const inR2 = (await D.prepare("SELECT COUNT(*) AS n FROM images WHERE r2 != ''").first()).n;
  return json({ r2: hasR2(env), dbMB: meta.size_after ? Math.round(meta.size_after / 1048576) : null, photosInDatabase: inDb, photosInR2: inR2 });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "No database" }, 503);
  const D = await db(env);
  let b = {}; try { b = await request.json(); } catch {}
  if (b.list) return json({ keys: (await D.prepare("SELECT item_id FROM images WHERE r2 = '' ORDER BY item_id").all()).results.map((r) => r.item_id) });
  try { return json(await movePhotosToR2(env, D, Math.max(1, Math.min(10, Number(b.n) || 2)), b.key ? String(b.key) : null)); }
  catch (e) { return json({ error: "Move failed", detail: String(e && e.message || e).slice(0, 200) }, 500); }
}
