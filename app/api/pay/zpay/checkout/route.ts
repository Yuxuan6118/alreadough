import { memberAccount, memberJson, sameOrigin } from "@/lib/member-auth";
import { createMemberOrder, isPaidPlan, membershipEnabled } from "@/lib/membership";
import { ZPAY_CHECKOUT_URL, zpayConfig, zpayFields } from "@/lib/zpay";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  const config = zpayConfig();
  if (!membershipEnabled() || !config.enabled) return memberJson({ error: "PAYMENTS_OFF" }, 503);
  const account = await memberAccount(request);
  if (!account) return memberJson({ error: "SIGN_IN_REQUIRED" }, 401);
  const body = await request.json().catch(() => null) as { plan?: unknown } | null;
  if (!isPaidPlan(body?.plan)) return memberJson({ error: "INVALID_PLAN" }, 400);
  const order = await createMemberOrder(account, body.plan);
  return memberJson({ action: ZPAY_CHECKOUT_URL,
    fields: zpayFields({ ...config, orderId: order.orderId, amountFen: order.amountFen, plan: order.plan, origin: new URL(request.url).origin }) });
}
