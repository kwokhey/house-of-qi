/**
 * GET /vid/<file> — product videos from R2, with Range support so phones (Safari) can play and seek.
 */
export async function onRequestGet({ request, params, env }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const key = "vid/" + parts.map((p) => decodeURIComponent(String(p || ""))).join("/");
  if (!env.PHOTOS || !/^vid\/[A-Za-z0-9_-]+\.(mp4|mov|webm)$/.test(key)) return new Response("Not found", { status: 404 });
  const head = await env.PHOTOS.head(key);
  if (!head) return new Response("Not found", { status: 404 });
  const size = head.size, type = (head.httpMetadata && head.httpMetadata.contentType) || "video/mp4";
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable", ETag: head.httpEtag };
  const m = (request.headers.get("Range") || "").match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start, end;
    if (m[1]) { start = +m[1]; end = m[2] ? Math.min(+m[2], size - 1) : size - 1; }
    else { start = Math.max(0, size - +m[2]); end = size - 1; }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const o = await env.PHOTOS.get(key, { range: { offset: start, length: end - start + 1 } });
    return new Response(o.body, { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const o = await env.PHOTOS.get(key);
  return new Response(o.body, { headers: { ...base, "Content-Length": String(size) } });
}
export const onRequestHead = onRequestGet;
