/* House of Qi · Marketing tab: affiliates (friends who help sell, online or at bazaars). */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RM = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const day = (t) => new Date(t).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
  const commLabel = (a) => (a.comm_kind === "fixed" ? `RM${+a.comm_value} per piece` : `${+a.comm_value}% of sales`);
  const shopLink = (a) => `${location.origin}/?ref=${encodeURIComponent(a.code)}`;
  const pageLink = (a) => `${location.origin}/a/${a.token}`;
  let LIST = [];

  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opt });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { location.reload(); throw new Error("Please log in again."); }
    if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
    return d;
  }
  async function copy(t, msg) { try { await navigator.clipboard.writeText(t); toast(msg || "Copied"); } catch { prompt("Copy this:", t); } }

  async function load() {
    try { LIST = (await api("/api/admin/affiliates")).affiliates; render(); } catch (e) { $("#mAffs").innerHTML = `<p class="m-empty">${esc(e.message)}</p>`; }
  }
  function render() {
    const due = LIST.reduce((t, a) => t + (a.totals.unpaid || 0), 0);
    $("#mAffSum").textContent = LIST.length ? `${LIST.filter((a) => a.active).length} active · ${RM(due)} commission to pay` : "";
    $("#mAffs").innerHTML = LIST.length ? LIST.map(row).join("") : `<p class="m-empty">No sellers yet. Add a friend, then send them their link and code. Website sales through their link count automatically; bazaar and WhatsApp sales are added from the Stock page with <b>Sold offline</b>.</p>`;
  }
  function row(a) {
    const t = a.totals;
    return `<button class="m-row" data-aff="${a.id}">
      <span class="m-main"><span class="m-code">${esc(a.code)}</span><b>${esc(a.name)}</b><small>${commLabel(a)}${a.disc_pct > 0 ? ` · customers get ${+a.disc_pct}% off` : ""}${a.note ? ` · ${esc(a.note)}` : ""}</small></span>
      <span class="m-num"><em class="st ${a.active ? "live" : "off"}">${a.active ? (t.unpaid > 0 ? `${RM(t.unpaid)} to pay` : "Active") : "Off"}</em><small>${t.orders} sale${t.orders === 1 ? "" : "s"}${t.orders ? ` · ${RM(t.amount)}` : ""}</small></span></button>`;
  }

  async function open(a) {
    const isNew = !a;
    a = a || { name: "", phone: "", code: "", comm_kind: "percent", comm_value: 10, disc_pct: 0, active: 1, note: "", totals: { orders: 0, unpaid: 0, earned: 0, amount: 0, pieces: 0 } };
    const d = $("#mEdit"), t = a.totals;
    d.innerHTML = `<form class="ed" id="aForm">
      <div class="ed-h"><b>${isNew ? "New seller" : esc(a.name)}</b><button type="button" class="link" data-x>Close</button></div>
      ${isNew ? "" : `<div class="aff-stats"><div><span>To pay</span><b>${RM(t.unpaid)}</b></div><div><span>Earned</span><b>${RM(t.earned)}</b></div><div><span>Sales</span><b>${t.orders}</b><small>${t.pieces || 0} pcs · ${RM(t.amount)}</small></div></div>
      <div class="aff-links"><button type="button" class="btn ghost sm" data-c="shop">Copy shop link</button><button type="button" class="btn ghost sm" data-c="page">Copy seller page</button>${a.phone ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(waLink(a))}">Send on WhatsApp</a>` : ""}${t.unpaid > 0 ? `<button type="button" class="btn gold sm" id="aPaid">Mark ${RM(t.unpaid)} as paid</button>` : ""}</div>`}
      <div class="grid-f">
        <label class="f"><span>Name</span><input id="aName" maxlength="60" value="${esc(a.name)}" placeholder="e.g. Amy Tan" required></label>
        <label class="f"><span>WhatsApp number (optional)</span><input id="aPhone" maxlength="30" inputmode="tel" value="${esc(a.phone)}" placeholder="e.g. 012 345 6789"></label>
        <label class="f"><span>Their code</span><input id="aCode" maxlength="24" autocapitalize="characters" value="${esc(a.code)}" placeholder="e.g. AMY" required></label>
        <label class="f"><span>Customer discount with this code (%)</span><input id="aDisc" inputmode="decimal" value="${+a.disc_pct || ""}" placeholder="None"></label>
      </div>
      <div class="f"><span>Commission</span></div>
      <div class="seg" role="radiogroup" aria-label="Commission type">${[["percent", "% of each sale"], ["fixed", "RM per piece"]].map(([k, l]) => `<label><input type="radio" name="aKind" value="${k}"${a.comm_kind === k ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <div class="grid-f">
        <label class="f"><span id="aValL">Percent</span><input id="aVal" inputmode="decimal" value="${+a.comm_value || ""}" required></label>
        <label class="f"><span>Note for yourself (optional)</span><input id="aNote" maxlength="200" value="${esc(a.note)}" placeholder="e.g. Sells at Sunday bazaar"></label>
      </div>
      <div class="toggles"><label><input type="checkbox" id="aOn"${a.active ? " checked" : ""}> Seller is active (their link and code work)</label></div>
      <p class="m-sum" id="aSum"></p>
      <p class="err" id="aErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit">${isNew ? "Add seller" : "Save changes"}</button>${!isNew && !t.orders ? '<button type="button" class="link danger" id="aDel">Delete seller</button>' : ""}</div>
      ${isNew ? "" : `<div class="aff-sales"><b>Sales</b><div id="aSales"><p class="muted">Loading…</p></div></div>`}
    </form>`;
    const kind = () => d.querySelector("[name=aKind]:checked").value;
    const sync = () => {
      const k = kind(), v = +$("#aVal").value || 0, disc = +$("#aDisc").value || 0, code = ($("#aCode").value || "CODE").toUpperCase().replace(/[^A-Z0-9-]/g, "");
      $("#aValL").textContent = k === "percent" ? "Percent of each sale" : "Ringgit per piece sold";
      const ex = 200, net = ex * (1 - disc / 100);
      $("#aSum").textContent = `Example: a customer uses ${code}${disc ? ` and pays ${RM(net)} instead of ${RM(ex)} for one piece` : ` and buys one ${RM(ex)} piece`}. The seller earns ${k === "percent" ? RM(net * v / 100) : RM(v)}.`;
    };
    d.querySelectorAll("input").forEach((x) => (x.oninput = x.onchange = sync)); sync();
    d.querySelector("[data-x]").onclick = () => d.close();
    d.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => copy(b.dataset.c === "shop" ? shopLink(a) : pageLink(a), b.dataset.c === "shop" ? "Shop link copied" : "Seller page link copied. Send it only to them.")));
    if ($("#aPaid")) $("#aPaid").onclick = async () => {
      if (!confirm(`Mark ${RM(t.unpaid)} as paid to ${a.name}?`)) return;
      try { await api("/api/admin/affiliates", { method: "POST", body: JSON.stringify({ action: "paid", id: a.id }) }); toast("Marked as paid"); d.close(); load(); } catch (x) { toast(x.message); }
    };
    $("#aForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { id: a.id, name: $("#aName").value, phone: $("#aPhone").value, code: $("#aCode").value, comm_kind: kind(), comm_value: $("#aVal").value, disc_pct: $("#aDisc").value, active: $("#aOn").checked, note: $("#aNote").value };
      try { await api("/api/admin/affiliates", { method: "POST", body: JSON.stringify(body) }); toast(isNew ? "Seller added. Open them to copy their link." : "Saved"); d.close(); load(); }
      catch (x) { $("#aErr").textContent = x.message; $("#aErr").hidden = false; }
    };
    if ($("#aDel")) $("#aDel").onclick = async () => {
      if ($("#aDel").dataset.sure !== "1") { $("#aDel").dataset.sure = "1"; $("#aDel").textContent = "Tap again to delete"; return; }
      try { await api(`/api/admin/affiliates?id=${a.id}`, { method: "DELETE" }); toast("Seller deleted"); d.close(); load(); } catch (x) { toast(x.message); }
    };
    d.showModal();
    if (!isNew) {
      try {
        const { sales } = await api(`/api/admin/affiliates?id=${a.id}`);
        $("#aSales").innerHTML = sales.length ? sales.map((s) => `<div class="aff-sale"><span><b>${esc(s.detail || `${s.pieces} pcs`)}</b><small>${day(s.created_at)} · ${esc(s.channel)}${s.order_no ? ` · ${esc(s.order_no)}` : ""}</small></span>
          <span class="r"><b>${RM(s.commission)}</b><small>sale ${RM(s.amount)} · ${s.paid_at ? `paid ${day(s.paid_at)} <button type="button" class="link" data-unpay="${s.id}">undo</button>` : "to pay"}</small></span></div>`).join("") : `<p class="muted">No sales yet.</p>`;
        $("#aSales").querySelectorAll("[data-unpay]").forEach((b) => (b.onclick = async () => { try { await api("/api/admin/affiliates", { method: "POST", body: JSON.stringify({ action: "unpay", sale: b.dataset.unpay }) }); toast("Marked as not paid"); d.close(); await load(); open(LIST.find((x) => x.id === a.id)); } catch (x) { toast(x.message); } }));
      } catch (x) { $("#aSales").innerHTML = `<p class="muted">${esc(x.message)}</p>`; }
    }
  }
  function waLink(a) {
    let n = String(a.phone).replace(/\D/g, ""); if (n.startsWith("0")) n = "6" + n;
    const msg = `Hi ${a.name.split(/\s+/)[0]}! Here are your House of Qi seller details ✨\n\nYour code: ${a.code}${a.disc_pct > 0 ? ` (customers get ${+a.disc_pct}% off)` : ""}\nYour shop link to share: ${shopLink(a)}\nYou earn ${commLabel(a)}.\n\nYour private page with your sales and earnings (keep this one to yourself): ${pageLink(a)}`;
    return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
  }

  document.addEventListener("click", (e) => { const r = e.target.closest("[data-aff]"); if (r) open(LIST.find((x) => String(x.id) === r.dataset.aff)); });
  $("#mNewAff").onclick = () => open(null);
  window.Affiliates = { load, list: () => LIST };
  // load together with the rest of the Marketing tab
  const M = window.Marketing; if (M) { const orig = M.load; M.load = async () => { await orig(); load(); }; }
  $("#mRefresh").addEventListener("click", load);
})();
