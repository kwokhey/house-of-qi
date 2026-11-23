/**
 * Builds the shop catalogue: settings (shipping, homepage text, add-ons) from
 * data/catalog.json, products from the inventory database.
 * If the database is not connected yet, the sample products in catalog.json are used.
 */
import { db, hasDB, itemName, itemDetails, getSetting } from "./db.js";
import { applySales, liveSales, shopPromo, saleCovers } from "./promo.js";
import { COLOURS, colourOf } from "./colours.js";
import { faqs } from "./seo.js";
import { stoneBelief, stoneAbout, stoneMeaning } from "./stones.js";

export async function loadSettings(env, origin) {
  const res = await env.ASSETS.fetch(new URL("/data/catalog.json", origin));
  if (!res.ok) throw new Error("catalog unavailable");
  return res.json();
}

/** Estimated weight of one piece in grams (a set weight_g wins). Bead bracelets: ~16 cm of round stone beads. */
export function gramsOf(r) {
  if (Number(r.weight_g) > 0) return Number(r.weight_g);
  const t = String(r.type || "");
  if (/earring/i.test(t)) return 10;
  if (/ring/i.test(t)) return 10;
  if (/pendant|necklace/i.test(t)) return 25;
  if (/bracelet/i.test(t)) {
    const mm = Number(r.size_mm) || 8, beads = Math.ceil(165 / mm), cm3 = (4 / 3) * Math.PI * Math.pow(mm / 20, 3);
    return Math.round(beads * cm3 * 2.7 + 5);
  }
  return 150; // spheres, décor and anything else: ask for a quote sooner rather than later
}

/** Turn an inventory row into a shop product. */
/** Pre-order bead sizes: one per line, "10 mm = 680" → [{label:"10 mm", price:680}] */
export function preorderSizes(text) {
  const out = [];
  for (const line of String(text || "").split(/[\n;]+/)) {
    const m = line.match(/^\s*(.+?)\s*[=:]\s*(?:RM)?\s*([\d,]+(?:\.\d+)?)\s*$/i);
    if (!m) continue;
    let label = m[1].trim().slice(0, 30), price = Math.round(Number(m[2].replace(/,/g, "")) * 100) / 100;
    if (/^\d+(\.\d+)?$/.test(label)) label += " mm";
    if (price > 0 && !out.some((x) => x.label.toLowerCase() === label.toLowerCase())) out.push({ label, price });
  }
  return out.slice(0, 12);
}

export function rowToProduct(r, settings) {
  const pendant = /pendant|necklace/i.test(r.type), ring = /^ring/i.test(r.type), earring = /^earring/i.test(r.type);
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
    collection: r.collection || (earring ? "earrings" : ring ? "rings" : pendant ? "pendants" : "bracelets"),
    price: r.price,
    // pre-order: always orderable (no stock limit), customer pays a 50% deposit now and the rest when it is ready
    preorder: !!r.preorder,
    preorderNote: r.preorder ? (r.preorder_note || "") : "",
    stock: r.preorder ? 99 : r.stock,
    grams: gramsOf(r),
    soldOut: r.preorder ? false : r.stock <= 0,
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
    meaning: r.meaning || stoneMeaning(r.stone),
    blurb: stoneBelief(r.stone),
    size: r.size_mm ? +r.size_mm : null,
    dims: r.dims || "",
    colour: colourOf(r),
    art: { stone: r.stone, variant: r.variant, type: r.type, size: r.size_mm || 8 },
    groups: settings.addons ? [settings.addons] : [],
  };
}

/** A pre-order with bead-size choices: price = cheapest size, each size adds the difference */
function withSizes(p, r) {
  const sz = r.preorder ? preorderSizes(r.preorder_sizes) : [];
  if (!sz.length) return p;
  const min = Math.min(...sz.map((x) => x.price));
  const opts = sz.map((x, i) => ({ id: "s" + i, label: x.label, short: x.label, price: Math.round((x.price - min) * 100) / 100, note: "" }));
  return { ...p, price: min, size: null, details: sz.length > 1 ? `${sz.length} bead sizes` : sz[0].label, quality: "Choose your bead size", specLabel: "Bead size",
    sizeOpts: sz, groups: [{ id: "size", label: "Bead size", type: "one", default: "s0", opts }, ...p.groups] };
}

export function defaultDescription(r, details) {
  const one = r.stock === 1 ? " One piece only." : "";
  // keep place names capitalised: Baltic amber, Libyan glass, Tanzania sunstone
  const stone = r.stone.toLowerCase().replace(/\b(baltic|libyan|tanzania|tanzanian|brazil|brazilian|madagascar|african|tibetan|himalayan|russian|mexican|peruvian|dominican)\b/g, (w) => w[0].toUpperCase() + w.slice(1));
  const about = stoneAbout(r.stone);
  return `Natural ${stone} ${r.type.toLowerCase()}${details ? `, ${details.toLowerCase()}` : ""}.${about ? " " + about : ""}${one}`;
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
  const products = applySales(results.map((r) => withSizes(rowToProduct(r, settings), r)), await liveSales(D));
  // pieces someone is paying for right now are held for them (checkout reservation, up to 30 min)
  if (!includeHidden) {
    try {
      const { results: H } = await D.prepare("SELECT item_id, SUM(qty) AS q FROM holds WHERE expires > ? GROUP BY item_id").bind(Date.now()).all();
      const held = Object.fromEntries(H.map((h) => [h.item_id, h.q]));
      for (const p of products) {
        const q = held[p.id]; if (!q || p.soldOut || p.preorder) continue;
        const left = (p.stock || 0) - q;
        if (left <= 0) { p.reserved = true; p.soldOut = true; p.stock = 0; } else p.stock = left;
      }
    } catch (e) { console.error("holds", e && e.message); }
  }
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
    const extra = safeArr(c.extra);
    const ids = products.filter((p) => (saleCovers(rule, p) && (!c.max_price || p.price <= c.max_price)) || extra.includes(p.id)).map((p) => p.id);
    const cover = ids.includes(c.cover) ? c.cover : ids.find((id) => products.find((p) => p.id === id).image) || ids[0];
    return { id: c.id, name: c.name, zh: c.zh, blurb: c.blurb, cover, coverImg: c.cover_v ? `img/coll-${c.id}.jpg?v=${c.cover_v}` : "", ids };
  }).filter((c) => c.ids.length);
  const { samplePhotos, _samplePhotosNote, ...pub } = settings;
  pub.shipping = await liveShipping(D, settings.shipping);
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

/** Hide seasonal options (Singapore self-collect) unless switched on in Marketing; use its saved note */
export async function liveShipping(D, shipping) {
  let sg = null;
  try { sg = JSON.parse((await getSetting(D, "sg_collect")) || "null"); } catch {}
  const out = {};
  for (const [k, s] of Object.entries(shipping || {})) {
    if (s.seasonal) {
      if (!sg || !sg.on) continue;
      out[k] = { ...s, note: sg.note || s.note };
    } else out[k] = s;
  }
  return out;
}
