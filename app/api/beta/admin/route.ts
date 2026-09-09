import { founderSnapshot, setBetaEnabled } from "@/lib/beta-guard";

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorized(request: Request) {
  const secret = process.env.BETA_FOUNDER_SECRET?.trim();
  if (!secret) return false;
  // Bearer token only — never accept the secret in the query string, where it
  // would land in CDN/access logs, history, and referrers.
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer && timingSafeEqual(bearer, secret)) return true;
  // Back-compat: still accept the platform email match when that env is set.
  const email = process.env.BETA_FOUNDER_EMAIL?.trim().toLowerCase();
  const headerEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return Boolean(email && headerEmail && email === headerEmail);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  return Response.json(await founderSnapshot(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return Response.json({ error: "INVALID_SETTING" }, { status: 400 });
  await setBetaEnabled(body.enabled);
  return Response.json(await founderSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
