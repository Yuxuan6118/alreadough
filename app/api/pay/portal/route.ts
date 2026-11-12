import { paymentsConfig } from "@/lib/payments";
import { readStripeCustomer } from "@/lib/payments-db";

// Sends a card subscriber to Stripe's own page where she can cancel or change her card.
export async function POST(request: Request) {
  const config = paymentsConfig(process.env);
  const deviceId = request.headers.get("x-already-session-id")?.trim().slice(0, 128);
  if (!config.enabled || !deviceId) return Response.json({ error: "PAYMENTS_OFF" }, { status: 503 });
  const customer = await readStripeCustomer(`device:${deviceId}`);
  if (!customer) return Response.json({ error: "NO_SUBSCRIPTION" }, { status: 404 });
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer, return_url: `${new URL(request.url).origin}/pricing` }),
  });
  const session = await response.json().catch(() => null) as { url?: string } | null;
  if (!response.ok || !session?.url) return Response.json({ error: "PORTAL_FAILED" }, { status: 502 });
  return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
}
