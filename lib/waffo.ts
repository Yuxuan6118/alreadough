import type { OrderItem } from "./membership";

/**
 * Waffo Pancake (merchant of record) card checkout: Visa, Mastercard, Apple Pay, Google Pay.
 * Each purchase is a one-time 30-day pass, the same as Alipay; nothing renews.
 * Signing follows https://docs.waffo.ai/api-reference/authentication and uses WebCrypto, so no SDK is needed.
 */
const WAFFO_API = "https://api.waffo.ai";
export const WAFFO_STORE_ID = "STO_3fCRdcbiMOjIUqwryxPUqi";
/**
 * Checkout runs in USD: on Waffo a CNY price can only be paid with WeChat Pay, while USD opens cards, Apple Pay,
 * Google Pay and WeChat Pay. Buyers are shown their local currency. Set so that after Waffo's 3.9% + $0.50 fee
 * the payout is about what Alipay brings in for ¥39 / ¥149 / ¥9.9 (at ~7.1 CNY/USD). Change together with the product prices in Waffo.
 */
export const WAFFO_CURRENCY = "USD";
export const WAFFO_PRICE_CENTS: Record<OrderItem, number> = { deep: 649, atelier: 2299, screenshots: 199, chats: 299 };

// Waffo's webhook signing keys, copied from @waffo/pancake-ts 0.28.0 (src/webhooks.ts).
const WEBHOOK_KEYS = {
  test: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxnmRY6yMMA3lVqmAU6ZGb1sjL/+r/z6E+ZjkXaDAKiqOhk9rpazni0bNsGXwmftTPk9jy2wn+j6JHODD/WH/SCnSfvKkLIjy4Hk7BuCgB174C0ydan7J+KgXLkOwgCAxxB68t2tezldwo74ZpXgnF49opzMvQ9prEwIAWOE+kV9iK6gx/AckSMtHIHpUesoPDkldpmFHlB2qpf1vsFTZ5kD6DmGl+2GIVK01aChy2lk8pLv0yUMu18v44sLkO5M44TkGPJD9qG09wrvVG2wpOTVCn1n5pP8P+HRLcgzbUB3OlZVfdFurn6EZwtyL4ZD9kdkQ4EZE/9inKcp3c1h4xwIDAQAB",
  prod: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+xApdTIb4ua+DgZKQ54iBsD82ybyhGCLRETONW4Jgbb3A8DUM1LqBk6r/CmTOCHqLalTQHNigvP3R5zkDNXiRJz6gA4MJ/+8K0+mnEE2RISQzN+Qu65TNd6svb+INm/kMaftY4uIXr6y6kchtTJdwnQhcKdAL2v7h7IFnkVelQsKxDdb2PqX8xX/qwd01iXvMcpCCaXovUwZsxH2QN5ZKBTseJivbhUeyJCco4fdUyxOMHe2ybCVhyvim2uxAl1nkvL5L8RCWMCAV55LLo09OhmLahz/DYNu13YLVP6dvIT09ZFBYU6Owj1NxdinTynlJCFS9VYwBgmftosSE1UdwIDAQAB",
} as const;
const WEBHOOK_MAX_AGE_MS = 45 * 60 * 1000;
const WEBHOOK_MAX_FUTURE_MS = 60 * 1000;

export type WaffoEnv = "test" | "prod";

export function waffoConfig() {
  const merchantId = process.env.WAFFO_MERCHANT_ID || "";
  const privateKey = process.env.WAFFO_PRIVATE_KEY || "";
  const env: WaffoEnv = process.env.WAFFO_ENV === "prod" ? "prod" : "test";
  // The screenshot-import and chat-pack products are optional: without WAFFO_PRODUCT_SCREENSHOTS / WAFFO_PRODUCT_CHATS
  // that item is sold by Alipay only.
  const products: Record<OrderItem, string> = { deep: process.env.WAFFO_PRODUCT_DEEP || "", atelier: process.env.WAFFO_PRODUCT_ATELIER || "", screenshots: process.env.WAFFO_PRODUCT_SCREENSHOTS || "", chats: process.env.WAFFO_PRODUCT_CHATS || "" };
  const enabled = process.env.WAFFO_ENABLED === "1" && !!merchantId && !!privateKey && !!products.deep && !!products.atelier;
  return { enabled, merchantId, privateKey, env, products };
}

/** In test mode only the founder's own account sees card checkout, so nobody can get a membership with a test card. */
export function waffoAvailableFor(accountId: string | null, isFounder: (id: string) => boolean, config = waffoConfig(), item?: OrderItem) {
  return config.enabled && (!item || !!config.products[item]) && (config.env === "prod" || (!!accountId && isFounder(accountId)));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function pemBody(pem: string) {
  return pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) [A-Z ]+-----/g, "").replace(/\s+/g, "");
}

let signingKey: { raw: string; key: Promise<CryptoKey> } | null = null;
function importSigningKey(raw: string) {
  if (signingKey?.raw !== raw) {
    signingKey = { raw, key: crypto.subtle.importKey("pkcs8", base64ToBytes(pemBody(raw)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]) };
  }
  return signingKey.key;
}

const verifyKeys = new Map<WaffoEnv, Promise<CryptoKey>>();
function importVerifyKey(env: WaffoEnv) {
  let key = verifyKeys.get(env);
  if (!key) {
    key = crypto.subtle.importKey("spki", base64ToBytes(WEBHOOK_KEYS[env]), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    verifyKeys.set(env, key);
  }
  return key;
}

/** Signed POST to the Waffo API. Throws with Waffo's own message on any error. */
export async function waffoPost<T>(path: string, body: unknown, config = waffoConfig()): Promise<T> {
  const bodyText = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = bytesToBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyText)));
  const canonical = `POST\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importSigningKey(config.privateKey), new TextEncoder().encode(canonical));
  const response = await fetch(`${WAFFO_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Merchant-Id": config.merchantId, "X-Timestamp": timestamp, "X-Signature": bytesToBase64(signature) },
    body: bodyText,
    signal: AbortSignal.timeout(10_000),
  });
  const envelope = await response.json().catch(() => null) as { data?: T; errors?: { message: string }[] } | null;
  if (!response.ok || !envelope || envelope.errors?.length || !envelope.data) {
    throw new Error(`WAFFO_${response.status}: ${envelope?.errors?.map(e => e.message).join("; ") || "no data"}`);
  }
  return envelope.data;
}

export async function createWaffoCheckout(args: { plan: OrderItem; orderId: string; origin: string; lang: "zh" | "en" }, config = waffoConfig()) {
  const session = await waffoPost<{ sessionId: string; checkoutUrl: string }>("/v1/actions/checkout/create-session", {
    productId: config.products[args.plan],
    productType: "onetime",
    currency: WAFFO_CURRENCY,
    successUrl: `${args.origin}${args.lang === "en" ? "/en/checkout" : "/checkout"}?paid=card&${args.plan === "screenshots" || args.plan === "chats" ? "item" : "plan"}=${args.plan}`,
    expiresInSeconds: 3600,
    metadata: { orderId: args.orderId, plan: args.plan },
    orderMerchantExternalId: args.orderId,
    language: args.lang === "en" ? "en" : "zh-Hans",
  }, config);
  return config.env === "test" ? `${session.checkoutUrl}?test=true` : session.checkoutUrl;
}

export type WaffoWebhookEvent = {
  id: string;
  eventType: string;
  eventId: string;
  storeId: string;
  mode: WaffoEnv;
  data: {
    orderId?: string;
    currency?: string;
    orderMetadata?: Record<string, unknown>;
    orderMerchantExternalId?: string;
    paymentId?: string;
    paymentStatus?: string;
    listPrice?: { total?: string };
    total?: string;
    amount?: string;
  };
};

/** Verifies `X-Waffo-Signature: t=<ms>,v1=<base64>` over `${t}.${rawBody}` with the given environment's key. */
export async function verifyWaffoWebhook(rawBody: string, header: string | null, env: WaffoEnv, now = Date.now()) {
  if (!header) return null;
  let t = "", v1 = "";
  for (const pair of header.split(",")) {
    const at = pair.indexOf("=");
    if (at < 0) continue;
    const name = pair.slice(0, at).trim(), value = pair.slice(at + 1).trim();
    if (name === "t") t = value; else if (name === "v1") v1 = value;
  }
  const sentAt = Number(t);
  if (!t || !v1 || !Number.isFinite(sentAt) || now - sentAt > WEBHOOK_MAX_AGE_MS || sentAt - now > WEBHOOK_MAX_FUTURE_MS) return null;
  let signature: Uint8Array<ArrayBuffer>;
  try { signature = base64ToBytes(v1); } catch { return null; }
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", await importVerifyKey(env), signature, new TextEncoder().encode(`${t}.${rawBody}`));
  if (!ok) return null;
  try { return JSON.parse(rawBody) as WaffoWebhookEvent; } catch { return null; }
}

/** "39.00" -> 3900. Waffo sends display-format strings in the pricing currency. */
export function displayAmountFen(value: unknown) {
  const match = typeof value === "string" ? /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value) : null;
  return match ? Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0")) : null;
}
