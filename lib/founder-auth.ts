function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Founder-only routes: Bearer BETA_FOUNDER_SECRET (never in the query string, where it would land in logs and history). */
export function founderAuthorized(request: Request) {
  const secret = process.env.BETA_FOUNDER_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer && timingSafeEqual(bearer, secret)) return true;
  // Back-compat: still accept the platform email match when that env is set.
  const email = process.env.BETA_FOUNDER_EMAIL?.trim().toLowerCase();
  const headerEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return Boolean(email && headerEmail && email === headerEmail);
}
