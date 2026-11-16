/**
 * Affiliates: friends who help sell.
 * A sale is credited to a friend when the customer uses their link (?ref=CODE) or types
 * their code at checkout, or when the shop records an offline sale (bazaar, WhatsApp…) for them.
 * Commission is either a % of what the customer paid for the pieces (delivery not included)
 * or a fixed RM amount per piece, set per friend.
 */
import { cleanCode } from "./promo.js";

const r2 = (n) => Math.round(n * 100) / 100;

export async function affByCode(D, raw) {
  const code = cleanCode(raw);
  if (!code) return null;
  return D.prepare("SELECT * FROM affiliates WHERE code = ? AND active = 1").bind(code).first();
}

export function commission(aff, amount, pieces) {
  return aff.comm_kind === "fixed" ? r2(aff.comm_value * pieces) : r2((amount * aff.comm_value) / 100);
}

export const commLabel = (a) => (a.comm_kind === "fixed" ? `RM${+a.comm_value} per piece` : `${+a.comm_value}% of sales`);

/** Credit one sale to a friend. ref keeps it to once per order or offline sale. */
export async function creditSale(D, aff, { ref, order_no = "", channel = "Website", detail = "", pieces, amount, created_at }) {
  await D.prepare("INSERT OR IGNORE INTO aff_sales (aff_id, ref, order_no, channel, detail, pieces, amount, commission, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(aff.id, ref, order_no, channel, detail.slice(0, 300), pieces, r2(amount), commission(aff, amount, pieces), created_at || Date.now()).run();
}

/** Totals per friend: sales, pieces, commission earned and still to pay. */
export async function affTotals(D) {
  const { results } = await D.prepare(`SELECT aff_id, COUNT(*) AS orders, SUM(pieces) AS pieces, SUM(amount) AS amount, SUM(commission) AS earned,
    SUM(CASE WHEN paid_at = 0 THEN commission ELSE 0 END) AS unpaid, MAX(created_at) AS last FROM aff_sales GROUP BY aff_id`).all();
  return Object.fromEntries(results.map((r) => [r.aff_id, r]));
}
