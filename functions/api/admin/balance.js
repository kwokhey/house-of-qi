/**
 * Pre-orders: ask the customer for the remaining 50% (+ delivery) when the piece is ready.
 *   POST /api/admin/balance { sessionId }  (login required)
 * Creates a Stripe payment page for the balance (valid 24 hours), saves its link on the order,
 * and emails it to the customer. Click again any time to make a fresh link.
 */
import { isAdmin } from "../../_lib/auth.js";
import { stripe, json } from "../../_lib/stripe.js";
import { balanceEmail } from "../../_lib/notify.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(b.sessionId || "")) return json({ error: "Unknown order." }, 400);
  const q = new URLSearchParams(); q.append("expand[]", "payment_intent");
  let s;
  try { s = await stripe(env, `checkout/sessions/${b.sessionId}`, { params: q }); } catch { return json({ error: "Couldn't find that order in Stripe." }, 404); }
  const sm = s.metadata || {}, pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  if (sm.preorder !== "1" || !pi) return json({ error: "This order isn't a pre-order." }, 400);
  if ((pi.metadata || {}).balance_status === "paid") return json({ error: "The balance for this order is already paid." }, 400);
  const balance = Number(sm.balance) || 0, ship = Number(sm.balance_ship) || 0;
  if (!(balance > 0)) return json({ error: "Nothing left to pay on this order." }, 400);

  const origin = new URL(request.url).origin, orderNo = sm.order_no || s.client_reference_id || "";
  const c = s.customer_details || {};
  const p = new URLSearchParams();
  p.append("mode", "payment");
  p.append("line_items[0][quantity]", "1");
  p.append("line_items[0][price_data][currency]", s.currency || "myr");
  p.append("line_items[0][price_data][unit_amount]", String(Math.round(balance * 100)));
  p.append("line_items[0][price_data][product_data][name]", `Balance for pre-order ${orderNo}`);
  p.append("line_items[0][price_data][product_data][description]", `Remaining 50%${ship ? ` + delivery RM${ship.toFixed(2)}` : ""} · House of Qi`);
  if (c.email) p.append("customer_email", c.email);
  const meta = { hq_balance: orderNo, parent_session: s.id, parent_pi: pi.id };
  for (const [k, v] of Object.entries(meta)) { p.append(`metadata[${k}]`, v); p.append(`payment_intent_data[metadata][${k}]`, v); }
  p.append("payment_intent_data[description]", `House of Qi pre-order ${orderNo} (balance)`);
  p.append("client_reference_id", `${orderNo}-BAL`);
  p.append("expires_at", String(Math.floor(Date.now() / 1000) + 23.5 * 3600));
  p.append("success_url", `${origin}/?balance=paid&o=${encodeURIComponent(orderNo)}`);
  p.append("cancel_url", `${origin}/`);
  let bs;
  try { bs = await stripe(env, "checkout/sessions", { method: "POST", params: p }); }
  catch (e) { console.error("balance", e.message); return json({ error: "Couldn't create the payment link. Please try again." }, 502); }

  const u = new URLSearchParams();
  u.append("metadata[balance_status]", "requested");
  u.append("metadata[balance_url]", bs.url.slice(0, 500));
  u.append("metadata[balance_sid]", bs.id);
  u.append("metadata[balance_at]", String(Math.floor(Date.now() / 1000)));
  try { await stripe(env, `payment_intents/${pi.id}`, { method: "POST", params: u }); } catch (e) { console.error("balance meta", e.message); }

  let emailed = false;
  if (c.email && env.RESEND_API_KEY) {
    try {
      const m = balanceEmail({ name: c.name || "", orderNo, balance, ship, url: bs.url });
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "House of Qi <orders@houseofqi.shop>", to: [c.email], reply_to: "naomi@soleiltrinity.com", subject: m.subject, html: m.html, text: m.text }) });
      emailed = r.ok;
    } catch (e) { console.error("balance email", e.message); }
  }
  const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${(c.name || "").split(" ")[0] || ""}, good news from House of Qi! Your pre-order ${orderNo} is ready. Please pay the balance of RM${balance.toFixed(2)} here (link valid 24 hours): ${bs.url}`)}` : "";
  return json({ ok: true, url: bs.url, emailed, email: c.email || "", whatsapp: wa, balance });
}
