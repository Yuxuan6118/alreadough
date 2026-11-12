import { buildCheckoutParams, channelFor, isBilling, isMethod, isPlan, paymentsConfig } from "@/lib/payments";
import { readClientInfo } from "@/lib/client-info";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const config = paymentsConfig(process.env);
  const country = readClientInfo(request.headers).country;
  // Closed by default, and closed for mainland China, which has no legitimate channel yet.
  if (channelFor(country, config) !== "stripe") return json({ error: "PAYMENTS_OFF" }, 503);
  const deviceId = request.headers.get("x-already-session-id")?.trim().slice(0, 128);
  if (!deviceId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  const body = await request.json().catch(() => null) as { plan?: unknown; billing?: unknown; method?: unknown; lang?: unknown } | null;
  if (!body || !isPlan(body.plan) || !isBilling(body.billing) || !isMethod(body.method)) return json({ error: "INVALID_REQUEST" }, 400);
  const params = buildCheckoutParams({
    plan: body.plan,
    billing: body.billing,
    method: body.method,
    lang: body.lang === "en" ? "en" : "zh",
    deviceId: `device:${deviceId}`,
    origin: new URL(request.url).origin,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await response.json().catch(() => null) as { url?: string; error?: { message?: string } } | null;
  if (!response.ok || !session?.url) {
    console.error("stripe checkout failed", response.status, session?.error?.message);
    return json({ error: "CHECKOUT_FAILED" }, 502);
  }
  return json({ url: session.url });
}
