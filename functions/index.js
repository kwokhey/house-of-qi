/**
 * GET /  The shop home page, with a plain-HTML copy of the shop (sections, every piece
 * with its price, and answers to common questions) and structured data, so search
 * engines and AI assistants can read it without running the shop script.
 */
import { buildCatalog } from "./_lib/catalog.js";
import { SITE, BRAND, esc, RM, abs, ld, faqs, orgLd, faqLd, grouped, setHead, ssr, putSsr } from "./_lib/seo.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL("/", url).toString());
  let html = await page.text();
  let cat = null;
  try { cat = await buildCatalog(env, url.origin); } catch {}
  const Q = faqs(cat);
  const n = cat ? cat.products.length : 0;
  html = setHead(html, {
    title: "House of Qi · Natural Crystal Bracelets & Jewellery in Malaysia",
    description: `Shop natural crystal bracelets, pendants and rings online in Malaysia. ${n ? n + " pieces including " : ""}amethyst, larimar, tiger eye, moonstone and more, cleansed before dispatch with delivery across Malaysia.`,
    canonical: SITE + "/",
    image: abs("/assets/img/logo.png"),
    extra: ld(orgLd(cat)) + ld(faqLd(Q)) + (cat ? ld({
      "@context": "https://schema.org", "@type": "ItemList", name: "House of Qi crystals",
      itemListElement: cat.products.slice(0, 200).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/p/${encodeURIComponent(p.id)}`, name: p.name })),
    }) : ""),
  });
  if (cat) {
    const groups = [...grouped(cat)].map(([name, list]) => `<section><h2>${esc(name)}</h2><ul>${list.map((p) =>
      `<li><a href="/p/${encodeURIComponent(p.id)}">${esc(p.name)}${p.details ? " · " + esc(p.details) : ""}</a> · ${RM(p.price)}${p.soldOut ? " · sold out" : ""}</li>`).join("")}</ul></section>`).join("");
    html = putSsr(html, ssr(`<header><h1>${BRAND} · Natural crystal bracelets &amp; jewellery in Malaysia</h1>
      <p>${BRAND} is a Malaysian online shop for natural crystal bracelets, pendants and rings. Every piece is made with natural gemstones, cleansed and packed by hand, and delivered across Malaysia. Shop by intention, birthstone, chakra, colour or bead size.</p></header>
      ${groups}
      <section><h2>Frequently asked questions</h2>${Q.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}</section>
      <p><a href="/policies">Shipping, returns &amp; crystal care</a></p>`));
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
