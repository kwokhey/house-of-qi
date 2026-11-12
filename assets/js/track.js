/* House of Qi · customer order tracking */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RM = (n) => "RM" + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ts) => (ts ? new Date(ts).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(",", "") : "");
const views = (v) => ["formView", "loadView", "tkView"].forEach((id) => ($("#" + id).hidden = id !== v));

function render(o) {
  const idx = { confirmed: 0, packed: 1, shipped: 2, ready: 2 }[o.status] || 0;
  const last = o.pickup ? ["Ready for pick-up", "We will WhatsApp you a time"] : ["Shipped", o.courier ? `With ${o.courier}` : "On its way to you"];
  const steps = [["Order confirmed", "Payment received"], ["Cleansed & packed", "Smudged, charged and gift wrapped"], last];
  const times = [o.times.confirmed, o.times.packed, o.times.shipped];
  const final = idx === 2;
  const title = final ? (o.pickup ? "Ready for<br><em>pick-up</em>" : "On its way<br><em>to you</em>") : idx === 1 ? "Cleansed<br><em>&amp; packed</em>" : "Order<br><em>confirmed</em>";
  const msg = final
    ? o.pickup ? "Your crystals are waiting for you. We will WhatsApp you to arrange a time." : "Your crystals are cleansed, packed and on their way."
    : idx === 1 ? "Your crystals are cleansed, charged and wrapped. They will be sent out shortly." : "We have your order and are preparing your crystals by hand.";
  $("#tkView").innerHTML = `
    <div class="tk-hero${final ? " final" : ""}">
      <span class="chip"><i></i>${esc(steps[idx][0])}</span>
      <h1>${title}</h1>
      <span class="no">${esc(o.orderNo)}</span>
      <p>${msg}</p>
    </div>
    <ol class="steps">${steps.map((s, i) => {
      const done = i < idx || (final && i === 2), now = i === idx && !final;
      return `<li class="${done ? "done" : ""}${now ? "now" : ""}"><span class="dot"></span><span><b>${esc(s[0])}</b><small>${esc(s[1])}</small></span><time>${done || now ? when(times[i]) : ""}</time></li>`;
    }).join("")}</ol>
    ${o.status === "shipped" && o.tracking ? `<div class="tracking">${esc(o.courier || "Courier")} tracking number: <b>${esc(o.tracking)}</b></div>` : ""}
    <div class="tk-sum"><ul>${o.items.map((i) => `<li><span>${i.qty}× ${esc(i.name)}</span><span>${RM(i.amount)}</span></li>`).join("")}</ul>
      ${o.discount ? `<div class="tot disc"><span>Discount${o.coupon ? ` (${esc(o.coupon)})` : ""}</span><span>−${RM(o.discount)}</span></div>` : ""}
      <div class="tot"><span>Total paid</span><span>${RM(o.total)}</span></div></div>
    <p class="again"><a href="/track">Track another order</a> · <a href="/">Back to shop</a></p>`;
  views("tkView");
}

async function fetchOrder(url, opt) {
  views("loadView");
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "We couldn't find that order.");
  return d;
}

$("#tkForm").onsubmit = async (e) => {
  e.preventDefault();
  const err = $("#tkErr"); err.hidden = true;
  try {
    render(await fetchOrder("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: $("#ord").value, email: $("#em").value }) }));
  } catch (x) { views("formView"); err.textContent = x.message; err.hidden = false; }
};

(async () => {
  const q = new URLSearchParams(location.search), o = q.get("o"), k = q.get("k");
  if (o && k) {
    try { render(await fetchOrder(`/api/track?o=${encodeURIComponent(o)}&k=${encodeURIComponent(k)}`)); return; }
    catch (x) { $("#ord").value = o; $("#tkErr").textContent = x.message + " You can also enter your email below."; $("#tkErr").hidden = false; }
  }
  views("formView");
})();
