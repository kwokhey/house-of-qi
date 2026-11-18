/**
 * POST /api/admin/test-email   (login required)
 * Sends one clearly marked sample "New order" email to the team, to check email delivery.
 */
import { isAdmin } from "../../_lib/auth.js";
import { db, hasDB } from "../../_lib/db.js";
import { json } from "../../_lib/stripe.js";
import { sendTeam, sampleEmail } from "../../_lib/notify.js";

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: "Please log in." }, 401);
  if (!env.RESEND_API_KEY) return json({ error: "RESEND_API_KEY is not set in Cloudflare." }, 503);
  const r = await sendTeam(env, hasDB(env) ? await db(env) : null, sampleEmail());
  return json(r, r.ok ? 200 : 502);
}
