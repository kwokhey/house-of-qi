/**
 * GET /api/order?session_id=cs_...  (Cloudflare Pages Function)
 * Used by the thank-you screen after Stripe sends the customer back.
 * Returns only what that screen needs (no address or card details).
 */
import { json } from "../_lib/pricing.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: "Order not found." }, 404);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments are not switched on yet." }, 503);

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}?expand[]=line_items`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const s = await res.json();
  if (!res.ok) return json({ error: "Order not found." }, 404);

  const items = (s.line_items?.data || []).map((li) => ({
    name: li.description,
    qty: li.quantity,
    amount: li.amount_total / 100,
  }));
  return json({
    orderNo: s.metadata?.order_no || s.client_reference_id || "",
    paid: s.payment_status === "paid" || s.payment_status === "no_payment_required",
    status: s.status,
    email: s.customer_details?.email || "",
    delivery: s.metadata?.delivery || "",
    pickup: s.metadata?.pickup === "yes",
    items,
    subtotal: (s.amount_subtotal || 0) / 100,
    shipping: (s.total_details?.amount_shipping || 0) / 100,
    total: (s.amount_total || 0) / 100,
  });
}
