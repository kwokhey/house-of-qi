/**
 * Shared Stripe Checkout logic used by BOTH hosting options:
 *   - Cloudflare Pages → functions/api/checkout.js
 *   - Vercel           → api/checkout.mjs
 *
 * Prices are always taken from data/products.json on the server,
 * so a shopper can never change what they pay from the browser.
 */
export async function createCheckout({ items, origin, store, secretKey }) {
  if (!secretKey) return { status: 500, body: { error: "Payments are not configured yet (missing STRIPE_SECRET_KEY)." } };

  items = Array.isArray(items) ? items.slice(0, 50) : [];
  if (!items.length) return { status: 400, body: { error: "Your bag is empty." } };

  const byId = Object.fromEntries(store.products.map((p) => [p.id, p]));
  const params = new URLSearchParams();
  let subtotal = 0, i = 0;

  for (const it of items) {
    const p = byId[it?.id];
    const qty = Math.floor(Number(it?.qty));
    if (!p || !(qty >= 1 && qty <= 10)) return { status: 400, body: { error: "One of the pieces in your bag is no longer available." } };
    if (p.soldOut) return { status: 409, body: { error: `${p.name} has just sold out — please remove it from your bag.` } };

    // Options are "Size 6" strings or { label, price } objects with their own price
    const opt = p.options.find((o) => (typeof o === "string" ? o : o.label) === it.option);
    const option = opt ? (typeof opt === "string" ? opt : opt.label) : "";
    if (p.options.length && !option) return { status: 400, body: { error: `Please choose a size for ${p.name}.` } };
    const unit = opt && typeof opt === "object" && opt.price != null ? opt.price : p.price;

    subtotal += unit * qty;
    params.append(`line_items[${i}][quantity]`, String(qty));
    params.append(`line_items[${i}][price_data][currency]`, store.currency);
    params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(unit * 100)));
    params.append(`line_items[${i}][price_data][product_data][name]`, option ? `${p.name} — ${option}` : p.name);
    params.append(`line_items[${i}][price_data][product_data][description]`, p.material);
    // Stripe shows product photos (JPG/PNG/WebP) on the checkout page; SVG placeholders are skipped
    if (!/\.svg$/i.test(p.image)) {
      params.append(`line_items[${i}][price_data][product_data][images][0]`, new URL(p.image, origin + "/").href);
    }
    params.append(`line_items[${i}][price_data][product_data][metadata][product_id]`, p.id);
    if (option) params.append(`line_items[${i}][price_data][product_data][metadata][option]`, option);
    i++;
  }

  // Shipping: free above threshold, otherwise flat rate
  const free = subtotal >= store.freeShippingThreshold;
  const rate = "shipping_options[0][shipping_rate_data]";
  params.append(`${rate}[type]`, "fixed_amount");
  params.append(`${rate}[display_name]`, free ? "Complimentary shipping" : "Standard shipping");
  params.append(`${rate}[fixed_amount][amount]`, String(free ? 0 : Math.round(store.shippingFlat * 100)));
  params.append(`${rate}[fixed_amount][currency]`, store.currency);
  params.append(`${rate}[delivery_estimate][minimum][unit]`, "business_day");
  params.append(`${rate}[delivery_estimate][minimum][value]`, "3");
  params.append(`${rate}[delivery_estimate][maximum][unit]`, "business_day");
  params.append(`${rate}[delivery_estimate][maximum][value]`, "7");
  store.shipToCountries.forEach((c, n) => params.append(`shipping_address_collection[allowed_countries][${n}]`, c));

  params.append("mode", "payment");
  params.append("phone_number_collection[enabled]", "true");
  params.append("allow_promotion_codes", "true");
  params.append("billing_address_collection", "auto");
  params.append("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/shop.html`);
  // Payment methods (card, FPX, GrabPay, etc.) follow what you switch on in the Stripe Dashboard.

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("Stripe error", session?.error);
    return { status: 502, body: { error: "We couldn't start checkout. Please try again in a moment." } };
  }
  return { status: 200, body: { url: session.url } };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
