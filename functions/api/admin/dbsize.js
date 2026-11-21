/** Storage used by photos (login required). GET /api/admin/dbsize */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "No database" }, 503);
  const D = await db(env);
  const { results } = await D.prepare(`SELECT CASE WHEN item_id LIKE 'orig-%' THEN 'originals' WHEN item_id LIKE 'g-%' THEN 'extra angles' ELSE 'main photos' END AS kind,
    COUNT(*) AS n, SUM(LENGTH(data)) AS bytes FROM images GROUP BY kind`).all();
  const orphans = await D.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)),0) AS bytes FROM images i WHERE item_id NOT LIKE 'orig-%' AND item_id NOT LIKE 'g-%' AND NOT EXISTS (SELECT 1 FROM items t WHERE t.id = i.item_id)`).first();
  return json({ results, orphans });
}
