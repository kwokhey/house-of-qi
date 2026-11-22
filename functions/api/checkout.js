/**
 * POST /api/checkout  (Cloudflare Pages Function)
 * Body: { items: [{ id, sel, qty, note }], ship: "std" | "exp" | "pick", coupon?: "CODE" }
 * Returns: { url } of a Stripe Checkout page.
 *
 * Needs the secret STRIPE_SECRET_KEY in Cloudflare:
 *   Pages project → Settings → Variables and Secrets.
 */
import { affByCode } from "../_lib/affiliates.js";
import { db, hasDB } from "../_lib/db.js";
import { priceOrder, orderNumber, json, loadCatalog } from "../_lib/pricing.js";
import { checkCoupon } from "../_lib/promo.js";

/** Random key that lets the customer's tracking link open their order */
function trackKey() {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(18))].map((b) => abc[b % abc.length]).join("");
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments are not switched on yet. Please try again later." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }

  const origin = new URL(request.url).origin;
  // the customer's own earlier unfinished checkout (back button, changed bag) no longer holds pieces
  if (body?.prev && hasDB(env)) {
    try { await (await db(env)).prepare("DELETE FROM holds WHERE order_no = ? AND sid NOT IN (SELECT sid FROM notified)").bind(String(body.prev).slice(0, 40)).run(); } catch (e) { console.error("release", e.message); }
  }
  let catalog;
  try { catalog = await loadCatalog(env, origin); } catch { return json({ error: "Our catalogue is unavailable. Please try again." }, 500); }

  const order = priceOrder(catalog, body?.items, body?.ship);
  if (order.error) return json({ error: order.error }, 400);

  // Coupon code (checked again here, so the price can't be changed in the browser)
  let promo = null;
  if (body?.coupon) {
    promo = await checkCoupon(env, body.coupon, order);
    if (promo.error) return json({ error: promo.error, coupon: false }, 400);
    order.fee = promo.fee;
    order.total = promo.total;
    order.promo = promo;
    if (promo.discount > 0) {
      try { promo.stripeCoupon = await stripeCoupon(env, promo, catalog.currency || "myr"); }
      catch (e) { console.error("coupon", e.message); return json({ error: "We couldn't apply your code just now. Please try again." }, 502); }
    }
  }

  // Which friend (affiliate) gets credit: their code typed at checkout, else the link the customer came in on
  if (promo?.aff) order.aff = { id: promo.aff, code: promo.code };
  else if (body?.ref && hasDB(env)) {
    try { const a = await affByCode(await db(env), body.ref); if (a) order.aff = { id: a.id, code: a.code }; } catch (e) { console.error("ref", e.message); }
  }

  const orderNo = orderNumber();
  const params = buildSessionParams(catalog, order, origin, orderNo);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe error", session?.error?.type || "", session?.error?.code || "", session?.error?.param || "");
    return json({ error: "We couldn't open the payment page. Please try again in a moment." }, 502);
  }
  // hold the pieces for this customer while they pay (released on payment, cancel, or after 30 minutes)
  if (hasDB(env)) {
    try {
      const D = await db(env), exp = Date.now() + 30 * 60 * 1000, per = {};
      for (const l of order.lines) per[l.product.id] = (per[l.product.id] || 0) + l.qty;
      await D.batch([
        D.prepare("DELETE FROM holds WHERE expires < ?").bind(Date.now() - 3600e3),
        ...Object.entries(per).map(([id, q]) => D.prepare("INSERT INTO holds (order_no, sid, item_id, qty, expires) VALUES (?, ?, ?, ?, ?)").bind(orderNo, session.id || "", id, q, exp)),
      ]);
    } catch (e) { console.error("hold", e.message); }
  }
  return json({ url: session.url, order: orderNo });
}

/**
 * Stripe needs a coupon object to show a discount on its payment page.
 * One is made per code + amount (e.g. HQ-QI10-1250 = RM12.50 off) and reused after that.
 */
async function stripeCoupon(env, promo, cur) {
  const cents = Math.round(promo.discount * 100);
  const id = `HQ-${promo.code}-${cents}`;
  const auth = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const got = await fetch(`https://api.stripe.com/v1/coupons/${encodeURIComponent(id)}`, { headers: auth });
  if (got.ok) return id;
  const p = new URLSearchParams({ id, amount_off: String(cents), currency: cur, duration: "once", name: `${promo.code} · ${promo.label}`.slice(0, 40) });
  const res = await fetch("https://api.stripe.com/v1/coupons", { method: "POST", headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" }, body: p });
  if (res.ok) return id;
  const e = await res.json().catch(() => ({}));
  if (e?.error?.code === "resource_already_exists") return id;
  throw new Error(e?.error?.message || `stripe ${res.status}`);
}

function buildSessionParams(catalog, order, origin, orderNo) {
  const p = new URLSearchParams();
  const cur = catalog.currency || "myr";

  order.lines.forEach((l, i) => {
    const k = `line_items[${i}]`;
    const desc = [l.product.details || "", ...l.chosen, l.note ? `Note: ${l.note}` : ""].filter(Boolean).join(" · ");
    p.append(`${k}[quantity]`, String(l.qty));
    p.append(`${k}[price_data][currency]`, cur);
    p.append(`${k}[price_data][unit_amount]`, String(Math.round(l.unit * 100)));
    p.append(`${k}[price_data][product_data][name]`, l.product.name);
    if (desc) p.append(`${k}[price_data][product_data][description]`, desc.slice(0, 500));
    // Stripe can show real photos (JPG/PNG/WebP) on its payment page
    if (l.product.image && !/\.svg$/i.test(l.product.image)) {
      p.append(`${k}[price_data][product_data][images][0]`, new URL(l.product.image, origin + "/").href);
    }
    p.append(`${k}[price_data][product_data][metadata][product_id]`, l.product.id);
  });

  // Delivery: the customer already picked it on our site, so we pass exactly one option
  const s = order.ship, r = "shipping_options[0][shipping_rate_data]";
  p.append(`${r}[type]`, "fixed_amount");
  p.append(`${r}[display_name]`, [s.label, order.weightNote, order.count > 1 ? `${order.count} pieces` : ""].filter(Boolean).join(" · ").slice(0, 100));
  p.append(`${r}[fixed_amount][amount]`, String(Math.round(order.fee * 100)));
  p.append(`${r}[fixed_amount][currency]`, cur);
  if (s.days) {
    p.append(`${r}[delivery_estimate][minimum][unit]`, "business_day");
    p.append(`${r}[delivery_estimate][minimum][value]`, String(s.days[0]));
    p.append(`${r}[delivery_estimate][maximum][unit]`, "business_day");
    p.append(`${r}[delivery_estimate][maximum][value]`, String(s.days[1]));
  }
  if (!s.pickup) (s.country ? [s.country] : catalog.shipToCountries || ["MY"]).forEach((c, n) => p.append(`shipping_address_collection[allowed_countries][${n}]`, c));

  const notes = order.lines.filter((l) => l.note).map((l) => `${l.product.name}: ${l.note}`).join(" | ");
  const meta = { order_no: orderNo, delivery: s.label, pickup: s.pickup ? "yes" : "no", track_key: trackKey(), fulfil_status: "confirmed", ...(notes ? { gift_notes: notes.slice(0, 500) } : {}) };
  // Stripe allows 50 metadata keys; with 20 bag lines × 2 keys, the code uses 2 at most
  if (order.promo && !order.promo.aff) { meta.coupon = order.promo.code; meta.coupon_off = order.promo.freeShip ? "free delivery" : String(order.promo.discount); }
  if (order.promo?.aff && order.promo.discount) meta.coupon_off = String(order.promo.discount);
  if (order.aff) { meta.aff = String(order.aff.id); meta.aff_code = order.aff.code; }
  // what each piece actually sold for after sale + code (for profit figures on the Stock page)
  const factor = order.promo?.discount ? 1 - order.promo.discount / order.subtotal : 1;
  // Each item's options, so the order page shows bead size, wrist size, add-ons
  order.lines.forEach((l, i) => {
    const desc = [`${l.qty}× ${l.product.name}`, l.product.details || "", ...l.chosen, l.product.sale ? `Sale ${l.product.sale.percent}% off (was RM${l.product.was})` : "", l.note ? `Note: ${l.note}` : ""].filter(Boolean).join(" · ");
    meta[`i${i + 1}`] = desc.slice(0, 500);
    meta[`s${i + 1}`] = `${l.product.id}:${l.qty}:${Math.round(l.product.price * factor * 100) / 100}`; // used to deduct stock once paid
  });
  for (const [key, val] of Object.entries(meta)) {
    p.append(`metadata[${key}]`, val);
    p.append(`payment_intent_data[metadata][${key}]`, val);
  }
  if (order.promo?.stripeCoupon) p.append("discounts[0][coupon]", order.promo.stripeCoupon);
  p.append("payment_intent_data[description]", `House of Qi order ${orderNo}`);
  p.append("client_reference_id", orderNo);

  p.append("mode", "payment");
  // hold one-of-a-kind pieces for a short time only
  p.append("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));
  p.append("phone_number_collection[enabled]", "true");
  p.append("billing_address_collection", "auto");
  p.append("success_url", `${origin}/?session_id={CHECKOUT_SESSION_ID}`);
  p.append("cancel_url", `${origin}/?checkout=cancelled&o=${encodeURIComponent(orderNo)}`);
  // Payment methods (cards, FPX, GrabPay…) follow what is switched on in the Stripe Dashboard.
  return p;
}
