import { grantPaidOrder, readMemberOrder } from "@/lib/membership";
import { WAFFO_CURRENCY, WAFFO_PRICE_CENTS, WAFFO_STORE_ID, displayAmountFen, verifyWaffoWebhook, waffoConfig } from "@/lib/waffo";

const ok = () => new Response("OK");

export async function POST(request: Request) {
  const config = waffoConfig();
  if (!config.enabled) return new Response("payments off", { status: 503 });
  const raw = await request.text(); // raw bytes are what Waffo signed
  const event = await verifyWaffoWebhook(raw, request.headers.get("x-waffo-signature"), config.env);
  if (!event) return new Response("invalid signature", { status: 401 });
  // Events for the other environment or another store are acknowledged and ignored.
  if (event.mode !== config.env || event.storeId !== WAFFO_STORE_ID || event.eventType !== "order.completed") return ok();
  const data = event.data || {};
  const orderId = String(data.orderMetadata?.orderId || data.orderMerchantExternalId || "");
  const order = /^[a-f0-9]{32}$/.test(orderId) ? await readMemberOrder(orderId) : null;
  if (!order) { console.error("waffo webhook: unknown order", orderId, event.eventId); return ok(); }
  if (order.status === "paid") return ok();
  // Waffo reports the amount in the pricing currency (USD cents here), whatever the buyer was shown locally.
  const paidCents = displayAmountFen(data.listPrice?.total ?? data.total);
  const expectedCents: number | undefined = WAFFO_PRICE_CENTS[order.plan];
  if (!expectedCents || data.currency !== WAFFO_CURRENCY || paidCents === null || paidCents < expectedCents || data.paymentStatus !== "succeeded") {
    console.error("waffo webhook: amount mismatch", orderId, data.currency, data.listPrice?.total, data.paymentStatus);
    return ok();
  }
  try {
    await grantPaidOrder(order, `waffo:${data.paymentId || event.eventId}`);
    return ok();
  } catch (error) {
    console.error("waffo webhook: grant failed", error instanceof Error ? error.message : error);
    return new Response("retry", { status: 503 });
  }
}
