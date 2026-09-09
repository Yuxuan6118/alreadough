import { founderSnapshot, setBetaEnabled } from "@/lib/beta-guard";

function authorized(request: Request) {
  const secret = process.env.BETA_FOUNDER_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const param = new URL(request.url).searchParams.get("key")?.trim();
  // Back-compat: still accept the platform email match when that env is set.
  const email = process.env.BETA_FOUNDER_EMAIL?.trim().toLowerCase();
  const headerEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return bearer === secret || param === secret || Boolean(email && headerEmail && email === headerEmail);
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
