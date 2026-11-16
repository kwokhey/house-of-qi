/**
 * GET /a/<token>  A friend's (affiliate's) private page: their link, code and earnings.
 * Shows no customer details. The token is random, so the page can only be opened from the link.
 */
import { db, hasDB } from "../_lib/db.js";
import { commLabel } from "../_lib/affiliates.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RM = (n) => "RM" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (t) => new Date(t).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

function page(title, body) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="icon" href="/assets/img/favicon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap">
<style>
:root{--paper:#EFE0D4;--card:#F7EDE6;--ink:#2E221C;--ink-2:#6E5A4E;--ink-3:#9A8578;--line:rgba(59,44,35,.12);--gold:#A8803E;--green:#4F7A55}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Jost,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.w{max-width:720px;margin:0 auto;padding:28px 20px 60px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:26px}.top img{width:34px;height:auto}.top b{font:600 15px Cormorant Garamond,serif;letter-spacing:.32em}
.eye{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:600}
h1{font:500 clamp(34px,8vw,48px)/1.05 Cormorant Garamond,serif;margin:6px 0 6px}h1 em{font-style:italic}
.sub{color:var(--ink-2);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 18px}
.share{display:grid;gap:12px;margin-bottom:18px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.lbl{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin-bottom:4px}
.link{flex:1;min-width:0;font-size:14px;padding:11px 12px;border:1px solid var(--line);border-radius:6px;background:#fff8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.code{font:600 20px Jost;letter-spacing:.14em;border:1.5px dashed var(--ink-2);padding:6px 14px;border-radius:4px}
button,a.btn{font:600 11px Jost;letter-spacing:.18em;text-transform:uppercase;padding:12px 16px;border-radius:999px;border:1px solid var(--ink);background:var(--ink);color:#F7EEE4;cursor:pointer;text-decoration:none;white-space:nowrap}
.ghost{background:transparent;color:var(--ink)}
.terms{color:var(--ink-2);font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
.tiles div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.tiles span{display:block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
.tiles b{display:block;font:500 26px Cormorant Garamond,serif;margin-top:4px}.tiles small{color:var(--ink-3);font-size:12px}
h2{font:500 26px Cormorant Garamond,serif;margin:26px 0 8px}
.sale{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:13px 0;border-bottom:1px solid var(--line)}
.sale .d{font-size:13px;color:var(--ink-3)}.sale .it{font-size:14px}.sale .c{text-align:right;font-weight:600}.sale .a{text-align:right;font-size:13px;color:var(--ink-3)}
.tag{display:inline-block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:2px 7px;border-radius:3px;margin-left:6px;vertical-align:1px}
.paid{background:#DDEBDD;color:var(--green)}.due{background:#F3E3C8;color:#8A6420}
.empty{color:var(--ink-3);padding:18px 0}
.foot{margin-top:30px;font-size:12.5px;color:var(--ink-3)}
@media(max-width:520px){.tiles{grid-template-columns:1fr 1fr}.tiles div:first-child{grid-column:1/-1}}
</style></head><body><div class="w"><div class="top"><img src="/assets/img/logo-mark.png" alt=""><b>HOUSE OF QI</b></div>${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function onRequestGet({ params, request, env }) {
  const notFound = () => { const r = page("House of Qi", `<h1>Link not found</h1><p class="sub">This seller link isn't active. Please ask House of Qi for your latest link.</p><p><a class="btn ghost" href="/">Visit the shop</a></p>`); return new Response(r.body, { status: 404, headers: r.headers }); };
  if (!hasDB(env) || !/^[a-z0-9]{8,32}$/.test(params.token || "")) return notFound();
  const D = await db(env);
  const a = await D.prepare("SELECT * FROM affiliates WHERE token = ?").bind(params.token).first();
  if (!a) return notFound();
  const { results: sales } = await D.prepare("SELECT order_no, channel, detail, pieces, amount, commission, paid_at, created_at FROM aff_sales WHERE aff_id = ? ORDER BY created_at DESC LIMIT 300").bind(a.id).all();
  const earned = sales.reduce((t, s) => t + s.commission, 0), due = sales.filter((s) => !s.paid_at).reduce((t, s) => t + s.commission, 0);
  const amount = sales.reduce((t, s) => t + s.amount, 0), pieces = sales.reduce((t, s) => t + s.pieces, 0);
  const origin = new URL(request.url).origin, link = `${origin}/?ref=${encodeURIComponent(a.code)}`;
  const first = a.name.trim().split(/\s+/)[0];
  const wa = `https://wa.me/?text=${encodeURIComponent(`Have a look at House of Qi's natural crystal jewellery ✨ ${link}${a.disc_pct > 0 ? `\nUse my code ${a.code} for ${+a.disc_pct}% off.` : ""}`)}`;
  const body = `
<span class="eye">Seller page${a.active ? "" : " · paused"}</span>
<h1>Hello, <em>${esc(first)}</em></h1>
<p class="sub">Thank you for sharing House of Qi. Here are your link, your code and everything you've earned.</p>
<div class="card share">
  <div><div class="lbl">Your shop link</div><div class="row"><span class="link" id="lk">${esc(link)}</span><button onclick="cp('${esc(link)}',this)">Copy</button><a class="btn ghost" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a></div></div>
  <div><div class="lbl">Your code</div><div class="row"><span class="code">${esc(a.code)}</span><span class="terms">${a.disc_pct > 0 ? `Customers get <b>${+a.disc_pct}% off</b> when they use it at checkout.` : "Customers type it at checkout so the sale counts for you."}</span></div></div>
  <div class="terms">You earn <b>${esc(commLabel(a))}</b>${a.comm_kind === "percent" ? " (delivery not included)" : ""}. Sales through your link or code on the website count automatically. Sales at a bazaar or by WhatsApp are added by House of Qi.</div>
</div>
${a.active ? "" : `<p class="terms"><b>Your link is paused.</b> New sales won't count for now. Please contact House of Qi.</p>`}
<div class="tiles">
  <div><span>To be paid</span><b>${RM(due)}</b><small>${due ? "House of Qi will pay this to you" : "all paid"}</small></div>
  <div><span>Earned so far</span><b>${RM(earned)}</b><small>${RM(earned - due)} paid</small></div>
  <div><span>Your sales</span><b>${sales.length}</b><small>${pieces} piece${pieces === 1 ? "" : "s"} · ${RM(amount)}</small></div>
</div>
<h2>Sales</h2>
${sales.length ? sales.map((s) => `<div class="sale"><span class="d">${day(s.created_at)} · ${esc(s.channel)}${s.order_no ? " · " + esc(s.order_no) : ""}<span class="tag ${s.paid_at ? "paid" : "due"}">${s.paid_at ? "Paid" : "To be paid"}</span></span><span class="c">${RM(s.commission)}</span>
  <span class="it">${esc(s.detail || `${s.pieces} piece${s.pieces === 1 ? "" : "s"}`)}</span><span class="a">sale ${RM(s.amount)}</span></div>`).join("") : `<p class="empty">No sales yet. Share your link to get started.</p>`}
<p class="foot">Keep this page private. It's only for you. Questions about your earnings? Message House of Qi on WhatsApp.</p>
<script>function cp(t,b){navigator.clipboard.writeText(t).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy',1600)})}</script>`;
  return page(`${first} · House of Qi seller`, body);
}
