/**
 * Small helpers for talking to Stripe and shaping orders.
 * Order progress (packed / shipped / ready) is stored on the Stripe PaymentIntent
 * as metadata, so the shop needs no database.
 */

const API = "https://api.stripe.com/v1/";
const VERSION = "2024-06-20";

/**
 * Two Stripe accounts (since 25 Nov 2026): STRIPE_SECRET_KEY is House of Qi's own account (new orders);
 * STRIPE_OLD_SECRET_KEY is the earlier shared Soleil Trinity account, kept so older orders still load,
 * refund and collect balances. A request for one object that the new account doesn't have
 * ("No such …") is tried again on the old account.
 */
export function stripeKeys(env) {
  return [...new Set([env.STRIPE_SECRET_KEY, env.STRIPE_OLD_SECRET_KEY].filter(Boolean))];
}

export async function stripe(env, path, { method = "GET", params, key } = {}) {
  try {
    return await stripeOnce(key || env.STRIPE_SECRET_KEY, path, { method, params });
  } catch (e) {
    if (!key && env.STRIPE_OLD_SECRET_KEY && env.STRIPE_OLD_SECRET_KEY !== env.STRIPE_SECRET_KEY && e.code === "resource_missing") {
      return stripeOnce(env.STRIPE_OLD_SECRET_KEY, path, { method, params });
    }
    throw e;
  }
}

async function stripeOnce(secret, path, { method = "GET", params } = {}) {
  const init = {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Stripe-Version": VERSION },
  };
  let url = API + path;
  if (params && method === "GET") url += (url.includes("?") ? "&" : "?") + params.toString();
  else if (params) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = params;
  }
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || "Stripe request failed");
    err.status = res.status;
    err.code = data?.error?.code || "";
    throw err;
  }
  return data;
}

export const STATUSES = ["confirmed", "packed", "shipped", "ready"];

/** Turn a Checkout Session (with line_items and payment_intent expanded) into a tidy order. */
export function toOrder(s, { full = false } = {}) {
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  const sm = s.metadata || {};
  const pm = pi?.metadata || {};
  const pickup = (pm.pickup || sm.pickup) === "yes";
  const status = STATUSES.includes(pm.fulfil_status) ? pm.fulfil_status : "confirmed";
  const items = (s.line_items?.data || []).map((li, i) => ({
    name: li.description,
    options: sm[`i${i + 1}`] || "",
    id: String(sm[`s${i + 1}`] || "").split(":")[0] || sm[`p${i + 1}`] || "", // the piece's item ID (for packing)
    qty: li.quantity,
    amount: (li.amount_subtotal ?? li.amount_total) / 100,
  }));
  const order = {
    orderNo: sm.order_no || s.client_reference_id || "",
    created: s.created * 1000,
    paid: s.payment_status === "paid" || s.payment_status === "no_payment_required",
    pickup,
    delivery: sm.delivery || "",
    items,
    subtotal: (s.amount_subtotal || 0) / 100,
    shipping: (s.total_details?.amount_shipping || 0) / 100,
    discount: (s.total_details?.amount_discount || 0) / 100,
    coupon: sm.coupon || "",
    total: (s.amount_total || 0) / 100,
    status,
    courier: pm.courier || "",
    tracking: pm.tracking_no || "",
    preorder: sm.preorder === "1",
    balance: Number(sm.balance) || 0,
    balanceShip: Number(sm.balance_ship) || 0,
    fullTotal: Number(sm.full_total) || 0,
    balanceStatus: sm.preorder === "1" ? (pm.balance_status || "due") : "",
    balanceUrl: pm.balance_url || "",
    balanceAt: pm.balance_at ? Number(pm.balance_at) * 1000 : null,
    balancePaidAt: pm.balance_paid_at ? Number(pm.balance_paid_at) * 1000 : null,
    refunded: (() => { const ch = pi && pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null; return Math.max(ch ? (ch.amount_refunded || 0) / 100 : 0, Number(pm.refunded_amount) || 0); })(),
    refundedAt: pm.refunded_at ? Number(pm.refunded_at) * 1000 : null,
    times: {
      confirmed: s.created * 1000,
      packed: pm.packed_at ? Number(pm.packed_at) * 1000 : null,
      shipped: pm.shipped_at ? Number(pm.shipped_at) * 1000 : null,
    },
  };
  if (full) {
    const c = s.customer_details || {};
    const ship = s.shipping_details || s.collected_information?.shipping_details || null;
    const a = ship?.address || c.address || {};
    Object.assign(order, {
      sessionId: s.id,
      paymentIntent: pi?.id || (typeof s.payment_intent === "string" ? s.payment_intent : ""),
      name: ship?.name || c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      address: pickup ? [] : [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean),
      notes: sm.gift_notes || "",
      trackKey: sm.track_key || pm.track_key || "",
    });
  }
  return order;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}
