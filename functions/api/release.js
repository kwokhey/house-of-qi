/**
 * POST /api/release { o: "HQ-…" } — the customer left the payment page (Cancel / back to the shop):
 * the pieces held for that unfinished checkout become available again straight away.
 */
import { db, hasDB } from "../_lib/db.js";
import { json } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!hasDB(env)) return json({ ok: true });
  let b = {};
  try { b = await request.json(); } catch {}
  const o = String(b.o || "").slice(0, 40);
  if (!/^HQ-[A-Z0-9-]{4,}$/i.test(o)) return json({ ok: true });
  const D = await db(env);
  await D.prepare("DELETE FROM holds WHERE order_no = ? AND sid NOT IN (SELECT sid FROM notified)").bind(o).run();
  return json({ ok: true });
}
