/**
 * Invoices for offline sales (House of Qi, issued by Soleil Trinity). No tax on crystals.
 * Numbers run HQ-00001, HQ-00002… (own series, separate from Soleil Trinity's other invoices).
 */
import { itemName, itemDetails } from "./db.js";

const s = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));

/** Cleans the "sold to" details typed in the Sold offline form. Returns null when no name was given. */
export function billTo(b) {
  if (!b || !s(b.name)) return null;
  return {
    name: s(b.name, 120), company: s(b.company, 120), address: s(b.address, 300), phone: s(b.phone, 40),
    email: s(b.email, 120), attn: s(b.attn, 80),
  };
}

/** Creates the invoice row and links it to the sale. Returns the invoice number. */
export async function createInvoice(D, { to, date, terms, item, qty, price, movementId, channel, note }) {
  const now = Date.now();
  const saleDate = dateOk(date) ? date : new Date(now + 8 * 3600e3).toISOString().slice(0, 10); // Malaysia date
  const desc = [itemName(item), itemDetails(item), `Item code: ${item.id}`].filter(Boolean).join("\n");
  const data = {
    to, date: saleDate, due: saleDate, terms: s(terms, 60) || "Paid in full", channel: s(channel, 40), note: s(note, 200),
    lines: [{ date: saleDate, activity: "Sale", description: desc, qty, rate: price, mid: movementId || null }],
  };
  data.subtotal = Math.round(qty * price * 100) / 100;
  data.total = data.subtotal;
  const r = await D.prepare("INSERT INTO invoices (number, movement_id, data, created_at) VALUES (?, ?, ?, ?)").bind(`tmp-${now}-${Math.random()}`, movementId || null, JSON.stringify(data), now).run();
  const seq = r.meta.last_row_id;
  const number = `HQ-${String(seq).padStart(5, "0")}`;
  await D.batch([
    D.prepare("UPDATE invoices SET number = ? WHERE seq = ?").bind(number, seq),
    ...(movementId ? [D.prepare("UPDATE movements SET invoice = ? WHERE id = ?").bind(number, movementId)] : []),
  ]);
  return number;
}

const lineDesc = (item) => [itemName(item), itemDetails(item), `Item code: ${item.id}`].filter(Boolean).join("\n");
const totals = (d) => { d.subtotal = Math.round(d.lines.reduce((a, l) => a + l.qty * l.rate, 0) * 100) / 100; d.total = d.subtotal; return d; };

/** Adds another item's sale to an existing invoice (customer bought several pieces). Returns the number or null. */
export async function addToInvoice(D, number, { item, qty, price, movementId, date }) {
  const r = await D.prepare("SELECT * FROM invoices WHERE number = ? AND void = 0").bind(String(number || "").trim().toUpperCase()).first();
  if (!r) return null;
  const d = JSON.parse(r.data);
  d.lines.push({ date: dateOk(date) ? date : d.date, activity: "Sale", description: lineDesc(item), qty, rate: price, mid: movementId || null });
  totals(d);
  await D.batch([
    D.prepare("UPDATE invoices SET data = ? WHERE seq = ?").bind(JSON.stringify(d), r.seq),
    ...(movementId ? [D.prepare("UPDATE movements SET invoice = ? WHERE id = ?").bind(r.number, movementId)] : []),
  ]);
  return r.number;
}

/** A sale was undone: take its line off the invoice; when no lines are left the invoice is marked VOID. */
export async function dropFromInvoice(D, number, movementId) {
  const r = await D.prepare("SELECT * FROM invoices WHERE number = ?").bind(number).first();
  if (!r) return;
  const d = JSON.parse(r.data);
  const left = d.lines.filter((l) => l.mid !== movementId);
  if (!left.length) { await D.prepare("UPDATE invoices SET void = 1 WHERE seq = ?").bind(r.seq).run(); return; }
  d.lines = left; totals(d);
  await D.prepare("UPDATE invoices SET data = ? WHERE seq = ?").bind(JSON.stringify(d), r.seq).run();
}
