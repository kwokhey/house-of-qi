/**
 * POST   /api/admin/login   { password }  → sets the login cookie
 * DELETE /api/admin/login                → logs out
 * GET    /api/admin/login                → { loggedIn }
 */
import { passwordMatches, loginCookie, logoutCookie, isAdmin } from "../../_lib/auth.js";
import { json } from "../../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json({ error: "The order page is not set up yet. Add ADMIN_PASSWORD in Cloudflare." }, 503);
  let body = {};
  try { body = await request.json(); } catch {}
  if (!(await passwordMatches(env, body.password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ error: "That password isn't right." }, 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": await loginCookie(env) });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { "Set-Cookie": logoutCookie() });
}

export async function onRequestGet({ request, env }) {
  return json({ loggedIn: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD });
}
