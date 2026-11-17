/**
 * GET /p/<item id> — share link for one product (used by the Share button).
 * Serves the normal shop page with the product's name, price and photo in the
 * link preview (WhatsApp, Instagram, Facebook), and opens that product.
 */
import { buildCatalog } from "../_lib/catalog.js";
import { db, hasDB } from "../_lib/db.js";
import { SITE, BRAND, esc as e2, RM as rm, ld, productLd, productDesc, seoName, setHead, ssr, putSsr } from "../_lib/seo.js";
import { stoneInfo, stoneParagraph } from "../_lib/stones.js";

/** Photo for the link preview: real/sample photo → saved drawing → pre-made drawing → logo */
async function previewPath(env, url, p) {
  if (p.image) return "/" + p.image.replace(/^\//, "");
  try {
    if (hasDB(env)) {
      const D = await db(env);
      const r = await D.prepare("SELECT updated_at FROM images WHERE item_id = ?").bind("prev-" + p.id).first();
      if (r) return `/img/prev-${encodeURIComponent(p.id)}.jpg?v=${r.updated_at}`;
    }
  } catch {}
  try {
    const list = await (await env.ASSETS.fetch(new URL("/assets/img/og/index.json", url).toString())).json();
    if (list.includes(p.id)) return `/assets/img/og/${encodeURIComponent(p.id)}.jpg`;
  } catch {}
  return "/assets/img/logo.png";
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const id = decodeURIComponent(String(params.id || "")).slice(0, 60);
  const page = await env.ASSETS.fetch(new URL("/", url).toString());
  let html = await page.text();
  let p = null;
  let cat = null;
  try { cat = await buildCatalog(env, url.origin); p = cat.products.find((x) => x.id === id) || null; } catch {}
  if (p) {
    const coll = (cat && (cat.collections || []).find((c) => c.id === p.collection)) || null;
    p.collectionName = coll ? coll.name : "";
    const image = new URL(await previewPath(env, url, p), SITE).toString();
    const canonical = `${SITE}/p/${encodeURIComponent(p.id)}`;
    const desc = productDesc(p);
    const info = p.stone ? stoneInfo(p.stone, cat, cat.products.filter((x) => x.stone === p.stone)) : null;
    const about = info ? stoneParagraph(info) : "";
    const sName = p.stone ? p.stone.replace(/\s*\(.*?\)/, "") : "";
    const nice = seoName(p);
    html = setHead(html, {
      title: `${nice} · ${rm(p.price)} | ${BRAND} Malaysia`,
      description: `${nice}${p.details && p.details !== `${p.size} mm` ? ` (${p.details.replace(/\s*·?\s*\d+(\.\d+)? mm$/, "")})` : ""} for ${rm(p.price)}. ${info && info.belief ? info.belief + " " : ""}Cleansed before dispatch, delivery across Malaysia.`.slice(0, 200),
      canonical, image, type: "product",
      extra: `<meta property="product:price:amount" content="${Number(p.price).toFixed(2)}"><meta property="product:price:currency" content="MYR">` +
        ld(productLd(p, image, { description: [desc, about].filter(Boolean).join(" ").slice(0, 1000), crumb: info ? [sName, "/crystals/" + info.slug] : null })),
    });
    html = putSsr(html, ssr(`<nav><a href="/">${BRAND}</a>${info ? ` › <a href="/crystals/${info.slug}">${e2(sName)}</a>` : p.collectionName ? " › " + e2(p.collectionName) : ""}</nav>
      <h1>${e2(nice)}</h1>${p.details ? `<p>${e2(p.details)}</p>` : ""}<p><strong>${rm(p.price)}</strong> · ${p.soldOut ? "Sold out" : "In stock"} · Item ${e2(p.id)}</p>
      <img src="${e2(image)}" alt="${e2(p.name)}" width="600" height="600"><p>${e2(desc)}</p>
      ${about ? `<h2>About ${e2(sName)}</h2><p>${e2(about)}</p><p><a href="/crystals/${info.slug}">More ${e2(sName)} pieces and meaning</a></p>` : ""}
      <p>Natural gemstones may vary in colour, clarity and patterns. Dispatched in 1–2 working days; delivery RM10 West Malaysia, RM20 East Malaysia; 14-day returns. See <a href="/policies">shipping &amp; returns</a>.</p>`));
  } else {
    html = html.replace("</head>", '<meta name="robots" content="noindex"></head>');
  }
  html = html.replace("</head>", `<script>window.OPEN_P=${JSON.stringify(id)}</script></head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
