/* House of Qi · order page. Orders come from Stripe; progress is saved back to Stripe. */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// customer chose West/East Malaysia: warn if the address says otherwise (Stripe can't limit by state)
const EAST = /sabah|sarawak|labuan/i;
const regionWarn = (o) => {
  const addr = (o.address || []).join(" ");
  if (!addr || !/malaysia/i.test(o.delivery || "")) return "";
  const east = EAST.test(addr), saidEast = /east/i.test(o.delivery);
  if (east === saidEast) return "";
  return `<div class="note warn">Check delivery: customer chose <b>${esc(o.delivery)}</b> but the address is in ${east ? "East" : "West"} Malaysia. The delivery fee may need adjusting.</div>`;
};
const RM = (n) => "RM" + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ts) => (ts ? new Date(ts).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(",", "") : "");
const COURIERS = ["Pos Laju", "J&T Express", "DHL eCommerce", "Ninja Van", "City-Link Express", "GDex", "Lalamove", "Other"];
const LABEL = { confirmed: "To pack", packed: "Packed", shipped: "Shipped", ready: "Ready for pick-up" };

let ORDERS = [], NEXT = null, FILTER = "todo";

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
function show(id) {
  ["loginView", "setupView", "ordersView", "stockView", "marketingView", "invoicesView"].forEach((v) => ($("#" + v).hidden = v !== id));
  const inside = ["ordersView", "stockView", "marketingView", "invoicesView"].includes(id);
  $("#logout").hidden = !inside; $("#tabs").hidden = !inside;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", (b.dataset.tab + "View") === id));
}
function openTab(tab) {
  try { localStorage.setItem("hq-admin-tab", tab); } catch {}
  if (tab === "stock" && window.Stock) { show("stockView"); window.Stock.load(); }
  else if (tab === "invoices" && window.Invoices) { show("invoicesView"); window.Invoices.load(); }
  else if (tab === "marketing" && window.Marketing) { show("marketingView"); window.Marketing.load(); }
  else { show("ordersView"); render(); load(); }
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
    return `<li><span>${it.qty}× ${esc(it.name)}${it.id ? ` <b class="iid">${esc(it.id)}</b>` : ""}${opts ? `<small>${esc(opts)}</small>` : ""}</span><span>${RM(it.amount)}</span></li>`;
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
  const due = o.preorder && o.balanceStatus !== "paid";
  if (due && (o.status === "packed" || o.status === "confirmed")) {
    if (o.status === "packed") act = `<p class="sent po-wait">Waiting for the balance. Ship once it's paid.</p>`;
  }
  const po = o.preorder ? `<div class="po-box${due ? "" : " paid"}">
      <b>Pre-order</b> · deposit ${RM(o.total)} paid · balance ${RM(o.balance)}${o.balanceShip ? ` (incl. delivery ${RM(o.balanceShip)})` : ""}
      <span class="po-st">${o.balanceStatus === "paid" ? `Balance paid${o.balancePaidAt ? ` · ${when(o.balancePaidAt)}` : ""}` : o.balanceStatus === "requested" ? `Link sent${o.balanceAt ? ` · ${when(o.balanceAt)}` : ""} · waiting for payment` : "Balance not requested yet"}</span>
      ${due ? `<div class="po-act"><button class="btn gold sm" data-bal="1">${o.balanceStatus === "requested" ? "Send a new balance link" : "Request balance"}</button>
        ${o.balanceUrl ? `<button class="link" data-copy="${esc(o.balanceUrl)}">Copy payment link</button>` : ""}</div>
        <small>Press when the piece is ready. The customer gets an email with a payment link (valid 24 hours), and you can WhatsApp it too.</small>` : ""}
    </div>` : "";
  if (o.refunded) act = `<p class="sent refunded">Refunded ${RM(o.refunded)}${o.refundedAt ? ` · ${when(o.refundedAt)}` : ""}</p>`;
  const back = o.refunded ? null : { packed: "confirmed", shipped: "packed", ready: "packed" }[o.status];
  return `<article class="oc" data-s="${o.status}" data-pi="${esc(o.paymentIntent)}">
    <div class="oc-h"><span class="oc-no">${esc(o.orderNo)}</span><span class="pill${o.refunded ? " rf" : ""}">${o.refunded ? "Refunded" : LABEL[o.status]}</span>${o.preorder ? `<span class="pill po">Pre-order</span>` : ""}<time>${when(o.created)}</time></div>
    <div class="oc-c"><b>${esc(o.name)}</b>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ""}${o.email ? `<span>${esc(o.email)}</span>` : ""}</div>
    <ul>${items}</ul>
    ${po}
    ${o.notes ? `<div class="note">Additional request: ${esc(o.notes)}</div>` : ""}
    ${o.coupon ? `<div class="note promo">Code <b>${esc(o.coupon)}</b>${o.discount ? ` · −${RM(o.discount)}` : " · free delivery"}</div>` : ""}
    ${regionWarn(o)}<div class="deliv"><span><b>${esc(o.delivery || (o.pickup ? "Self pick-up" : "Delivery"))}</b></span><span class="tot">${RM(o.total)}</span>
      ${o.address.length ? `<span class="addr">${o.address.map(esc).join("<br>")}</span><button class="link" data-copy="${esc([o.name, ...o.address, o.phone].join("\n"))}">Copy address</button>` : ""}</div>
    <div class="act">${act}
      ${wa ? `<a class="btn ghost sm" href="${wa}" target="_blank" rel="noopener">WhatsApp customer</a>` : ""}
      <a class="link" href="/api/admin/receipt?id=${encodeURIComponent(o.sessionId)}" target="_blank" rel="noopener">Email receipt</a>
      <button class="link" data-copy="${esc(trackLink(o))}">Copy tracking link</button>
      ${back ? `<button class="link undo" data-a="${back}" data-undo="1">Undo</button>` : ""}
      ${o.refunded ? `<button class="link undo" data-hide="${esc(o.sessionId)}" title="Hide this refunded order. The payment record stays in Stripe.">Remove from list</button>` : `<button class="link undo" data-refund="${esc(o.sessionId)}">Refund</button>`}</div>
  </article>`;
}

function render() {
  const groups = { todo: (o) => !o.refunded && o.status === "confirmed", packed: (o) => !o.refunded && o.status === "packed", done: (o) => !o.refunded && (o.status === "shipped" || o.status === "ready"), refunded: (o) => !!o.refunded, all: () => true };
  for (const k in groups) $("#c-" + k).textContent = ORDERS.filter(groups[k]).length;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b.dataset.f === FILTER));
  const list = ORDERS.filter(groups[FILTER]);
  const empty = { todo: "Nothing to pack. New paid orders appear here.", packed: "No packed orders waiting to be sent.", done: "No sent orders yet.", refunded: "No refunded orders.", all: "No orders yet." }[FILTER];
  $("#list").innerHTML = list.length ? list.map(card).join("") : `<p class="empty">${empty}</p>`;
  $("#more").hidden = !NEXT;
}

async function load(more = false) {
  try {
    const d = await api("/api/admin/orders" + (more && NEXT ? `?after=${encodeURIComponent(NEXT)}` : ""));
    ORDERS = more ? ORDERS.concat(d.orders) : d.orders;
    NEXT = d.more ? d.next : null;
    $("#mode").hidden = d.mode !== "test";
    $("#clearTest").hidden = d.mode !== "test";
    if (!$("#stockView").hidden || !$("#marketingView").hidden) return render();
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

async function requestBalance(art, btn) {
  const o = ORDERS.find((x) => x.paymentIntent === art.dataset.pi);
  if (!o) return;
  if (!confirm(`Send ${o.name || "the customer"} a link to pay the balance of ${RM(o.balance)} for ${o.orderNo}?`)) return;
  btn.disabled = true;
  try {
    const d = await api("/api/admin/balance", { method: "POST", body: JSON.stringify({ sessionId: o.sessionId }) });
    o.balanceStatus = "requested"; o.balanceUrl = d.url; o.balanceAt = Date.now();
    render();
    toast(d.emailed ? `Payment link emailed to ${d.email}` : "Payment link made (email not sent). Copy it or WhatsApp it.");
    if (d.whatsapp) window.open(d.whatsapp, "_blank", "noopener");
  } catch (e) { toast(e.message); btn.disabled = false; }
}

document.addEventListener("click", async (e) => {
  const tb = e.target.closest("#tabs button");
  if (tb) { openTab(tb.dataset.tab); return; }
  const f = e.target.closest("#filters button");
  if (f) { FILTER = f.dataset.f; render(); return; }
  const c = e.target.closest("[data-copy]");
  if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); toast("Copied"); } catch { toast("Couldn't copy. Select the text instead."); } return; }
  const bal = e.target.closest("[data-bal]");
  if (bal) { requestBalance(bal.closest(".oc"), bal); return; }
  const rf = e.target.closest("[data-refund]");
  if (rf) { refundOrder(rf); return; }
  const h = e.target.closest("[data-hide]");
  if (h) {
    const no = h.closest(".oc")?.querySelector(".oc-no")?.textContent || "this order";
    if (!confirm(`Remove ${no} from the order list?\n\nUse this for test or refunded orders. The payment record stays in Stripe.`)) return;
    h.disabled = true;
    try { await api("/api/admin/orders", { method: "POST", body: JSON.stringify({ action: "hide", id: h.dataset.hide }) }); h.closest(".oc").remove(); toast(`${no} removed`); }
    catch (err) { h.disabled = false; toast(err.message || "Couldn't remove it."); }
    return;
  }
  const a = e.target.closest("[data-a]");
  if (a) { setStatus(a.closest(".oc"), a.dataset.a, !!a.dataset.undo); return; }
});
$("#refresh").onclick = () => load();
$("#clearTest").onclick = async () => {
  if (!confirm("Clear all test orders?\n\nThey disappear from Orders and their sales come off the Sold counts and monthly totals. Pieces go back into stock, unless you've imported fresh stock counts since that order. This can't be undone.")) return;
  const btn = $("#clearTest"); btn.disabled = true;
  try {
    const d = await api("/api/admin/orders", { method: "POST", body: JSON.stringify({ action: "clearTest" }) });
    toast(d.cleared ? `Test orders cleared${d.restocked ? ` · ${d.restocked} back in stock` : ""}` : "Test orders cleared");
    ORDERS = []; await load();
  } catch (e) { toast(e.message); }
  btn.disabled = false;
};
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

/* Refund a website order in full (Stripe), optionally putting the pieces back in stock */
async function refundOrder(btn) {
  const o = ORDERS.find((x) => x.sessionId === btn.dataset.refund);
  if (!o) return;
  const amt = o.total + (o.preorder && o.balanceStatus === "paid" ? o.balance : 0);
  if (!confirm(`Refund ${o.orderNo} in full?\n\n${RM(amt)} goes back to ${o.name || "the customer"}'s card${o.preorder && o.balanceStatus === "paid" ? " (deposit + balance)" : ""}. It usually reaches them in 5–10 working days. This can't be undone.`)) return;
  const restock = o.preorder ? false : confirm("Put the pieces back in stock?\n\nOK = yes, they're coming back or were never sent.\nCancel = no, the customer keeps them.");
  btn.disabled = true; btn.textContent = "Refunding…";
  try {
    const r = await api("/api/admin/refund", { method: "POST", body: JSON.stringify({ id: o.sessionId, restock }) });
    o.refunded = r.refunded; o.refundedAt = Date.now();
    render();
    toast(`${o.orderNo} refunded ${RM(r.refunded)}${r.restocked ? ` · ${r.restocked} piece${r.restocked === 1 ? "" : "s"} back in stock` : ""}`);
  } catch (err) { btn.disabled = false; btn.textContent = "Refund"; toast(err.message || "Couldn't refund it."); }
}
