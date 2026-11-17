/**
 * GET /p/<item id> — share link for one product (used by the Share button).
 * Serves the normal shop page with the product's name, price and photo in the
 * link preview (WhatsApp, Instagram, Facebook), and opens that product.
 */
import { buildCatalog } from "../_lib/catalog.js";
import { db, hasDB } from "../_lib/db.js";
import { SITE, BRAND, esc as e2, RM as rm, ld, productLd, productDesc, setHead, ssr, putSsr } from "../_lib/seo.js";

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
    html = setHead(html, {
      title: `${p.name}${p.details ? ` · ${p.details}` : ""} · ${rm(p.price)} | ${BRAND}`,
      description: desc.slice(0, 170), canonical, image, type: "product",
      extra: `<meta property="product:price:amount" content="${Number(p.price).toFixed(2)}"><meta property="product:price:currency" content="MYR">` + ld(productLd(p, image)),
    });
    html = putSsr(html, ssr(`<nav><a href="/">${BRAND}</a>${p.collectionName ? " › " + e2(p.collectionName) : ""}</nav>
      <h1>${e2(p.name)}</h1>${p.details ? `<p>${e2(p.details)}</p>` : ""}<p><strong>${rm(p.price)}</strong> · ${p.soldOut ? "Sold out" : "In stock"} · Item ${e2(p.id)}</p>
      <img src="${e2(image)}" alt="${e2(p.name)}" width="600" height="600"><p>${e2(desc)}</p>
      <p>Natural gemstones may vary in colour, clarity and patterns. Delivery across Malaysia; see <a href="/policies">shipping &amp; returns</a>.</p>`));
  } else {
    html = html.replace("</head>", '<meta name="robots" content="noindex"></head>');
  }
  html = html.replace("</head>", `<script>window.OPEN_P=${JSON.stringify(id)}</script></head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
