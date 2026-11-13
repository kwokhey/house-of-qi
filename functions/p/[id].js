/**
 * GET /p/<item id> — share link for one product (used by the Share button).
 * Serves the normal shop page with the product's name, price and photo in the
 * link preview (WhatsApp, Instagram, Facebook), and opens that product.
 */
import { buildCatalog } from "../_lib/catalog.js";

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
    const image = p.image ? new URL("/" + p.image.replace(/^\//, ""), url.origin).toString() : new URL("/assets/img/logo.png", url.origin).toString();
    html = html
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`)
      .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(url.toString())}"><meta name="twitter:card" content="summary_large_image">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.name)} · House of Qi</title>`);
  }
  html = html.replace("</head>", `<script>window.OPEN_P=${JSON.stringify(id)}</script></head>`);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
