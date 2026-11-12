/**
 * POST /api/checkout  (Cloudflare Pages Function)
 * Body: { items: [{ id, sel, qty, note }], ship: "std" | "exp" | "pick" }
 * Returns: { url } of a Stripe Checkout page.
 *
 * Needs the secret STRIPE_SECRET_KEY in Cloudflare:
 *   Pages project → Settings → Variables and Secrets.
 */
import { priceOrder, orderNumber, json, loadCatalog } from "../_lib/pricing.js";

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
  let catalog;
  try { catalog = await loadCatalog(env, origin); } catch { return json({ error: "Our catalogue is unavailable. Please try again." }, 500); }

  const order = priceOrder(catalog, body?.items, body?.ship);
  if (order.error) return json({ error: order.error }, 400);

  const params = buildSessionParams(catalog, order, origin, orderNumber());
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe error", JSON.stringify(session?.error));
    return json({ error: "We couldn't open the payment page. Please try again in a moment." }, 502);
  }
  return json({ url: session.url });
}

function buildSessionParams(catalog, order, origin, orderNo) {
  const p = new URLSearchParams();
  const cur = catalog.currency || "myr";

  order.lines.forEach((l, i) => {
    const k = `line_items[${i}]`;
    const desc = [...l.chosen, l.note ? `Note: ${l.note}` : ""].filter(Boolean).join(" · ");
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
  p.append(`${r}[display_name]`, order.fee === 0 && s.fee > 0 ? `${s.label} (free)` : s.label);
  p.append(`${r}[fixed_amount][amount]`, String(Math.round(order.fee * 100)));
  p.append(`${r}[fixed_amount][currency]`, cur);
  if (s.days) {
    p.append(`${r}[delivery_estimate][minimum][unit]`, "business_day");
    p.append(`${r}[delivery_estimate][minimum][value]`, String(s.days[0]));
    p.append(`${r}[delivery_estimate][maximum][unit]`, "business_day");
    p.append(`${r}[delivery_estimate][maximum][value]`, String(s.days[1]));
  }
  if (!s.pickup) (catalog.shipToCountries || ["MY"]).forEach((c, n) => p.append(`shipping_address_collection[allowed_countries][${n}]`, c));

  const notes = order.lines.filter((l) => l.note).map((l) => `${l.product.name}: ${l.note}`).join(" | ");
  const meta = { order_no: orderNo, delivery: s.label, pickup: s.pickup ? "yes" : "no", track_key: trackKey(), fulfil_status: "confirmed", ...(notes ? { gift_notes: notes.slice(0, 500) } : {}) };
  // Each item's options, so the order page shows bead size, wrist size, add-ons
  order.lines.forEach((l, i) => {
    const desc = [`${l.qty}× ${l.product.name}`, ...l.chosen, l.note ? `Note: ${l.note}` : ""].filter(Boolean).join(" · ");
    meta[`i${i + 1}`] = desc.slice(0, 500);
  });
  for (const [key, val] of Object.entries(meta)) {
    p.append(`metadata[${key}]`, val);
    p.append(`payment_intent_data[metadata][${key}]`, val);
  }
  p.append("payment_intent_data[description]", `House of Qi order ${orderNo}`);
  p.append("client_reference_id", orderNo);

  p.append("mode", "payment");
  p.append("phone_number_collection[enabled]", "true");
  p.append("billing_address_collection", "auto");
  p.append("success_url", `${origin}/?session_id={CHECKOUT_SESSION_ID}`);
  p.append("cancel_url", `${origin}/?checkout=cancelled`);
  // Payment methods (cards, FPX, GrabPay…) follow what is switched on in the Stripe Dashboard.
  return p;
}
