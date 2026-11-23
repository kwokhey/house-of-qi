/* House of Qi · Invoices tab: every offline-sale invoice, searchable, newest first. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(d); };
  const thisMonth = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
  let L = [], F = "all", PRE = null, preLoading = false, SAMPLE = false;
  // a made-up pre-order, only to show what the list looks like (nothing is saved, emailed or charged)
  const sampleOrders = () => {
    const t = Date.now();
    return [
      { sample: true, sessionId: "sample-1", orderNo: "HQ-SAMPLE-01", created: t - 3 * 864e5, name: "Amy Tan", phone: "+60 12-345 6789", email: "amy@example.com",
        items: [{ qty: 1, name: "Larimar Bracelet · Pre-order 50% deposit", options: "1× Larimar Bracelet · 12 mm" }], total: 469, balance: 479, balanceShip: 10, balanceStatus: "due" },
      { sample: true, sessionId: "sample-2", orderNo: "HQ-SAMPLE-02", created: t - 9 * 864e5, name: "Jason Lim", phone: "+60 17-222 3344", email: "jason@example.com",
        items: [{ qty: 1, name: "Mica Bracelet · Pre-order 50% deposit", options: "1× Mica Bracelet · 10 mm" }], total: 340, balance: 360, balanceShip: 20, balanceStatus: "requested", balanceAt: t - 864e5, balanceUrl: "https://checkout.stripe.com/sample" },
      { sample: true, sessionId: "sample-3", orderNo: "HQ-SAMPLE-03", created: t - 20 * 864e5, name: "Mei Ling", phone: "+65 9123 4567", email: "meiling@example.com",
        items: [{ qty: 1, name: "Larimar Pendant · Pre-order 50% deposit", options: "" }], total: 134, balance: 222, balanceShip: 88, balanceStatus: "paid", balancePaidAt: t - 2 * 864e5 },
    ];
  };
  const api = async (u, o = {}) => { const r = await fetch(u, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...o }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again."); return d; };
  const when = (t) => (t ? new Date(t).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "");
  const toast = (m) => { const t = document.getElementById("toast"); if (t) { t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600); } else alert(m); };

  /* ---------- pre-orders (online, 50% deposit paid): follow up for the balance ---------- */
  async function loadPre() {
    if (preLoading) return; preLoading = true;
    try {
      let out = [], after = "";
      for (let i = 0; i < 10; i++) { // newest 300 orders
        const d = await api("/api/admin/orders" + (after ? `?after=${encodeURIComponent(after)}` : ""));
        out = out.concat(d.orders.filter((o) => o.preorder));
        if (!d.more || !d.next) break; after = d.next;
      }
      PRE = out;
    } catch (e) { PRE = PRE || []; toast(e.message); }
    preLoading = false; render();
  }
  const preState = (o) => o.balanceStatus === "paid" ? ["paid", "Balance paid"] : o.balanceStatus === "requested" ? ["due", "Link sent"] : ["due", "Waiting for stock"];
  const waText = (o, url) => `Hi ${(o.name || "").split(" ")[0] || "there"}, good news from House of Qi! Your pre-order ${o.orderNo} (${o.items.map((i) => i.name).join(", ")}) has arrived. Please pay the balance of ${money(o.balance)}${o.balanceShip ? ` (includes ${money(o.balanceShip)} delivery)` : ""}${url ? ` here: ${url}` : ". We'll send you the payment link shortly"}. Thank you!`;
  function renderPre(q) {
    if (!PRE) { $("#invSum").textContent = ""; $("#invList").innerHTML = '<p class="muted">Loading pre-orders…</p>'; loadPre(); return; }
    const src = SAMPLE ? sampleOrders() : PRE;
    const rows = src.filter((o) => !q || [o.orderNo, o.name, o.phone, o.email, ...o.items.map((i) => i.name + " " + (i.options || ""))].join(" ").toLowerCase().includes(q));
    const open = rows.filter((o) => o.balanceStatus !== "paid");
    $("#invSum").innerHTML = (SAMPLE ? '<b>Sample only</b> · made-up pre-orders to show how this list works. Buttons do nothing. <button type="button" class="link" id="preHideS">Hide sample</button><br>' : "") + esc(rows.length ? `${rows.length} pre-order${rows.length === 1 ? "" : "s"} · ${open.length} waiting for the balance · ${money(open.reduce((a, o) => a + o.balance, 0))} to collect` : "");
    $("#invList").innerHTML = rows.length ? rows.map((o) => { const st = preState(o), ph = (o.phone || "").replace(/\D/g, "");
      return `<article class="inv-row pre-row${o.sample ? " is-sample" : ""}" data-sid="${esc(o.sessionId)}">
        <div class="inv-a"><b>${esc(o.orderNo)}</b><span>${when(o.created)}</span>${o.sample ? '<em class="inv-tag void">Sample</em>' : ""}</div>
        <div class="inv-b"><b>${esc(o.name || "")}</b>
          <small class="muted">${esc([o.phone, o.email].filter(Boolean).join(" · "))}</small>
          <small>${o.items.map((i) => `${esc(i.qty)}× ${esc(i.name.replace(/ · Pre-order 50% deposit$/, ""))}${i.options ? ` <span class="muted">${esc(String(i.options).split(" · ").slice(1).join(" · "))}</span>` : ""}`).join(", ")}</small>
          <small class="muted">Deposit paid ${money(o.total)} · balance ${money(o.balance)}${o.balanceShip ? ` (incl. delivery ${money(o.balanceShip)})` : ""}${o.balanceAt && o.balanceStatus === "requested" ? ` · link sent ${when(o.balanceAt)}` : ""}${o.balancePaidAt ? ` · paid ${when(o.balancePaidAt)}` : ""}</small>
          ${o.balanceStatus === "paid" ? "" : `<div class="pre-act">
            <button type="button" class="btn gold sm" data-req>${o.balanceStatus === "requested" ? "Send a new payment link" : "Arrived · email payment link"}</button>
            ${ph ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${encodeURIComponent(waText(o, o.balanceUrl))}">WhatsApp customer</a>` : ""}
            ${o.email ? `<a class="btn ghost sm" href="mailto:${esc(o.email)}?subject=${encodeURIComponent(`Your House of Qi pre-order ${o.orderNo}`)}&body=${encodeURIComponent(waText(o, o.balanceUrl))}">Write email</a>` : ""}
            ${o.balanceUrl ? `<button type="button" class="link" data-copy="${esc(o.balanceUrl)}">Copy payment link</button>` : ""}</div>`}</div>
        <div class="inv-c"><b>${money(o.balance)}</b><em class="inv-tag ${st[0]}">${st[1]}</em></div>
      </article>`; }).join("") : `<p class="muted">${src.length ? "No pre-orders match." : 'No pre-orders yet. They appear here when a customer pays the 50% deposit online. <button type="button" class="link" id="preShowS">Show a sample</button>'}</p>`;
    if ($("#preShowS")) $("#preShowS").onclick = () => { SAMPLE = true; render(); };
    if ($("#preHideS")) $("#preHideS").onclick = () => { SAMPLE = false; render(); };
    $("#invList").querySelectorAll(".pre-row").forEach((el) => {
      const o = src.find((x) => x.sessionId === el.dataset.sid);
      if (o.sample) { el.querySelectorAll("a,button").forEach((x) => { x.onclick = (e) => { e.preventDefault(); toast("This is only a sample. Nothing was sent."); }; }); return; }
      const b = el.querySelector("[data-req]");
      if (b) b.onclick = async () => {
        if (!confirm(`Email ${o.name || "the customer"} a link to pay the balance of ${money(o.balance)} for ${o.orderNo}?`)) return;
        b.disabled = true;
        try {
          const d = await api("/api/admin/balance", { method: "POST", body: JSON.stringify({ sessionId: o.sessionId }) });
          o.balanceStatus = "requested"; o.balanceUrl = d.url; o.balanceAt = Date.now(); render();
          toast(d.emailed ? `Payment link emailed to ${d.email}. You can also WhatsApp it.` : "Payment link made (email not sent). Use WhatsApp or Copy.");
        } catch (e) { toast(e.message); b.disabled = false; }
      };
      const c = el.querySelector("[data-copy]");
      if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(c.dataset.copy); toast("Payment link copied"); } catch { toast("Couldn't copy"); } };
    });
  }

  const match = (v, q) => !q || [v.number, v.to, v.company, v.phone, v.email, v.channel, ...v.lines.map((l) => l.name + " " + l.code)].join(" ").toLowerCase().includes(q);
  const inF = (v, f) => f === "void" ? v.void : v.void ? f === "all" : f === "month" ? String(v.date).startsWith(thisMonth()) : f === "due" ? !v.paid : true;

  function render() {
    const q = ($("#invQ").value || "").trim().toLowerCase();
    ["all", "month", "due", "void"].forEach((f) => ($("#ic-" + f).textContent = L.filter((v) => inF(v, f)).length));
    $("#ic-pre").textContent = PRE ? PRE.filter((o) => o.balanceStatus !== "paid").length : "…";
    if (F === "pre") return renderPre(q);
    const rows = L.filter((v) => inF(v, F) && match(v, q));
    const live = rows.filter((v) => !v.void);
    $("#invSum").textContent = rows.length ? `${rows.length} invoice${rows.length === 1 ? "" : "s"} · ${money(live.reduce((a, v) => a + Number(v.total || 0), 0))}${rows.length !== live.length ? " (void not counted)" : ""}` : "";
    $("#invList").innerHTML = rows.length ? rows.map((v) => `<article class="inv-row${v.void ? " is-void" : ""}" data-no="${esc(v.number)}" tabindex="0">
        <div class="inv-a"><b>${esc(v.number)}</b><span>${dmy(v.date)}</span></div>
        <div class="inv-b"><b>${esc(v.to || "")}</b>
          <small class="muted">${esc([v.company, v.phone, v.email, v.channel].filter(Boolean).join(" · "))}</small>
          <small>${v.lines.map((l) => `${esc(l.qty)}× ${esc(l.name)}${l.code ? ` (${esc(l.code)})` : ""}`).join(", ")}</small></div>
        <div class="inv-c"><b>${money(v.total)}</b>${v.void ? '<em class="inv-tag void">Void</em>' : v.paid ? '<em class="inv-tag paid">Paid</em>' : `<em class="inv-tag due">${esc(v.terms || "Due")}</em>`}</div>
      </article>`).join("") : `<p class="muted">${L.length ? "No invoices match." : "No invoices yet. Make one from Stock → an item → Sold offline (fill in \"Sold to\")."}</p>`;
    $("#invList").querySelectorAll("[data-no]").forEach((el) => {
      const open = () => window.open(`/invoice.html?no=${encodeURIComponent(el.dataset.no)}`, "_blank");
      el.onclick = open; el.onkeydown = (e) => { if (e.key === "Enter") open(); };
    });
  }

  async function load() {
    $("#invList").innerHTML = '<p class="muted">Loading…</p>';
    try {
      const r = await fetch("/api/admin/invoice", { credentials: "same-origin" });
      if (r.status === 401) { location.reload(); return; }
      L = (await r.json()).invoices || [];
    } catch { $("#invList").innerHTML = '<p class="muted">Couldn\'t load invoices. Please try again.</p>'; return; }
    render();
    if (F !== "pre") { PRE = null; loadPre(); } // refresh the pre-order count
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#invQ").addEventListener("input", render);
    $("#invRefresh").onclick = () => { PRE = null; load(); };
    $("#invF").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      F = b.dataset.f; $("#invF").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); render();
    }));
  });
  window.Invoices = { load };
})();
