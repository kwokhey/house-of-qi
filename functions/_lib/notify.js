/**
 * "New order" email to the House of Qi team, sent once per paid order.
 * Sent through Resend (https://resend.com) with the Cloudflare secret RESEND_API_KEY.
 * Recipients: settings key "order_emails" (comma separated) or the default list below.
 * Nothing here gives the team access to Stripe: they only get this email.
 */
import { toOrder } from "./stripe.js";
import { getSetting } from "./db.js";

export const DEFAULT_TO = ["jessie@soleiltrinity.com", "kongeu@soleiltrinity.com", "suzee@soleiltrinity.com", "naomi@soleiltrinity.com"];
const FROM = "House of Qi Orders <orders@houseofqi.shop>";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rm = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Build subject, html and text for a paid Checkout Session (line_items + payment_intent expanded) */
export function orderEmail(s, site = "https://houseofqi.shop") {
  const o = toOrder(s, { full: true });
  const when = new Date(o.created).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
  const items = o.items.map((it, i) => {
    const opt = (it.options || "").split(" · ").slice(1).filter((x) => !/^Note:/.test(x)).join(" · ");
    return { name: it.name, qty: it.qty, amount: it.amount, opt };
  });
  const rows = items.map((it) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eadfd6">${esc(it.qty)} × <b>${esc(it.name)}</b>${it.opt ? `<br><span style="color:#7a6a60;font-size:13px">${esc(it.opt)}</span>` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #eadfd6;text-align:right;white-space:nowrap">${rm(it.amount)}</td></tr>`).join("");
  const sum = [["Subtotal", o.subtotal], ...(o.discount ? [[`Discount${o.coupon ? ` (${o.coupon})` : ""}`, -o.discount]] : []), [o.pickup ? "Self pick-up" : `Delivery (${o.delivery})`, o.shipping]]
    .map(([k, v]) => `<tr><td style="padding:3px 0;color:#7a6a60">${esc(k)}</td><td style="padding:3px 0;text-align:right">${v < 0 ? "−" + rm(-v) : rm(v)}</td></tr>`).join("");
  const addr = o.pickup ? "Self pick-up" : o.address.map(esc).join("<br>");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2b211c;font-size:15px;line-height:1.5">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a07a3c;margin:0 0 4px">House of Qi · New order</p>
  <h1 style="font-size:22px;margin:0 0 4px">Order ${esc(o.orderNo)} · ${rm(o.total)}</h1>
  <p style="margin:0 0 18px;color:#7a6a60">Paid ${esc(when)}</p>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
  <table style="width:100%;border-collapse:collapse;margin-top:8px">${sum}<tr><td style="padding:6px 0;font-weight:bold">Total paid</td><td style="padding:6px 0;text-align:right;font-weight:bold">${rm(o.total)}</td></tr></table>
  ${o.notes ? `<div style="margin:18px 0;padding:12px 14px;background:#f6ece4;border-radius:8px"><b>Additional request</b><br>${esc(o.notes).replace(/ \| /g, "<br>")}</div>` : ""}
  <h2 style="font-size:16px;margin:22px 0 6px">Customer</h2>
  <p style="margin:0">${esc(o.name)}<br>${o.phone ? `<a href="https://wa.me/${esc(o.phone.replace(/\D/g, ""))}">${esc(o.phone)}</a><br>` : ""}${o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : ""}</p>
  <h2 style="font-size:16px;margin:18px 0 6px">${o.pickup ? "Collection" : "Deliver to"}</h2>
  <p style="margin:0">${addr}</p>
  <p style="margin:24px 0 0"><a href="${site}/admin" style="display:inline-block;background:#2b211c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:99px">Open orders to pack</a></p>
</div>`;
  const text = [`House of Qi · New order ${o.orderNo} · ${rm(o.total)}`, `Paid ${when}`, "",
    ...items.map((it) => `${it.qty} × ${it.name}${it.opt ? ` (${it.opt})` : ""}  ${rm(it.amount)}`), "",
    `Subtotal ${rm(o.subtotal)}`, ...(o.discount ? [`Discount${o.coupon ? ` (${o.coupon})` : ""} -${rm(o.discount)}`] : []), `${o.pickup ? "Self pick-up" : `Delivery (${o.delivery})`} ${rm(o.shipping)}`, `Total paid ${rm(o.total)}`, "",
    ...(o.notes ? [`Additional request: ${o.notes}`, ""] : []),
    `Customer: ${o.name} · ${o.phone} · ${o.email}`, o.pickup ? "Self pick-up" : `Deliver to: ${o.address.join(", ")}`, "", `Orders: ${site}/admin`].join("\n");
  return { subject: `New order ${o.orderNo} · ${rm(o.total)} · ${items.map((i) => i.name).join(", ")}`.slice(0, 180), html, text, replyTo: o.email || undefined, paid: o.paid };
}

/** Send the team email once per session. Safe to call from both the webhook and the thank-you page. */
export async function notifyOrder(env, D, s) {
  if (!env.RESEND_API_KEY || !D || !s || s.payment_status !== "paid") return false;
  if (!String(s.id).startsWith("cs_live_") && !env.NOTIFY_TEST) return false; // only real orders
  const claim = await D.prepare("INSERT OR IGNORE INTO notified (sid, at) VALUES (?, ?)").bind(s.id, Date.now()).run();
  if (!claim.meta || !claim.meta.changes) return false; // already sent
  const res = await sendTeam(env, D, orderEmail(s));
  if (!res.ok) {
    console.error("order email", res.status, res.error);
    await D.prepare("DELETE FROM notified WHERE sid = ?").bind(s.id).run(); // let the next trigger retry
    return false;
  }
  return true;
}

/** Who gets the team email */
export async function teamList(D) {
  try { const v = D && (await getSetting(D, "order_emails")); if (v) return v.split(/[,\s]+/).filter((x) => /@/.test(x)); } catch {}
  return DEFAULT_TO;
}

/** Send one email to the team through Resend */
export async function sendTeam(env, D, m) {
  const to = await teamList(D);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.ORDER_EMAIL_FROM || FROM, to, subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, error: res.ok ? "" : body.slice(0, 300), to };
}

/** A clearly marked sample order, for the "send test email" button */
export function sampleEmail() {
  const s = { id: "cs_live_SAMPLE", created: Math.floor(Date.now() / 1000), payment_status: "paid", amount_subtotal: 9600, amount_total: 10600, total_details: { amount_shipping: 1000, amount_discount: 0 },
    metadata: { order_no: "TEST-0000", delivery: "West Malaysia", pickup: "no", gift_notes: "Amethyst Bracelet: (sample) please make it 16 cm", i1: "1× Amethyst Bracelet · Deep purple · 10 mm", i2: "1× Moss Agate Bracelet · 6 mm" },
    line_items: { data: [{ description: "Amethyst Bracelet", quantity: 1, amount_subtotal: 6800 }, { description: "Moss Agate Bracelet", quantity: 1, amount_subtotal: 2800 }] },
    customer_details: { name: "Sample Customer", email: "", phone: "+60120000000" },
    shipping_details: { name: "Sample Customer", address: { line1: "1 Jalan Contoh", postal_code: "50000", city: "Kuala Lumpur", state: "Kuala Lumpur", country: "MY" } } };
  const m = orderEmail(s);
  const note = `<p style="background:#fff3cd;padding:10px 14px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px">TEST EMAIL · This is a sample to show what the team receives for each paid order. No order was placed.</p>`;
  return { subject: "[TEST] " + m.subject, html: note + m.html, text: "TEST EMAIL · sample only, no order was placed.\n\n" + m.text };
}
