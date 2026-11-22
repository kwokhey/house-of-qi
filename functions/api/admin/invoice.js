/**
 * Offline-sale invoices (login required).
 *   GET  /api/admin/invoice?no=HQ-00001   → one invoice
 *   GET  /api/admin/invoice               → latest invoices (list)
 *   POST /api/admin/invoice { mid, to:{name,…}, date?, terms? } → make an invoice for an earlier offline sale
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
import { billTo, createInvoice, addToInvoice } from "../../_lib/invoice.js";

async function guard(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  return null;
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  const no = new URL(request.url).searchParams.get("no");
  if (no) {
    const r = await D.prepare("SELECT * FROM invoices WHERE number = ?").bind(no).first();
    if (!r) return json({ error: "Invoice not found." }, 404);
    return json({ invoice: { number: r.number, void: !!r.void, ...JSON.parse(r.data) } });
  }
  const { results } = await D.prepare("SELECT number, void, data, created_at FROM invoices ORDER BY seq DESC LIMIT 200").all();
  return json({ invoices: results.map((r) => { const d = JSON.parse(r.data); return { number: r.number, void: !!r.void, date: d.date, to: d.to && d.to.name, total: d.total }; }) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g) return g;
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const to = billTo(b.to);
  if (!to && !b.addTo) return json({ error: "Please enter who it was sold to." }, 400);
  const m = await D.prepare("SELECT * FROM movements WHERE id = ? AND kind = 'sale'").bind(Number(b.mid)).first();
  if (!m) return json({ error: "That sale wasn't found." }, 404);
  if (m.ref) return json({ error: "Website orders already have a Stripe receipt." }, 400);
  if (m.invoice) return json({ ok: true, number: m.invoice });
  const item = await D.prepare("SELECT * FROM items WHERE id = ?").bind(m.item_id).first();
  if (!item) return json({ error: "The item for this sale no longer exists." }, 404);
  if (b.addTo) {
    const n = await addToInvoice(D, b.addTo, { item, qty: -m.qty, price: m.unit_price ?? item.price, movementId: m.id, date: b.date });
    return n ? json({ ok: true, number: n }) : json({ error: `Invoice ${b.addTo} wasn't found (or it is void).` }, 404);
  }
  const date = b.date || new Date(m.created_at + 8 * 3600e3).toISOString().slice(0, 10);
  const number = await createInvoice(D, { to, date, terms: b.terms, item, qty: -m.qty, price: m.unit_price ?? item.price, movementId: m.id, channel: m.channel, note: m.note });
  return json({ ok: true, number });
}
