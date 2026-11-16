/* House of Qi · Stock tab: inventory list, photos, offline sales, import and Excel export. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RM = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const RM0 = (n) => "RM" + Math.round(Number(n || 0)).toLocaleString("en-MY");
  const day = (ts) => new Date(ts).toLocaleString("en-MY", { day: "numeric", month: "short", year: "2-digit", hour: "numeric", minute: "2-digit" }).replace(",", "");
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const CHANNELS = ["Instagram", "WhatsApp", "Facebook", "Bazaar / event", "In person", "Other"];
  const TYPES = ["Bracelet", "Pendant", "Necklace", "Ring", "Earrings", "Sphere", "Cluster", "Tumbled", "Other"];
  const COLLECTIONS = [["bracelets", "Bracelets"], ["pendants", "Pendants"], ["decor", "Spheres & Décor"], ["sets", "Gift Sets"]];
  const KIND = { sale: "Sold", restock: "Stock in", adjust: "Adjusted", consign: "Seller" };

  let ITEMS = [], MONTH = {}, FILTER = "all", Q = "", loaded = false, COLS = [];

  async function api(path, opt = {}) {
    const r = await fetch(path, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...opt });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { location.reload(); throw new Error("Please log in again."); }
    if (!r.ok) { const e = new Error(d.error || "Something went wrong. Please try again."); e.setup = d.setup; throw e; }
    return d;
  }

  const name = (i) => `${i.stone} ${i.type}`.trim();
  const details = (i) => [i.variant, i.size_mm ? `${+i.size_mm} mm` : ""].filter(Boolean).join(" · ");
  const thumb = (i, v = "sq") => (i.image_v ? `/img/${encodeURIComponent(i.id)}.jpg?v=${i.image_v}` : ART.get(i.id, v, { stone: i.stone, variant: i.variant, type: i.type, size: i.size_mm || 8 }));
  const isLow = (i) => i.stock > 0 && i.stock <= 2 && i.stock_in > 2;
  const GROUPS = {
    all: () => true, in: (i) => i.stock > 0, low: isLow, sold: (i) => (i.sold || 0) > 0, out: (i) => i.stock <= 0,
    nophoto: (i) => !i.image_v, hidden: (i) => !i.published,
  };

  /* ---------- list ---------- */
  function tiles() {
    const pcs = ITEMS.reduce((t, i) => t + Math.max(0, i.stock), 0);
    const cost = ITEMS.reduce((t, i) => t + Math.max(0, i.stock) * i.cost, 0);
    const retail = ITEMS.reduce((t, i) => t + Math.max(0, i.stock) * i.price, 0);
    const mName = new Date().toLocaleString("en-MY", { month: "long" });
    $("#sTiles").innerHTML = `
      <div><span>In stock</span><b>${pcs.toLocaleString()}</b><small>${ITEMS.filter((i) => i.stock > 0).length} lines</small></div>
      <div><span>Stock value</span><b>${RM0(cost)}</b><small>at cost · ${RM0(retail)} retail</small></div>
      <div><span>Sold in ${mName}</span><b>${(MONTH.pcs || 0).toLocaleString()}</b><small>${RM0(MONTH.revenue)} sales</small></div>
      <div><span>Profit in ${mName}</span><b>${RM0(MONTH.profit)}</b><small>sales minus cost</small></div>`;
  }
  function render() {
    tiles();
    document.querySelectorAll("#sFilters button").forEach((b) => {
      b.classList.toggle("on", b.dataset.f === FILTER);
      b.querySelector("i").textContent = ITEMS.filter(GROUPS[b.dataset.f]).length;
    });
    const q = Q.trim().toLowerCase();
    const list = ITEMS.filter(GROUPS[FILTER]).filter((i) => !q || `${i.id} ${name(i)} ${details(i)} ${i.supplier}`.toLowerCase().includes(q));
    if (FILTER === "sold") list.sort((a, b) => (b.sold || 0) - (a.sold || 0)); // best sellers first
    $("#sList").innerHTML = list.length
      ? list.map((i) => `<button class="s-row${i.stock <= 0 ? " out" : ""}" data-sid="${esc(i.id)}">
          <img src="${thumb(i)}" alt="" loading="lazy">
          <span class="s-main"><b>${esc(name(i))}</b><small>${esc([i.id, details(i)].filter(Boolean).join(" · "))}</small>
            <span class="s-flags">${!i.published ? "<em>Hidden</em>" : ""}${!i.image_v ? "<em>No photo</em>" : ""}${i.featured ? "<em class=\"g\">Featured</em>" : ""}${i.sold ? `<em class="s">${i.sold} sold</em>` : ""}${i.with_sellers > 0 ? `<em>${i.with_sellers} with sellers</em>` : ""}</span></span>
          <span class="s-num"><b class="${i.stock <= 0 ? "zero" : isLow(i) ? "low" : ""}">${i.stock}</b><small>${RM0(i.price)}</small></span>
        </button>`).join("")
      : `<p class="empty">${ITEMS.length ? (Q.trim() ? "Nothing matches your search." : { sold: "Nothing has sold yet.", out: "Nothing is sold out. Every item still has stock.", low: "Nothing is running low.", nophoto: "Every item has a photo.", hidden: "No hidden items. Everything is showing in the shop.", in: "Nothing in stock." }[FILTER] || "Nothing matches.") : "No stock yet. Tap Import to bring in your Excel list, or + Add item."}</p>`;
  }

  /* Link previews: for pieces without a photo, save the drawn picture as a JPG so
     shared links (WhatsApp, Facebook) show the piece instead of the logo. Runs quietly. */
  let previewBusy = false;
  async function makePreviews() {
    if (previewBusy || typeof ART === "undefined") return; previewBusy = true;
    try {
      const { prev, staticAt } = await api("/api/admin/preview");
      const todo = ITEMS.filter((i) => !i.image_v && (prev[i.id] ? prev[i.id] < i.updated_at : i.updated_at > staticAt || !i.updated_at)).slice(0, 40);
      for (const i of todo) {
        const im = new Image();
        await new Promise((ok) => { im.onload = im.onerror = ok; im.src = ART.get(i.id, "sq", { stone: i.stone, variant: i.variant, type: i.type, size: i.size_mm || 8 }); });
        const cv = document.createElement("canvas"); cv.width = cv.height = 630;
        cv.getContext("2d").drawImage(im, 0, 0, 630, 630);
        await api("/api/admin/preview", { method: "POST", body: JSON.stringify({ id: i.id, data: cv.toDataURL("image/jpeg", 0.78) }) }).catch(() => {});
      }
    } catch {} finally { previewBusy = false; }
  }

  async function load() {
    try {
      const d = await api("/api/admin/items");
      ITEMS = d.items; MONTH = d.month || {}; COLS = d.colours || []; loaded = true;
      $("#sSetup").hidden = true; $("#sList").hidden = false;
      render();
      makePreviews();
    } catch (e) {
      if (e.setup) {
        $("#sList").hidden = true; $("#sSetup").hidden = false;
        $("#sSetup").innerHTML = `<p><b>One setup step left.</b> The stock database isn't connected yet. In Cloudflare: <b>Storage &amp; databases → D1 → Create database</b> named <code>house-of-qi</code>, then in the <b>house-of-qi</b> Pages project: <b>Settings → Bindings → Add → D1 database</b>, variable name <code>DB</code>, and redeploy.</p>`;
      } else toast(e.message);
    }
  }

  /* ---------- editor ---------- */
  const field = (id, label, value, attrs = "") => `<label class="f"><span>${label}</span><input id="${id}" value="${esc(value ?? "")}" ${attrs}></label>`;
  const selectF = (id, label, opts, value) => `<label class="f"><span>${label}</span><select id="${id}">${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`; }).join("")}</select></label>`;

  function openEditor(item) {
    const isNew = !item;
    const i = item || { id: "", stone: "", type: "Bracelet", variant: "", size_mm: "", supplier: "", collection: "bracelets", cost: "", price: "", published: 1, featured: 0, zh: "", description: "", meaning: "", stock: 1, image_v: 0 };
    const d = $("#sEdit");
    d.innerHTML = `<form method="dialog" class="ed" id="edForm">
      <div class="ed-h"><b>${isNew ? "Add item" : esc(i.id)}</b><button type="button" class="link" data-x>Close</button></div>
      ${isNew ? "" : `<div class="ed-photo"><img id="edImg" src="${thumb(i, "tall")}" alt="">
        <div class="ed-ph-act"><label class="btn ghost sm">${i.image_v ? "Change photo" : "Add photo"}<input type="file" id="edFile" accept="image/*" hidden></label>
        ${i.image_v ? '<button type="button" class="link" id="edDelPh">Remove photo</button>' : '<small>Drawn picture shown until you add a photo</small>'}</div></div>
      <div class="ed-stock"><div><span>In stock</span><b id="edStock" class="${i.stock <= 0 ? "zero" : ""}">${i.stock}</b><small>${i.sold || 0} sold · ${i.stock_in} received</small></div>
        <div class="ed-acts"><button type="button" class="btn gold sm" data-mv="sale"${i.stock <= 0 ? " disabled" : ""}>Sold offline</button><button type="button" class="btn ghost sm" data-mv="restock">Add stock</button><button type="button" class="btn ghost sm" data-mv="adjust">Adjust count</button></div>
        <div id="mvForm"></div></div>`}
      <div class="grid-f">
        ${field("eId", "Item ID", i.id, isNew ? 'placeholder="e.g. LRM-1060" autocapitalize="characters" required' : "readonly")}
        ${field("eStone", "Stone", i.stone, 'required placeholder="e.g. Larimar"')}
        ${selectF("eType", "Type", TYPES, i.type)}
        ${field("eSize", "Bead size (mm)", i.size_mm ?? "", 'inputmode="decimal" placeholder="e.g. 10"')}
        ${field("eVar", "Details", i.variant, 'placeholder="e.g. Bright blue, premium"')}
        ${selectF("eCol", "Shop section", COLLECTIONS, i.collection)}
        ${field("eCost", "Cost (RM per piece)", i.cost, 'inputmode="decimal"')}
        ${field("ePrice", "Selling price (RM)", i.price, 'inputmode="decimal" required')}
        ${isNew ? field("eQty", "Stock now", i.stock, 'inputmode="numeric"') : ""}
        ${field("eSup", "Supplier", i.supplier)}
        ${field("eZh", "Chinese name", i.zh, 'placeholder="optional"')}
        ${selectF("eColour", "Bead colour (Shop by colour)", [["", `Automatic · ${(COLS.find((c) => c.id === (i.auto_colour || "")) || { name: "set from stone" }).name}`], ...COLS.map((c) => [c.id, c.name])], i.colour || "")}
      </div>
      <p class="margin" id="eMargin"></p>
      <label class="f full"><span>Description (shown in the shop)</span><textarea id="eDesc" rows="2" placeholder="Leave empty for an automatic line">${esc(i.description)}</textarea></label>
      <label class="f full"><span>Meaning</span><textarea id="eMean" rows="2" placeholder="e.g. The stone of calm, traditionally used for…">${esc(i.meaning)}</textarea></label>
      <div class="toggles"><label><input type="checkbox" id="ePub"${i.published ? " checked" : ""}> Show on website</label><label><input type="checkbox" id="eFeat"${i.featured ? " checked" : ""}> Featured on home page</label></div>
      <p class="err" id="edErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit" id="edSave">${isNew ? "Add item" : "Save changes"}</button>${!isNew && !i.sold ? '<button type="button" class="link danger" id="edDel">Delete item</button>' : ""}</div>
      ${isNew ? "" : '<h3>History</h3><ul class="hist" id="edHist"><li class="muted">Loading…</li></ul>'}
    </form>`;
    const margin = () => {
      const c = +$("#eCost").value || 0, p = +$("#ePrice").value || 0;
      $("#eMargin").textContent = p && c ? `Profit per piece ${RM(p - c)} · ${(p / c).toFixed(2)}× cost` : "";
    };
    $("#eCost").oninput = $("#ePrice").oninput = margin; margin();
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#edForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        id: $("#eId").value, stone: $("#eStone").value, type: $("#eType").value, variant: $("#eVar").value, size_mm: $("#eSize").value,
        collection: $("#eCol").value, cost: $("#eCost").value, price: $("#ePrice").value, supplier: $("#eSup").value, zh: $("#eZh").value,
        description: $("#eDesc").value, meaning: $("#eMean").value, colour: $("#eColour").value, published: $("#ePub").checked, featured: $("#eFeat").checked ? (i.featured || 1) : 0,
        intentions: (() => { try { return JSON.parse(i.intentions || "[]"); } catch { return []; } })(), isNew, stock: isNew ? $("#eQty").value : undefined,
      };
      $("#edSave").disabled = true;
      try { const r = await api("/api/admin/items", { method: "POST", body: JSON.stringify(body) }); toast(isNew ? `${r.item.id} added` : "Saved"); await load(); if (isNew) openEditor(ITEMS.find((x) => x.id === r.item.id)); else d.close(); }
      catch (x) { $("#edErr").textContent = x.message; $("#edErr").hidden = false; }
      $("#edSave").disabled = false;
    };
    if (!isNew) {
      $("#edFile").onchange = (e) => uploadPhoto(i, e.target.files[0]);
      if ($("#edDelPh")) $("#edDelPh").onclick = async () => { await api(`/api/admin/image?id=${encodeURIComponent(i.id)}`, { method: "DELETE" }); toast("Photo removed"); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); };
      if ($("#edDel")) $("#edDel").onclick = async () => {
        if ($("#edDel").dataset.sure !== "1") { $("#edDel").dataset.sure = "1"; $("#edDel").textContent = "Tap again to delete for good"; return; }
        try { await api(`/api/admin/items?id=${encodeURIComponent(i.id)}`, { method: "DELETE" }); toast(`${i.id} deleted`); d.close(); load(); } catch (x) { toast(x.message); }
      };
      d.querySelectorAll("[data-mv]").forEach((b) => (b.onclick = () => movementForm(i, b.dataset.mv)));
      history(i);
    }
    if (!d.open) d.showModal();
    d.scrollTop = 0;
  }

  const sellers = async () => { try { return (await api("/api/admin/affiliates")).affiliates; } catch { return []; } };
  function movementForm(i, kind) {
    const box = $("#mvForm");
    const f = {
      sale: `<div class="mv"><b>Record an offline sale</b><div class="grid-f">
          ${field("mQty", "Quantity", 1, 'inputmode="numeric"')}${field("mPrice", "Price paid per piece (RM)", i.price, 'inputmode="decimal"')}
          ${selectF("mCh", "Sold through", CHANNELS, "Instagram")}${field("mNote", "Note", "", 'placeholder="e.g. customer name"')}
          <label class="f" id="mAffF" hidden><span>Sold by (affiliate)</span><select id="mAff"></select></label></div>
          <button type="button" class="btn gold sm" id="mGo">Record sale</button></div>`,
      restock: `<div class="mv"><b>New stock arrived</b><div class="grid-f">
          ${field("mQty", "Quantity", 1, 'inputmode="numeric"')}${field("mCost", "Cost per piece (RM)", i.cost, 'inputmode="decimal"')}
          ${field("mNote", "Note", "", 'placeholder="e.g. supplier, invoice no."')}</div>
          <button type="button" class="btn gold sm" id="mGo">Add to stock</button></div>`,
      adjust: `<div class="mv"><b>Correct the count</b><div class="grid-f">
          ${field("mQty", "Pieces you counted", i.stock, 'inputmode="numeric"')}${field("mNote", "Reason", "", 'placeholder="e.g. stock take, damaged, gift"')}</div>
          <button type="button" class="btn gold sm" id="mGo">Save count</button></div>`,
    }[kind];
    box.innerHTML = f;
    if (kind === "sale") sellers().then((L) => {
      const act = L.filter((a) => a.active);
      if (!act.length || !$("#mAff")) return;
      $("#mAff").innerHTML = `<option value="">Nobody (House of Qi)</option>` + act.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.code)}</option>`).join("");
      $("#mAffF").hidden = false;
    });
    $("#mQty").focus(); $("#mQty").select();
    $("#mGo").onclick = async () => {
      $("#mGo").disabled = true;
      try {
        await api("/api/admin/movement", { method: "POST", body: JSON.stringify({ itemId: i.id, kind, qty: $("#mQty").value, price: $("#mPrice")?.value, cost: $("#mCost")?.value, channel: $("#mCh")?.value, note: $("#mNote").value, aff: $("#mAff")?.value || undefined }) });
        toast({ sale: "Sale recorded", restock: "Stock added", adjust: "Count saved" }[kind]);
        await load(); openEditor(ITEMS.find((x) => x.id === i.id));
      } catch (x) { toast(x.message); $("#mGo").disabled = false; }
    };
  }

  async function history(i) {
    try {
      const { movements } = await api(`/api/admin/movement?id=${encodeURIComponent(i.id)}`);
      $("#edHist").innerHTML = movements.length ? movements.map((m) => `<li><span class="h-k ${m.kind}">${KIND[m.kind] || m.kind}</span>
          <span class="h-d">${m.qty > 0 ? "+" : ""}${m.qty} ${m.kind === "sale" && m.unit_price != null ? `@ ${RM(m.unit_price)}` : ""}
          <small>${esc([m.channel, m.note].filter(Boolean).join(" · "))} · ${day(m.created_at)}</small></span>
          ${m.ref ? "" : `<button type="button" class="link" data-undo="${m.id}">Undo</button>`}</li>`).join("") : '<li class="muted">No changes yet.</li>';
      $("#edHist").querySelectorAll("[data-undo]").forEach((b) => (b.onclick = async () => {
        try { await api(`/api/admin/movement?mid=${b.dataset.undo}`, { method: "DELETE" }); toast("Undone"); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); } catch (x) { toast(x.message); }
      }));
    } catch { $("#edHist").innerHTML = '<li class="muted">Couldn\'t load history.</li>'; }
  }

  /* ---------- photos: resized on the phone before upload ---------- */
  async function uploadPhoto(i, file) {
    if (!file) return;
    toast("Uploading photo…");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      let q = 0.86, data = cv.toDataURL("image/jpeg", q);
      while (data.length > 1_700_000 && q > 0.5) { q -= 0.08; data = cv.toDataURL("image/jpeg", q); }
      await api("/api/admin/image", { method: "POST", body: JSON.stringify({ id: i.id, data }) });
      toast("Photo saved"); await load(); openEditor(ITEMS.find((x) => x.id === i.id));
    } catch (x) { toast(x.message || "Couldn't read that photo. Try a JPG or PNG."); }
  }

  /* ---------- import from Excel / Google Sheets ---------- */
  let PREVIEW = null;
  function openImport() {
    const d = $("#sImp");
    d.innerHTML = `<div class="ed"><div class="ed-h"><b>Import stock</b><button type="button" class="link" data-x>Close</button></div>
      <p class="lede">Bring in your inventory list. Rows are matched by Item ID, so importing the same list again updates it instead of adding duplicates.</p>
      <div class="imp-opts">
        <label class="btn ghost">Choose Excel or CSV file<input type="file" id="iFile" accept=".xlsx,.xls,.csv" hidden></label>
        <span class="or">or</span>
        <div class="imp-url"><input id="iUrl" placeholder="Paste a Google Sheets link"><button class="btn sm" id="iUrlGo">Read sheet</button></div>
      </div>
      <p class="err" id="iErr" hidden></p>
      <div id="iPrev"></div></div>`;
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#iFile").onchange = (e) => readFile(e.target.files[0]);
    $("#iUrlGo").onclick = readUrl;
    d.showModal();
  }
  const iErr = (m) => { $("#iErr").textContent = m; $("#iErr").hidden = !m; };
  async function readFile(file) {
    if (!file) return; iErr("");
    try {
      let rows;
      if (/\.csv$/i.test(file.name)) rows = StockImport.csv(await file.text());
      else {
        await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
        const wb = XLSX.read(await file.arrayBuffer());
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      }
      preview(rows);
    } catch (x) { iErr(x.message); }
  }
  async function readUrl() {
    iErr(""); $("#iUrlGo").disabled = true;
    try { const { csv } = await api(`/api/admin/import?url=${encodeURIComponent($("#iUrl").value.trim())}`); preview(StockImport.csv(csv)); }
    catch (x) { iErr(x.message); }
    $("#iUrlGo").disabled = false;
  }
  function preview(rows) {
    const { items, notes } = StockImport.parse(rows);
    if (!items.length) throw new Error("No stock rows found in that sheet.");
    const have = new Set(ITEMS.map((i) => i.id));
    const fresh = items.filter((i) => !have.has(i.id)).length;
    PREVIEW = items;
    $("#iPrev").innerHTML = `<div class="imp-sum"><b>${items.length} lines · ${items.reduce((t, i) => t + i.stock, 0)} pieces</b><span>${fresh} new · ${items.length - fresh} already in stock</span></div>
      ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <div class="tbl"><table><thead><tr><th>ID</th><th>Name</th><th>Details</th><th>Stock</th><th>Cost</th><th>Price</th><th>Supplier</th></tr></thead><tbody>
      ${items.map((i) => `<tr${have.has(i.id) ? ' class="ex"' : ""}><td>${esc(i.id)}</td><td>${esc(name(i))}</td><td>${esc(details(i))}</td><td>${i.stock}</td><td>${i.cost}</td><td>${i.price}</td><td>${esc(i.supplier)}</td></tr>`).join("")}
      </tbody></table></div>
      ${items.length - fresh ? `<div class="toggles"><label><input type="radio" name="sm" value="keep" checked> Keep current stock counts for existing items</label><label><input type="radio" name="sm" value="replace"> Replace counts with the sheet</label></div>` : ""}
      <button class="btn gold" id="iGo">Import ${items.length} lines</button>`;
    $("#iGo").onclick = doImport;
  }
  async function doImport() {
    $("#iGo").disabled = true;
    try {
      const mode = document.querySelector('input[name="sm"]:checked')?.value || "keep";
      const r = await api("/api/admin/import", { method: "POST", body: JSON.stringify({ items: PREVIEW, stockMode: mode }) });
      toast(`Imported: ${r.added} new, ${r.updated} updated`); $("#sImp").close(); load();
    } catch (x) { iErr(x.message); $("#iGo").disabled = false; }
  }

  /* ---------- export to Excel, with photos ---------- */
  const loadScript = (src) => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load the Excel tool. Check your connection.")); document.head.appendChild(s); });
  async function exportExcel() {
    if (!ITEMS.length) return toast("Nothing to export yet");
    toast("Preparing Excel file…");
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Stock", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Photo", width: 12 }, { header: "Item ID", width: 14 }, { header: "Stone", width: 26 }, { header: "Type", width: 11 },
        { header: "Details", width: 22 }, { header: "Size (mm)", width: 10 }, { header: "Supplier", width: 12 }, { header: "Stock In (Pcs)", width: 13 },
        { header: "Sold (Pcs)", width: 10 }, { header: "Stock Left (Pcs)", width: 14 }, { header: "Purchase Price (RM/pc)", width: 20 },
        { header: "Selling Price (RM)", width: 16 }, { header: "Profit so far (RM)", width: 16 }, { header: "Stock Status", width: 13 }, { header: "On website", width: 11 },
      ];
      ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0E0D3" } };
      for (const [n, i] of ITEMS.entries()) {
        const row = ws.addRow(["", i.id, i.stone, i.type, i.variant, i.size_mm ?? "", i.supplier, i.stock_in, i.sold || 0, i.stock, i.cost, i.price, Math.round((i.profit || 0) * 100) / 100,
          i.stock <= 0 ? "Sold out" : isLow(i) ? "Low" : "In stock", i.published ? "Yes" : "No"]);
        row.height = 62; row.alignment = { vertical: "middle" };
        if (i.image_v) {
          try {
            const buf = await (await fetch(`/img/${encodeURIComponent(i.id)}.jpg?v=${i.image_v}`)).arrayBuffer();
            const id = wb.addImage({ buffer: buf, extension: "jpeg" });
            ws.addImage(id, { tl: { col: 0.1, row: n + 1.08 }, ext: { width: 76, height: 76 } });
          } catch {}
        }
      }
      ["K", "L", "M"].forEach((c) => (ws.getColumn(c).numFmt = '"RM"#,##0.00'));
      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `House of Qi stock ${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast("Excel file downloaded");
    } catch (x) { toast(x.message || "Export failed"); }
  }

  /* ---------- wiring ---------- */
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-sid]");
    if (r) return openEditor(ITEMS.find((i) => i.id === r.dataset.sid));
    const f = e.target.closest("#sFilters button");
    if (f) { FILTER = f.dataset.f; render(); }
  });
  $("#sSearch").addEventListener("input", (e) => { Q = e.target.value; render(); });
  $("#sAdd").onclick = () => openEditor(null);
  $("#sImport").onclick = openImport;
  $("#sExport").onclick = exportExcel;
  window.Stock = { load };
})();
