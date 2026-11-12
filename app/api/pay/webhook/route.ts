import { entitlementFromEvent, paymentsConfig, verifyStripeSignature } from "@/lib/payments";
import { applyEntitlementChange, hasSeenEvent, markEventSeen } from "@/lib/payments-db";

// Stripe calls this after a payment. Nothing is trusted unless the signature checks out against the raw body.
export async function POST(request: Request) {
  const config = paymentsConfig(process.env);
  if (!config.enabled) return new Response("payments off", { status: 503 });
  const raw = await request.text();
  const valid = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), config.webhookSecret);
  if (!valid) return new Response("bad signature", { status: 400 });
  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  if (event.id && (await hasSeenEvent(event.id))) return Response.json({ received: true, duplicate: true });
  const change = entitlementFromEvent(event);
  if (change.kind !== "ignore") await applyEntitlementChange(change);
  if (event.id) await markEventSeen(event.id, event.type || "");
  return Response.json({ received: true });
}
