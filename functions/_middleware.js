/**
 * One official address: house-of-qi.pages.dev and www.houseofqi.shop send visitors (and
 * search engines) to https://houseofqi.shop with a permanent redirect, so Google sees one site.
 * Only page visits (GET/HEAD) are redirected; preview deployments (xyz.house-of-qi.pages.dev) are left alone.
 */
const OLD = new Set(["house-of-qi.pages.dev", "www.houseofqi.shop"]);

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (OLD.has(url.hostname) && (request.method === "GET" || request.method === "HEAD")) {
    url.hostname = "houseofqi.shop"; url.protocol = "https:"; url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
