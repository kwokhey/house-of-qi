/**
 * GET /p/<item id> — share link for one product (used by the Share button).
 * Serves the normal shop page with the product's name, price and photo in the
 * link preview (WhatsApp, Instagram, Facebook), and opens that product.
 */
import { buildCatalog } from "../_lib/catalog.js";
import { db, hasDB } from "../_lib/db.js";

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
  try { const cat = await buildCatalog(env, url.origin); p = cat.products.find((x) => x.id === id) || null; } catch {}
  if (p) {
    const RM = (n) => "RM" + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const title = `${p.name}${p.details ? ` · ${p.details}` : ""} · ${RM(p.price)}`;
    const desc = (p.description || "Natural crystal jewellery from House of Qi.").slice(0, 180);
    const image = new URL(await previewPath(env, url, p), url.origin).toString();
    html = html
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`)
      .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(url.toString())}"><meta name="twitter:card" content="summary_large_image">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.name)} · House of Qi</title>`);
  }
  html = html.replace("</head>", `<script>window.OPEN_P=${JSON.stringify(id)}</script></head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
