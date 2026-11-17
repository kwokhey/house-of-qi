/** GET /crystals: crystal meanings A–Z, linking to a guide page per stone */
import { buildCatalog } from "../_lib/catalog.js";
import { loadCat, stonesIndex, html } from "../_lib/guide.js";
export async function onRequestGet({ request, env }) {
  return html(stonesIndex(await loadCat(env, new URL(request.url), buildCatalog)));
}
