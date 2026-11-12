/**
 * GET /api/catalog — what the shop shows: settings + products in stock.
 * Also catches up stock with any new paid Stripe orders (in the background).
 */
import { buildCatalog } from "../_lib/catalog.js";
import { syncSales } from "../_lib/inventory.js";

export async function onRequestGet({ request, env, waitUntil }) {
  const origin = new URL(request.url).origin;
  try {
    const cat = await buildCatalog(env, origin);
    if (cat.source === "inventory" && waitUntil) waitUntil(syncSales(env).catch((e) => console.error("sync", e.message)));
    return new Response(JSON.stringify(cat), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=20" },
    });
  } catch (e) {
    console.error("catalog", e.message);
    return new Response(JSON.stringify({ error: "Catalogue unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
