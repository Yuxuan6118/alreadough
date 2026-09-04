import { founderSnapshot, setBetaEnabled } from "@/lib/beta-guard";

function authorized(request: Request) {
  const configured = process.env.BETA_FOUNDER_EMAIL?.trim().toLowerCase();
  const actual = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return Boolean(configured && actual && configured === actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const days = Number(new URL(request.url).searchParams.get("days") || 1);
  return Response.json(await founderSnapshot(days), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "FOUNDER_ACCESS_REQUIRED" }, { status: 403 });
  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return Response.json({ error: "INVALID_SETTING" }, { status: 400 });
  await setBetaEnabled(body.enabled);
  return Response.json(await founderSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
