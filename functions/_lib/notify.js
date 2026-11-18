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

const SITE = "https://houseofqi.shop";
const C = { paper: "#F0E0D3", card: "#FBF6F1", soft: "#F4E8DF", ink: "#3B2C23", ink2: "#7A6658", gold: "#A97F45", line: "#E8D9CC" };
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "'Jost','Helvetica Neue',Helvetica,Arial,sans-serif";

/** Build subject, html and text for a paid Checkout Session (line_items + payment_intent expanded).
 *  images: optional list of absolute image URLs, one per line item */
export function orderEmail(s, { images = [], site = SITE } = {}) {
  const o = toOrder(s, { full: true });
  const when = new Date(o.created).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const items = o.items.map((it, i) => {
    const opt = (it.options || "").split(" · ").slice(1).filter((x) => !/^Note:/.test(x)).join(" · ");
    return { name: it.name, qty: it.qty, amount: it.amount, opt, img: images[i] || `${site}/assets/img/logo-mark.png` };
  });
  const wa = o.phone ? `https://wa.me/${o.phone.replace(/\D/g, "")}` : "";
  const how = o.pickup ? "Self pick-up" : `Delivery · ${o.delivery || "Malaysia"}`;

  const itemRows = items.map((it) => `
    <tr>
      <td width="76" style="padding:14px 0;border-bottom:1px solid ${C.line};vertical-align:top">
        <img src="${esc(it.img)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:12px;object-fit:cover;background:${C.soft}">
      </td>
      <td style="padding:14px 10px 14px 0;border-bottom:1px solid ${C.line};vertical-align:top;font-family:${SANS}">
        <div style="font-family:${SERIF};font-size:20px;line-height:1.15;color:${C.ink}">${esc(it.name)}</div>
        ${it.opt ? `<div style="font-size:13px;color:${C.ink2};margin-top:3px">${esc(it.opt)}</div>` : ""}
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.gold};margin-top:6px">Qty ${esc(it.qty)}</div>
      </td>
      <td align="right" style="padding:14px 0;border-bottom:1px solid ${C.line};vertical-align:top;font-family:${SANS};font-size:15px;color:${C.ink};white-space:nowrap">${rm(it.amount)}</td>
    </tr>`).join("");

  const sumRow = (k, v, strong) => `<tr><td style="padding:4px 0;font-family:${SANS};font-size:${strong ? 16 : 14}px;color:${strong ? C.ink : C.ink2};${strong ? "font-weight:600;" : ""}">${esc(k)}</td><td align="right" style="padding:4px 0;font-family:${SANS};font-size:${strong ? 16 : 14}px;color:${C.ink};${strong ? "font-weight:600;" : ""}">${v}</td></tr>`;
  const sums = [
    sumRow("Subtotal", rm(o.subtotal)),
    o.discount ? sumRow(`Discount${o.coupon ? ` · ${o.coupon}` : ""}`, "−" + rm(o.discount)) : "",
    sumRow(o.pickup ? "Self pick-up" : `Delivery · ${o.delivery}`, o.shipping ? rm(o.shipping) : "Free"),
  ].join("");

  const label = (t) => `<div style="font-family:${SANS};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${C.gold};margin:0 0 8px">${t}</div>`;
  const block = (t, body) => `<td class="col" width="50%" valign="top" style="padding:0 8px 0 0">${label(t)}<div style="font-family:${SANS};font-size:14.5px;line-height:1.6;color:${C.ink}">${body}</div></td>`;
  const customer = [esc(o.name), o.phone ? `<a href="${wa}" style="color:${C.ink};text-decoration:none">${esc(o.phone)}</a>` : "", o.email ? `<a href="mailto:${esc(o.email)}" style="color:${C.ink2};text-decoration:underline">${esc(o.email)}</a>` : ""].filter(Boolean).join("<br>");
  const address = o.pickup ? "Customer will collect<br>(self pick-up)" : o.address.map((x) => (x === "MY" ? "Malaysia" : x)).map(esc).join("<br>");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>New order ${esc(o.orderNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.paper}}
  @media (max-width:520px){ .wrap{padding:22px 18px !important} .col{display:block !important;width:100% !important;padding:0 0 18px 0 !important} .h1{font-size:30px !important} }
</style></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden">${esc(how)} · ${items.length} piece${items.length > 1 ? "s" : ""} · ${rm(o.total)} paid${o.notes ? " · has an additional request" : ""}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td align="center" style="padding:6px 0 20px">
      <img src="${site}/assets/img/logo-full.png" width="92" alt="House of Qi" style="display:block;width:92px;height:auto">
    </td></tr>
    <tr><td class="wrap" style="background:${C.card};border-radius:22px;padding:34px 34px 30px;border:1px solid ${C.line}">
      <div style="height:2px;width:56px;background:${C.gold};background-image:linear-gradient(115deg,#8F6834,#C79E5F 28%,#F1DCAA 46%,#C49A5B 62%,#94703A);margin:0 0 18px"></div>
      ${label("New order")}
      <div class="h1" style="font-family:${SERIF};font-size:36px;line-height:1.05;color:${C.ink};font-weight:500">Order ${esc(o.orderNo)}</div>
      <div style="font-family:${SANS};font-size:14px;color:${C.ink2};margin-top:8px">Paid ${esc(when)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
        <td style="background:${C.soft};border-radius:99px;padding:7px 14px;font-family:${SANS};font-size:13px;color:${C.ink}">${esc(how)}</td>
        <td width="8"></td>
        <td style="background:${C.ink};border-radius:99px;padding:7px 14px;font-family:${SANS};font-size:13px;color:#fff">${rm(o.total)} paid</td>
      </tr></table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid ${C.line}">${itemRows}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${sums}
        <tr><td colspan="2" style="padding:8px 0 0"><div style="height:1px;background:${C.line}"></div></td></tr>
        ${sumRow("Total paid", rm(o.total), true)}
      </table>

      ${o.notes ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:${C.soft};border-left:3px solid ${C.gold};border-radius:4px 14px 14px 4px;padding:14px 16px">
        ${label("Additional request")}<div style="font-family:${SERIF};font-size:19px;font-style:italic;line-height:1.35;color:${C.ink}">${esc(o.notes).replace(/ \| /g, "<br>")}</div></td></tr></table>` : ""}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr>
        ${block("Customer", customer)}${block(o.pickup ? "Collection" : "Deliver to", address)}
      </tr></table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr>
        <td style="background:${C.ink};border-radius:99px"><a href="${site}/admin" style="display:inline-block;padding:13px 22px;font-family:${SANS};font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#fff;text-decoration:none">Open orders</a></td>
        ${wa ? `<td width="10"></td><td style="border:1px solid ${C.ink};border-radius:99px"><a href="${wa}" style="display:inline-block;padding:12px 20px;font-family:${SANS};font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${C.ink};text-decoration:none">WhatsApp</a></td>` : ""}
      </tr></table>
    </td></tr>
    <tr><td align="center" style="padding:20px 10px 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.ink2}">
      <span style="font-family:${SERIF};font-size:15px;letter-spacing:.2em;color:${C.ink}">HOUSE OF QI</span><br>
      Jewellery with frequencies · <a href="${site}" style="color:${C.ink2}">houseofqi.shop</a><br>
      Sent to the House of Qi team for each paid order. Reply to reach the customer.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = [`House of Qi · New order ${o.orderNo} · ${rm(o.total)}`, `Paid ${when} · ${how}`, "",
    ...items.map((it) => `${it.qty} × ${it.name}${it.opt ? ` (${it.opt})` : ""}  ${rm(it.amount)}`), "",
    `Subtotal ${rm(o.subtotal)}`, ...(o.discount ? [`Discount${o.coupon ? ` (${o.coupon})` : ""} -${rm(o.discount)}`] : []), `${o.pickup ? "Self pick-up" : `Delivery (${o.delivery})`} ${rm(o.shipping)}`, `Total paid ${rm(o.total)}`, "",
    ...(o.notes ? [`Additional request: ${o.notes}`, ""] : []),
    `Customer: ${o.name} · ${o.phone} · ${o.email}`, o.pickup ? "Self pick-up" : `Deliver to: ${o.address.join(", ")}`, "", `Orders: ${site}/admin`].join("\n");
  return { subject: `New order ${o.orderNo} · ${rm(o.total)} · ${items.map((i) => i.name).join(", ")}`.slice(0, 180), html, text, replyTo: o.email || undefined, paid: o.paid };
}

/** Absolute photo URL for each line item (real photo, saved preview, or drawn preview); logo if none */
export async function itemImages(env, D, s, site = SITE) {
  const ids = Object.keys(s.metadata || {}).filter((k) => /^s\d+$/.test(k)).sort((a, b) => a.slice(1) - b.slice(1)).map((k) => String(s.metadata[k]).split(":")[0]);
  let og = [];
  try { og = await (await env.ASSETS.fetch(`${site}/assets/img/og/index.json`)).json(); } catch {}
  const out = [];
  for (const id of ids) {
    let url = "";
    try {
      const r = D && (await D.prepare("SELECT item_id, updated_at FROM images WHERE item_id IN (?, ?) ORDER BY item_id = ? DESC").bind(id, "prev-" + id, id).first());
      if (r) url = `${site}/img/${encodeURIComponent(r.item_id)}.jpg?v=${r.updated_at}`;
    } catch {}
    if (!url && og.includes(id)) url = `${site}/assets/img/og/${encodeURIComponent(id)}.jpg`;
    out.push(url || `${site}/assets/img/logo-mark.png`);
  }
  return out;
}

/** Send the team email once per session. Safe to call from both the webhook and the thank-you page. */
export async function notifyOrder(env, D, s) {
  if (!env.RESEND_API_KEY || !D || !s || s.payment_status !== "paid") return false;
  if (!String(s.id).startsWith("cs_live_") && !env.NOTIFY_TEST) return false; // only real orders
  const claim = await D.prepare("INSERT OR IGNORE INTO notified (sid, at) VALUES (?, ?)").bind(s.id, Date.now()).run();
  if (!claim.meta || !claim.meta.changes) return false; // already sent
  let images = [];
  try { images = await itemImages(env, D, s); } catch {}
  const res = await sendTeam(env, D, orderEmail(s, { images }));
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
export function sampleSession() {
  return { id: "cs_live_SAMPLE", created: Math.floor(Date.now() / 1000), payment_status: "paid", amount_subtotal: 9600, amount_total: 10600, total_details: { amount_shipping: 1000, amount_discount: 0 },
    metadata: { order_no: "TEST-0000", delivery: "West Malaysia", pickup: "no", gift_notes: "Amethyst Bracelet: (sample) please make it 16 cm", i1: "1× Amethyst Bracelet · Deep purple · 10 mm", i2: "1× Moss Agate Bracelet · 6 mm", s1: "AMET-1-10:1:68", s2: "MAGA-1-4:1:28" },
    line_items: { data: [{ description: "Amethyst Bracelet", quantity: 1, amount_subtotal: 6800 }, { description: "Moss Agate Bracelet", quantity: 1, amount_subtotal: 2800 }] },
    customer_details: { name: "Sample Customer", email: "", phone: "+60120000000" },
    shipping_details: { name: "Sample Customer", address: { line1: "1 Jalan Contoh", postal_code: "50000", city: "Kuala Lumpur", state: "Kuala Lumpur", country: "MY" } } };
}

export function sampleEmail(images = []) {
  const s = sampleSession();
  const m = orderEmail(s, { images });
  const note = `<div style="background:#3B2C23;color:#F8EEE7;text-align:center;padding:10px 14px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Test email · sample only · no order was placed</div>`;
  return { subject: "[TEST] " + m.subject, html: m.html.replace(/<body([^>]*)>/, (x) => x + note), text: "TEST EMAIL · sample only, no order was placed.\n\n" + m.text };
}
