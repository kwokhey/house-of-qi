/**
 * Photo storage. When the Cloudflare R2 bucket is bound as PHOTOS, the picture itself lives in R2 and the
 * D1 `images` row keeps only the name, type and date (data = empty, r2 = the R2 object name). Without the
 * binding everything stays in D1 as before. Renaming a row (UPDATE images SET item_id) keeps working because
 * the R2 object name never changes.
 */
const EMPTY = new Uint8Array(0);
export const hasR2 = (env) => !!(env && env.PHOTOS && typeof env.PHOTOS.put === "function");
const objName = (key) => `p/${Date.now().toString(36)}-${crypto.randomUUID()}-${String(key).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60)}`;

/** Stores the bytes (R2 when available) and returns the D1 statement that records the row. */
export async function photoStmt(env, D, key, mime, bin, now) {
  if (hasR2(env)) {
    const name = objName(key);
    await env.PHOTOS.put(name, bin, { httpMetadata: { contentType: mime } });
    return D.prepare("INSERT INTO images (item_id, mime, data, updated_at, r2) VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at, r2 = excluded.r2")
      .bind(key, mime, EMPTY, now, name);
  }
  return D.prepare("INSERT INTO images (item_id, mime, data, updated_at, r2) VALUES (?, ?, ?, ?, '') ON CONFLICT(item_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at, r2 = ''")
    .bind(key, mime, bin, now);
}

/** Reads a photo: { mime, body } or null. */
export async function readPhoto(env, D, key) {
  const row = await D.prepare("SELECT mime, r2, CASE WHEN r2 = '' THEN data ELSE NULL END AS data FROM images WHERE item_id = ?").bind(key).first();
  if (!row) return null;
  if (row.r2 && hasR2(env)) {
    const o = await env.PHOTOS.get(row.r2);
    if (!o) return null;
    return { mime: row.mime || "image/jpeg", body: o.body };
  }
  if (!row.data) return null;
  const body = row.data instanceof ArrayBuffer || ArrayBuffer.isView(row.data) ? row.data : new Uint8Array(row.data);
  return { mime: row.mime || "image/jpeg", body };
}

/**
 * Moves up to `limit` photos from D1 into R2 (call repeatedly until left = 0).
 * Biggest space users first: originals, then extra angles and main photos.
 */
export async function movePhotosToR2(env, D, limit = 12) {
  if (!hasR2(env)) return { error: "The PHOTOS bucket isn't connected yet." };
  // one row at a time keeps memory and CPU low
  const { results: keys } = await D.prepare("SELECT item_id FROM images WHERE r2 = '' ORDER BY (item_id LIKE 'orig-%') DESC LIMIT ?").bind(limit).all();
  let moved = 0;
  for (const k of keys) {
    const r = await D.prepare("SELECT item_id, mime, data FROM images WHERE item_id = ? AND r2 = ''").bind(k.item_id).first();
    if (!r) continue;
    const bin = r.data instanceof ArrayBuffer || ArrayBuffer.isView(r.data) ? r.data : new Uint8Array(r.data);
    const name = objName(r.item_id);
    await env.PHOTOS.put(name, bin, { httpMetadata: { contentType: r.mime || "image/jpeg" } });
    await D.prepare("UPDATE images SET data = ?, r2 = ? WHERE item_id = ? AND r2 = ''").bind(EMPTY, name, r.item_id).run();
    moved++;
  }
  const left = (await D.prepare("SELECT COUNT(*) AS n FROM images WHERE r2 = ''").first()).n;
  return { moved, left };
}
