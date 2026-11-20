/**
 * Mark tags as printed (login required).
 *   POST /api/admin/printed { marks: [{ id, qty }] }  → records how many tags were printed per item
 *   POST /api/admin/printed { clear: [id, ...] }      → unmark
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB, idOk } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";


export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  const b = await request.json().catch(() => ({}));
  const now = Date.now(), st = [];
  for (const m of (Array.isArray(b.marks) ? b.marks : []).slice(0, 2000)) {
    const id = String(m?.id || ""), q = Math.max(0, Math.min(100000, Math.floor(Number(m?.qty) || 0)));
    if (!idOk(id)) continue;
    st.push(D.prepare(`INSERT INTO printed (item_id, qty, at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET qty = excluded.qty, at = excluded.at`).bind(id, q, now));
  }
  for (const id of (Array.isArray(b.clear) ? b.clear : []).slice(0, 2000)) if (idOk(String(id))) st.push(D.prepare(`DELETE FROM printed WHERE item_id = ?`).bind(String(id)));
  if (st.length) await D.batch(st);
  return json({ ok: true, count: st.length });
}
