/**
 * Inventory database (Cloudflare D1, binding name "DB").
 * Tables are created automatically on first use.
 *
 *   items      one row per stock line (a unique piece, or a batch of the same size)
 *   movements  every change to stock: online sale, offline sale, restock, adjustment
 *   images     product photos (JPEG, resized in the browser before upload)
 *   settings   small key/value store (e.g. when Stripe sales were last synced)
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
];

let ready = null;
export function hasDB(env) { return !!(env && env.DB && typeof env.DB.prepare === "function"); }
export async function db(env) {
  if (!hasDB(env)) throw new Error("no-db");
  if (!ready) ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { ready = null; throw e; });
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
