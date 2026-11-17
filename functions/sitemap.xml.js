/** GET /sitemap.xml  Every page search engines should know about: home, policies and each piece */
import { buildCatalog } from "./_lib/catalog.js";
import { SITE } from "./_lib/seo.js";
import { stonesOf, CATS } from "./_lib/guide.js";
import { slug } from "./_lib/stones.js";

export async function onRequestGet({ request, env }) {
  let cat = null;
  try { cat = await buildCatalog(env, new URL(request.url).origin); } catch {}
  const day = new Date().toISOString().slice(0, 10);
  const urls = [[SITE + "/", "daily", "1.0"], [SITE + "/policies", "monthly", "0.4"], [SITE + "/crystals", "weekly", "0.8"],
    ...Object.entries(CATS).filter(([, c]) => (cat ? cat.products : []).some(c.match)).map(([k]) => [`${SITE}/${k}`, "daily", "0.8"])]
    .concat(stonesOf(cat).map((s) => [`${SITE}/crystals/${slug(s.stone)}`, "weekly", "0.8"]))
    .concat((cat ? cat.products : []).map((p) => [`${SITE}/p/${encodeURIComponent(p.id)}`, "weekly", p.soldOut ? "0.3" : "0.7"]));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, f, pr]) =>
    `  <url><loc>${u.replace(/&/g, "&amp;")}</loc><lastmod>${day}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
