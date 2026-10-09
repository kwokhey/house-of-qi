/* =========================================================
   HOUSE OF QI — Storefront script
   Header, footer, cart drawer, product rendering, checkout.
   Products come from /data/products.json (edit that file).
   ========================================================= */
(() => {
  const CART_KEY = "hoq_cart_v1";
  const state = { store: null, cart: loadCart() };

  /* ---------- Helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = (n) =>
    `${state.store?.currencySymbol || "RM"} ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {}
    renderCart();
  }
  async function loadStore() {
    if (state.store) return state.store;
    const res = await fetch("data/products.json", { cache: "no-cache" });
    state.store = await res.json();
    return state.store;
  }
  const product = (id) => state.store.products.find((p) => p.id === id);
  // Options can be plain strings ("Size 6") or { label, price } when sizes are priced differently
  const optLabel = (o) => (typeof o === "string" ? o : o.label);
  const priceOf = (p, option) => {
    const o = p.options.find((x) => optLabel(x) === option);
    return o && typeof o === "object" && o.price != null ? o.price : p.price;
  };
  const priceVaries = (p) => p.options.some((o) => typeof o === "object" && o.price !== p.price);
  const stoneOf = (p) => state.store.stones?.[p.stone];

  // Chakras, read from each stone's "Chakra" fact (e.g. "Crown & third eye", "All chakras")
  const CHAKRAS = [
    ["Root", "#B23A3A"], ["Sacral", "#E07A35"], ["Solar Plexus", "#E3B23C"], ["Heart", "#6BA36B"],
    ["Throat", "#4E93C2"], ["Third Eye", "#5A5FB0"], ["Crown", "#9B72C4"],
  ];
  function chakrasOf(p) {
    const raw = (stoneOf(p)?.facts?.Chakra || "").toLowerCase();
    if (!raw) return [];
    if (raw.includes("all")) return CHAKRAS.map((c) => c[0]);
    return CHAKRAS.map((c) => c[0]).filter((n) => raw.includes(n.toLowerCase()));
  }
  const waLink = (text) => state.store?.whatsapp
    ? `https://wa.me/${state.store.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";

  /* ---------- Layout: header / footer / drawer ---------- */
  const ICONS = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };

  function renderLayout() {
    const page = document.body.dataset.page || "";
    const link = (href, label, key) => `<a href="${href}" class="${page === key ? "active" : ""}">${label}</a>`;

    document.body.insertAdjacentHTML("afterbegin", `
      <div class="announce"><span id="announce-text">Jewellery with frequencies ✦ Complimentary shipping above RM 500</span></div>
      <header class="site-header">
        <div class="container header-inner">
          <div style="display:flex;align-items:center;gap:8px">
            <button class="icon-btn menu-toggle" aria-label="Menu">${ICONS.menu}</button>
            <nav class="nav">
              ${link("shop.html", "Shop All", "shop")}
              ${link("shop.html?c=Bracelets", "Bracelets", "")}
              ${link("shop.html?c=Pendants", "Pendants", "")}
              ${link("guide.html", "Crystal Guide", "guide")}
              ${link("about.html", "Our Story", "about")}
            </nav>
          </div>
          <a href="index.html" class="logo" aria-label="House of Qi home">
            <img class="logo-mark" src="assets/img/logo.png" alt="">
            <span class="logo-word">House of Qi</span>
          </a>
          <div class="header-actions">
            <button class="icon-btn" data-open-cart aria-label="Open bag">
              <span class="label">Bag</span>${ICONS.bag}<span class="cart-count">0</span>
            </button>
          </div>
        </div>
      </header>`);

    document.body.insertAdjacentHTML("beforeend", `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <a href="index.html" class="logo"><img class="logo-mark" src="assets/img/logo.png" alt=""><span class="logo-word">House of Qi</span></a>
              <p style="max-width:300px;margin-top:22px">Jewellery with frequencies. Natural crystals and gemstones, chosen with intention and made to be worn every day.</p>
            </div>
            <div><h4>Shop</h4><ul>
              <li><a href="shop.html?c=Bracelets">Crystal Bracelets</a></li><li><a href="shop.html?c=Pendants">Pendants</a></li>
              <li><a href="shop.html?c=Crystal%20Spheres">Crystal Spheres</a></li><li><a href="index.html#intentions">Shop by Intention</a></li><li><a href="guide.html">Crystal Guide</a></li>
            </ul></div>
            <div><h4>Client Care</h4><ul>
              <li><a href="policies.html#shipping">Shipping</a></li><li><a href="policies.html#returns">Returns &amp; Exchanges</a></li>
              <li><a href="policies.html#care">Crystal Care</a></li><li><a href="policies.html#privacy">Privacy</a></li>
            </ul></div>
            <div><h4>Connect</h4><ul>
              <li><a href="https://www.instagram.com/house_of_qi/" target="_blank" rel="noopener">Instagram</a></li>
              <li><a href="https://www.facebook.com/share/1CMpyxtrWB/" target="_blank" rel="noopener">Facebook</a></li>
              <li><a href="mailto:hello@houseofqi.com">hello@houseofqi.com</a></li>
            </ul></div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} House of Qi. All rights reserved.</span>
            <span>Secure payments by Stripe</span>
          </div>
        </div>
      </footer>
      <div class="overlay" data-close-cart></div>
      <aside class="drawer" aria-label="Shopping bag">
        <div class="drawer-head"><h2>Your Bag</h2><button class="icon-btn" data-close-cart aria-label="Close">${ICONS.close}</button></div>
        <div class="drawer-body"></div>
        <div class="drawer-foot"></div>
      </aside>
      <div class="toast"></div>`);

    $(".menu-toggle").addEventListener("click", () => $(".nav").classList.toggle("open"));
    $$("[data-open-cart]").forEach((b) => b.addEventListener("click", openCart));
    $$("[data-close-cart]").forEach((b) => b.addEventListener("click", closeCart));
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeCart());
  }

  function openCart() { $(".drawer").classList.add("open"); $(".overlay").classList.add("open"); }
  function closeCart() { $(".drawer").classList.remove("open"); $(".overlay").classList.remove("open"); }
  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- Cart ---------- */
  function addToCart(id, option = "", qty = 1) {
    const p = product(id);
    if (!p || p.soldOut) { toast("This piece has found its home"); return; }
    if (p.options.length && !option) option = optLabel(p.options[0]);
    const line = state.cart.find((l) => l.id === id && l.option === option);
    if (line) line.qty = Math.min(line.qty + qty, 10);
    else state.cart.push({ id, option, qty });
    saveCart();
    openCart();
  }

  function renderCart() {
    const count = state.cart.reduce((n, l) => n + l.qty, 0);
    $$(".cart-count").forEach((el) => (el.textContent = count));
    if (!state.store || !$(".drawer-body")) return;

    // drop lines whose product no longer exists
    state.cart = state.cart.filter((l) => product(l.id));
    const body = $(".drawer-body"), foot = $(".drawer-foot");

    if (!state.cart.length) {
      body.innerHTML = `<div class="empty"><p>Your bag is empty</p><a class="btn btn-ghost" href="shop.html">Discover the collection</a></div>`;
      foot.innerHTML = "";
      return;
    }

    const subtotal = state.cart.reduce((s, l) => s + priceOf(product(l.id), l.option) * l.qty, 0);
    const threshold = state.store.freeShippingThreshold;
    const remaining = Math.max(0, threshold - subtotal);

    body.innerHTML = state.cart.map((l, i) => {
      const p = product(l.id);
      return `<div class="cart-item">
        <img src="${esc(p.image)}" alt="${esc(p.name)}">
        <div>
          <h4>${esc(p.name)}</h4>
          <div class="variant">${l.option ? esc(l.option) : esc(p.collection)}</div>
          <div class="qty"><button data-dec="${i}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="Increase">+</button></div>
          <div><button class="remove" data-rm="${i}">Remove</button></div>
        </div>
        <div class="line-price">${money(priceOf(p, l.option) * l.qty)}</div>
      </div>`;
    }).join("");

    foot.innerHTML = `
      <div class="ship-note">${remaining > 0 ? `You are ${money(remaining)} away from complimentary shipping` : "Your order ships complimentary"}</div>
      <div class="ship-bar"><span style="width:${Math.min(100, (subtotal / threshold) * 100)}%"></span></div>
      <div class="subtotal"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <button class="btn btn-block" id="checkout-btn">Secure Checkout</button>
      <div class="secure">${ICONS.lock} Shipping calculated at checkout · Card, FPX &amp; e-wallets</div>
      <div class="checkout-error" hidden></div>`;

    $$("[data-inc]", body).forEach((b) => b.onclick = () => { const l = state.cart[b.dataset.inc]; l.qty = Math.min(l.qty + 1, 10); saveCart(); });
    $$("[data-dec]", body).forEach((b) => b.onclick = () => { const l = state.cart[b.dataset.dec]; l.qty--; if (l.qty < 1) state.cart.splice(b.dataset.dec, 1); saveCart(); });
    $$("[data-rm]", body).forEach((b) => b.onclick = () => { state.cart.splice(b.dataset.rm, 1); saveCart(); });
    $("#checkout-btn").onclick = () => checkout(state.cart, $("#checkout-btn"), $(".checkout-error"));
  }

  // items: the cart, or a single piece for "Buy now"
  async function checkout(items, btn, err) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing checkout…"; if (err) err.hidden = true;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout is unavailable right now.");
      window.location.href = data.url;
    } catch (e) {
      const msg = e.message.includes("Failed to fetch") || e.message.includes("JSON")
        ? "Checkout runs once the site is deployed online." : e.message;
      if (err) { err.textContent = msg; err.hidden = false; } else toast(msg);
      btn.disabled = false; btn.textContent = label;
    }
  }

  /* ---------- Product rendering ---------- */
  function card(p) {
    return `<article class="product-card reveal">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-media">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        ${p.soldOut ? `<span class="badge-soldout">Sold out</span>` : p.options.length ? "" : `<button class="btn quick-add" data-quick="${esc(p.id)}">Add to bag</button>`}
      </a>
      ${p.intention ? `<div><span class="intent-tag">${esc(p.intention)}</span></div>` : ""}
      <a href="product.html?id=${encodeURIComponent(p.id)}"><h3>${esc(p.name)}</h3></a>
      <div class="product-meta">${esc(p.material)}</div>
      <div class="price">${priceVaries(p) ? '<span class="from">From</span>' : ""}${money(Math.min(p.price, ...p.options.map((o) => priceOf(p, optLabel(o)))))}</div>
    </article>`;
  }
  function bindQuickAdd(root) {
    $$("[data-quick]", root).forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault(); addToCart(b.dataset.quick); toast("Added to your bag");
    }));
  }

  function initHome() {
    const grid = $("#featured-grid");
    if (!grid) return;
    grid.innerHTML = state.store.products.filter((p) => p.featured).slice(0, 4).map(card).join("");
    bindQuickAdd(grid);
    const row = $("#chakra-row");
    if (row) row.innerHTML = CHAKRAS.map(([n, c], i) => `<a class="chakra reveal" href="shop.html?ch=${encodeURIComponent(n)}">
      <span class="chakra-dot" style="--c:${c}"><span>${i + 1}</span></span><span class="chakra-name">${n}</span></a>`).join("");
  }

  function initShop() {
    const grid = $("#shop-grid");
    if (!grid) return;
    const cats = ["All", ...new Set(state.store.products.map((p) => p.collection))];
    const intents = ["All", ...Object.keys(state.store.intentions || {})];
    const qs = new URLSearchParams(location.search);
    let current = qs.get("c") || "All", intent = qs.get("i") || "All", chakra = qs.get("ch") || "All";
    const filters = $("#filters"), ifilters = $("#intent-filters"), cfilters = $("#chakra-filters");

    const draw = () => {
      const pill = (v, sel, key) => `<button class="filter ${v === sel ? "active" : ""}" data-${key}="${esc(v)}">${esc(v)}</button>`;
      filters.innerHTML = cats.map((c) => pill(c, current, "c")).join("");
      if (ifilters) ifilters.innerHTML = intents.map((c) => pill(c, intent, "i")).join("");
      $$("[data-c]", filters).forEach((b) => b.onclick = () => { current = b.dataset.c; update(); });
      if (ifilters) $$("[data-i]", ifilters).forEach((b) => b.onclick = () => { intent = b.dataset.i; update(); });
      if (cfilters) {
        cfilters.innerHTML = ["All", ...CHAKRAS.map((c) => c[0])].map((c) => pill(c, chakra, "ch")).join("");
        $$("[data-ch]", cfilters).forEach((b) => b.onclick = () => { chakra = b.dataset.ch; update(); });
      }
      const list = state.store.products.filter((p) =>
        (current === "All" || p.collection === current) && (intent === "All" || p.intention === intent) &&
        (chakra === "All" || chakrasOf(p).includes(chakra)));
      $("#shop-title").textContent = intent !== "All" ? `For ${intent}` : chakra !== "All" ? `${chakra} Chakra` : current === "All" ? "The Collection" : current;
      const sub = $("#shop-sub");
      if (sub) sub.textContent = intent !== "All" ? state.store.intentions[intent]
        : chakra !== "All" ? "Crystals traditionally associated with this energy centre"
        : "Natural crystals & gemstones, chosen with intention";
      if (!list.length) { grid.innerHTML = `<p class="muted" style="grid-column:1/-1;text-align:center">No pieces here yet — try another filter.</p>`; return; }
      grid.innerHTML = list.map(card).join("");
      bindQuickAdd(grid);
      observeReveal();
    };
    const update = () => {
      const q = new URLSearchParams();
      if (current !== "All") q.set("c", current);
      if (intent !== "All") q.set("i", intent);
      if (chakra !== "All") q.set("ch", chakra);
      history.replaceState(null, "", "shop.html" + (q.toString() ? "?" + q : ""));
      draw();
    };
    draw();
  }

  /* "About the stone" explanation, from the "stones" section of products.json */
  function stoneSection(p) {
    const s = state.store.stones?.[p.stone];
    if (!s) return "";
    const facts = Object.entries(s.facts || {}).map(([k, v]) =>
      `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    return `<section class="stone-about" id="stone">
      <div class="container">
        <div class="stone-head">
          <div>
            <span class="eyebrow">About the stone</span>
            <h2><span class="script">${esc(s.name)}</span>${s.chinese ? ` <span class="zh">${esc(s.chinese)}</span>` : ""}</h2>
            <div class="stone-title">${esc(s.title)}</div>
            <p class="stone-story">${esc(s.story)}</p>
            <div class="chips">${(s.keywords || []).map((k) => `<span>${esc(k)}</span>`).join("")}</div>
          </div>
          <dl class="facts">${facts}</dl>
        </div>
        ${s.forYou?.length ? `<div class="for-you"><h3>This stone is for you if you…</h3><ul>${s.forYou.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        <div class="stone-cols">
          <div class="stone-col"><div class="num">01</div><h3>How to wear</h3><p>${esc(s.wear)}</p></div>
          <div class="stone-col"><div class="num">02</div><h3>How to know it's real</h3><p>${esc(s.real)}</p></div>
          <div class="stone-col"><div class="num">03</div><h3>Caring for your stone</h3><p>Keep away from perfume, lotion and harsh chemicals, and remove before showering or swimming. Cleanse with moonlight or sound, and store in its pouch.</p></div>
        </div>
        <p class="stone-note">Crystal meanings are drawn from traditional and spiritual beliefs and are not a substitute for medical advice.</p>
      </div>
    </section>`;
  }

  function initProduct() {
    const root = $("#pdp");
    if (!root) return;
    const p = product(new URLSearchParams(location.search).get("id"));
    if (!p) {
      root.innerHTML = `<div class="center-page"><div><h1>Piece not found</h1><a class="btn" href="shop.html">Back to the collection</a></div></div>`;
      return;
    }
    document.title = `${p.name} — House of Qi`;
    let option = p.options.length ? optLabel(p.options[0]) : "", qty = 1;

    root.innerHTML = `<div class="container pdp-grid">
      <div class="pdp-media"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div class="pdp-info">
        <div class="breadcrumb"><a href="shop.html">Shop</a> / <a href="shop.html?c=${encodeURIComponent(p.collection)}">${esc(p.collection)}</a></div>
        <div class="eyebrow">${esc(p.collection)}${p.intention ? ` · ${esc(p.intention)}` : ""}</div>
        <h1>${esc(p.name)}</h1>
        <div class="pdp-price" id="pdp-price">${money(priceOf(p, option))}</div>
        <p class="pdp-desc">${esc(p.description)}</p>
        ${state.store.stones?.[p.stone] ? `<a href="#stone" class="stone-link">Discover the meaning of ${esc(state.store.stones[p.stone].name)} ↓</a>` : ""}
        ${p.options.length ? `<div class="option-label">Select size</div><div class="options">${p.options.map((o) =>
          `<button class="option ${optLabel(o) === option ? "selected" : ""}" data-o="${esc(optLabel(o))}">${esc(optLabel(o))}</button>`).join("")}</div>` : ""}
        ${p.soldOut ? `<div class="soldout-note">This piece has found its home. Similar stones arrive often — ask us to reserve the next one.</div>
        ${waLink(`Hi House of Qi! I'm interested in the ${p.name}. Do you have a similar piece?`) ? `<a class="btn btn-block" target="_blank" rel="noopener" href="${waLink(`Hi House of Qi! I'm interested in the ${p.name}. Do you have a similar piece?`)}">Enquire on WhatsApp</a>` : ""}` : `
        <div class="buy-row">
          <div class="qty"><button id="q-dec">−</button><span id="q-val">1</span><button id="q-inc">+</button></div>
          <button class="btn btn-ghost" id="add-btn">Add to bag</button>
          <button class="btn" id="buy-btn">Buy now</button>
        </div>
        <div class="checkout-error" id="buy-error" hidden></div>`}
        ${waLink("") && !p.soldOut ? `<a class="wa-ask" id="wa-ask" target="_blank" rel="noopener" href="#">Not sure which size or stone? Ask us on WhatsApp →</a>` : ""}
        <dl class="spec">
          ${stoneOf(p) ? `<div><dt>Stone</dt><dd>${esc(stoneOf(p).name)}${stoneOf(p).chinese ? ` · ${esc(stoneOf(p).chinese)}` : ""}</dd></div>` : ""}
          <div><dt>Material</dt><dd>${esc(p.material)}</dd></div>
          ${chakrasOf(p).length ? `<div><dt>Chakra</dt><dd>${esc(stoneOf(p).facts.Chakra)}</dd></div>` : ""}
          ${p.intention ? `<div><dt>Intention</dt><dd>${esc(p.intention)}</dd></div>` : ""}
          <div><dt>Each piece</dt><dd>Natural &amp; one of a kind</dd></div>
        </dl>
        <div class="details">
          <details><summary>Natural Crystals</summary><p>Every stone is natural, so colour, clarity and inclusions vary slightly from piece to piece — that's how you know it's real. The piece you receive is unique.</p></details>
          <details><summary>Shipping &amp; Returns</summary><p>Complimentary shipping on orders above ${money(state.store.freeShippingThreshold)}. Dispatched within 2–3 working days, gift-ready. See our <a href="policies.html#returns" style="text-decoration:underline">returns policy</a>.</p></details>
          <details><summary>Crystal Care</summary><p>Remove before showering, swimming or exercise, and keep away from perfume and chemicals. Store separately in the pouch provided. Many cleanse their crystals under moonlight or with sound — avoid direct sunlight for rose quartz and amethyst, as strong sun can fade their colour.</p></details>
        </div>
      </div>
    </div>${stoneSection(p)}
    ${p.soldOut ? "" : `<div class="sticky-buy"><div><strong>${esc(p.name)}</strong><span id="sticky-price">${money(priceOf(p, option))}</span></div><button class="btn" id="sticky-add">Add to bag</button></div>`}`;

    $$(".option", root).forEach((b) => b.onclick = () => {
      option = b.dataset.o; $$(".option", root).forEach((x) => x.classList.toggle("selected", x === b));
      $("#pdp-price").textContent = money(priceOf(p, option));
      if ($("#sticky-price")) $("#sticky-price").textContent = money(priceOf(p, option));
      setWa();
    });
    const setWa = () => {
      const a = $("#wa-ask");
      if (a) a.href = waLink(`Hi House of Qi! I'd like to ask about the ${p.name}${option ? ` (${option})` : ""}.`);
    };
    setWa();
    if (!p.soldOut) {
      $("#q-dec").onclick = () => { qty = Math.max(1, qty - 1); $("#q-val").textContent = qty; };
      $("#q-inc").onclick = () => { qty = Math.min(10, qty + 1); $("#q-val").textContent = qty; };
      $("#add-btn").onclick = () => addToCart(p.id, option, qty);
      $("#sticky-add").onclick = () => addToCart(p.id, option, qty);
      $("#buy-btn").onclick = () => checkout([{ id: p.id, option, qty }], $("#buy-btn"), $("#buy-error"));
      // show the sticky bar once the main buttons scroll out of view
      const bar = $(".sticky-buy");
      new IntersectionObserver(([e]) => bar.classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0))
        .observe($(".buy-row"));
    }

    const more = $("#more-grid");
    if (more) {
      more.innerHTML = state.store.products.filter((x) => x.id !== p.id).slice(0, 4).map(card).join("");
      bindQuickAdd(more);
    }
  }

  /* Crystal Guide: every stone in products.json, linked to its pieces */
  function initGuide() {
    const root = $("#guide");
    if (!root) return;
    const stones = Object.entries(state.store.stones || {});
    $("#guide-index").innerHTML = stones.map(([id, s]) => `<a href="#${id}">${esc(s.name)}</a>`).join("");
    root.innerHTML = stones.map(([id, s]) => {
      const pieces = state.store.products.filter((p) => p.stone === id);
      return `<article class="guide-item reveal" id="${id}">
        <div class="guide-media">${pieces[0] ? `<img src="${esc(pieces[0].image)}" alt="${esc(s.name)}" loading="lazy">` : ""}</div>
        <div>
          <div class="stone-title">${esc(s.title)}</div>
          <h2><span class="script">${esc(s.name)}</span>${s.chinese ? ` <span class="zh">${esc(s.chinese)}</span>` : ""}</h2>
          <p>${esc(s.story)}</p>
          <div class="chips">${(s.keywords || []).map((k) => `<span>${esc(k)}</span>`).join("")}</div>
          <dl class="spec">${Object.entries(s.facts || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
          ${pieces.length ? `<div class="guide-shop">${pieces.map((p) => `<a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)} →</a>`).join("")}</div>` : ""}
        </div>
      </article>`;
    }).join("");
  }

  function initExtras() {
    // Rotating announcement bar
    const msgs = state.store.announcements || [];
    const el = $("#announce-text");
    if (el && msgs.length) {
      let i = 0; el.textContent = msgs[0];
      if (msgs.length > 1) setInterval(() => {
        el.classList.add("fade");
        setTimeout(() => { i = (i + 1) % msgs.length; el.textContent = msgs[i]; el.classList.remove("fade"); }, 400);
      }, 4500);
    }
    // Floating WhatsApp button (only when a number is set in products.json)
    const wa = waLink("Hi House of Qi! I'd like to ask about your crystals.");
    if (wa) document.body.insertAdjacentHTML("beforeend",
      `<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-1-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7a.6.6 0 0 0 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8 1 3.9.8a3.3 3.3 0 0 0 2.1-1.5 2.7 2.7 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.5Z"/></svg></a>`);
  }

  function initSuccess() {
    if (document.body.dataset.page === "success") { state.cart = []; saveCart(); }
  }

  /* ---------- Reveal on scroll ---------- */
  let io;
  function observeReveal() {
    io ||= new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    renderLayout();
    renderCart();
    try {
      await loadStore();
      initSuccess(); initHome(); initShop(); initProduct(); initGuide(); initExtras();
      renderCart();
    } catch (e) {
      console.error("Could not load products", e);
    }
    observeReveal();
    const nl = $("#newsletter");
    if (nl) nl.addEventListener("submit", (e) => { e.preventDefault(); nl.reset(); toast("Thank you — welcome to the House"); });
  });
})();
