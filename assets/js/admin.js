/* House of Qi · order page. Orders come from Stripe; progress is saved back to Stripe. */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RM = (n) => "RM" + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ts) => (ts ? new Date(ts).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(",", "") : "");
const COURIERS = ["Pos Laju", "J&T Express", "DHL eCommerce", "Ninja Van", "City-Link Express", "GDex", "Lalamove", "Other"];
const LABEL = { confirmed: "To pack", packed: "Packed", shipped: "Shipped", ready: "Ready for pick-up" };

let ORDERS = [], NEXT = null, FILTER = "todo";

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
function show(id) {
  ["loginView", "setupView", "ordersView", "stockView"].forEach((v) => ($("#" + v).hidden = v !== id));
  const inside = id === "ordersView" || id === "stockView";
  $("#logout").hidden = !inside; $("#tabs").hidden = !inside;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", (b.dataset.tab + "View") === id));
}
function openTab(tab) {
  try { localStorage.setItem("hq-admin-tab", tab); } catch {}
  if (tab === "stock" && window.Stock) { show("stockView"); window.Stock.load(); } else load();
}
const savedTab = () => { try { return localStorage.getItem("hq-admin-tab") || "orders"; } catch { return "orders"; } };
async function api(path, opt = {}) {
  const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opt });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/admin/login") { show("loginView"); throw new Error("Please log in again."); }
  if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
  return d;
}

const trackLink = (o) => location.origin + (o.trackKey ? `/track?o=${encodeURIComponent(o.orderNo)}&k=${encodeURIComponent(o.trackKey)}` : "/track");
function waLink(o) {
  const phone = (o.phone || "").replace(/\D/g, "");
  if (!phone) return "";
  const first = (o.name || "").trim() || "there";
  const msg = {
    confirmed: `Hi ${first}, thank you for your House of Qi order ${o.orderNo}. We're cleansing and packing your crystals now.`,
    packed: `Hi ${first}, your House of Qi order ${o.orderNo} is cleansed, charged and packed. We'll send it out shortly.`,
    shipped: `Hi ${first}, your House of Qi order ${o.orderNo} is on its way${o.courier ? ` with ${o.courier}` : ""}.${o.tracking ? ` Tracking number: ${o.tracking}.` : ""}`,
    ready: `Hi ${first}, your House of Qi order ${o.orderNo} is ready for pick-up. When would you like to collect it?`,
  }[o.status];
  return `https://wa.me/${phone}?text=${encodeURIComponent(`${msg}\n\nFollow your order: ${trackLink(o)}`)}`;
}

function card(o) {
  const items = o.items.map((it) => {
    const opts = (it.options || "").replace(/^\d+× [^·]*·?\s*/, "");
    return `<li><span>${it.qty}× ${esc(it.name)}${opts ? `<small>${esc(opts)}</small>` : ""}</span><span>${RM(it.amount)}</span></li>`;
  }).join("");
  const wa = waLink(o);
  let act = "";
  if (o.status === "confirmed") {
    act = `<button class="btn gold sm" data-a="packed">Mark as packed</button>`;
  } else if (o.status === "packed" && !o.pickup) {
    act = `<div class="ship-form"><select data-courier aria-label="Courier">${COURIERS.map((c) => `<option${c === o.courier ? " selected" : ""}>${c}</option>`).join("")}</select><input data-tracking placeholder="Tracking number" value="${esc(o.tracking)}" aria-label="Tracking number"><button class="btn gold sm" data-a="shipped">Mark as shipped</button></div>`;
  } else if (o.status === "packed" && o.pickup) {
    act = `<button class="btn gold sm" data-a="ready">Mark ready for pick-up</button>`;
  } else {
    act = `<p class="sent">${o.status === "ready" ? "Ready for pick-up" : `Sent${o.courier ? ` with <b>${esc(o.courier)}</b>` : ""}${o.tracking ? ` · Tracking <b>${esc(o.tracking)}</b>` : ""}`} · ${when(o.times.shipped)}</p>`;
  }
  const back = { packed: "confirmed", shipped: "packed", ready: "packed" }[o.status];
  return `<article class="oc" data-s="${o.status}" data-pi="${esc(o.paymentIntent)}">
    <div class="oc-h"><span class="oc-no">${esc(o.orderNo)}</span><span class="pill">${LABEL[o.status]}</span><time>${when(o.created)}</time></div>
    <div class="oc-c"><b>${esc(o.name)}</b>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ""}${o.email ? `<span>${esc(o.email)}</span>` : ""}</div>
    <ul>${items}</ul>
    ${o.notes ? `<div class="note">Gift message: ${esc(o.notes)}</div>` : ""}
    <div class="deliv"><span><b>${esc(o.delivery || (o.pickup ? "Self pick-up" : "Delivery"))}</b></span><span class="tot">${RM(o.total)}</span>
      ${o.address.length ? `<span class="addr">${o.address.map(esc).join("<br>")}</span><button class="link" data-copy="${esc([o.name, ...o.address, o.phone].join("\n"))}">Copy address</button>` : ""}</div>
    <div class="act">${act}
      ${wa ? `<a class="btn ghost sm" href="${wa}" target="_blank" rel="noopener">WhatsApp customer</a>` : ""}
      <button class="link" data-copy="${esc(trackLink(o))}">Copy tracking link</button>
      ${back ? `<button class="link undo" data-a="${back}" data-undo="1">Undo</button>` : ""}</div>
  </article>`;
}

function render() {
  const groups = { todo: (o) => o.status === "confirmed", packed: (o) => o.status === "packed", done: (o) => o.status === "shipped" || o.status === "ready", all: () => true };
  for (const k in groups) $("#c-" + k).textContent = ORDERS.filter(groups[k]).length;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b.dataset.f === FILTER));
  const list = ORDERS.filter(groups[FILTER]);
  const empty = { todo: "Nothing to pack. New paid orders appear here.", packed: "No packed orders waiting to be sent.", done: "No sent orders yet.", all: "No orders yet." }[FILTER];
  $("#list").innerHTML = list.length ? list.map(card).join("") : `<p class="empty">${empty}</p>`;
  $("#more").hidden = !NEXT;
}

async function load(more = false) {
  try {
    const d = await api("/api/admin/orders" + (more && NEXT ? `?after=${encodeURIComponent(NEXT)}` : ""));
    ORDERS = more ? ORDERS.concat(d.orders) : d.orders;
    NEXT = d.more ? d.next : null;
    $("#mode").hidden = d.mode !== "test";
    if (!$("#stockView").hidden) return render();
    show("ordersView"); render();
  } catch (e) { toast(e.message); }
}

async function setStatus(art, status, undo) {
  const o = ORDERS.find((x) => x.paymentIntent === art.dataset.pi);
  const body = { paymentIntent: o.paymentIntent, status };
  if (status === "shipped") {
    body.courier = $("[data-courier]", art).value;
    body.tracking = $("[data-tracking]", art).value.trim();
    if (!body.tracking && body.courier !== "Lalamove" && body.courier !== "Other") { $("[data-tracking]", art).focus(); toast("Add the tracking number first"); return; }
  }
  art.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await api("/api/admin/status", { method: "POST", body: JSON.stringify(body) });
    o.status = status;
    const now = Date.now();
    if (status === "packed") o.times.packed = now;
    if (status === "shipped" || status === "ready") o.times.shipped = now;
    if (status === "confirmed") { o.times.packed = null; o.times.shipped = null; }
    if (body.courier !== undefined) { o.courier = body.courier; o.tracking = body.tracking; }
    toast(undo ? "Change undone" : `${o.orderNo} marked as ${LABEL[status].toLowerCase()}`);
    render();
  } catch (e) { toast(e.message); art.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
}

document.addEventListener("click", async (e) => {
  const tb = e.target.closest("#tabs button");
  if (tb) { openTab(tb.dataset.tab); return; }
  const f = e.target.closest("#filters button");
  if (f) { FILTER = f.dataset.f; render(); return; }
  const c = e.target.closest("[data-copy]");
  if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast("Copied"); } catch { toast("Couldn't copy. Select the text instead."); } return; }
  const a = e.target.closest("[data-a]");
  if (a) { setStatus(a.closest(".oc"), a.dataset.a, !!a.dataset.undo); return; }
});
$("#refresh").onclick = () => load();
$("#more").onclick = () => load(true);
$("#logout").onclick = async () => { await fetch("/api/admin/login", { method: "DELETE" }); ORDERS = []; show("loginView"); };
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#loginErr"), btn = e.target.querySelector("button");
  err.hidden = true; btn.disabled = true;
  try { await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#pw").value }) }); $("#pw").value = ""; openTab(savedTab()); }
  catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false;
};

(async () => {
  try {
    const s = await (await fetch("/api/admin/login", { credentials: "same-origin" })).json();
    if (!s.configured) return show("setupView");
    if (s.loggedIn) return openTab(savedTab());
    show("loginView");
  } catch { show("loginView"); }
})();
