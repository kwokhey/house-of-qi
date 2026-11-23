/**
 * GET /api/admin/receipt?id=cs_...   (login required)
 * Shows the email receipt ("Thank you for your order") exactly as the customer got it,
 * with a small bar on top saying where and when it was sent.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { stripe } from "../../_lib/stripe.js";
import { customerEmail, itemImages } from "../../_lib/notify.js";

const page = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return page("<p style='font-family:sans-serif;padding:24px'>Please log in to the admin page first.</p>", 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return page("<p style='font-family:sans-serif;padding:24px'>Order not found.</p>", 404);
  try {
    const p = new URLSearchParams();
    p.append("expand[]", "line_items");
    p.append("expand[]", "payment_intent");
    const s = await stripe(env, `checkout/sessions/${id}`, { params: p });
    const D = hasDB(env) ? await db(env) : null;
    let images = [];
    try { images = await itemImages(env, D, s); } catch {}
    const m = customerEmail(s, { images });
    let sent = null;
    try { sent = D && (await D.prepare("SELECT at FROM notified WHERE sid = ?").bind("cust-" + id).first()); } catch {}
    const when = sent ? new Date(sent.at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    const bar = `<div style="background:#3B2C23;color:#F8EEE7;padding:10px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5">
      <b>Email receipt</b> · ${esc(m.subject)}<br>${sent ? `Sent to ${esc(m.to)} on ${esc(when)}` : `Not sent by email${m.to ? ` (customer email: ${esc(m.to)})` : ""}. This is how it looks.`}</div>`;
    const html = /<body[^>]*>/.test(m.html) ? m.html.replace(/<body([^>]*)>/, (x) => x + bar) : bar + m.html;
    return page(html.replace(/<title>[^<]*<\/title>/, "") .replace(/<head>/, `<head><title>Receipt ${esc(s.metadata?.order_no || "")}</title>`));
  } catch (e) {
    console.error("receipt", e.message);
    return page("<p style='font-family:sans-serif;padding:24px'>Couldn't load this order from Stripe. Please try again.</p>", 502);
  }
}
