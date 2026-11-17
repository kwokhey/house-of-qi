/** GET /sitemap.xml  Every page search engines should know about: home, policies and each piece */
import { buildCatalog } from "./_lib/catalog.js";
import { SITE } from "./_lib/seo.js";

export async function onRequestGet({ request, env }) {
  let cat = null;
  try { cat = await buildCatalog(env, new URL(request.url).origin); } catch {}
  const day = new Date().toISOString().slice(0, 10);
  const urls = [[SITE + "/", "daily", "1.0"], [SITE + "/policies", "monthly", "0.4"]]
    .concat((cat ? cat.products : []).map((p) => [`${SITE}/p/${encodeURIComponent(p.id)}`, "weekly", p.soldOut ? "0.3" : "0.7"]));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, f, pr]) =>
    `  <url><loc>${u.replace(/&/g, "&amp;")}</loc><lastmod>${day}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
