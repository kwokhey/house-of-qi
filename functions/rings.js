/** GET /rings: crawlable list of every piece in this section */
import { buildCatalog } from "./_lib/catalog.js";
import { loadCat, categoryPage, html } from "./_lib/guide.js";
export async function onRequestGet({ request, env }) {
  return html(categoryPage(await loadCat(env, new URL(request.url), buildCatalog), "rings"));
}
