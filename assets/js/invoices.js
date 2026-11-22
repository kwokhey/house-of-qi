/* House of Qi · Invoices tab: every offline-sale invoice, searchable, newest first. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : esc(d); };
  const thisMonth = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
  let L = [], F = "all";

  const match = (v, q) => !q || [v.number, v.to, v.company, v.phone, v.email, v.channel, ...v.lines.map((l) => l.name + " " + l.code)].join(" ").toLowerCase().includes(q);
  const inF = (v, f) => f === "void" ? v.void : v.void ? f === "all" : f === "month" ? String(v.date).startsWith(thisMonth()) : f === "due" ? !v.paid : true;

  function render() {
    const q = ($("#invQ").value || "").trim().toLowerCase();
    ["all", "month", "due", "void"].forEach((f) => ($("#ic-" + f).textContent = L.filter((v) => inF(v, f)).length));
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
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#invQ").addEventListener("input", render);
    $("#invRefresh").onclick = load;
    $("#invF").querySelectorAll("button").forEach((b) => (b.onclick = () => {
      F = b.dataset.f; $("#invF").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); render();
    }));
  });
  window.Invoices = { load };
})();
