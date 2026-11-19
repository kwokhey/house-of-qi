/**
 * Bulk import (login required). The browser reads the Excel file or Google Sheet,
 * shows a preview, then sends the cleaned rows here.
 *   POST /api/admin/import  { items: [...], stockMode: "keep" | "replace" }
 *     new item IDs are added with their stock;
 *     existing IDs get their names and prices updated; stock is only changed with "replace".
 *   GET /api/admin/import?url=<Google Sheets link>  → the sheet as CSV text
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";

const ID_RE = /^[A-Z0-9][A-Z0-9-]{0,39}$/;

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!hasDB(env)) return json({ error: "The stock database isn't connected yet." }, 503);
  const D = await db(env);
  let b = {};
  try { b = await request.json(); } catch {}
  const rows = Array.isArray(b.items) ? b.items.slice(0, 2000) : [];
  if (!rows.length) return json({ error: "Nothing to import." }, 400);
  const replace = b.stockMode === "replace";
  const now = Date.now();
  const existing = new Map((await D.prepare("SELECT id, stock FROM items").all()).results.map((r) => [r.id, r]));
  let sort = (await D.prepare("SELECT COALESCE(MAX(sort),0) AS s FROM items").first()).s;
  const stmts = [];
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const id = String(r.id || "").toUpperCase().replace(/\s+/g, "");
    if (!ID_RE.test(id) || !r.stone) { skipped++; continue; }
    const f = [String(r.stone).slice(0, 80), String(r.type || "Bracelet").slice(0, 40), String(r.variant || "").slice(0, 120),
      Number.isFinite(+r.size_mm) && r.size_mm !== null && r.size_mm !== "" ? +r.size_mm : null, String(r.supplier || "").slice(0, 80),
      String(r.collection || ({ Earrings: "earrings", Ring: "rings", Pendant: "pendants", Necklace: "pendants" })[r.type] || "bracelets").slice(0, 40), Math.max(0, +r.cost || 0), Math.max(0, +r.price || 0)];
    const stockIn = Math.max(0, Math.floor(+r.stock_in || 0));
    const stockLeft = Math.max(0, Math.floor(r.stock != null ? +r.stock : stockIn));
    const ex = existing.get(id);
    if (!ex) {
      stmts.push(D.prepare(`INSERT INTO items (id, stone, type, variant, size_mm, supplier, collection, cost, price, stock_in, stock, published, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(id, ...f, stockIn, stockLeft, ++sort, now, now));
      if (stockIn) stmts.push(D.prepare("INSERT INTO movements (item_id, kind, qty, unit_cost, note, created_at) VALUES (?, 'restock', ?, ?, 'Imported', ?)").bind(id, stockIn, f[6], now));
      if (stockIn > stockLeft) stmts.push(D.prepare("INSERT INTO movements (item_id, kind, qty, note, created_at) VALUES (?, 'adjust', ?, 'Imported: already sold', ?)").bind(id, stockLeft - stockIn, now));
      existing.set(id, { id, stock: stockLeft });
      added++;
    } else {
      stmts.push(D.prepare("UPDATE items SET stone=?, type=?, variant=?, size_mm=?, supplier=?, collection=?, cost=?, price=?, updated_at=? WHERE id=?").bind(...f, now, id));
      if (replace && stockLeft !== ex.stock) {
        stmts.push(D.prepare("INSERT INTO movements (item_id, kind, qty, note, created_at) VALUES (?, 'adjust', ?, 'Imported count', ?)").bind(id, stockLeft - ex.stock, now));
        stmts.push(D.prepare("UPDATE items SET stock = ? WHERE id = ?").bind(stockLeft, id));
      }
      updated++;
    }
  }
  for (let i = 0; i < stmts.length; i += 80) await D.batch(stmts.slice(i, i + 80));
  return json({ ok: true, added, updated, skipped });
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  const url = new URL(request.url).searchParams.get("url") || "";
  const m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (!m) return json({ error: "Paste a Google Sheets link (docs.google.com/spreadsheets/…)." }, 400);
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
  const res = await fetch(csvUrl, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok || /^\s*<!DOCTYPE html/i.test(text)) {
    return json({ error: "Couldn't open that sheet. In Google Sheets, click Share and set General access to 'Anyone with the link', or upload the Excel file instead." }, 400);
  }
  return json({ csv: text });
}
