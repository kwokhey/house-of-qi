/**
 * Simple password login for the order page.
 * The password is the Cloudflare secret ADMIN_PASSWORD. After login the browser
 * keeps a signed cookie for 12 hours.
 */

const COOKIE = "hq_admin";
const HOURS = 12;
const enc = new TextEncoder();

async function sign(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function passwordMatches(env, given) {
  if (!env.ADMIN_PASSWORD || typeof given !== "string") return false;
  // compare fixed-length digests so timing does not reveal the length
  return same(await sign("hq", given), await sign("hq", env.ADMIN_PASSWORD));
}

export async function loginCookie(env) {
  const exp = Date.now() + HOURS * 3600 * 1000;
  const token = `${exp}.${await sign(env.ADMIN_PASSWORD, String(exp))}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HOURS * 3600}`;
}

export const logoutCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await sign(env.ADMIN_PASSWORD, exp));
}
