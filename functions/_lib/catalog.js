/**
 * Builds the shop catalogue: settings (shipping, homepage text, add-ons) from
 * data/catalog.json, products from the inventory database.
 * If the database is not connected yet, the sample products in catalog.json are used.
 */
import { db, hasDB, itemName, itemDetails, getSetting } from "./db.js";
import { applySales, liveSales, shopPromo, saleCovers } from "./promo.js";
import { COLOURS, colourOf } from "./colours.js";
import { faqs } from "./seo.js";

export async function loadSettings(env, origin) {
  const res = await env.ASSETS.fetch(new URL("/data/catalog.json", origin));
  if (!res.ok) throw new Error("catalog unavailable");
  return res.json();
}

/** Turn an inventory row into a shop product. */
export function rowToProduct(r, settings) {
  const pendant = /pendant|necklace/i.test(r.type), ring = /^ring/i.test(r.type);
  const name = itemName(r);
  const details = itemDetails(r);
  let intentions = [];
  try { intentions = JSON.parse(r.intentions || "[]"); } catch {}
  return {
    id: r.id,
    code: r.id,
    name,
    zh: r.zh || "",
    details,
    collection: r.collection || (ring ? "rings" : pendant ? "pendants" : "bracelets"),
    price: r.price,
    stock: r.stock,
    soldOut: r.stock <= 0,
    // a real photo from the Stock tab wins; otherwise a showcase sample (data/catalog.json → samplePhotos), else drawn art
    image: r.image_v ? `img/${encodeURIComponent(r.id)}.jpg?v=${r.image_v}` : (settings.samplePhotos && settings.samplePhotos[r.id]) || "",
    // extra angles, shown after the main photo in the product view
    gallery: (() => { try { return JSON.parse(r.gallery || "[]").filter((p) => p && p.k).map((p) => `img/${encodeURIComponent(p.k)}.jpg?v=${p.v}`); } catch { return []; } })(),
    bestseller: r.featured ? r.featured : 0,
    stone: r.stone,
    quality: r.size_mm ? `${+r.size_mm} mm beads` : (r.variant || ""),
    specLabel: r.size_mm ? "Size" : "Details",
    intentions,
    description: r.description || defaultDescription(r, details),
    meaning: r.meaning || "",
    size: r.size_mm ? +r.size_mm : null,
    colour: colourOf(r),
    art: { stone: r.stone, variant: r.variant, type: r.type, size: r.size_mm || 8 },
    groups: settings.addons ? [settings.addons] : [],
  };
}

function defaultDescription(r, details) {
  const one = r.stock === 1 ? " One piece only." : "";
  // keep place names capitalised: Baltic amber, Libyan glass, Tanzania sunstone
  const stone = r.stone.toLowerCase().replace(/\b(baltic|libyan|tanzania|tanzanian|brazil|brazilian|madagascar|african|tibetan|himalayan|russian|mexican|peruvian|dominican)\b/g, (w) => w[0].toUpperCase() + w.slice(1));
  return `Natural ${stone} ${r.type.toLowerCase()}${details ? `, ${details.toLowerCase()}` : ""}.${one}`;
}

export async function buildCatalog(env, origin, { includeHidden = false } = {}) {
  const settings = await loadSettings(env, origin);
  if (!hasDB(env)) return { ...settings, source: "sample" };
  const D = await db(env);
  const { results } = await D.prepare(
    includeHidden
      ? "SELECT * FROM items ORDER BY sort, id"
      : "SELECT * FROM items WHERE published = 1 AND price > 0 ORDER BY stock <= 0, featured = 0, featured, sort, id" // sold-out pieces stay visible, listed last
  ).all();
  if (!results.length && !includeHidden) {
    const count = await D.prepare("SELECT COUNT(*) AS n FROM items").first();
    if (!count.n) {
      // nothing imported yet → sample products; after "Start over" in Stock → an empty shop until the new list is imported
      const reset = await getSetting(D, "stock_reset_at");
      return { ...settings, ...(reset ? { products: [] } : {}), banner: bannerOf(settings, (await shopPromo(env)).banner), source: reset ? "empty" : "sample" };
    }
  }
  const products = applySales(results.map((r) => rowToProduct(r, settings)), await liveSales(D));
  const inStock = products.filter((p) => !p.soldOut);
  const hero = inStock.find((p) => p.bestseller) || [...inStock].sort((a, b) => b.price - a.price)[0];
  const heroCfg = hero
    ? {
        product: hero.id,
        eyebrow: hero.stock === 1 ? "One of a kind" : "Featured",
        title: `${hero.stone}|${hero.name.slice(hero.stone.length).trim() || "Collection"}`,
        text: hero.details ? `${hero.details}. Hand-picked natural stone.` : "Hand-picked natural stone.",
      }
    : settings.hero;
  const promo = await shopPromo(env);
  // colour families in use, in palette order
  const colours = COLOURS.map(([id, name, hex]) => ({ id, name, hex, n: products.filter((p) => p.colour === id).length })).filter((c) => c.n);
  // curated collections (Marketing tab) with the pieces they hold right now
  const { results: cols } = await D.prepare("SELECT * FROM collections WHERE active = 1 ORDER BY sort, id").all();
  const collections = cols.map((c) => {
    const rule = { scope: c.scope, targets: safeArr(c.targets) };
    const ids = products.filter((p) => saleCovers(rule, p) && (!c.max_price || p.price <= c.max_price)).map((p) => p.id);
    const cover = ids.includes(c.cover) ? c.cover : ids.find((id) => products.find((p) => p.id === id).image) || ids[0];
    return { id: c.id, name: c.name, zh: c.zh, blurb: c.blurb, cover, coverImg: c.cover_v ? `img/coll-${c.id}.jpg?v=${c.cover_v}` : "", ids };
  }).filter((c) => c.ids.length);
  const { samplePhotos, _samplePhotosNote, ...pub } = settings;
  return { ...pub, faqs: faqs(settings), banner: bannerOf(settings, promo.banner), products, hero: heroCfg, spotlight: null, source: "inventory", announce: promo.announce || null, codes: !!promo.codes, colours, curated: collections };
}

function safeArr(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

/** home page banner: words and photos saved in the Marketing tab win over data/catalog.json */
function bannerOf(settings, saved) {
  const bo = saved || {}, bd = settings.banner || {};
  const mine = bannerPhotos(bo).map((p) => `img/${p.k}.jpg?v=${p.v}`);
  return { title: bo.title || bd.title || "", text: bo.text || bd.text || "", cta: bo.cta || bd.cta || "Shop our collection", imgs: mine.length ? mine : bd.imgs || (bd.img ? [bd.img] : []) };
}
/** uploaded banner photos, oldest first (an early single photo was saved as "banner") */
export function bannerPhotos(b) {
  if (!b) return [];
  if (Array.isArray(b.photos)) return b.photos.filter((p) => p && p.k && p.v);
  return b.v ? [{ k: "banner", v: b.v }] : [];
}
