// Payment plumbing. Pure functions only (no Cloudflare imports) so the tests can run them directly.
//
// Everything here is OFF until the founder turns it on with the PAYMENTS_ENABLED secret.
// Cards (Visa etc.) are sold as a subscription. Alipay and WeChat Pay are sold as a one-time
// purchase for one month or one year, because Stripe Checkout does not support those two in
// subscription mode. A mainland-China merchant channel is intentionally NOT implemented here:
// it needs a mainland business licence first. `PaymentMethod` is the place to add it later.

export type PlanId = "soft" | "deep" | "atelier";
export type Billing = "monthly" | "annual";
export type PaymentMethod = "card" | "wallet";

/** Monthly list prices, kept in step with app/pricing/Pricing.tsx. USD in cents, CNY in fen. Annual = 10 months. */
export const PLAN_PRICES: Record<PlanId, { usd: number; cny: number }> = {
  soft: { usd: 599, cny: 3900 },
  deep: { usd: 1299, cny: 8800 },
  atelier: { usd: 2499, cny: 16800 },
};

export function isPlan(value: unknown): value is PlanId {
  return value === "soft" || value === "deep" || value === "atelier";
}
export function isBilling(value: unknown): value is Billing {
  return value === "monthly" || value === "annual";
}
export function isMethod(value: unknown): value is PaymentMethod {
  return value === "card" || value === "wallet";
}

export function amountFor(plan: PlanId, billing: Billing, currency: "usd" | "cny") {
  const monthly = PLAN_PRICES[plan][currency];
  return billing === "annual" ? monthly * 10 : monthly;
}

export type CheckoutRequest = {
  plan: PlanId;
  billing: Billing;
  method: PaymentMethod;
  lang: "zh" | "en";
  deviceId: string;
  origin: string;
};

const PLAN_NAMES: Record<PlanId, { zh: string; en: string }> = {
  soft: { zh: "轻揉", en: "Soft Start" },
  deep: { zh: "醒发", en: "Deep Practice" },
  atelier: { zh: "丰盛工坊", en: "Dough Atelier" },
};

/**
 * Builds the form body for Stripe's "create Checkout Session" call.
 * The device id travels as client_reference_id and as metadata, so the webhook can tell whose it is.
 */
export function buildCheckoutParams(request: CheckoutRequest): URLSearchParams {
  const { plan, billing, method, lang, deviceId, origin } = request;
  const params = new URLSearchParams();
  const subscription = method === "card";
  const currency = subscription ? "usd" : "cny";
  const name = `${lang === "zh" ? PLAN_NAMES[plan].zh : PLAN_NAMES[plan].en} · ${billing === "annual" ? (lang === "zh" ? "年付" : "Yearly") : (lang === "zh" ? "月付" : "Monthly")}`;

  params.set("mode", subscription ? "subscription" : "payment");
  params.set("success_url", `${origin}/pricing?paid=1`);
  params.set("cancel_url", `${origin}/pricing?canceled=1`);
  params.set("client_reference_id", deviceId);
  params.set("metadata[device_id]", deviceId);
  params.set("metadata[plan]", plan);
  params.set("metadata[billing]", billing);
  params.set("metadata[method]", method);
  params.set("locale", lang === "zh" ? "zh" : "en");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", currency);
  params.set("line_items[0][price_data][unit_amount]", String(amountFor(plan, billing, currency)));
  params.set("line_items[0][price_data][product_data][name]", `AlreaDough ${name}`);
  if (subscription) {
    params.set("line_items[0][price_data][recurring][interval]", billing === "annual" ? "year" : "month");
    params.set("subscription_data[metadata][device_id]", deviceId);
    params.set("subscription_data[metadata][plan]", plan);
    params.set("payment_method_types[0]", "card");
  } else {
    params.set("payment_method_types[0]", "alipay");
    params.set("payment_method_types[1]", "wechat_pay");
    params.set("payment_method_options[wechat_pay][client]", "web");
    params.set("payment_intent_data[metadata][device_id]", deviceId);
  }
  return params;
}

// ---- Stripe webhook signature (Stripe-Signature: t=...,v1=...) -------------------------------

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export async function signStripePayload(secret: string, timestamp: number, rawBody: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return toHex(signature);
}

/** True only when the header carries a valid signature for this exact body, made less than `toleranceSeconds` ago. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const candidates = parts.filter(([key]) => key === "v1").map(([, value]) => value || "");
  if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = await signStripePayload(secret, timestamp, rawBody);
  return candidates.some((candidate) => safeEqual(candidate, expected));
}

// ---- Turning a Stripe event into an entitlement change ---------------------------------------

export type EntitlementChange =
  | { kind: "grant"; deviceId: string; plan: PlanId; billing: Billing; method: PaymentMethod; periodEnd: string; customer: string | null; subscription: string | null; reference: string }
  | { kind: "extend"; subscription: string; periodEnd: string }
  | { kind: "revoke"; subscription: string }
  | { kind: "ignore" };

const DAY = 86_400_000;

type StripeEvent = { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/** Reads one verified Stripe event and says what to do. Never throws on an unexpected shape; it returns "ignore". */
export function entitlementFromEvent(event: StripeEvent, now = Date.now()): EntitlementChange {
  const object = event.data?.object || {};
  if (event.type === "checkout.session.completed") {
    const metadata = (object.metadata || {}) as Record<string, unknown>;
    const deviceId = text(metadata.device_id) || text(object.client_reference_id);
    const plan = metadata.plan;
    const billing = metadata.billing;
    const method = metadata.method;
    // A delayed method such as a bank debit can complete before the money arrives. Only grant on "paid".
    if (object.payment_status !== "paid") return { kind: "ignore" };
    if (!deviceId || !isPlan(plan) || !isBilling(billing) || !isMethod(method)) return { kind: "ignore" };
    const subscription = text(object.subscription);
    const periodEnd = new Date(now + (billing === "annual" ? 366 : 31) * DAY).toISOString();
    return { kind: "grant", deviceId, plan, billing, method, periodEnd, customer: text(object.customer), subscription, reference: text(object.id) || text(event.id) || "" };
  }
  if (event.type === "invoice.paid") {
    const subscription = text(object.subscription);
    const lines = ((object.lines as { data?: Array<{ period?: { end?: number } }> } | undefined)?.data) || [];
    const end = Math.max(0, ...lines.map((line) => Number(line.period?.end) || 0));
    if (!subscription || !end) return { kind: "ignore" };
    return { kind: "extend", subscription, periodEnd: new Date(end * 1000).toISOString() };
  }
  if (event.type === "customer.subscription.deleted") {
    const subscription = text(object.id);
    return subscription ? { kind: "revoke", subscription } : { kind: "ignore" };
  }
  return { kind: "ignore" };
}

/** Whether a stored entitlement is still in force. */
export function isActive(entitlement: { status: string; periodEnd: string } | null, now = Date.now()) {
  return !!entitlement && entitlement.status === "active" && Date.parse(entitlement.periodEnd) > now;
}

// ---- Switches --------------------------------------------------------------------------------

export type PaymentsConfig = { enabled: boolean; stripeKey: string; webhookSecret: string };

/** Payments run only when PAYMENTS_ENABLED=1 and both Stripe secrets exist. */
export function paymentsConfig(env: Record<string, string | undefined>): PaymentsConfig {
  const stripeKey = env.STRIPE_SECRET_KEY || "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || "";
  return { enabled: env.PAYMENTS_ENABLED === "1" && !!stripeKey && !!webhookSecret, stripeKey, webhookSecret };
}

/** Mainland China has no legitimate channel yet, so visitors from there only ever see the reservation form. */
export function channelFor(country: string | null, config: PaymentsConfig): "stripe" | "reserve" {
  if (!config.enabled) return "reserve";
  if (country === "CN") return "reserve";
  return "stripe";
}
