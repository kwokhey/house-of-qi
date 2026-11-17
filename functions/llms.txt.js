/**
 * GET /llms.txt  A plain summary of the shop for AI assistants (ChatGPT, Perplexity, Gemini…):
 * what House of Qi is, delivery and returns, common questions, and every piece with its price and link.
 */
import { buildCatalog } from "./_lib/catalog.js";
import { SITE, BRAND, COMPANY, SOCIAL, RM, faqs, grouped } from "./_lib/seo.js";
import { stonesOf } from "./_lib/guide.js";
import { stoneInfo, stoneParagraph } from "./_lib/stones.js";

export async function onRequestGet({ request, env }) {
  let cat = null;
  try { cat = await buildCatalog(env, new URL(request.url).origin); } catch {}
  const lines = [
    `# ${BRAND}`, "",
    `> ${BRAND} is a Malaysian online shop selling natural crystal bracelets, pendants and rings, run by ${COMPANY} Prices are in Malaysian Ringgit (MYR). Every piece uses natural gemstones, so colour and pattern vary slightly from piece to piece.`, "",
    `- Shop: ${SITE}/`, `- Crystal meanings A–Z: ${SITE}/crystals`, `- Bracelets: ${SITE}/bracelets`, `- Pendants: ${SITE}/pendants`, `- Rings: ${SITE}/rings`, `- Shipping, returns & crystal care: ${SITE}/policies`,
    ...(cat && cat.whatsapp ? [`- Customer service (WhatsApp): https://wa.me/${cat.whatsapp}`] : []),
    ...SOCIAL.map((s) => `- ${/instagram/.test(s) ? "Instagram" : "Facebook"}: ${s}`), "",
    "## Frequently asked questions", "",
    ...faqs(cat).flatMap(([q, a]) => [`### ${q}`, a, ""]),
  ];
  if (cat) {
    lines.push("## Crystal guide", "", "Meanings are traditional and spiritual beliefs, not medical claims.", "");
    for (const s of stonesOf(cat)) {
      const info = stoneInfo(s.stone, cat, s.pieces), prices = s.pieces.filter((p) => !p.soldOut).map((p) => +p.price);
      lines.push(`### [${s.stone}](${SITE}/crystals/${info.slug})`, stoneParagraph(info) || `Natural ${s.stone.toLowerCase()}.`, `${s.pieces.length} piece(s) at House of Qi${prices.length ? `, from ${RM(Math.min(...prices))}` : ", currently sold out"}.`, "");
    }
    lines.push("## Pieces available", "", "Each link opens the piece in the shop. Prices in MYR; sold-out pieces are marked.", "");
    for (const [name, list] of grouped(cat)) {
      lines.push(`### ${name}`, "");
      for (const p of list) lines.push(`- [${p.name}${p.details ? " · " + p.details : ""}](${SITE}/p/${encodeURIComponent(p.id)}): ${RM(p.price)}${p.soldOut ? " (sold out)" : ""}`);
      lines.push("");
    }
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
