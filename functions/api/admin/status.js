/**
 * POST /api/admin/status   (login required)
 * Body: { paymentIntent, status: "confirmed"|"packed"|"shipped"|"ready", courier?, tracking? }
 * Saves the order's progress on the Stripe PaymentIntent.
 */
import { isAdmin } from "../../_lib/auth.js";
import { stripe, json, STATUSES } from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  if (!/^pi_[A-Za-z0-9]+$/.test(b.paymentIntent || "")) return json({ error: "Unknown order." }, 400);
  if (!STATUSES.includes(b.status)) return json({ error: "Unknown status." }, 400);

  const now = String(Math.floor(Date.now() / 1000));
  const p = new URLSearchParams();
  p.append("metadata[fulfil_status]", b.status);
  if (b.status === "packed") p.append("metadata[packed_at]", now);
  if (b.status === "shipped" || b.status === "ready") p.append("metadata[shipped_at]", now);
  if (b.status === "confirmed") { p.append("metadata[packed_at]", ""); p.append("metadata[shipped_at]", ""); }
  if (typeof b.courier === "string") p.append("metadata[courier]", b.courier.trim().slice(0, 60));
  if (typeof b.tracking === "string") p.append("metadata[tracking_no]", b.tracking.trim().slice(0, 80));

  try {
    const pi = await stripe(env, `payment_intents/${b.paymentIntent}`, { method: "POST", params: p });
    return json({ ok: true, status: pi.metadata.fulfil_status });
  } catch (e) {
    console.error("status", e.message);
    return json({ error: "Couldn't save to Stripe. Please try again." }, 502);
  }
}
