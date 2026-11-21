/** Storage used by photos (login required). GET /api/admin/dbsize */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "No database" }, 503);
  const D = env.DB;
  const { results } = await D.prepare(`SELECT CASE WHEN item_id LIKE 'orig-%' THEN 'originals' WHEN item_id LIKE 'g-%' THEN 'extra angles' ELSE 'main photos' END AS kind,
    COUNT(*) AS n FROM images GROUP BY kind`).all();
  const orphans = await D.prepare(`SELECT COUNT(*) AS n FROM images i WHERE item_id NOT LIKE 'orig-%' AND item_id NOT LIKE 'g-%' AND NOT EXISTS (SELECT 1 FROM items t WHERE t.id = i.item_id)`).first();
  const sample = (await D.prepare(`SELECT item_id, updated_at FROM images i WHERE item_id NOT LIKE 'orig-%' AND item_id NOT LIKE 'g-%' AND NOT EXISTS (SELECT 1 FROM items t WHERE t.id = i.item_id) ORDER BY updated_at DESC`).all()).results;
  let size = null; try { size = (await D.prepare("SELECT 1").run()).meta; } catch {}
  return json({ results, orphans, size, sample });
}
