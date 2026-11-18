import { memberAccount, memberJson, sameOrigin } from "@/lib/member-auth";
import { createMemberOrder, isPaidPlan, isUnlimitedAccount, membershipEnabled } from "@/lib/membership";
import { createWaffoCheckout, waffoAvailableFor, waffoConfig } from "@/lib/waffo";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  const config = waffoConfig();
  if (!membershipEnabled() || !config.enabled) return memberJson({ error: "PAYMENTS_OFF" }, 503);
  const account = await memberAccount(request);
  if (!account) return memberJson({ error: "SIGN_IN_REQUIRED" }, 401);
  if (!waffoAvailableFor(account, isUnlimitedAccount, config)) return memberJson({ error: "PAYMENTS_OFF" }, 503);
  const body = await request.json().catch(() => null) as { plan?: unknown; lang?: unknown } | null;
  if (!isPaidPlan(body?.plan)) return memberJson({ error: "INVALID_PLAN" }, 400);
  const order = await createMemberOrder(account, body.plan);
  try {
    const url = await createWaffoCheckout({ plan: order.plan, orderId: order.orderId, origin: new URL(request.url).origin, lang: body.lang === "en" ? "en" : "zh" }, config);
    return memberJson({ url });
  } catch (error) {
    console.error("waffo checkout failed", error instanceof Error ? error.message : error);
    return memberJson({ error: "CHECKOUT_FAILED" }, 502);
  }
}
