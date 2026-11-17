/**
 * Crawlable guide pages: /crystals (all stones), /crystals/<stone>, and /bracelets, /pendants, /rings.
 * Plain HTML (no shop script needed) so search engines and AI assistants read the same page people see.
 * Each piece links to /p/<id>, which opens it in the shop.
 */
import { SITE, BRAND, COMPANY, esc, RM, abs, ld, faqLd } from "./seo.js";
import { stoneInfo, stoneParagraph, slug, stoneKey, list } from "./stones.js";

export const CATS = {
  bracelets: { name: "Bracelets", title: "Natural Crystal Bracelets in Malaysia", match: (p) => p.collection === "bracelets" || /bracelet/i.test(p.name),
    intro: "Natural crystal bead bracelets, strung on durable elastic and sorted by stone and bead size. Each bracelet is made with natural gemstones, cleansed before dispatch and delivered across Malaysia." },
  pendants: { name: "Pendants", title: "Natural Crystal Pendants & Necklaces in Malaysia", match: (p) => p.collection === "pendants" || /pendant|necklace/i.test(p.name),
    intro: "Natural crystal pendants and necklaces, each one chosen by hand for its colour and character, and delivered across Malaysia." },
  rings: { name: "Rings", title: "Natural Crystal & Gemstone Rings in Malaysia", match: (p) => p.collection === "rings" || /\bring\b/i.test(p.name),
    intro: "Natural crystal and gemstone rings, chosen by hand and delivered across Malaysia." },
};

const img = (p) => (p.image ? abs(p.image) : p._og ? abs(`/assets/img/og/${encodeURIComponent(p.id)}.jpg`) : abs("/assets/img/logo-mark.png"));

/** Load the catalogue and mark which pieces have a pre-made preview picture */
export async function loadCat(env, url, buildCatalog) {
  const cat = await buildCatalog(env, url.origin);
  try {
    const og = new Set(await (await env.ASSETS.fetch(new URL("/assets/img/og/index.json", url).toString())).json());
    for (const p of cat.products || []) p._og = og.has(p.id);
  } catch {}
  return cat;
}
const pUrl = (p) => `${SITE}/p/${encodeURIComponent(p.id)}`;

/** All stones on sale (with at least one piece), most pieces first */
export function stonesOf(cat) {
  const m = new Map();
  for (const p of (cat && cat.products) || []) {
    if (!p.stone) continue;
    const k = stoneKey(p.stone);
    if (!m.has(k)) m.set(k, { stone: p.stone, pieces: [] });
    m.get(k).pieces.push(p);
  }
  return [...m.values()].sort((a, b) => b.pieces.length - a.pieces.length || a.stone.localeCompare(b.stone));
}

function cards(pieces) {
  return `<ul class="g-grid">${pieces.map((p) => `<li><a href="/p/${encodeURIComponent(p.id)}">
    <img src="${esc(img(p).replace(SITE, ""))}"${!p.image && !p._og ? ` data-art="${esc(JSON.stringify([p.id, p.art || {}]))}"` : ""} alt="${esc(p.name + (p.details ? ", " + p.details : ""))}" loading="lazy" width="300" height="300" onerror="this.src='/assets/img/logo-mark.png'">
    <b>${esc(p.name)}</b>${p.details ? `<span>${esc(p.details)}</span>` : ""}<i>${RM(p.price)}${p.soldOut ? " · Sold out" : ""}</i></a></li>`).join("")}</ul>`;
}

function itemList(name, pieces) {
  return { "@context": "https://schema.org", "@type": "ItemList", name, numberOfItems: pieces.length,
    itemListElement: pieces.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: pUrl(p), name: p.name })) };
}
const crumbs = (trail) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + path })) });

function page({ title, description, path, h1, body, schema = [], image, noindex = false }) {
  const canonical = SITE + path;
  return `<!doctype html>
<html lang="en-MY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${noindex ? '\n<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:locale" content="en_MY">
<meta property="og:image" content="${esc(image || abs("/assets/img/logo.png"))}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F0E0D3">
<link rel="icon" href="/assets/img/favicon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/css/page.css?v=2">
<style>
.wrap{max-width:980px}.lede{font-size:17px;color:var(--ink-2)}
.g-grid{list-style:none;padding:0;margin:18px 0 8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.g-grid a{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:var(--ink);background:var(--card);border-radius:14px;padding:10px;height:100%}
.g-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#E7D1C2;margin-bottom:6px}
.g-grid b{font-weight:500;font-size:14px}.g-grid span{font-size:12.5px;color:var(--ink-2)}.g-grid i{font-style:normal;font-size:13px;color:var(--gold-deep);margin-top:auto}
.facts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;padding:0;list-style:none}.facts li{background:var(--card);border-radius:99px;padding:5px 12px;font-size:13px}
.tags{columns:3 180px;padding:0;list-style:none}.tags li{margin:0 0 6px}.crumb{font-size:13px;color:var(--ink-3)}.crumb a{color:inherit}
.cta{display:inline-block;background:var(--ink);color:#fff;text-decoration:none;border-radius:99px;padding:10px 20px;margin:8px 0 18px}
details{border-top:1px solid var(--line);padding:10px 0}summary{cursor:pointer;font-weight:500}
.note{font-size:13px;color:var(--ink-3)}
</style>
${schema.map(ld).join("\n")}
</head>
<body>
<div class="wrap">
  <header><a class="brand" href="/"><span class="mark" aria-hidden="true"></span><b>${BRAND}</b></a><a class="back" href="/">Shop all crystals</a></header>
  <main>
  <h1>${esc(h1)}</h1>
  ${body}
  <nav aria-label="More from House of Qi"><p><a href="/crystals">Crystal meanings A–Z</a> · <a href="/bracelets">Bracelets</a> · <a href="/pendants">Pendants</a> · <a href="/rings">Rings</a> · <a href="/policies">Shipping, returns &amp; care</a></p></nav>
  <p class="note">Natural gemstones vary in colour, clarity and pattern, so each piece is unique. Crystal meanings describe traditional and spiritual beliefs and are not medical advice.</p>
  </main>
  <script src="/assets/js/art.js?v=30"></script>
  <script>try{document.querySelectorAll('img[data-art]').forEach(function(i){var a=JSON.parse(i.dataset.art);i.src=ART.get(a[0],'sq',a[1])})}catch(e){}</script>
  <footer>${BRAND} · Crystals<br>by ${esc(COMPANY).replace("Sdn. Bhd.", "Sdn.&nbsp;Bhd.")}<br>202201006345 (1452042-H)</footer>
</div>
</body>
</html>`;
}

const qa = (list) => list.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");

/** /crystals/<slug> */
export function stonePage(cat, s) {
  const info = stoneInfo(s.stone, cat, s.pieces);
  const name = s.stone.replace(/\s*\(.*?\)/, "");
  const types = [...new Set(s.pieces.map((p) => (/pendant|necklace/i.test(p.name) ? "pendants" : /\bring\b/i.test(p.name) ? "rings" : "bracelets")))];
  const typeWords = list(types.map((t) => t));
  const inStock = s.pieces.filter((p) => !p.soldOut);
  const prices = inStock.map((p) => +p.price).filter((n) => n > 0);
  const sizes = [...new Set(s.pieces.map((p) => p.size).filter(Boolean))].sort((a, b) => a - b);
  const para = stoneParagraph(info);
  const meaningQ = info.belief || info.chakras.length || info.intentions.length;
  const Q = [
    ...(meaningQ ? [[`What is ${name} good for?`, [info.meaning, info.intentions.length ? `House of Qi lists it under ${list(info.intentions.map((x) => x.toLowerCase()))}.` : "", "These are traditional and spiritual beliefs, not medical claims."].filter(Boolean).join(" ")]] : []),
    ...(info.chakras.length ? [[`Which chakra is ${name} for?`, `${name} is associated with the ${list(info.chakras)} chakra${info.chakras.length > 1 ? "s" : ""}.`]] : []),
    ...(info.months.length ? [[`Is ${name} a birthstone?`, `${name} is a birthstone or birth-month crystal for ${list(info.months)} in the House of Qi birthstone guide.`]] : []),
    [`How much is ${/^[aeiou]/i.test(name) ? "an" : "a"} ${name} ${types[0].replace(/s$/, "")} in Malaysia?`, prices.length ? `At House of Qi, ${name} ${typeWords} cost from ${RM(Math.min(...prices))}${prices.length > 1 ? ` to ${RM(Math.max(...prices))}` : ""}, depending on bead size and quality. Delivery within West Malaysia is RM10 and East Malaysia RM20.` : `${name} pieces at House of Qi are currently sold out. Message House of Qi on WhatsApp to ask about new stock.`],
    [`How do I care for ${name}?`, "Take it off before showering, swimming or exercise and keep it away from perfume and chemicals. Store it separately so harder stones do not scratch it, and cleanse it with moonlight, sound or a selenite plate rather than long hours in strong sunlight, which can fade some coloured stones."],
  ];
  const path = `/crystals/${info.slug}`;
  const title = `${name} ${cap(typeWords)} · Meaning & Price in Malaysia | ${BRAND}`;
  const description = `${info.about ? info.about.split(". ")[0].replace(/\.$/, "") + ". " : ""}Shop ${s.pieces.length} natural ${name.toLowerCase()} ${typeWords}${prices.length ? ` from ${RM(Math.min(...prices))}` : ""} with delivery across Malaysia.`.slice(0, 300);
  const facts = [
    sizes.length ? `Bead sizes: ${sizes.join(", ")} mm` : "",
    prices.length ? `From ${RM(Math.min(...prices))}` : "Sold out",
    `${inStock.length} in stock`,
    ...info.chakras.map((c) => `${c} chakra`),
    ...info.months.map((m) => `${m} birthstone`),
  ].filter(Boolean);
  const body = `<p class="crumb"><a href="/">${BRAND}</a> › <a href="/crystals">Crystals A–Z</a> › ${esc(name)}</p>
  ${para ? `<p class="lede">${esc(para)}</p>` : `<p class="lede">Natural ${esc(name.toLowerCase())} ${typeWords}, chosen by hand and delivered across Malaysia.</p>`}
  <ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  <h2>Shop ${esc(name)} ${typeWords}</h2>
  ${cards(s.pieces)}
  <h2>${esc(name)}: questions &amp; answers</h2>${qa(Q)}`;
  return page({ title, description, path, h1: `${name} ${cap(typeWords)}`, body, image: s.pieces[0] && img(s.pieces[0]), schema: [
    { "@context": "https://schema.org", "@type": "CollectionPage", name: `${name} ${typeWords}`, url: SITE + path, description, isPartOf: { "@id": SITE + "/#website" },
      about: { "@type": "Thing", name, description: [info.about, info.belief].filter(Boolean).join(" ") || undefined } },
    itemList(`${name} at ${BRAND}`, s.pieces), faqLd(Q),
    crumbs([[BRAND, "/"], ["Crystals A–Z", "/crystals"], [name, path]]),
  ] });
}

/** /crystals */
export function stonesIndex(cat) {
  const all = stonesOf(cat);
  const rows = all.map((s) => {
    const info = stoneInfo(s.stone, cat, s.pieces);
    return `<li><a href="/crystals/${info.slug}">${esc(s.stone)}</a> <span class="note">· ${s.pieces.length} piece${s.pieces.length > 1 ? "s" : ""}${info.belief ? " · " + esc(info.belief.split(/[,.]/)[0].replace(/^It is (traditionally )?(known as |associated with |linked to |worn for )?/i, "").toLowerCase()) : ""}</span></li>`;
  }).join("");
  const chak = ((cat && cat.chakras) || []).map((c) => `<li><b>${esc(c.name)}</b> (${esc(c.sk || "")}) · ${esc(c.theme || "")}</li>`).join("");
  const body = `<p class="lede">A guide to every natural crystal we sell at ${BRAND}: what each stone is, what it is traditionally believed to support, its chakra and birth month, and the bracelets, pendants and rings available in Malaysia right now.</p>
  <h2>Crystals A–Z</h2><ul class="tags">${rows}</ul>
  ${chak ? `<h2>Crystals by chakra</h2><ul>${chak}</ul>` : ""}`;
  return page({ title: `Crystal Meanings A–Z · Natural Crystals in Malaysia | ${BRAND}`,
    description: `Meanings, chakras and birth months for ${all.length} natural crystals, with bracelets, pendants and rings for sale in Malaysia at ${BRAND}.`,
    path: "/crystals", h1: "Crystal meanings A–Z", body, schema: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "Crystal meanings A–Z", url: SITE + "/crystals", isPartOf: { "@id": SITE + "/#website" } },
      { "@context": "https://schema.org", "@type": "ItemList", name: "Crystals at House of Qi", itemListElement: all.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.stone, url: `${SITE}/crystals/${slug(s.stone)}` })) },
      crumbs([[BRAND, "/"], ["Crystals A–Z", "/crystals"]]),
    ] });
}

/** /bracelets, /pendants, /rings */
export function categoryPage(cat, key) {
  const c = CATS[key];
  const pieces = ((cat && cat.products) || []).filter(c.match);
  const prices = pieces.filter((p) => !p.soldOut).map((p) => +p.price);
  const stones = stonesOf({ products: pieces });
  const sizes = [...new Set(pieces.map((p) => p.size).filter(Boolean))].sort((a, b) => a - b);
  const body = `<p class="crumb"><a href="/">${BRAND}</a> › ${c.name}</p>
  <p class="lede">${esc(c.intro)}${prices.length ? ` ${pieces.length} pieces from ${RM(Math.min(...prices))} to ${RM(Math.max(...prices))}.` : ""}</p>
  ${stones.length > 1 ? `<h2>Shop by stone</h2><ul class="tags">${stones.map((s) => `<li><a href="/crystals/${slug(s.stone)}">${esc(s.stone)}</a> <span class="note">(${s.pieces.length})</span></li>`).join("")}</ul>` : ""}
  ${key === "bracelets" && sizes.length ? `<h2>Choosing a bead size</h2><p>Bead size is the width of each bead. 4–6 mm beads are delicate and easy to stack, 8 mm is the classic everyday size, and 10–14 mm beads make a bolder statement. We currently have ${sizes.join(", ")} mm.</p>` : ""}
  <h2>All ${c.name.toLowerCase()}</h2>${pieces.length ? cards(pieces) : "<p>New pieces are coming soon.</p>"}`;
  return page({ title: `${c.title} | ${BRAND}`, description: c.intro.replace(/^(.{0,158}\.).*$/, "$1"), path: "/" + key, h1: c.title, body, noindex: !pieces.length,
    image: pieces[0] && img(pieces[0]), schema: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: c.title, url: SITE + "/" + key, isPartOf: { "@id": SITE + "/#website" } },
      itemList(c.title, pieces), crumbs([[BRAND, "/"], [c.name, "/" + key]]),
    ] });
}

const cap = (s) => s.replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
export const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
