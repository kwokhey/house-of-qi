/* House of Qi · Stock tab: inventory list, photos, offline sales, import and Excel export. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RM = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const RM0 = (n) => "RM" + Math.round(Number(n || 0)).toLocaleString("en-MY");
  const day = (ts) => new Date(ts).toLocaleString("en-MY", { day: "numeric", month: "short", year: "2-digit", hour: "numeric", minute: "2-digit" }).replace(",", "");
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const CHANNELS = ["Tea & Qi", "Instagram", "WhatsApp", "Facebook", "Bazaar / event", "In person", "Other"];
  const TYPES = ["Bracelet", "Pendant", "Necklace", "Ring", "Earrings", "Sphere", "Statue", "Stand", "Cluster", "Tumbled", "Other"];
  const COLLECTIONS = [["bracelets", "Bracelets"], ["pendants", "Pendants"], ["rings", "Rings"], ["earrings", "Earrings"], ["decor", "Home & Décor"], ["sets", "Gift Sets"]];
  const KIND = { sale: "Sold", gift: "Gift", restock: "Stock in", adjust: "Adjusted", consign: "Seller" };

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
    all: () => true, in: (i) => i.stock > 0, low: isLow, sold: (i) => (i.sold || 0) > 0, gift: (i) => (i.gifted || 0) > 0, out: (i) => i.stock <= 0,
    nophoto: (i) => !i.image_v, hidden: (i) => !i.published, preorder: (i) => !!i.preorder,
  };

  /* ---------- list ---------- */
  function tiles() {
    const pcs = ITEMS.reduce((t, i) => t + Math.max(0, i.stock), 0);
    const cost = ITEMS.reduce((t, i) => t + Math.max(0, i.stock) * i.cost, 0);
    const retail = ITEMS.reduce((t, i) => t + Math.max(0, i.stock) * i.price, 0);
    const mName = new Date().toLocaleString("en-MY", { month: "long" });
    $("#sTiles").innerHTML = `
      <div><span>Pieces in stock</span><b>${pcs.toLocaleString()}</b><small>across ${ITEMS.filter((i) => i.stock > 0).length} items</small></div>
      <div><span>Stock value</span><b>${RM0(cost)}</b><small>at cost · ${RM0(retail)} retail</small></div>
      <div><span>Sold in ${mName}</span><b>${(MONTH.pcs || 0).toLocaleString()}</b><small>${RM0(MONTH.revenue)} sales</small></div>
      <div><span>Profit in ${mName}</span><b>${RM0(MONTH.profit)}</b><small>sales minus cost</small></div>`;
  }
  let SHOWN = [];
  function render() {
    tiles();
    document.querySelectorAll("#sFilters button").forEach((b) => {
      b.classList.toggle("on", b.dataset.f === FILTER);
      b.querySelector("i").textContent = ITEMS.filter(GROUPS[b.dataset.f]).length;
    });
    const q = Q.trim().toLowerCase();
    const list = ITEMS.filter(GROUPS[FILTER]).filter((i) => !q || `${i.id} ${name(i)} ${details(i)} ${i.supplier}`.toLowerCase().includes(q));
    SHOWN = list;
    if (FILTER === "sold") list.sort((a, b) => (b.sold || 0) - (a.sold || 0)); // best sellers first
    if (FILTER === "gift") list.sort((a, b) => (b.last_gift || 0) - (a.last_gift || 0)); // latest gifts first
    $("#sList").innerHTML = list.length
      ? list.map((i) => `<button class="s-row${i.stock <= 0 ? " out" : ""}" data-sid="${esc(i.id)}">
          <img src="${thumb(i)}" alt="" loading="lazy">
          <span class="s-main"><b>${esc(name(i))}</b><small>${esc([i.id, details(i)].filter(Boolean).join(" · "))}</small>
            <span class="s-flags">${!i.published ? "<em>Hidden</em>" : ""}${!i.image_v ? "<em>No photo</em>" : ""}${i.featured ? "<em class=\"g\">Featured</em>" : ""}${i.printed > 0 ? `<em class="g">${i.stock > 0 && i.printed >= i.stock ? "Tags printed" : `${i.printed} tag${i.printed === 1 ? "" : "s"} printed`}</em>` : ""}${i.sold ? `<em class="s">${i.sold} sold</em>` : ""}${i.gifted ? `<em class="gf">${i.gifted} gifted</em>` : ""}${i.with_sellers > 0 ? `<em>${i.with_sellers} with sellers</em>` : ""}${!(i.price > 0) ? `<em class="w">No price · not in shop</em>` : ""}</span></span>
          <span class="s-num"><b class="${i.stock <= 0 ? "zero" : isLow(i) ? "low" : ""}">${i.stock}</b><small>${RM0(i.price)}</small></span>
        </button>`).join("")
      : `<p class="empty">${ITEMS.length ? (Q.trim() ? "Nothing matches your search." : { sold: "Nothing has sold yet.", gift: "Nothing has been gifted yet. Use the Gift button on an item.", out: "Nothing is sold out. Every item still has stock.", low: "Nothing is running low.", nophoto: "Every item has a photo.", hidden: "No hidden items. Everything is showing in the shop.", preorder: "No pre-order pieces yet. Open a piece and tick Pre-order.", in: "Nothing in stock." }[FILTER] || "Nothing matches.") : "No stock yet. Tap Import to bring in your Excel list, or + Add item."}</p>`;
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
        ${i.image_v ? '<button type="button" class="btn ghost sm" id="edAdjPh">Adjust photo</button><button type="button" class="link" id="edDelPh">Remove photo</button>' : '<small>Drawn picture shown until you add a photo</small>'}</div></div>
      ${(() => { const g = angles(i); return `<div class="ed-ang"><div class="ang-h"><b>More angles</b><small>${g.length}/5 · shown after the main photo, customers swipe through them</small></div>
        <div class="ang-grid">${g.map((p, n) => `<span class="ang"><img src="/img/${encodeURIComponent(p.k)}.jpg?v=${p.v}" alt="">
          <span class="ang-t"><button type="button" data-amv="${esc(p.k)}" data-d="-1" ${n ? "" : "disabled"} aria-label="Move earlier">‹</button><button type="button" data-amv="${esc(p.k)}" data-d="1" ${n < g.length - 1 ? "" : "disabled"} aria-label="Move later">›</button><button type="button" data-aadj="${esc(p.k)}" aria-label="Adjust">✎</button><button type="button" data-adel="${esc(p.k)}" aria-label="Remove">✕</button></span></span>`).join("")}
          ${g.length < 5 ? `<label class="ang ang-add"><input type="file" id="edAngFile" accept="image/*" hidden><em>+ Add angle</em></label>` : ""}</div></div>`; })()}
      ${(() => { let v = null; try { v = JSON.parse(i.video || "null"); } catch {} return `<div class="ed-vid" id="edVid"><div class="ang-h"><b>Video</b><small>${v && v.k ? `${(v.s / 1048576).toFixed(1)} MB · shown with the photos, customers tap ▶ to play` : "optional · MP4 or MOV, up to 90 MB · a short clip (10–30 s) loads fastest"}</small></div>
        <div class="vid-row">${v && v.k ? `<video src="/${esc(v.k)}?v=${v.v}" controls playsinline preload="metadata"></video>` : ""}
          <div class="vid-act"><label class="btn ghost sm">${v && v.k ? "Replace video" : "+ Add video"}<input type="file" id="edVidFile" accept="video/mp4,video/quicktime,video/webm,video/*" hidden></label>${v && v.k ? '<button type="button" class="link" id="edVidDel">Remove video</button>' : ""}<small id="edVidMsg"></small></div></div></div>`; })()}
      <div class="ed-stock"><div><span>In stock</span><b id="edStock" class="${i.stock <= 0 ? "zero" : ""}">${i.stock}</b><small>${i.sold || 0} sold · ${i.stock_in} received</small></div>
        <div class="ed-acts"><button type="button" class="btn gold sm" data-mv="sale"${i.stock <= 0 ? " disabled" : ""}>Sold offline</button><button type="button" class="btn ghost sm" data-mv="gift"${i.stock <= 0 ? " disabled" : ""}>Gift</button><button type="button" class="btn ghost sm" data-mv="restock">Add stock</button><button type="button" class="btn ghost sm" data-mv="adjust">Adjust count</button><button type="button" class="btn ghost sm" data-oos${i.stock <= 0 ? " disabled" : ""}>${i.stock <= 0 ? "Out of stock" : "Mark out of stock"}</button></div>
        <div id="mvForm"></div></div>`}
      <div class="grid-f">
        ${field("eId", "Item ID", i.id, 'placeholder="e.g. LRM-1060" autocapitalize="off" required')}
        ${field("eStone", "Stone", i.stone, 'required placeholder="e.g. Larimar"')}
        ${selectF("eType", "Type", TYPES, i.type)}
        ${field("eSize", "Bead size (mm)", i.size_mm ?? "", 'inputmode="decimal" placeholder="e.g. 10"')}
        ${field("eVar", "Details", i.variant, 'placeholder="e.g. Bright blue, premium"')}
        ${selectF("eCol", "Shop section", COLLECTIONS, i.collection)}
        ${field("eCost", "Cost (RM per piece)", i.cost, 'inputmode="decimal"')}
        ${field("ePrice", "Selling price (RM)", i.price, 'inputmode="decimal" required')}
        ${isNew ? field("eQty", "Stock now", i.stock, 'inputmode="numeric"') : ""}
        ${field("eSup", "Supplier", i.supplier)}
        ${field("eZh", "Chinese name", i.zh, 'placeholder="optional"')}${field("eDims", "Measurements", i.dims || "", 'placeholder="e.g. H 32 mm × W 23 mm × D 10 mm"')}
        ${selectF("eColour", "Bead colour (Shop by colour)", [["", `Automatic · ${(COLS.find((c) => c.id === (i.auto_colour || "")) || { name: "set from stone" }).name}`], ...COLS.map((c) => [c.id, c.name])], i.colour || "")}
      </div>
      <p class="margin" id="eMargin"></p>
      <label class="f full"><span>Description (shown in the shop)</span><textarea id="eDesc" rows="3" placeholder="${esc(i.auto_description ? "Automatic (shown in the shop now): " + i.auto_description : "Leave empty for an automatic line")}">${esc(i.description)}</textarea></label>
      <label class="f full"><span>Meaning</span><textarea id="eMean" rows="5" placeholder="e.g. The stone of calm, traditionally used for…">${esc(i.meaning || i.auto_meaning || "")}</textarea></label>
      <div class="toggles"><label><input type="checkbox" id="ePub"${i.published ? " checked" : ""}> Show on website</label><label><input type="checkbox" id="eFeat"${i.featured ? " checked" : ""}> Featured on home page</label><label><input type="checkbox" id="eRing"${i.ring_adj ? " checked" : ""}> Adjustable ring (customer types their ring size, same price)</label><label><input type="checkbox" id="ePre"${i.preorder ? " checked" : ""}> Pre-order (50% deposit now, rest when ready)</label></div>
      <label class="f full" id="ePreNoteW"${i.preorder ? "" : " hidden"}><span>Pre-order note (shown to customers)</span><input id="ePreNote" maxlength="120" value="${esc(i.preorder_note || "")}" placeholder="e.g. Ready in about 3–4 weeks"></label>
      <label class="f full" id="ePreSzW"${i.preorder ? "" : " hidden"}><span>Pre-order bead sizes and prices (optional, one per line)</span><textarea id="ePreSz" rows="4" placeholder="10 mm = 680&#10;12 mm = 938&#10;14 mm = 1380">${esc(i.preorder_sizes || "")}</textarea><small class="muted">Customers choose a size on the product page and pay 50% of that size's price. Leave empty to sell just this piece at the selling price.</small></label>
      ${isNew ? "" : '<div class="f full"><span>Our collections</span><div class="pick ecoll" id="eColls"><small class="muted">Loading…</small></div></div>'}
      <p class="err" id="edErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit" id="edSave">${isNew ? "Add item" : "Save changes"}</button>${!isNew && !i.sold ? '<button type="button" class="link danger" id="edDel">Delete item</button>' : ""}</div>
      ${isNew ? "" : '<h3>History</h3><ul class="hist" id="edHist"><li class="muted">Loading…</li></ul>'}
    </form>`;
    const margin = () => {
      const c = +$("#eCost").value || 0, p = +$("#ePrice").value || 0;
      $("#eMargin").textContent = p && c ? `Profit per piece ${RM(p - c)} · ${(p / c).toFixed(2)}× cost` : "";
    };
    $("#eCost").oninput = $("#ePrice").oninput = margin; margin();
    if (!isNew) (async () => {
      try {
        const { collections } = await api("/api/admin/marketing?colls=1");
        const t = (a) => a.map((x) => String(x).toLowerCase());
        const auto = (c) => {
          const T = t(c.targets), szp = i.preorder ? String(i.preorder_sizes || "").split(/\n/).map((l) => +((l.split(/[=:]/)[1] || "").replace(/[^\d.]/g, ""))).filter((n) => n > 0) : [], price = szp.length ? Math.min(...szp) : +i.price || 0;
          const hit = c.scope === "all" || (c.scope === "collection" && T.includes(String(i.collection || "").toLowerCase())) || (c.scope === "stones" && T.includes(String(i.stone).toLowerCase()))
            || (c.scope === "price" && price >= (+c.targets[0] || 0) && (!(+c.targets[1]) || price <= +c.targets[1]));
          return hit && (!c.max_price || price <= c.max_price);
        };
        const box = $("#eColls"); if (!box) return;
        box.innerHTML = collections.length ? collections.map((c) => {
          const a = false, on = a || (c.scope === "items" ? c.targets : c.extra || []).includes(i.id);
          return `<label><input type="checkbox" data-cid="${c.id}" data-was="${on && !a ? 1 : 0}"${on ? " checked" : ""}${a ? " disabled" : ""}><span>${esc(c.name)}${c.zh ? ` <span class="zh">${esc(c.zh)}</span>` : ""}</span><small>${a ? "included automatically" : c.active ? "" : "hidden"}</small></label>`;
        }).join("") : '<small class="muted">No collections yet. Make one in the Marketing tab.</small>';
      } catch { const box = $("#eColls"); if (box) box.innerHTML = '<small class="muted">Couldn\'t load collections.</small>'; }
    })();
    $("#ePre").onchange = () => { $("#ePreNoteW").hidden = $("#ePreSzW").hidden = !$("#ePre").checked; };
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#edForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        id: $("#eId").value, oldId: isNew ? undefined : i.id, stone: $("#eStone").value, type: $("#eType").value, variant: $("#eVar").value, size_mm: $("#eSize").value,
        collection: $("#eCol").value, cost: $("#eCost").value, price: $("#ePrice").value, supplier: $("#eSup").value, zh: $("#eZh").value, dims: $("#eDims").value, preorder: $("#ePre").checked, ring_adj: $("#eRing").checked, preorder_note: $("#ePreNote").value, preorder_sizes: $("#ePreSz").value,
        description: $("#eDesc").value, meaning: $("#eMean").value, colour: $("#eColour").value, published: $("#ePub").checked, featured: $("#eFeat").checked ? (i.featured || 1) : 0,
        intentions: (() => { try { return JSON.parse(i.intentions || "[]"); } catch { return []; } })(), isNew, stock: isNew ? $("#eQty").value : undefined,
      };
      $("#edSave").disabled = true;
      const newId = $("#eId").value.trim();
      if (!isNew && newId !== i.id && !confirm(`Change the item ID from ${i.id} to ${newId}?\n\nPhotos, stock history and sales move with it. Printed tags and shared links that use ${i.id} will no longer match, and the next import should use ${newId}.`)) { $("#edSave").disabled = false; return; }
      try { const r = await api("/api/admin/items", { method: "POST", body: JSON.stringify(body) });
        for (const x of document.querySelectorAll("#eColls input[data-cid]:not([disabled])")) {
          if (x.checked !== (x.dataset.was === "1")) await api("/api/admin/marketing", { method: "POST", body: JSON.stringify({ type: "collMember", id: +x.dataset.cid, item: r.item.id, on: x.checked }) });
        } toast(isNew ? `${r.item.id} added` : newId !== i.id ? `Item ID changed to ${r.item.id}` : "Saved"); await load(); if (isNew) openEditor(ITEMS.find((x) => x.id === r.item.id)); else d.close(); }
      catch (x) { $("#edErr").textContent = x.message; $("#edErr").hidden = false; }
      $("#edSave").disabled = false;
    };
    if (!isNew) {
      $("#edFile").onchange = (e) => { const f = e.target.files[0]; if (f) adjustPhoto(i, f); };
      if ($("#edAdjPh")) $("#edAdjPh").onclick = () => adjustPhoto(i, `/img/${encodeURIComponent(i.id)}.jpg?v=${i.image_v}`);
      if ($("#edVidFile")) $("#edVidFile").onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 90 * 1048576) { toast("That video is over 90 MB. Please trim it or record a shorter clip."); return; }
        const msg = $("#edVidMsg"), x = new XMLHttpRequest();
        x.open("POST", "/api/admin/video?id=" + encodeURIComponent(i.id));
        x.setRequestHeader("Content-Type", f.type || "video/mp4");
        x.upload.onprogress = (ev) => { if (ev.lengthComputable) msg.textContent = `Uploading… ${Math.round((ev.loaded / ev.total) * 100)}%`; };
        x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {}
          if (x.status >= 200 && x.status < 300) { i.video = JSON.stringify(d.video); const it = ITEMS.find((z) => z.id === i.id); if (it) it.video = i.video; toast("Video saved. It shows on the product page."); openEditor(i); }
          else { msg.textContent = ""; toast(d.error || "The video didn't upload. Please try again."); } };
        x.onerror = () => { msg.textContent = ""; toast("The video didn't upload. Please check your connection and try again."); };
        msg.textContent = "Uploading… 0%"; x.send(f);
      };
      if ($("#edVidDel")) $("#edVidDel").onclick = async () => {
        if (!confirm("Remove this video from the product?")) return;
        try { await api("/api/admin/video?id=" + encodeURIComponent(i.id), { method: "DELETE" }); i.video = ""; const it = ITEMS.find((z) => z.id === i.id); if (it) it.video = ""; toast("Video removed"); openEditor(i); } catch (x) { toast(x.message); }
      };
      if ($("#edAngFile")) $("#edAngFile").onchange = (e) => { const f = e.target.files[0]; if (f) adjustPhoto(i, f, "new"); };
      const ang = $("#sEdit .ed-ang");
      if (ang) ang.onclick = async (e) => {
        const mv = e.target.closest("[data-amv]"), adj = e.target.closest("[data-aadj]"), del = e.target.closest("[data-adel]");
        if (adj) { const p = angles(i).find((x) => x.k === adj.dataset.aadj); return adjustPhoto(i, `/img/${encodeURIComponent(p.k)}.jpg?v=${p.v}`, p.k); }
        if (!mv && !del) return;
        if (del && del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "?"; del.title = "Tap again to remove"; return; }
        try {
          if (mv) await api("/api/admin/image", { method: "POST", body: JSON.stringify({ id: i.id, action: "move", k: mv.dataset.amv, d: +mv.dataset.d }) });
          else { await api(`/api/admin/image?id=${encodeURIComponent(i.id)}&k=${encodeURIComponent(del.dataset.adel)}`, { method: "DELETE" }); toast("Photo removed"); }
          await load(); openEditor(ITEMS.find((x) => x.id === i.id));
        } catch (x) { toast(x.message); }
      };
      if ($("#edDelPh")) $("#edDelPh").onclick = async () => { await api(`/api/admin/image?id=${encodeURIComponent(i.id)}`, { method: "DELETE" }); toast("Photo removed"); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); };
      if ($("#edDel")) $("#edDel").onclick = async () => {
        if ($("#edDel").dataset.sure !== "1") { $("#edDel").dataset.sure = "1"; $("#edDel").textContent = "Tap again to delete for good"; return; }
        try { await api(`/api/admin/items?id=${encodeURIComponent(i.id)}`, { method: "DELETE" }); toast(`${i.id} deleted`); d.close(); load(); } catch (x) { toast(x.message); }
      };
      d.querySelectorAll("[data-oos]").forEach((b) => (b.onclick = async () => {
        if (!confirm(`Mark ${i.id} as out of stock?\n\nStock goes from ${i.stock} to 0. The shop shows it as out of stock and nobody can buy it. Use "Add stock" to bring it back.`)) return;
        b.disabled = true;
        try { await api("/api/admin/movement", { method: "POST", body: JSON.stringify({ itemId: i.id, kind: "adjust", qty: 0, note: "Marked out of stock" }) }); toast("Marked out of stock"); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); }
        catch (x) { toast(x.message); b.disabled = false; }
      }));
      d.querySelectorAll("[data-mv]").forEach((b) => (b.onclick = () => movementForm(i, b.dataset.mv)));
      history(i);
    }
    if (!d.open) d.showModal();
    d.scrollTop = 0;
  }

  /* invoice details for an offline sale ("sold to"); leave Sold to empty for no invoice */
  const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const invFields = (date) => `<div class="inv-f"><b>Invoice details</b> <small class="muted">Fill in "Sold to" to make an invoice. Leave it empty for no invoice.</small>
      <label class="f"><span>Invoice</span><select id="iMode"><option value="">New invoice</option></select></label>
      <small class="muted" id="iModeHint">Customer bought several pieces? Record the first piece as a new invoice, then for each other piece pick that invoice here.</small>
      <div class="grid-f" id="iNew">${field("iName", "Sold to (customer name) *", "", 'placeholder="e.g. Tan Mei Ling"')}${field("iCo", "Company (optional)", "")}
      ${field("iPhone", "Phone", "", 'inputmode="tel"')}${field("iEmail", "Email", "", 'inputmode="email"')}
      ${field("iAttn", "Attn / PIC (optional)", "")}${field("iDate", "Sale date", date || today(), 'type="date"')}
      ${field("iTerms", "Payment terms", "Paid in full")}
      <label class="f" style="grid-column:1/-1"><span>Address</span><textarea id="iAddr" rows="2" placeholder="Street, postcode, city, state"></textarea></label></div></div>`;
  const fillInvoices = async () => {
    try {
      const { invoices } = await api("/api/admin/invoice");
      const sel = $("#iMode"); if (!sel) return;
      sel.innerHTML = `<option value="">New invoice</option>` + invoices.filter((v) => !v.void).slice(0, 40).map((v) => `<option value="${esc(v.number)}">Add to ${esc(v.number)} · ${esc(v.to || "")} · RM${Number(v.total || 0).toFixed(2)}</option>`).join("");
      sel.onchange = () => {
        $("#iNew").hidden = !!sel.value;
        // adding to an existing invoice: use the same "Sold through" as that invoice
        const v = invoices.find((x) => x.number === sel.value), ch = v && v.channel, m = $("#mCh");
        if (!ch || !m) return;
        if (CHANNELS.includes(ch)) { m.value = ch; $("#mChOF").hidden = true; }
        else { m.value = "Other"; $("#mChOF").hidden = false; $("#mChO").value = ch; }
      };
    } catch {}
  };
  const invData = () => ({ addTo: $("#iMode")?.value || undefined, to: { name: $("#iName").value, company: $("#iCo").value, phone: $("#iPhone").value, email: $("#iEmail").value, attn: $("#iAttn").value, address: $("#iAddr").value }, saleDate: $("#iDate").value, terms: $("#iTerms").value });
  const openInvoice = (no, w) => { const u = `/invoice.html?no=${encodeURIComponent(no)}`; if (w) w.location = u; else window.open(u, "_blank"); };

  const sellers = async () => { try { return (await api("/api/admin/affiliates")).affiliates; } catch { return []; } };
  function movementForm(i, kind) {
    const box = $("#mvForm");
    const f = {
      sale: `<div class="mv"><b>Record an offline sale</b><div class="grid-f">
          ${field("mQty", "Quantity", 1, 'inputmode="numeric"')}${field("mPrice", "Price paid per piece (RM)", i.price, 'inputmode="decimal"')}
          ${selectF("mCh", "Sold through", CHANNELS, "Tea & Qi")}<label class="f" id="mChOF" hidden><span>Sold through (please specify)</span><input id="mChO" maxlength="40" placeholder="e.g. Shopee, Carousell, friend referral"></label>${field("mNote", "Note", "", 'placeholder="e.g. customer name"')}
          <label class="f" id="mAffF" hidden><span>Sold by (affiliate)</span><select id="mAff"></select></label></div>
          ${invFields()}
          <button type="button" class="btn gold sm" id="mGo">Record sale</button></div>`,
      gift: `<div class="mv"><b>Give as a gift</b> <small class="muted">Stock goes down; it isn't counted as a sale.</small><div class="grid-f">
          ${field("mQty", "Quantity", 1, 'inputmode="numeric"')}${field("mTo", "Given to", "", 'placeholder="e.g. Ms Lee, influencer @name"')}
          ${field("mNote", "Reason (optional)", "", 'placeholder="e.g. birthday, collaboration, giveaway"')}</div>
          <button type="button" class="btn gold sm" id="mGo">Record gift</button></div>`,
      restock: `<div class="mv"><b>New stock arrived</b><div class="grid-f">
          ${field("mQty", "Quantity", 1, 'inputmode="numeric"')}${field("mCost", "Cost per piece (RM)", i.cost, 'inputmode="decimal"')}
          ${field("mNote", "Note", "", 'placeholder="e.g. supplier, invoice no."')}</div>
          <button type="button" class="btn gold sm" id="mGo">Add to stock</button></div>`,
      adjust: `<div class="mv"><b>Correct the count</b><div class="grid-f">
          ${field("mQty", "Pieces you counted", i.stock, 'inputmode="numeric"')}${field("mNote", "Reason", "", 'placeholder="e.g. stock take, damaged, gift"')}</div>
          <button type="button" class="btn gold sm" id="mGo">Save count</button></div>`,
    }[kind];
    box.innerHTML = f;
    if (kind === "sale") fillInvoices();
    if (kind === "sale") $("#mCh").onchange = () => { const o = $("#mCh").value === "Other"; $("#mChOF").hidden = !o; if (o) $("#mChO").focus(); };
    if (kind === "sale") sellers().then((L) => {
      const act = L.filter((a) => a.active);
      if (!act.length || !$("#mAff")) return;
      $("#mAff").innerHTML = `<option value="">Nobody (House of Qi)</option>` + act.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.code)}</option>`).join("");
      $("#mAffF").hidden = false;
      // a seller whose code gives customers a discount: use the discounted price, like the website does
      let auto = null;
      $("#mAff").insertAdjacentHTML("afterend", '<small class="muted" id="mAffHint" hidden></small>');
      $("#mAff").onchange = () => {
        const a = act.find((x) => String(x.id) === $("#mAff").value), d = a ? +a.disc_pct || 0 : 0, pr = $("#mPrice"), h = $("#mAffHint");
        if (!pr) return;
        const base = +i.price || 0, cur = pr.value;
        if (d > 0) {
          if (auto === null || cur === auto) { auto = (Math.round(base * (100 - d)) / 100).toFixed(2); pr.value = auto; }
          h.textContent = `${a.code} gives ${d}% off: RM${base.toFixed(2)} → RM${(Math.round(base * (100 - d)) / 100).toFixed(2)} per piece. Change the price if the customer paid something else.`; h.hidden = false;
        } else {
          if (auto !== null && cur === auto) pr.value = base;
          auto = null; h.hidden = true;
        }
      };
    });
    $("#mQty").focus(); $("#mQty").select();
    $("#mGo").onclick = async () => {
      $("#mGo").disabled = true;
      const inv = kind === "sale" ? invData() : null;
      const w = inv && (inv.to.name.trim() || inv.addTo) ? window.open("", "_blank") : null; // opened now so the browser doesn't block it
      try {
        const r = await api("/api/admin/movement", { method: "POST", body: JSON.stringify({ itemId: i.id, kind, qty: $("#mQty").value, price: $("#mPrice")?.value, cost: $("#mCost")?.value, channel: $("#mCh")?.value === "Other" && $("#mChO").value.trim() ? $("#mChO").value.trim() : $("#mCh")?.value, note: $("#mNote").value, to_name: $("#mTo")?.value, aff: $("#mAff")?.value || undefined, ...(inv || {}) }) });
        if (r.invoice) openInvoice(r.invoice, w); else if (w) w.close();
        if (r.warning) toast(r.warning);
        toast(r.invoice ? `Sale recorded · invoice ${r.invoice}` : { sale: "Sale recorded", gift: "Gift recorded", restock: "Stock added", adjust: "Count saved" }[kind]);
        await load(); openEditor(ITEMS.find((x) => x.id === i.id));
      } catch (x) { if (w) w.close(); toast(x.message); $("#mGo").disabled = false; }
    };
  }

  async function history(i) {
    try {
      const { movements } = await api(`/api/admin/movement?id=${encodeURIComponent(i.id)}`);
      $("#edHist").innerHTML = movements.length ? movements.map((m) => `<li><span class="h-k ${m.kind}">${KIND[m.kind] || m.kind}</span>
          <span class="h-d">${m.qty > 0 ? "+" : ""}${m.qty} ${m.kind === "sale" && m.unit_price != null ? `@ ${RM(m.unit_price)}` : ""}
          <small>${esc([m.channel, m.note].filter(Boolean).join(" · "))} · ${day(m.created_at)}</small></span>
          ${m.kind === "sale" && !m.ref ? (m.invoice ? `<button type="button" class="link" data-inv="${esc(m.invoice)}">Invoice ${esc(m.invoice)}</button>` : `<button type="button" class="link" data-mkinv="${m.id}" data-d="${new Date(m.created_at + 8 * 3600e3).toISOString().slice(0, 10)}">Make invoice</button>`) : ""}
          ${m.ref ? "" : `<button type="button" class="link" data-undo="${m.id}">Undo</button>`}</li>`).join("") : '<li class="muted">No changes yet.</li>';
      $("#edHist").querySelectorAll("[data-inv]").forEach((b) => (b.onclick = () => openInvoice(b.dataset.inv)));
      $("#edHist").querySelectorAll("[data-mkinv]").forEach((b) => (b.onclick = () => {
        $("#mvForm").innerHTML = `<div class="mv"><b>Invoice for this offline sale</b>${invFields(b.dataset.d)}<button type="button" class="btn gold sm" id="iGo">Make invoice</button></div>`;
        $("#mvForm").scrollIntoView({ block: "center" }); $("#iName").focus(); fillInvoices();
        $("#iGo").onclick = async () => {
          const d = invData(); if (!d.addTo && !d.to.name.trim()) { toast("Please enter who it was sold to."); return; }
          const w = window.open("", "_blank"); $("#iGo").disabled = true;
          try { const r = await api("/api/admin/invoice", { method: "POST", body: JSON.stringify({ mid: b.dataset.mkinv, to: d.to, addTo: d.addTo, date: d.saleDate, terms: d.terms }) }); openInvoice(r.number, w); toast(`Invoice ${r.number} made`); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); }
          catch (x) { if (w) w.close(); toast(x.message); $("#iGo").disabled = false; }
        };
      }));
      $("#edHist").querySelectorAll("[data-undo]").forEach((b) => (b.onclick = async () => {
        try { await api(`/api/admin/movement?mid=${b.dataset.undo}`, { method: "DELETE" }); toast("Undone"); await load(); openEditor(ITEMS.find((x) => x.id === i.id)); } catch (x) { toast(x.message); }
      }));
    } catch { $("#edHist").innerHTML = '<li class="muted">Couldn\'t load history.</li>'; }
  }

  /* ---------- adjust a photo: zoom, drag into place, rotate; saved as a square like the shop shows it ---------- */
  const angles = (i) => { try { return JSON.parse(i.gallery || "[]").filter((p) => p && p.k); } catch { return []; } };
  async function adjustPhoto(i, src, slot) {
    let bmp, orig = null;
    try {
      if (typeof src === "string") {
        // start from the full original when one was kept, so nothing cut off earlier is lost
        const o = await fetch(`/api/admin/image?id=${encodeURIComponent(i.id)}&orig=1${slot && slot !== "new" ? `&k=${encodeURIComponent(slot)}` : ""}`, { credentials: "same-origin", cache: "no-store" });
        bmp = await createImageBitmap(o.ok ? await o.blob() : await (await fetch(src, { cache: "no-store" })).blob());
      } else {
        bmp = await createImageBitmap(src);
        // keep the whole photo (up to 2000px) for later adjustments
        const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), oc = document.createElement("canvas");
        oc.width = Math.round(bmp.width * k); oc.height = Math.round(bmp.height * k); oc.getContext("2d").drawImage(bmp, 0, 0, oc.width, oc.height);
        let q = 0.85; orig = oc.toDataURL("image/jpeg", q);
        while (orig.length > 2_400_000 && q > 0.5) { q -= 0.08; orig = oc.toDataURL("image/jpeg", q); }
      }
    } catch { toast("Couldn't open that photo. Try a JPG or PNG."); return; }
    let d = $("#sCrop");
    if (!d) { d = document.createElement("dialog"); d.id = "sCrop"; d.className = "sheet-d crop-d"; document.body.appendChild(d); }
    d.innerHTML = `<div class="ed"><div class="ed-h"><b>Adjust photo</b><button type="button" class="link" data-x>Cancel</button></div>
      <p class="lede">Drag the photo to move it. Use the slider (or pinch / scroll) to zoom. The square is exactly what the shop shows.</p>
      <div class="crop-stage" id="cStage"><canvas id="cCv" width="1200" height="1200"></canvas><span class="crop-grid"></span></div>
      <div class="crop-row"><span class="crop-z">−</span><input type="range" id="cZoom" min="0" max="1000" value="0" aria-label="Zoom"><span class="crop-z">+</span></div>
      <div class="crop-row crop-tools">
        <button type="button" class="btn ghost sm" id="cRot">Rotate ↻</button>
        <button type="button" class="btn ghost sm" id="cFit">Fit whole photo</button>
        <button type="button" class="btn ghost sm" id="cReset">Reset</button>
        <span class="crop-bg">Background <button type="button" data-bg="#FFFFFF" title="White"></button><button type="button" data-bg="#EFE3D7" title="Cream"></button><button type="button" data-bg="#1E1714" title="Dark"></button></span>
      </div>
      <div class="ed-f"><button class="btn" type="button" id="cSave">Save photo</button></div></div>`;
    const cv = $("#cCv"), cx = cv.getContext("2d"), N = cv.width, Z = $("#cZoom");
    const st = { rot: 0, x: 0, y: 0, k: 1, bg: "#FFFFFF" };
    const dims = () => (st.rot % 180 ? [bmp.height, bmp.width] : [bmp.width, bmp.height]);
    const cover = () => { const [w, h] = dims(); return N / Math.min(w, h); };   // fills the square
    const contain = () => { const [w, h] = dims(); return N / Math.max(w, h); }; // whole photo visible
    const kMin = () => contain() * 0.9, kMax = () => cover() * 5;
    const toSlider = () => (Z.value = Math.round(1000 * Math.log(st.k / kMin()) / Math.log(kMax() / kMin())));
    const fromSlider = () => kMin() * Math.pow(kMax() / kMin(), Z.value / 1000);
    function clamp() {
      const [w, h] = dims(), W = w * st.k, H = h * st.k;
      const lx = Math.abs(W - N) / 2, ly = Math.abs(H - N) / 2;   // a photo larger than the square can't leave a gap; a smaller one stays inside
      st.x = Math.max(-lx, Math.min(lx, st.x)); st.y = Math.max(-ly, Math.min(ly, st.y));
    }
    function draw() {
      clamp();
      cx.fillStyle = st.bg; cx.fillRect(0, 0, N, N);
      cx.save(); cx.translate(N / 2 + st.x, N / 2 + st.y); cx.rotate((st.rot * Math.PI) / 180); cx.scale(st.k, st.k);
      cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2); cx.restore();
      d.querySelectorAll("[data-bg]").forEach((b) => b.classList.toggle("on", b.dataset.bg === st.bg));
    }
    const reset = () => { st.k = cover(); st.x = st.y = 0; toSlider(); draw(); };
    const zoomAt = (k, px = N / 2, py = N / 2) => { k = Math.max(kMin(), Math.min(kMax(), k)); const f = k / st.k; st.x = (st.x + N / 2 - px) * f - (N / 2 - px); st.y = (st.y + N / 2 - py) * f - (N / 2 - py); st.k = k; toSlider(); draw(); };
    Z.oninput = () => zoomAt(fromSlider());
    $("#cRot").onclick = () => { st.rot = (st.rot + 90) % 360; reset(); };
    $("#cFit").onclick = () => { st.k = contain(); st.x = st.y = 0; toSlider(); draw(); };
    $("#cReset").onclick = () => { st.rot = 0; reset(); };
    d.querySelectorAll("[data-bg]").forEach((b) => (b.onclick = () => { st.bg = b.dataset.bg; draw(); }));
    // drag + pinch (pointer events), scroll to zoom
    const stage = $("#cStage"), pts = new Map(); let last = null;
    const scale = () => N / stage.getBoundingClientRect().width;
    const local = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) * scale(), (e.clientY - r.top) * scale()]; };
    stage.onpointerdown = (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); last = null; };
    stage.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = local(e); pts.set(e.pointerId, cur);
      if (pts.size === 1) { st.x += cur[0] - prev[0]; st.y += cur[1] - prev[1]; draw(); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (last) zoomAt(st.k * (dist / last), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        last = dist;
      }
    };
    stage.onpointerup = stage.onpointercancel = (e) => { pts.delete(e.pointerId); last = null; };
    stage.onwheel = (e) => { e.preventDefault(); const [px, py] = local(e); zoomAt(st.k * Math.exp(-e.deltaY * 0.0015), px, py); };
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#cSave").onclick = async () => {
      $("#cSave").disabled = true; toast("Saving photo…");
      try {
        let q = 0.88, data = cv.toDataURL("image/jpeg", q);
        while (data.length > 1_700_000 && q > 0.5) { q -= 0.08; data = cv.toDataURL("image/jpeg", q); }
        await api("/api/admin/image", { method: "POST", body: JSON.stringify({ id: i.id, data, orig: orig || undefined, slot: slot || undefined }) });
        d.close(); toast("Photo saved"); await load(); openEditor(ITEMS.find((x) => x.id === i.id));
      } catch (x) { toast(x.message || "Couldn't save the photo. Please try again."); $("#cSave").disabled = false; }
    };
    d.showModal(); reset();
  }

  /* ---------- import from Excel / Google Sheets ---------- */
  let PREVIEW = null;
  function openImport() {
    const d = $("#sImp");
    d.innerHTML = `<div class="ed"><div class="ed-h"><b>Import stock</b><button type="button" class="link" data-x>Close</button></div>
      <p class="lede">Bring in your inventory list. Rows are matched by Item ID, so importing the same list again updates it instead of adding duplicates.</p>
      <div class="imp-opts">
        <label class="btn ghost">Choose Excel or CSV file<input type="file" id="iFile" accept=".xlsx,.csv" hidden></label>
        <span class="or">or</span>
        <div class="imp-url"><input id="iUrl" placeholder="Paste a Google Sheets link"><button class="btn sm" id="iUrlGo">Read sheet</button></div>
      </div>
      <p class="err" id="iErr" hidden></p>
      <div id="iPrev"></div>
      ${ITEMS.length ? `<details class="imp-reset"><summary>Start over: delete all ${ITEMS.length} items</summary>
        <p>Deletes every item in Stock with its photos, stock counts, stock history and sold counts, and pieces recorded as with sellers. Orders, coupons, sales, collections, the banner, and affiliates with their commission records are kept. <b>This can't be undone.</b> Export Excel first if you want a copy.</p>
        <div class="row-b"><input id="iDelTxt" placeholder="Type DELETE" autocomplete="off" autocapitalize="characters"><button type="button" class="btn sm danger" id="iDelGo" disabled>Delete all items</button></div></details>` : ""}</div>`;
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#iFile").onchange = (e) => readFile(e.target.files[0]);
    $("#iUrlGo").onclick = readUrl;
    if ($("#iDelGo")) {
      $("#iDelTxt").oninput = () => ($("#iDelGo").disabled = $("#iDelTxt").value.trim() !== "DELETE");
      $("#iDelGo").onclick = async () => {
        $("#iDelGo").disabled = true;
        try {
          const r = await api("/api/admin/items", { method: "POST", body: JSON.stringify({ action: "clearAll", confirm: $("#iDelTxt").value.trim() }) });
          toast(`${r.deleted} items deleted. Import your new list now.`);
          await load(); openImport();
        } catch (x) { toast(x.message); $("#iDelGo").disabled = false; }
      };
    }
    d.showModal();
  }
  const iErr = (m) => { $("#iErr").textContent = m; $("#iErr").hidden = !m; };
  async function readFile(file) {
    if (!file) return; iErr("");
    try {
      let rows;
      if (/\.csv$/i.test(file.name)) rows = StockImport.csv(await file.text());
      else {
        if (/\.xls$/i.test(file.name)) throw new Error("Please save the sheet as .xlsx or .csv first (old .xls files aren't supported).");
        await loadScript(EXCELJS);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets[0];
        if (!ws) throw new Error("That file has no sheets.");
        rows = [];
        ws.eachRow({ includeEmpty: true }, (row, n) => {
          const out = [];
          for (let c = 1; c <= ws.columnCount; c++) { const cell = row.getCell(c); out.push(cell.text == null ? "" : String(cell.text)); }
          rows[n - 1] = out;
        });
        for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
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
      ${notes.length ? `<ul class="notes">${notes.map((n) => `<li${/^⚠/.test(n) ? ' class="warn"' : ""}>${esc(n)}</li>`).join("")}</ul>` : ""}
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
  const EXCELJS = "/assets/vendor/exceljs-4.4.0.min.js"; // self-hosted (no third-party CDN)
  const loadScript = (src) => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load the Excel tool. Check your connection.")); document.head.appendChild(s); });
  async function exportExcel() {
    if (!ITEMS.length) return toast("Nothing to export yet");
    toast("Preparing Excel file…");
    try {
      await loadScript(EXCELJS);
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

  /* ---------- monthly sales report (online + offline + total), as Excel ---------- */
  function openSales() {
    const d = $("#sSalesD");
    const now = new Date(Date.now() + 8 * 3600e3); // Malaysia time
    const cur = now.toISOString().slice(0, 7);
    d.innerHTML = `<div class="ed"><div class="ed-h"><b>Monthly sales</b><button type="button" class="link" data-x>Close</button></div>
      <p class="lede">Download one Excel file with the month's website (online) sales, offline sales and the total. Test orders you removed from Orders are left out; refunds are shown.</p>
      <label class="fld">Month<input type="month" id="slMonth" value="${cur}" max="${cur}"></label>
      <p class="err" id="slErr" hidden></p>
      <div class="ed-f"><button class="btn gold" id="slGo">Download Excel</button></div></div>`;
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#slGo").onclick = () => exportSales($("#slMonth").value);
    d.showModal();
  }
  async function exportSales(month) {
    const err = (m) => { $("#slErr").textContent = m; $("#slErr").hidden = !m; };
    err("");
    if (!/^\d{4}-\d{2}$/.test(month || "")) return err("Choose a month.");
    const btn = $("#slGo"); btn.disabled = true; btn.textContent = "Preparing…";
    try {
      const r = await fetch(`/api/admin/sales?month=${month}`, { credentials: "same-origin" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Couldn't load the sales.");
      await loadScript(EXCELJS);
      const label = new Date(month + "-01T00:00:00").toLocaleDateString("en-MY", { month: "long", year: "numeric" });
      const day = (t) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);
      const RMF = '"RM"#,##0.00';
      const head = (ws) => { ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0E0D3" } }; };
      const wb = new ExcelJS.Workbook();

      const S = data.summary;
      const ws0 = wb.addWorksheet("Summary");
      ws0.columns = [{ width: 26 }, { width: 16 }, { width: 16 }, { width: 16 }];
      ws0.addRow([`House of Qi · Sales ${label}`]).font = { bold: true, size: 14 };
      ws0.addRow([]);
      const h = ws0.addRow(["", "Online (website)", "Offline", "Total"]); h.font = { bold: true }; h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0E0D3" } };
      const rows = [["Orders / sales", "count"], ["Pieces sold", "pieces"], ["Sales (RM)", "gross"], ["Refunds (RM)", "refunded"], ["Net sales (RM)", "net"]];
      for (const [t, k] of rows) {
        const row = ws0.addRow([t, S.online[k] || 0, S.offline[k] || 0, S.total[k] || 0]);
        if (/RM/.test(t)) [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = RMF));
        if (k === "net") row.font = { bold: true };
      }
      const pr = ws0.addRow(["Offline profit (RM)", "", S.offline.profit || 0, ""]); pr.getCell(3).numFmt = RMF;
      ws0.addRow([]);
      ws0.addRow(["Online counts website orders and pre-order deposits; pre-order balance payments are added to sales when paid. Delivery fees are included in online sales."]).font = { italic: true, color: { argb: "FF8A7A6E" } };
      if (data.onlineError) ws0.addRow([data.onlineError]).font = { color: { argb: "FFB0412E" } };

      const ws1 = wb.addWorksheet("Online", { views: [{ state: "frozen", ySplit: 1 }] });
      ws1.columns = [
        { header: "Date", width: 12 }, { header: "Order", width: 18 }, { header: "Type", width: 18 }, { header: "Customer", width: 22 }, { header: "Email", width: 26 },
        { header: "Items", width: 46 }, { header: "Pieces", width: 8 }, { header: "Subtotal", width: 12 }, { header: "Discount", width: 11 }, { header: "Delivery", width: 11 },
        { header: "Paid", width: 12 }, { header: "Refunded", width: 11 }, { header: "Net", width: 12 }, { header: "Code", width: 12 },
      ];
      head(ws1);
      for (const o of data.online) ws1.addRow([day(o.date), o.orderNo, o.type, o.customer, o.email, o.items, o.pieces || "", o.subtotal, o.discount || "", o.delivery || "", o.total, o.refunded || "", Math.round((o.total - o.refunded) * 100) / 100, o.code || ""]);
      const t1 = ws1.addRow(["Total", "", "", "", "", "", S.online.pieces, "", "", "", S.online.gross, S.online.refunded, S.online.net]); t1.font = { bold: true };
      ["H", "I", "J", "K", "L", "M"].forEach((c) => (ws1.getColumn(c).numFmt = RMF));

      const ws2 = wb.addWorksheet("Offline", { views: [{ state: "frozen", ySplit: 1 }] });
      ws2.columns = [
        { header: "Date", width: 12 }, { header: "Invoice", width: 11 }, { header: "Item ID", width: 14 }, { header: "Item", width: 30 }, { header: "Details", width: 18 },
        { header: "Qty", width: 6 }, { header: "Price each", width: 12 }, { header: "Amount", width: 12 }, { header: "Cost each", width: 11 }, { header: "Profit", width: 12 },
        { header: "Channel", width: 14 }, { header: "Note", width: 34 },
      ];
      head(ws2);
      for (const x of data.offline) ws2.addRow([day(x.date), x.invoice, x.itemId, x.item, x.details, x.qty, x.price, x.amount, x.cost, x.profit, x.channel, x.note]);
      const t2 = ws2.addRow(["Total", "", "", "", "", S.offline.pieces, "", S.offline.gross, "", S.offline.profit]); t2.font = { bold: true };
      ["G", "H", "I", "J"].forEach((c) => (ws2.getColumn(c).numFmt = RMF));

      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `House of Qi sales ${month}.xlsx`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast(`Sales for ${label} downloaded`);
      $("#sSalesD").close();
    } catch (x) { err(x.message || "Export failed"); }
    finally { btn.disabled = false; btn.textContent = "Download Excel"; }
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
  $("#sSales").onclick = openSales;
  // tags for the items in the list right now (search + filter), or one item from its editor
  $("#sTags").onclick = () => window.open(`/tags.html?ids=${encodeURIComponent(SHOWN.map((i) => i.id).join(","))}`, "_blank");
  window.Stock = { load };
})();
