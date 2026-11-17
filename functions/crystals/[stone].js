/** GET /crystals/<stone>: guide page for one stone (meaning, chakra, birth month, price) with every piece in that stone */
import { buildCatalog } from "../_lib/catalog.js";
import { loadCat, stonesOf, stonePage, html } from "../_lib/guide.js";
import { slug } from "../_lib/stones.js";
export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const cat = await loadCat(env, url, buildCatalog);
  const s = stonesOf(cat).find((x) => slug(x.stone) === String(params.stone || "").toLowerCase());
  if (!s) return Response.redirect(new URL("/crystals", url).toString(), 302);
  return html(stonePage(cat, s));
}
