/**
 * Affiliates: friends who help sell (login required).
 *   GET    /api/admin/affiliates             → friends with their totals
 *   GET    /api/admin/affiliates?id=N        → one friend's sales
 *   POST   /api/admin/affiliates  { id?, name, phone, code, comm_kind: "percent"|"fixed", comm_value, disc_pct, active, note }
 *   POST   /api/admin/affiliates  { action: "paid", id }      → mark all their unpaid commission as paid
 *   POST   /api/admin/affiliates  { action: "unpay", sale }   → undo "paid" for one sale
 *   DELETE /api/admin/affiliates?id=N        → remove a friend who has no sales yet
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { cleanCode } from "../../_lib/promo.js";
import { affTotals } from "../../_lib/affiliates.js";
import { json } from "../../_lib/stripe.js";

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The database isn't connected yet." }, 503);
  return null;
}
const str = (v, n) => String(v ?? "").trim().slice(0, n);
const token = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (id) {
    const { results } = await D.prepare("SELECT * FROM aff_sales WHERE aff_id = ? ORDER BY created_at DESC LIMIT 300").bind(id).all();
    return json({ sales: results });
  }
  const { results } = await D.prepare("SELECT * FROM affiliates ORDER BY active DESC, name COLLATE NOCASE").all();
  const t = await affTotals(D);
  return json({ affiliates: results.map((a) => ({ ...a, totals: t[a.id] || { orders: 0, pieces: 0, amount: 0, earned: 0, unpaid: 0, last: 0 } })) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const b = await request.json().catch(() => ({}));
  const now = Date.now();

  if (b.action === "paid") {
    const r = await D.prepare("UPDATE aff_sales SET paid_at = ? WHERE aff_id = ? AND paid_at = 0").bind(now, Number(b.id)).run();
    return json({ ok: true, marked: r.meta.changes });
  }
  if (b.action === "unpay") {
    await D.prepare("UPDATE aff_sales SET paid_at = 0 WHERE id = ?").bind(Number(b.sale)).run();
    return json({ ok: true });
  }

  const name = str(b.name, 60);
  if (!name) return json({ error: "Please enter the seller's name." }, 400);
  const code = cleanCode(b.code);
  if (!code || code.length < 3) return json({ error: "Please choose a code of at least 3 letters or numbers, e.g. AMY or AMY10." }, 400);
  const kind = b.comm_kind === "fixed" ? "fixed" : "percent";
  const value = Math.max(0, Number(b.comm_value) || 0);
  if (kind === "percent" && value > 90) return json({ error: "Commission can't be more than 90%." }, 400);
  const disc = Math.min(50, Math.max(0, Number(b.disc_pct) || 0));
  const id = Number(b.id) || 0;

  const clashCoupon = await D.prepare("SELECT 1 FROM coupons WHERE code = ?").bind(code).first();
  const clashAff = await D.prepare("SELECT id FROM affiliates WHERE code = ?").bind(code).first();
  if (clashCoupon || (clashAff && clashAff.id !== id)) return json({ error: `The code ${code} is already used. Please choose another.` }, 400);

  const f = [name, str(b.phone, 30), code, kind, value, disc, b.active === false ? 0 : 1, str(b.note, 200)];
  if (id) {
    const r = await D.prepare("UPDATE affiliates SET name=?, phone=?, code=?, comm_kind=?, comm_value=?, disc_pct=?, active=?, note=?, updated_at=? WHERE id=?").bind(...f, now, id).run();
    if (!r.meta.changes) return json({ error: "Seller not found." }, 404);
  } else {
    await D.prepare("INSERT INTO affiliates (name, phone, code, comm_kind, comm_value, disc_pct, active, note, token, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(...f, token(), now, now).run();
  }
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const id = Number(new URL(request.url).searchParams.get("id"));
  const n = await D.prepare("SELECT COUNT(*) AS n FROM aff_sales WHERE aff_id = ?").bind(id).first();
  if (n.n) return json({ error: "This seller already has sales, so they can't be deleted. Switch them off instead." }, 400);
  await D.prepare("DELETE FROM affiliates WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
