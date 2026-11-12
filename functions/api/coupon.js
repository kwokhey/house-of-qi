/**
 * POST /api/coupon  { code, items, ship }
 * Lets the checkout screen check a code and show the new total before paying.
 * The same check runs again in /api/checkout.
 */
import { priceOrder, json, loadCatalog } from "../_lib/pricing.js";
import { checkCoupon } from "../_lib/promo.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const origin = new URL(request.url).origin;
  let catalog;
  try { catalog = await loadCatalog(env, origin); } catch { return json({ error: "Please try again in a moment." }, 500); }
  const order = priceOrder(catalog, body?.items, body?.ship);
  if (order.error) return json({ error: order.error }, 400);
  const c = await checkCoupon(env, body?.code, order);
  if (c.error) return json({ error: c.error }, 400);
  return json({ ok: true, ...c, subtotal: order.subtotal });
}
