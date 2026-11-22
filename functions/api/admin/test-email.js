/**
 * POST /api/admin/test-email   (login required)
 * Sends one clearly marked sample "New order" email to the team, to check email delivery.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
import { sendTeam, sampleEmail, sampleSession, itemImages, sampleCustomerEmail } from "../../_lib/notify.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!env.RESEND_API_KEY) return json({ error: "RESEND_API_KEY is not set in Cloudflare." }, 503);
  const D = hasDB(env) ? await db(env) : null;
  let images = [];
  try { images = await itemImages(env, D, sampleSession()); } catch {}
  let b = {}; try { b = await request.json(); } catch {}
  if (b.customer) {
    const to = String(b.to || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "Enter the email address to send the sample to." }, 400);
    const m = sampleCustomerEmail(images, to);
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "House of Qi <orders@houseofqi.shop>", to: [to], subject: m.subject, html: m.html, text: m.text }) });
    return json({ ok: res.ok, to: [to] }, res.ok ? 200 : 502);
  }
  const r = await sendTeam(env, D, sampleEmail(images));
  return json(r, r.ok ? 200 : 502);
}

/** GET /api/admin/test-email?customer=1 → preview of the customer's thank-you email */
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  const D = hasDB(env) ? await db(env) : null;
  let images = [];
  try { images = await itemImages(env, D, sampleSession()); } catch {}
  return new Response(sampleCustomerEmail(images, "customer@example.com").html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
