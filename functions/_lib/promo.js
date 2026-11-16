/**
 * Marketing: automatic sales and coupon codes.
 *
 *  Sales   — % off for the whole shop, one section (e.g. bracelets), chosen stones, or chosen pieces,
 *            between two dates. The shop shows the old price crossed out. If two sales cover the
 *            same piece, the bigger discount wins.
 *  Coupons — a code the customer types at checkout: % off, RM off, or free delivery,
 *            with an optional minimum spend, dates and a limit on how many orders can use it.
 *
 * All checks run on the server, so a customer can't change what they pay.
 */
import { db, hasDB, getSetting } from "./db.js";

const round2 = (n) => Math.round(n * 100 + 1e-9) / 100;
const live = (r, now) => r.active && (!r.starts_at || now >= r.starts_at) && (!r.ends_at || now <= r.ends_at);
export const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);

/** Sales running right now */
export async function liveSales(D, now = Date.now()) {
  const { results } = await D.prepare("SELECT * FROM sales WHERE active = 1").all();
  return results.filter((r) => live(r, now)).map((r) => ({ ...r, targets: safeArr(r.targets) }));
}
function safeArr(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

/** Does a sale cover this product? */
export function saleCovers(sale, p) {
  const t = sale.targets.map((x) => String(x).toLowerCase());
  if (sale.scope === "all") return true;
  if (sale.scope === "collection") return t.includes(String(p.collection).toLowerCase());
  if (sale.scope === "stones") return t.includes(String(p.stone).toLowerCase());
  if (sale.scope === "items") return t.includes(String(p.id).toLowerCase());
  return false;
}

/** Sale price, rounded to whole ringgit like the rest of the shop */
export const salePrice = (price, pct) => Math.max(1, Math.round(price * (1 - pct / 100)));

/** Put sale prices on public products: price becomes the sale price, `was` keeps the old one. */
export function applySales(products, sales) {
  if (!sales.length) return products;
  return products.map((p) => {
    let best = null;
    for (const s of sales) if (saleCovers(s, p) && (!best || s.percent > best.percent)) best = s;
    if (!best) return p;
    const np = salePrice(p.price, best.percent);
    if (np >= p.price) return p;
    return { ...p, was: p.price, price: np, sale: { name: best.name, percent: best.percent, ends: best.ends_at || 0 } };
  });
}

/** Shop-wide marketing bits the storefront needs (announcement bar, whether to show the code box) */
export async function shopPromo(env) {
  if (!hasDB(env)) return {};
  const D = await db(env), now = Date.now();
  let announce = null;
  try { const a = JSON.parse((await getSetting(D, "announce")) || "null"); if (a && a.active && a.text && live({ active: 1, starts_at: a.starts_at || 0, ends_at: a.ends_at || 0 }, now)) announce = { text: a.text, link: a.link || "" }; } catch {}
  let banner = null;
  try { banner = JSON.parse((await getSetting(D, "banner")) || "null"); } catch {}
  const { results } = await D.prepare("SELECT active, starts_at, ends_at FROM coupons WHERE active = 1").all();
  const affs = await D.prepare("SELECT COUNT(*) AS n FROM affiliates WHERE active = 1").first().catch(() => ({ n: 0 }));
  return { announce, banner, codes: results.some((r) => live(r, now)) || affs.n > 0 };
}

const MYR = (n) => "RM" + (Math.round(n * 100) / 100).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Short wording for a coupon, e.g. "10% off", "RM20 off", "Free delivery" */
export const couponLabel = (c) => (c.kind === "percent" ? `${+c.value}% off` : c.kind === "amount" ? `${MYR(c.value)} off` : "Free delivery");

/**
 * Check a code against a priced order (from priceOrder). Returns { error } or
 * { code, label, discount, freeShip, fee, total } with the order totals after the code.
 */
export async function checkCoupon(env, rawCode, order, now = Date.now()) {
  const code = cleanCode(rawCode);
  if (!code) return { error: "Please enter a code." };
  if (!hasDB(env)) return { error: "That code isn't valid." };
  const D = await db(env);
  const c = await D.prepare("SELECT * FROM coupons WHERE code = ?").bind(code).first();
  if (!c) {
    // a friend's (affiliate) code: credits the sale to them, with their customer discount if they have one
    const a = await D.prepare("SELECT * FROM affiliates WHERE code = ? AND active = 1").bind(code).first();
    if (!a) return { error: `“${code}” isn't a valid code.` };
    const first = a.name.trim().split(/\s+/)[0];
    const discount = a.disc_pct > 0 ? round2(order.subtotal * Math.min(50, a.disc_pct) / 100) : 0;
    return { code, aff: a.id, label: discount ? `${+a.disc_pct}% off · from ${first}` : `Shopping with ${first}`, discount, freeShip: false, fee: order.fee, total: round2(order.subtotal - discount + order.fee) };
  }
  if (!c.active) return { error: `“${code}” isn't a valid code.` };
  if (c.starts_at && now < c.starts_at) return { error: `“${code}” isn't active yet.` };
  if (c.ends_at && now > c.ends_at) return { error: `“${code}” has expired.` };
  if (c.max_uses > 0) {
    const u = await D.prepare("SELECT COUNT(*) AS n FROM coupon_uses WHERE code = ?").bind(code).first();
    if (u.n >= c.max_uses) return { error: `“${code}” has been fully redeemed.` };
  }
  const eligible = round2(order.lines.filter((l) => !(c.exclude_sale && l.product.was)).reduce((t, l) => t + l.unit * l.qty, 0));
  if (eligible <= 0) return { error: `“${code}” can't be used on items that are already on sale.` };
  if (c.min_spend > 0 && eligible < c.min_spend) {
    return { error: `“${code}” needs a minimum spend of ${MYR(c.min_spend)}${c.exclude_sale ? " on items not already on sale" : ""}. Add ${MYR(c.min_spend - eligible)} more to use it.` };
  }
  let discount = 0, fee = order.fee, freeShip = false;
  if (c.kind === "percent") discount = round2(eligible * Math.min(90, c.value) / 100);
  else if (c.kind === "amount") discount = round2(Math.min(c.value, eligible - 1)); // always leave something to pay
  else if (c.kind === "freeship") { freeShip = true; fee = 0; }
  if (c.kind !== "freeship" && discount <= 0) return { error: `“${code}” doesn't apply to this order.` };
  return { code, label: couponLabel(c), discount, freeShip, fee, total: round2(order.subtotal - discount + fee) };
}
