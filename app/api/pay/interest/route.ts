import { isBilling, isPlan } from "@/lib/payments";
import { readClientInfo } from "@/lib/client-info";
import { saveInterest } from "@/lib/payments-db";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// A visitor says "tell me when it opens". Only the plan, billing period and an optional contact are kept.
export async function POST(request: Request) {
  const deviceId = request.headers.get("x-already-session-id")?.trim().slice(0, 128);
  if (!deviceId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  const body = await request.json().catch(() => null) as { plan?: unknown; billing?: unknown; contact?: unknown; lang?: unknown } | null;
  if (!body || !isPlan(body.plan) || !isBilling(body.billing)) return json({ error: "INVALID_REQUEST" }, 400);
  const contact = typeof body.contact === "string" && body.contact.trim() ? body.contact.trim().slice(0, 120) : null;
  await saveInterest({
    deviceId: `device:${deviceId}`,
    plan: body.plan,
    billing: body.billing,
    contact,
    country: readClientInfo(request.headers).country,
    lang: body.lang === "en" ? "en" : "zh",
  });
  return json({ saved: true });
}
