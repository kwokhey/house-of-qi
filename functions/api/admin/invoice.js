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
    const d = JSON.parse(r.data);
    // older invoices (before 23 Nov) only kept the price paid: work out the original price and the seller's discount
    for (const l of d.lines || []) {
      if (l.list || !l.mid) continue;
      try {
        const a = await D.prepare("SELECT a.code, a.disc_pct FROM aff_sales s JOIN affiliates a ON a.id = s.aff_id WHERE s.ref = ?").bind(`mv-${l.mid}`).first();
        if (!a || !(a.disc_pct > 0)) continue;
        const list = Math.round((l.rate / (1 - a.disc_pct / 100)) * 100) / 100;
        if (list > l.rate + 0.004) { l.list = list; l.disc = `${a.code} ${+a.disc_pct}% off`; }
      } catch {}
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    d.total = r2((d.lines || []).reduce((a, l) => a + l.qty * l.rate, 0));
    d.subtotal = r2((d.lines || []).reduce((a, l) => a + l.qty * (l.list || l.rate), 0));
    d.discount = r2(d.subtotal - d.total);
    return json({ invoice: { number: r.number, void: !!r.void, ...d } });
  }
  const { results } = await D.prepare("SELECT number, void, data, created_at FROM invoices ORDER BY seq DESC LIMIT 1000").all();
  return json({ invoices: results.map((r) => {
    const d = JSON.parse(r.data); const t = d.to || {};
    const lines = (d.lines || []).map((l) => ({ name: String(l.description || "").split("\n")[0], code: (String(l.description || "").match(/Item code: (.*)$/m) || [])[1] || "", qty: l.qty }));
    return { number: r.number, void: !!r.void, date: d.date, to: t.name, company: t.company || "", phone: t.phone || "", email: t.email || "",
      terms: d.terms || "", paid: /paid/i.test(d.terms || ""), channel: d.channel || "", total: d.total, pieces: lines.reduce((a, l) => a + (Number(l.qty) || 0), 0), lines, created_at: r.created_at };
  }) });
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
