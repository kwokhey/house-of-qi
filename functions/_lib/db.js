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
  `CREATE UNIQUE INDEX IF NOT EXISTS movements_ref ON movements(ref, item_id) WHERE ref <> ''`,
  `CREATE INDEX IF NOT EXISTS movements_item ON movements(item_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS images (
    item_id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
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
const ADD_COLUMNS = [`ALTER TABLE items ADD COLUMN colour TEXT NOT NULL DEFAULT ''`];

let ready = null;
export function hasDB(env) { return !!(env && env.DB && typeof env.DB.prepare === "function"); }
export async function db(env) {
  if (!hasDB(env)) throw new Error("no-db");
  if (!ready) ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)))
    .then(async () => { for (const sql of ADD_COLUMNS) { try { await env.DB.prepare(sql).run(); } catch { /* already there */ } } })
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
