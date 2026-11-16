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
  // unpaid: commission the shop still owes the seller (website and offline sales)
  // owed:   money a seller still owes the shop for consignment pieces she sold (sale minus her commission, which she keeps)
  const { results } = await D.prepare(`SELECT aff_id, COUNT(*) AS orders, SUM(pieces) AS pieces, SUM(amount) AS amount, SUM(commission) AS earned,
    SUM(CASE WHEN paid_at = 0 AND channel != 'Consignment' THEN commission ELSE 0 END) AS unpaid,
    SUM(CASE WHEN paid_at = 0 AND channel = 'Consignment' THEN amount - commission ELSE 0 END) AS owed,
    MAX(created_at) AS last FROM aff_sales GROUP BY aff_id`).all();
  const hold = await D.prepare("SELECT aff_id, SUM(CASE kind WHEN 'give' THEN qty ELSE -qty END) AS holding FROM consign GROUP BY aff_id").all();
  const out = Object.fromEntries(results.map((r) => [r.aff_id, r]));
  for (const h of hold.results) out[h.aff_id] = { orders: 0, pieces: 0, amount: 0, earned: 0, unpaid: 0, owed: 0, last: 0, ...(out[h.aff_id] || {}), holding: h.holding };
  return out;
}

/** Pieces each seller is holding, per item */
export async function holdings(D, affId) {
  const { results } = await D.prepare(`SELECT c.item_id, SUM(CASE c.kind WHEN 'give' THEN c.qty ELSE -c.qty END) AS qty, i.stone, i.type, i.variant, i.size_mm, i.price
    FROM consign c LEFT JOIN items i ON i.id = c.item_id WHERE c.aff_id = ? GROUP BY c.item_id HAVING SUM(CASE c.kind WHEN 'give' THEN c.qty ELSE -c.qty END) > 0 ORDER BY i.sort, c.item_id`).bind(affId).all();
  return results;
}
