/* House of Qi · Marketing tab: announcement bar, coupon codes and sales. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RM = (n) => { n = Number(n || 0); const f = n % 1 ? 2 : 0; return "RM" + n.toLocaleString("en-MY", { minimumFractionDigits: f, maximumFractionDigits: f }); };
  const testMail = async (body, btn) => {
    btn.disabled = true;
    try { const r = await fetch("/api/admin/test-email", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}));
      toast(r.ok ? `Test sent to ${(j.to || []).join(", ") || "the team"}` : (j.error || "Couldn't send the test email.")); }
    catch { toast("Couldn't send the test email."); } finally { btn.disabled = false; }
  };
  document.addEventListener("click", (e) => {
    if (e.target.id === "mTestTeam") testMail({}, e.target);
    if (e.target.id === "mTestCust") testMail({ customer: true, to: ($("#mTestTo").value || "").trim() }, e.target);
  });
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const MYT = 8 * 3600 * 1000;
  const ymd = (ts) => (ts ? new Date(ts + MYT).toISOString().slice(0, 10) : "");
  const nice = (ts) => (ts ? new Date(ts).toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" }) : "");
  const COLLECTIONS = [["bracelets", "Bracelets"], ["pendants", "Pendants"], ["decor", "Home & Décor"], ["sets", "Gift Sets"]];
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
    if (s.scope === "price") { const [lo, hi] = s.targets.map(Number); return lo && hi ? `${RM(lo)} – ${RM(hi)}` : lo ? `${RM(lo)} and up` : `up to ${RM(hi)}`; }
    return `${s.targets.length} chosen piece${s.targets.length === 1 ? "" : "s"}`;
  };
  const covered = (s) => D.items.filter((i) => s.scope === "all" || (s.scope === "collection" && s.targets.includes(collectionOf(i))) || (s.scope === "stones" && s.targets.map((x) => x.toLowerCase()).includes(i.stone.toLowerCase())) || (s.scope === "items" && s.targets.includes(i.id)) || (s.scope === "price" && inRange(s.targets, i.price)));
  const inRange = (t, price) => { const lo = +t[0] || 0, hi = +t[1] || 0; return price >= lo && (!hi || price <= hi); };
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
    renderAnn(); renderBan(); renderSg();
    $("#mCodes").innerHTML = D.coupons.length ? D.coupons.map(codeRow).join("") : `<p class="m-empty">No codes yet. Try one like <b>WELCOME10</b> for 10% off a first order.</p>`;
    $("#mColls").innerHTML = (D.collections || []).length ? D.collections.map(collRow).join("") : `<p class="m-empty">No collections yet. They appear as picture tiles on the shop's home page.</p>`;
    $("#mSales").innerHTML = D.sales.length ? D.sales.map(saleRow).join("") : `<p class="m-empty">No sales yet. A sale lowers prices automatically between the dates you choose.</p>`;
  }

  function renderSg() {
    const a = D.sgCollect || { on: false, note: "" };
    $("#mSg").innerHTML = `
      <label class="f full"><span>Note for customers (dates and place)</span><input id="sgNote" maxlength="160" value="${esc(a.note || "")}" placeholder="e.g. Collect at Orchard on 12–15 Dec · we will WhatsApp you"></label>
      <label class="tgl"><input type="checkbox" id="sgOn"${a.on ? " checked" : ""}> Show "Singapore self-collect" at checkout <em class="st ${a.on ? "live" : "off"}">${a.on ? "On" : "Off"}</em></label>
      <div class="ed-f"><button class="btn sm" type="submit">Save</button></div>`;
  }
  $("#mSg").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/marketing", { method: "POST", body: JSON.stringify({ type: "sgcollect", on: $("#sgOn").checked, note: $("#sgNote").value }) });
      D.sgCollect = r.sgCollect; renderSg(); toast(r.sgCollect.on ? "Singapore self-collect is on" : "Singapore self-collect is off");
    } catch (x) { toast(x.message); }
  };

  function renderAnn() {
    const a = D.announce || { text: "", link: "", active: false };
    const st = a.active && a.text ? status({ active: 1, starts_at: a.starts_at, ends_at: a.ends_at }) : ["off", "Off"];
    $("#mAnn").innerHTML = `
      <label class="f full"><span>Text</span><input id="aText" maxlength="140" value="${esc(a.text)}" placeholder="e.g. 11.11 Sale · 10% off everything with code QI1111"></label>
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

  function renderBan() {
    const b = D.banner || {}, photos = b.photos || [];
    $("#mBan").innerHTML = `
      <div class="f full"><span>Slideshow photos <small class="hint" style="display:inline">· ${photos.length ? `${photos.length} of 8` : "using the shop's standard photos"}</small></span>
        <div class="ban-grid">${photos.map((p, i) => `<span class="ban-img"><img src="/img/${esc(p.k)}.jpg?v=${p.v}" alt=""><span class="ban-tools">
          <button type="button" data-bmove="${esc(p.k)}" data-d="-1" ${i ? "" : "disabled"} aria-label="Move earlier">‹</button><button type="button" data-bmove="${esc(p.k)}" data-d="1" ${i < photos.length - 1 ? "" : "disabled"} aria-label="Move later">›</button><button type="button" data-bdel="${esc(p.k)}" aria-label="Remove photo">✕</button></span></span>`).join("")}
          ${photos.length < 8 ? `<label class="ban-img ban-add"><input type="file" id="bFile" accept="image/*" multiple hidden><em>+ Add photos</em></label>` : ""}</div>
        <small class="hint">Photos fade from one to the next every few seconds. Landscape photos, at least 1600px wide, look best. Darker or softer backgrounds keep the headline easy to read. Remove all your photos to go back to the standard ones.</small></div>
      <label class="f full"><span>Headline (optional)</span><input id="bTitle" maxlength="80" value="${esc(b.title || "")}" placeholder="Healing crystals | for wellness &amp; balance"><small class="hint">Words after a | appear on a second line in italics.</small></label>
      <label class="f full"><span>Short line (optional)</span><input id="bText" maxlength="200" value="${esc(b.text || "")}" placeholder="Hand-picked natural crystals, each chosen for its energy and intention."></label>
      <label class="f"><span>Button text (optional)</span><input id="bCta" maxlength="30" value="${esc(b.cta || "")}" placeholder="Shop our collection"></label>
      <div class="ed-f"><button class="btn sm" type="submit">Save words</button></div>`;
    const post = (body) => api("/api/admin/marketing", { method: "POST", body: JSON.stringify(body) });
    const f = $("#bFile");
    if (f) f.onchange = async (e) => {
      const files = [...e.target.files].slice(0, 8 - photos.length); if (!files.length) return;
      toast(`Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`);
      try { for (const file of files) await post({ type: "bannerAdd", data: await shrink(file, 2000) }); toast("Added. The shop shows it within a minute."); }
      catch (x) { toast(x.message || "Couldn't read that photo. Please try another."); }
      load();
    };
    $("#mBan").onclick = async (e) => {
      const d = e.target.closest("[data-bdel]"), m = e.target.closest("[data-bmove]");
      if (!d && !m) return;
      try { await post(d ? { type: "bannerDel", k: d.dataset.bdel } : { type: "bannerMove", k: m.dataset.bmove, d: +m.dataset.d }); if (d) toast("Photo removed"); load(); }
      catch (x) { toast(x.message); }
    };
    $("#mBan").onsubmit = async (e) => {
      e.preventDefault();
      try { await post({ type: "banner", title: $("#bTitle").value, text: $("#bText").value, cta: $("#bCta").value }); toast("Banner saved. It shows in the shop within a minute."); load(); }
      catch (x) { toast(x.message); }
    };
  }

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

  /** resize a photo in the browser (max 1400px, JPEG) before upload */
  function shrink(file, max = 1400) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement("canvas");
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        let q = 0.86, data = cv.toDataURL("image/jpeg", q);
        while (data.length > 1_700_000 && q > 0.5) { q -= 0.08; data = cv.toDataURL("image/jpeg", q); }
        res(data);
      };
      im.onerror = rej; im.src = url;
    });
  }
  const inColl = (c) => covered(c).filter((i) => !c.max_price || i.price <= c.max_price);
  const thumbOf = (i) => (i && i.image_v ? `/img/${encodeURIComponent(i.id)}.jpg?v=${i.image_v}` : i && typeof ART !== "undefined" ? ART.get(i.id, "sq", { stone: i.stone, variant: i.variant, type: i.type, size: i.size_mm || 8 }) : "");
  function collRow(c) {
    const items = inColl(c), cover = items.find((i) => i.id === c.cover) || items.find((i) => i.image_v) || items[0];
    return `<button class="m-row m-coll" data-coll="${c.id}">
      <span class="m-cov">${c.cover_v ? `<img src="/img/coll-${c.id}.jpg?v=${c.cover_v}" alt="">` : cover ? `<img src="${thumbOf(cover)}" alt="">` : ""}</span>
      <span class="m-main"><b>${esc(c.name)}${c.zh ? ` <small class="zh">${esc(c.zh)}</small>` : ""}</b><small>${esc(scopeText(c))}${c.max_price ? ` · up to ${RM(c.max_price)}` : ""}${c.blurb ? ` · ${esc(c.blurb)}` : ""}</small></span>
      <span class="m-num"><em class="st ${c.active ? "live" : "off"}">${c.active ? "Shown" : "Hidden"}</em><small>${items.length} piece${items.length === 1 ? "" : "s"}</small></span></button>`;
  }

  /* ---------- collection editor ---------- */
  function openColl(c) {
    const isNew = !c;
    c = c || { id: 0, name: "", zh: "", blurb: "", scope: "stones", targets: [], max_price: 0, cover: "", sort: (D.collections || []).length + 1, active: 1 };
    let targets = new Set(c.scope === "price" ? [] : c.targets), q = "", range = c.scope === "price" ? [c.targets[0] || "", c.targets[1] || ""] : ["", ""];
    const d = $("#mEdit");
    d.innerHTML = `<form class="ed" id="kForm">
      <div class="ed-h"><b>${isNew ? "New collection" : esc(c.name)}</b><button type="button" class="link" data-x>Close</button></div>
      <div class="grid-f">
        <label class="f"><span>Name</span><input id="kName" maxlength="50" value="${esc(c.name)}" placeholder="e.g. Rare Finds" required></label>
        <label class="f"><span>Chinese name (optional)</span><input id="kZh" maxlength="30" value="${esc(c.zh)}" placeholder="e.g. 珍稀"></label>
      </div>
      <label class="f"><span>Short line (optional)</span><input id="kBlurb" maxlength="160" value="${esc(c.blurb)}" placeholder="e.g. Stones you rarely see, one piece each"></label>
      <label class="f"><span>Pieces in this collection</span><select id="kScope">${[...SCOPES, ["price", "Price range"]].map(([v, l]) => `<option value="${v}"${c.scope === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <div id="kPick"></div>
      <div class="grid-f">
        <label class="f"><span>Only pieces up to (RM, optional)</span><input id="kMax" inputmode="decimal" value="${+c.max_price || ""}" placeholder="Any price"></label>
        <label class="f"><span>Order on the page</span><input id="kSort" inputmode="numeric" value="${+c.sort || 0}"></label>
      </div>
      <div class="f"><span>Cover photo</span>
        <div class="kcov"><span class="kcov-img"><img id="kCovImg" alt="" hidden><em id="kCovNone">No photo uploaded</em></span>
          <span class="kcov-b"><label class="btn sm">Upload photo<input type="file" id="kCovFile" accept="image/*" hidden></label><button type="button" class="link danger" id="kCovDel" hidden>Remove photo</button>
          <small>Shown on the shop's collection tile instead of a product picture. A tall (portrait) photo works best.</small></span></div></div>
      <label class="f" id="kCoverF"><span>Or use a product picture</span><select id="kCover"></select></label>
      <div class="toggles"><label><input type="checkbox" id="kOn"${c.active ? " checked" : ""}> Show in the shop</label></div>
      <p class="m-sum" id="kSum"></p>
      <p class="err" id="kErr" hidden></p>
      <div class="ed-f"><button class="btn" type="submit">${isNew ? "Create collection" : "Save changes"}</button>${isNew ? "" : '<button type="button" class="link danger" id="kDel">Delete collection</button>'}</div>
    </form>`;
    let pendingCover = null, coverV = +c.cover_v || 0;
    const paintCover = () => {
      const src = pendingCover || (coverV ? `/img/coll-${c.id}.jpg?v=${coverV}` : "");
      $("#kCovImg").hidden = !src; if (src) $("#kCovImg").src = src;
      $("#kCovNone").hidden = !!src; $("#kCovDel").hidden = !src;
      $("#kCoverF").style.opacity = src ? ".55" : "";
    };
    $("#kCovFile").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { pendingCover = await shrink(f); paintCover(); toast(isNew ? "Photo ready. It uploads when you create the collection." : "Photo ready. Tap Save changes to use it."); }
      catch { toast("Couldn't read that photo. Please try another."); }
    };
    $("#kCovDel").onclick = () => { pendingCover = null; coverV = 0; c._removeCover = true; paintCover(); };
    paintCover();
    const scope = () => $("#kScope").value;
    const rule = () => scope() === "price" ? { scope: "price", targets: range.map((x) => String(+x || 0)), max_price: 0 } : { scope: scope(), targets: [...targets], max_price: +$("#kMax").value || 0 };
    const sum = () => {
      const items = inColl(rule());
      $("#kSum").textContent = `${items.length} piece${items.length === 1 ? "" : "s"} in stock will show in this collection.`;
      const cur = $("#kCover").value || c.cover;
      $("#kCover").innerHTML = `<option value="">Automatic (first piece with a photo)</option>` + items.map((i) => `<option value="${esc(i.id)}"${i.id === cur ? " selected" : ""}>${esc(`${i.stone} ${i.type}${i.size_mm ? ` · ${+i.size_mm} mm` : ""}${i.variant ? ` · ${i.variant}` : ""} (${i.id})${i.image_v ? " · photo" : ""}`)}</option>`).join("");
    };
    const pick = () => {
      const sc = scope();
      $("#kMax").closest("label").style.display = sc === "price" ? "none" : "";
      if (sc === "all") { $("#kPick").innerHTML = ""; return sum(); }
      if (sc === "price") {
        $("#kPick").innerHTML = `<div class="grid-f"><label class="f"><span>From (RM)</span><input id="kLo" inputmode="decimal" value="${+range[0] || ""}" placeholder="e.g. 500"></label><label class="f"><span>To (RM)</span><input id="kHi" inputmode="decimal" value="${+range[1] || ""}" placeholder="No limit"></label></div>`;
        $("#kLo").oninput = (e) => { range[0] = e.target.value; sum(); };
        $("#kHi").oninput = (e) => { range[1] = e.target.value; sum(); };
        return sum();
      }
      let opts;
      if (sc === "collection") opts = COLLECTIONS.map(([v, l]) => [v, l, D.items.filter((i) => collectionOf(i) === v).length]).filter((o) => o[2]);
      else if (sc === "stones") opts = D.stones.map((x) => [x.stone, x.stone, x.n]);
      else opts = D.items.filter((i) => !q || `${i.id} ${i.stone} ${i.variant} ${i.size_mm}`.toLowerCase().includes(q)).map((i) => [i.id, `${i.stone} ${i.type}${i.size_mm ? ` · ${+i.size_mm} mm` : ""}${i.variant ? ` · ${i.variant}` : ""}`, `${i.id} · ${RM(i.price)}`]);
      $("#kPick").innerHTML = `${sc === "items" ? `<input type="search" id="kQ" placeholder="Search ID, stone, size…" value="${esc(q)}">` : ""}
        <div class="pick-h"><small>${targets.size} chosen</small><span><button type="button" class="link" data-all>Select all${sc === "items" && q ? " shown" : ""}</button> · <button type="button" class="link" data-none>Clear</button></span></div>
        <div class="pick">${opts.map(([v, l, n]) => `<label><input type="checkbox" value="${esc(v)}"${targets.has(v) ? " checked" : ""}><span>${esc(l)}</span><small>${esc(n)}</small></label>`).join("")}</div>`;
      $("#kPick").querySelectorAll(".pick input").forEach((x) => (x.onchange = () => { x.checked ? targets.add(x.value) : targets.delete(x.value); $("#kPick .pick-h small").textContent = `${targets.size} chosen`; sum(); }));
      $("#kPick [data-all]").onclick = () => { opts.forEach(([v]) => targets.add(v)); pick(); };
      $("#kPick [data-none]").onclick = () => { targets.clear(); pick(); };
      if ($("#kQ")) $("#kQ").oninput = (e) => { q = e.target.value.toLowerCase(); pick(); $("#kQ").focus(); $("#kQ").setSelectionRange(q.length, q.length); };
      sum();
    };
    $("#kScope").onchange = () => { targets.clear(); q = ""; pick(); };
    $("#kMax").oninput = sum;
    pick();
    d.querySelector("[data-x]").onclick = () => d.close();
    $("#kForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { type: "collection", id: c.id, name: $("#kName").value, zh: $("#kZh").value, blurb: $("#kBlurb").value, ...rule(), cover: $("#kCover").value, sort: $("#kSort").value, active: $("#kOn").checked };
      try {
        await api("/api/admin/marketing", { method: "POST", body: JSON.stringify(body) });
        let id = c.id;
        if (!id && pendingCover) { const all = await api("/api/admin/marketing"); id = Math.max(...all.collections.filter((x) => x.name === body.name.trim()).map((x) => x.id)); }
        if (id && (pendingCover || c._removeCover)) await api("/api/admin/marketing", { method: "POST", body: JSON.stringify({ type: "collCover", id, data: pendingCover || "" }) });
        toast(isNew ? "Collection created. The shop updates within a minute." : "Saved"); d.close(); load();
      } catch (x) { $("#kErr").textContent = x.message; $("#kErr").hidden = false; }
    };
    if ($("#kDel")) $("#kDel").onclick = async () => {
      if ($("#kDel").dataset.sure !== "1") { $("#kDel").dataset.sure = "1"; $("#kDel").textContent = "Tap again to delete"; return; }
      try { await api(`/api/admin/marketing?type=collection&id=${c.id}`, { method: "DELETE" }); toast("Collection deleted"); d.close(); load(); } catch (x) { toast(x.message); }
    };
    d.showModal();
  }

  /* ---------- code editor ---------- */
  function openCode(c) {
    const isNew = !c;
    c = c || { code: "", kind: "percent", value: 10, min_spend: 0, starts_at: 0, ends_at: 0, max_uses: 0, exclude_sale: 0, active: 1, note: "", uses: 0 };
    const d = $("#mEdit");
    d.innerHTML = `<form class="ed" id="cForm">
      <div class="ed-h"><b>${isNew ? "New code" : esc(c.code)}</b><button type="button" class="link" data-x>Close</button></div>
      <label class="f"><span>Code customers type</span><input id="cCode" value="${esc(c.code)}" placeholder="e.g. QI10" autocapitalize="characters" maxlength="24" required${c.uses ? " readonly" : ""}></label>
      <div class="seg" role="radiogroup" aria-label="Discount type">${[["percent", "% off"], ["amount", "RM off"]].map(([k, l]) => `<label><input type="radio" name="cKind" value="${k}"${c.kind === k ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
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
    const k = e.target.closest("[data-coll]"); if (k) return openColl(D.collections.find((x) => String(x.id) === k.dataset.coll));
  });
  $("#mNewCode").onclick = () => openCode(null);
  $("#mNewSale").onclick = () => openSale(null);
  $("#mNewColl").onclick = () => openColl(null);
  $("#mRefresh").onclick = load;
  window.Marketing = { load };
})();
