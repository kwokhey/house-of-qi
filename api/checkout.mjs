/**
 * POST /api/checkout — Vercel Function
 * Required environment variable (Vercel → Project → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY   sk_test_... while testing, sk_live_... when you go live
 */
import { createCheckout, jsonResponse } from "../lib/stripe-checkout.mjs";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request." }, 400); }

  const origin = new URL(request.url).origin;
  const catRes = await fetch(new URL("/data/products.json", origin));
  if (!catRes.ok) return jsonResponse({ error: "Catalogue unavailable." }, 500);
  const store = await catRes.json();

  const { status, body: out } = await createCheckout({
    items: body?.items, origin, store, secretKey: process.env.STRIPE_SECRET_KEY,
  });
  return jsonResponse(out, status);
}
