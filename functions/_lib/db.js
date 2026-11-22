/**
 * Inventory database (Cloudflare D1, binding name "DB").
 * Tables are created automatically on first use.
 *
 *   items      one row per stock line (a unique piece, or a batch of the same size)
 *   movements  every change to stock: online sale, offline sale, restock, adjustment
 *   images     product photos (JPEG, resized in the browser before upload)
 *   settings   small key/value store (e.g. when Stripe sales were last synced)
 *   coupons    discount codes customers type at checkout
 *   sales      automatic % off for the whole shop, a section, stones or single pieces
 *   coupon_uses one row per paid website order that used a code
 *   affiliates  friends who sell for the shop (code, link, commission, customer discount)
 *   aff_sales   one row per sale credited to an affiliate (website order, offline sale or consignment sale)
 *   consign     pieces given to a seller to sell for the shop: give / sold / return
 *   collections curated groups shown in the shop (e.g. Rare Finds), picked by section, stone or piece
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    stone TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Bracelet',
    variant TEXT NOT NULL DEFAULT '',
    size_mm REAL,
    supplier TEXT NOT NULL DEFAULT '',
    collection TEXT NOT NULL DEFAULT 'bracelets',
    cost REAL NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    stock_in INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    zh TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    meaning TEXT NOT NULL DEFAULT '',
    intentions TEXT NOT NULL DEFAULT '[]',
    image_v INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_price REAL,
    unit_cost REAL,
    channel TEXT NOT NULL DEFAULT '',
    ref TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    movement_id INTEGER,
    void INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS movements_ref ON movements(ref, item_id) WHERE ref <> ''`,
  `CREATE INDEX IF NOT EXISTS movements_item ON movements(item_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS images (
    item_id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS printed (item_id TEXT PRIMARY KEY, qty INTEGER NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notified (sid TEXT PRIMARY KEY, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'percent',
    value REAL NOT NULL DEFAULT 0,
    min_spend REAL NOT NULL DEFAULT 0,
    starts_at INTEGER NOT NULL DEFAULT 0,
    ends_at INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 0,
    exclude_sale INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS coupon_uses (
    ref TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    order_no TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS coupon_uses_code ON coupon_uses(code)`,
  `CREATE TABLE IF NOT EXISTS affiliates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    comm_kind TEXT NOT NULL DEFAULT 'percent',
    comm_value REAL NOT NULL DEFAULT 10,
    disc_pct REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS aff_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aff_id INTEGER NOT NULL,
    ref TEXT NOT NULL UNIQUE,
    order_no TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT 'Website',
    detail TEXT NOT NULL DEFAULT '',
    pieces INTEGER NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    paid_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS aff_sales_aff ON aff_sales(aff_id)`,
  `CREATE TABLE IF NOT EXISTS consign (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aff_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit_price REAL,
    mv_id INTEGER,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS consign_aff ON consign(aff_id)`,
  `CREATE INDEX IF NOT EXISTS consign_item ON consign(item_id)`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    percent REAL NOT NULL,
    scope TEXT NOT NULL DEFAULT 'all',
    targets TEXT NOT NULL DEFAULT '[]',
    starts_at INTEGER NOT NULL DEFAULT 0,
    ends_at INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    zh TEXT NOT NULL DEFAULT '',
    blurb TEXT NOT NULL DEFAULT '',
    scope TEXT NOT NULL DEFAULT 'stones',
    targets TEXT NOT NULL DEFAULT '[]',
    max_price REAL NOT NULL DEFAULT 0,
    cover TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];
// columns added after the first release (ignored if they already exist)
const ADD_COLUMNS = [`ALTER TABLE movements ADD COLUMN invoice TEXT NOT NULL DEFAULT ''`, `ALTER TABLE images ADD COLUMN r2 TEXT NOT NULL DEFAULT ''`, `ALTER TABLE items ADD COLUMN dims TEXT NOT NULL DEFAULT ''`, `ALTER TABLE items ADD COLUMN colour TEXT NOT NULL DEFAULT ''`, `ALTER TABLE items ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]'`, `ALTER TABLE collections ADD COLUMN cover_v INTEGER NOT NULL DEFAULT 0`];

/**
 * The sheet sometimes puts the kind of piece in the product name:
 *   "Rose Quartz (Rings)", "Boulder Opal (Pendants)", "Golden Rutilated Quartz (Pendant (Rimmed))", "Topaz Ring"
 * → stone "Rose Quartz", type "Ring" (extra words like "Rimmed" go to the variant).
 * Returns null when the name has no kind in it.
 */
export function splitType(stone) {
  const KIND = (w) => (/^earring/i.test(w) ? "Earrings" : /^ring/i.test(w) ? "Ring" : "Pendant");
  let s = String(stone || "").trim(), m;
  if ((m = s.match(/^(.*?)\s*\(\s*(earrings?|rings?|pendants?|necklaces?)\b\s*(.*)\)$/i))) {
    const extra = m[3].replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    return { stone: m[1].trim(), type: KIND(m[2]), extra: extra ? extra[0].toUpperCase() + extra.slice(1) : "" };
  }
  if ((m = s.match(/^(.*?)\s*\b(earrings?|rings?|pendants?|necklaces?)$/i))) return { stone: m[1].trim(), type: KIND(m[2]), extra: "" };
  return null;
}
const DEFAULT_COLL = { Earrings: "earrings", Ring: "rings", Pendant: "pendants", Bracelet: "bracelets" };

/** One-time tidy of items imported before the kind was read from the name. Safe to run again. */
export async function fixTypes(D) {
  const { results } = await D.prepare("SELECT id, stone, type, variant, collection FROM items WHERE stone LIKE '%ring%' OR stone LIKE '%pendant%' OR stone LIKE '%necklace%'").all();
  const now = Date.now();
  for (const r of results) {
    const t = splitType(r.stone);
    if (!t) continue;
    const variant = [t.extra, r.variant].filter(Boolean).join(", ");
    const coll = !r.collection || r.collection === DEFAULT_COLL[r.type] || r.collection === "bracelets" ? DEFAULT_COLL[t.type] : r.collection;
    await D.prepare("UPDATE items SET stone = ?, type = ?, variant = ?, collection = ?, updated_at = ? WHERE id = ?").bind(t.stone, t.type, variant, coll, now, r.id).run();
  }
}

let ready = null;
export function hasDB(env) { return !!(env && env.DB && typeof env.DB.prepare === "function"); }
export async function db(env) {
  if (!hasDB(env)) throw new Error("no-db");
  if (!ready) ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)))
    .then(async () => { for (const sql of ADD_COLUMNS) { try { await env.DB.prepare(sql).run(); } catch { /* already there */ } } })
    .then(() => fixTypes(env.DB).catch((e) => console.error("fixTypes", e.message)))
    .catch((e) => { ready = null; throw e; });
  await ready;
  return env.DB;
}

export async function getSetting(D, k) {
  const r = await D.prepare("SELECT v FROM settings WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}
export async function setSetting(D, k, v) {
  await D.prepare("INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, String(v)).run();
}

/** Display name, e.g. "Larimar Bracelet" */
export const itemName = (r) => `${r.stone} ${r.type}`.trim();
/** Secondary line, e.g. "Bright blue · 10 mm" */
export const itemDetails = (r) => [r.variant, r.size_mm ? `${+r.size_mm} mm` : ""].filter(Boolean).join(" · ");

/** Item IDs are kept exactly as written in the inventory sheet (spaces, brackets, # and Chinese are fine).
 *  Only characters that break links or pages are refused: / \ ? % < > " ' ` and control characters. */
export const cleanId = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 60);
export const idOk = (id) => typeof id === "string" && id.length > 0 && id.length <= 60 && id === id.trim() && !/[\/\\?%<>"'`\u0000-\u001f\u007f]/.test(id);
/** For spotting the same ID written differently (case, spaces): "lrm-1001" and "LRM - 1001" → "LRM-1001" */
export const idKey = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "");
