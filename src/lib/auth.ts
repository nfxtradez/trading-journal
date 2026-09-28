// Single-password auth. Enabled only when APP_PASSWORD is set (e.g. on Netlify); open locally.
// The session cookie holds an HMAC of a fixed string keyed by the password, so changing the
// password signs every device out.
export const SESSION_COOKIE = "tradelog_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(password = process.env.APP_PASSWORD ?? ""): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("tradelog-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!cookieValue) return false;
  const expected = await sessionToken();
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
