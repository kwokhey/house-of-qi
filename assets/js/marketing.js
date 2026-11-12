/* House of Qi · Marketing tab: announcement bar, coupon codes and sales. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RM = (n) => { n = Number(n || 0); const f = n % 1 ? 2 : 0; return "RM" + n.toLocaleString("en-MY", { minimumFractionDigits: f, maximumFractionDigits: f }); };
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const MYT = 8 * 3600 * 1000;
  const ymd = (ts) => (ts ? new Date(ts + MYT).toISOString().slice(0, 10) : "");
  const nice = (ts) => (ts ? new Date(ts).toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" }) : "");
  const COLLECTIONS = [["bracelets", "Bracelets"], ["pendants", "Pendants"], ["decor", "Spheres & Décor"], ["sets", "Gift Sets"]];
  const SCOPES = [["all", "Whole shop"], ["collection", "A shop section"], ["stones", "Chosen stones"], ["items", "Chosen pieces"]];

  let D = { coupons: [], sales: [], stones: [], items: [], announce: null, now: Date.now() };

  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opt });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { location.reload(); throw new Error("Please log in again."); }
    if (!r.ok) { const e = new Error(d.error || "Something went wrong. Please try again."); e.setup = d.setup; throw e; }
    return d;
  }

  /** Live / Scheduled / Ended / Off / Used up */
  function status(r, usedUp) {
    const now = Date.now();
    if (!r.active) return ["off", "Off"];
    if (usedUp) return ["end", "Used up"];
    if (r.starts_at && now < r.starts_at) return ["soon", `Starts ${nice(r.starts_at)}`];
    if (r.ends_at && now > r.ends_at) return ["end", "Ended"];
    return ["live", "Live"];
  }
  const dates = (r) => (r.starts_at && r.ends_at ? `${nice(r.starts_at)} – ${nice(r.ends_at)}` : r.ends_at ? `until ${nice(r.ends_at)}` : r.starts_at ? `from ${nice(r.starts_at)}` : "no end date");
  const codeLabel = (c) => (c.kind === "percent" ? `${+c.value}% off` : c.kind === "amount" ? `${RM(c.value)} off` : "Free delivery");
  const scopeText = (s) => {
    if (s.scope === "all") return "Whole shop";
    if (s.scope === "collection") return s.targets.map((t) => (COLLECTIONS.find((c) => c[0] === t) || [t, t])[1]).join(", ");
    if (s.scope === "stones") return s.targets.join(", ");
    return `${s.targets.length} chosen piece${s.targets.length === 1 ? "" : "s"}`;
  };
  const covered = (s) => D.items.filter((i) => s.scope === "all" || (s.scope === "collection" && s.targets.includes(collectionOf(i))) || (s.scope === "stones" && s.targets.map((x) => x.toLowerCase()).includes(i.stone.toLowerCase())) || (s.scope === "items" && s.targets.includes(i.id)));
  const collectionOf = (i) => i.collection || (/pendant|necklace/i.test(i.type) ? "pendants" : "bracelets");

  /* ---------- page ---------- */
  async function load() {
    try {
      D = await api("/api/admin/marketing");
      $("#mSetup").hidden = true;
      render();
    } catch (e) {
      if (e.setup) { $("#mSetup").hidden = false; $("#mSetup").textContent = e.message; } else toast(e.message);
    }
  }

  function render() {
    const live = D.coupons.filter((c) => status(c, c.max_uses && c.uses >= c.max_uses)[0] === "live").length;
    const liveSales = D.sales.filter((s) => status(s)[0] === "live").length;
    const uses = D.coupons.reduce((t, c) => t + c.uses, 0), given = D.coupons.reduce((t, c) => t + c.given, 0), rev = D.coupons.reduce((t, c) => t + c.revenue, 0);
    $("#mTiles").innerHTML = `
      <div><span>Live codes</span><b>${live}</b><small>${D.coupons.length} in total</small></div>
      <div><span>Live sales</span><b>${liveSales}</b><small>${D.sales.length} in total</small></div>
      <div><span>Orders with a code</span><b>${uses}</b><small>${RM(rev)} in sales</small></div>
      <div><span>Discount given</span><b>${RM(given)}</b><small>through codes</small></div>`;
    renderAnn();
    $("#mCodes").innerHTML = D.coupons.length ? D.coupons.map(codeRow).join("") : `<p class="m-empty">No codes yet. Try one like <b>WELCOME10</b> for 10% off a first order.</p>`;
    $("#mSales").innerHTML = D.sales.length ? D.sales.map(saleRow).join("") : `<p class="m-empty">No sales yet. A sale lowers prices automatically between the dates you choose.</p>`;
  }

  function renderAnn() {
    const a = D.announce || { text: "", link: "", active: false };
    const st = a.active && a.text ? status({ active: 1, starts_at: a.starts_at, ends_at: a.ends_at }) : ["off", "Off"];
    $("#mAnn").innerHTML = `
      <label class="f full"><span>Text</span><input id="aText" maxlength="140" value="${esc(a.text)}" placeholder="e.g. Free delivery this weekend with code SHIPFREE"></label>
      <div class="grid-f g3"><label class="f"><span>Show from (optional)</span><input id="aFrom" type="date" value="${ymd(a.starts_at)}"></label><label class="f"><span>Until (optional)</span><input id="aTo" type="date" value="${ymd(a.ends_at)}"></label>
      <label class="tgl"><input type="checkbox" id="aOn"${a.active ? " checked" : ""}> Show in shop <em class="st ${st[0]}">${st[1]}</em></label></div>
      <div class="ann-prev"${a.text ? "" : " hidden"} id="aPrev"><span>${esc(a.text)}</span></div>
      <div class="ed-f"><button class="btn sm" type="submit">Save announcement</button></div>`;
    $("#aText").oninput = (e) => { $("#aPrev").hidden = !e.target.value; $("#aPrev span").textContent = e.target.value; };
  }
  $("#mAnn").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/marketing", { method: "POST", body: JSON.stringify({ type: "announce", text: $("#aText").value, active: $("#aOn").checked, starts: $("#aFrom").value, ends: $("#aTo").value }) });
      toast($("#aOn").checked && $("#aText").value ? "Announcement saved. It shows in the shop within a minute." : "Announcement saved (hidden)");
      load();
    } catch (x) { toast(x.message); }
  };

  function codeRow(c) {
    const usedUp = c.max_uses && c.uses >= c.max_uses, st = status(c, usedUp);
    const rules = [c.min_spend ? `min spend ${RM(c.min_spend)}` : "", c.exclude_sale ? "not on sale items" : "", c.max_uses ? `limit ${c.max_uses}` : ""].filter(Boolean).join(" · ");
    return `<button class="m-row" data-code="${esc(c.code)}">
      <span class="m-main"><span class="m-code">${esc(c.code)}</span><b>${codeLabel(c)}</b><small>${[rules, dates(c)].filter(Boolean).join(" · ")}${c.note ? ` · ${esc(c.note)}` : ""}</small></span>
      <span class="m-num"><em class="st ${st[0]}">${st[1]}</em><small>${c.uses} order${c.uses === 1 ? "" : "s"}${c.uses ? ` · ${RM(c.revenue)}` : ""}</small></span></button>`;
  }
  function saleRow(s) {
    const st = status(s), n = covered(s).length;
    return `<button class="m-row" data-sale="${s.id}">
      <span class="m-main"><b>${esc(s.name)}</b><small>${+s.percent}% off · ${esc(scopeText(s))} · ${dates(s)}</small></span>
      <span class="m-num"><em class="st ${st[0]}">${st[1]}</em><small>${n} piece${n === 1 ? "" : "s"}</small></span></button>`;
  }

  /* ---------- code editor ---------- */
  function openCode(c) {
    const isNew = !c;
    c = c || { code: "", kind: "percent", value: 10, min_spend: 0, starts_at: 0, ends_at: 0, max_uses: 0, exclude_sale: 0, active: 1, note: "", uses: 0 };
    const d = $("#mEdit");
    d.innerHTML = `<form class="ed" id="cForm">
      <div class="ed-h"><b>${isNew ? "New code" : esc(c.code)}</b><button type="button" class="link" data-x>Close</button></div>
      <label class="f"><span>Code customers type</span><input id="cCode" value="${esc(c.code)}" placeholder="e.g. QI10" autocapitalize="characters" maxlength="24" required${c.uses ? " readonly" : ""}></label>
      <div class="seg" role="radiogroup" aria-label="Discount type">${[["percent", "% off"], ["amount", "RM off"], ["freeship", "Free delivery"]].map(([k, l]) => `<label><input type="radio" name="cKind" value="${k}"${c.kind === k ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <div class="grid-f">
        <label class="f" id="cValF"><span id="cValL">Percent off</span><input id="cVal" inputmode="decimal" value="${c.kind === "freeship" ? "" : +c.value || ""}"></label>
        <label class="f"><span>Minimum spend (RM, optional)</span><input id="cMin" inputmode="decimal" value="${+c.min_spend || ""}" placeholder="No minimum"></label>
        <label class="f"><span>Starts (optional)</span><input id="cFrom" type="date" value="${ymd(c.starts_at)}"></label>
        <label class="f"><span>Ends (optional)</span><input id="cTo" type="date" value="${ymd(c.ends_at)}"></label>
        <label class="f"><span>How many orders can use it</span><input id="cMax" inputmode="numeric" value="${+c.max_uses || ""}" placeholder="Unlimited"></label>
        <label class="f"><span>Note for yourself (optional)</span><input id="cNote" maxlength="120" value="${esc(c.note)}" placeholder="e.g. Instagram giveaway"></label>
      </div>
      <div class="toggles"><label><input type="checkbox" id="cEx"${c.exclude_sale ? " checked" : ""}> Don't discount pieces already on sale</label><label><input type="checkbox" id="cOn"${c.active ? " checked" : ""}> Code is switched on</label></div>
      <p class="m-sum" id="cSum"></p>
      <p class="err" id="cErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit">${isNew ? "Create code" : "Save changes"}</button>${!isNew ? (c.uses ? `<small class="muted">Used on ${c.uses} order${c.uses === 1 ? "" : "s"} · ${RM(c.given)} given</small>` : '<button type="button" class="link danger" id="cDel">Delete code</button>') : ""}</div>
    </form>`;
    const kind = () => d.querySelector("[name=cKind]:checked").value;
    const sync = () => {
      const k = kind();
      $("#cValF").hidden = k === "freeship";
      $("#cValL").textContent = k === "percent" ? "Percent off" : "Ringgit off";
      const v = +$("#cVal").value || 0, min = +$("#cMin").value || 0, code = ($("#cCode").value || "CODE").toUpperCase().replace(/[^A-Z0-9-]/g, "");
      const what = k === "percent" ? `${v || "?"}% off` : k === "amount" ? `${RM(v)} off` : "free delivery";
      const ex = k === "percent" && v && min ? ` e.g. on a ${RM(min)} order they save ${RM(min * v / 100)}.` : "";
      $("#cSum").textContent = `Customers who enter ${code} get ${what}${min ? ` when they spend ${RM(min)} or more` : ""}.${ex}`;
    };
    d.querySelectorAll("input").forEach((x) => (x.oninput = x.onchange = sync)); sync();
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#cForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { type: "coupon", isNew, orig: isNew ? "" : c.code, code: $("#cCode").value, kind: kind(), value: $("#cVal").value, min_spend: $("#cMin").value, starts: $("#cFrom").value, ends: $("#cTo").value, max_uses: $("#cMax").value, exclude_sale: $("#cEx").checked, active: $("#cOn").checked, note: $("#cNote").value };
      try { const r = await api("/api/admin/marketing", { method: "POST", body: JSON.stringify(body) }); toast(isNew ? `${r.code} created` : "Saved"); d.close(); load(); }
      catch (x) { $("#cErr").textContent = x.message; $("#cErr").hidden = false; }
    };
    if ($("#cDel")) $("#cDel").onclick = async () => {
      if ($("#cDel").dataset.sure !== "1") { $("#cDel").dataset.sure = "1"; $("#cDel").textContent = "Tap again to delete"; return; }
      try { await api(`/api/admin/marketing?type=coupon&code=${encodeURIComponent(c.code)}`, { method: "DELETE" }); toast(`${c.code} deleted`); d.close(); load(); } catch (x) { toast(x.message); }
    };
    d.showModal();
  }

  /* ---------- sale editor ---------- */
  function openSale(s) {
    const isNew = !s;
    s = s || { id: 0, name: "", percent: 10, scope: "all", targets: [], starts_at: 0, ends_at: 0, active: 1 };
    let targets = new Set(s.targets);
    const d = $("#mEdit");
    d.innerHTML = `<form class="ed" id="sForm">
      <div class="ed-h"><b>${isNew ? "New sale" : esc(s.name)}</b><button type="button" class="link" data-x>Close</button></div>
      <div class="grid-f">
        <label class="f"><span>Name (shown on the label)</span><input id="sName" maxlength="60" value="${esc(s.name)}" placeholder="e.g. 11.11 Sale" required></label>
        <label class="f"><span>Percent off</span><input id="sPct" inputmode="decimal" value="${+s.percent || ""}" required></label>
        <label class="f"><span>Starts (optional)</span><input id="sFrom" type="date" value="${ymd(s.starts_at)}"></label>
        <label class="f"><span>Ends (optional)</span><input id="sTo" type="date" value="${ymd(s.ends_at)}"></label>
      </div>
      <label class="f"><span>Applies to</span><select id="sScope">${SCOPES.map(([v, l]) => `<option value="${v}"${s.scope === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <div id="sPick"></div>
      <div class="toggles"><label><input type="checkbox" id="sOn"${s.active ? " checked" : ""}> Sale is switched on</label></div>
      <p class="m-sum" id="sSum"></p>
      <p class="err" id="sErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit">${isNew ? "Create sale" : "Save changes"}</button>${isNew ? "" : '<button type="button" class="link danger" id="sDel">Delete sale</button>'}</div>
    </form>`;
    const scope = () => $("#sScope").value;
    let q = "";
    const pick = () => {
      const sc = scope();
      if (sc === "all") { $("#sPick").innerHTML = ""; return sum(); }
      let opts;
      if (sc === "collection") opts = COLLECTIONS.map(([v, l]) => [v, l, D.items.filter((i) => collectionOf(i) === v).length]).filter((o) => o[2]);
      else if (sc === "stones") opts = D.stones.map((x) => [x.stone, x.stone, x.n]);
      else opts = D.items.filter((i) => !q || `${i.id} ${i.stone} ${i.variant} ${i.size_mm}`.toLowerCase().includes(q)).map((i) => [i.id, `${i.stone} ${i.type}${i.size_mm ? ` · ${+i.size_mm} mm` : ""}${i.variant ? ` · ${i.variant}` : ""}`, `${i.id} · ${RM(i.price)}`]);
      $("#sPick").innerHTML = `${sc === "items" ? `<input type="search" id="sQ" placeholder="Search ID, stone, size…" value="${esc(q)}">` : ""}
        <div class="pick-h"><small>${targets.size} chosen</small><span><button type="button" class="link" data-all>Select all${sc === "items" && q ? " shown" : ""}</button> · <button type="button" class="link" data-none>Clear</button></span></div>
        <div class="pick">${opts.map(([v, l, n]) => `<label><input type="checkbox" value="${esc(v)}"${targets.has(v) ? " checked" : ""}><span>${esc(l)}</span><small>${esc(n)}</small></label>`).join("")}</div>`;
      $("#sPick").querySelectorAll(".pick input").forEach((x) => (x.onchange = () => { x.checked ? targets.add(x.value) : targets.delete(x.value); $("#sPick .pick-h small").textContent = `${targets.size} chosen`; sum(); }));
      $("#sPick [data-all]").onclick = () => { opts.forEach(([v]) => targets.add(v)); pick(); };
      $("#sPick [data-none]").onclick = () => { targets.clear(); pick(); };
      if ($("#sQ")) { $("#sQ").oninput = (e) => { q = e.target.value.toLowerCase(); pick(); $("#sQ").focus(); $("#sQ").setSelectionRange(q.length, q.length); }; }
      sum();
    };
    const sum = () => {
      const pct = +$("#sPct").value || 0, cov = covered({ scope: scope(), targets: [...targets] });
      const ex = cov.slice().sort((a, b) => b.price - a.price)[0];
      $("#sSum").textContent = !pct ? "" : `${cov.length} piece${cov.length === 1 ? "" : "s"} will be ${pct}% off${ex ? `, e.g. ${ex.stone} ${ex.type} ${RM(ex.price)} → ${RM(Math.max(1, Math.round(ex.price * (1 - pct / 100))))}` : ""}. Prices are rounded to the nearest ringgit.`;
    };
    $("#sScope").onchange = () => { targets.clear(); q = ""; pick(); };
    $("#sPct").oninput = sum;
    pick();
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#sForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { type: "sale", id: s.id, name: $("#sName").value, percent: $("#sPct").value, scope: scope(), targets: [...targets], starts: $("#sFrom").value, ends: $("#sTo").value, active: $("#sOn").checked };
      try { await api("/api/admin/marketing", { method: "POST", body: JSON.stringify(body) }); toast(isNew ? "Sale created. The shop updates within a minute." : "Saved"); d.close(); load(); }
      catch (x) { $("#sErr").textContent = x.message; $("#sErr").hidden = false; }
    };
    if ($("#sDel")) $("#sDel").onclick = async () => {
      if ($("#sDel").dataset.sure !== "1") { $("#sDel").dataset.sure = "1"; $("#sDel").textContent = "Tap again to delete"; return; }
      try { await api(`/api/admin/marketing?type=sale&id=${s.id}`, { method: "DELETE" }); toast("Sale deleted"); d.close(); load(); } catch (x) { toast(x.message); }
    };
    d.showModal();
  }

  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-code]"); if (c) return openCode(D.coupons.find((x) => x.code === c.dataset.code));
    const s = e.target.closest("[data-sale]"); if (s) return openSale(D.sales.find((x) => String(x.id) === s.dataset.sale));
  });
  $("#mNewCode").onclick = () => openCode(null);
  $("#mNewSale").onclick = () => openSale(null);
  $("#mRefresh").onclick = load;
  window.Marketing = { load };
})();
