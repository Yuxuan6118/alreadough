import { memberAccount, memberAuthReady, memberJson } from "@/lib/member-auth";
import { membershipEnabled, membershipForRequest } from "@/lib/membership";
import { zpayConfig } from "@/lib/zpay";

export async function GET(request: Request) {
  const account = await memberAccount(request);
  return memberJson({ enabled: membershipEnabled(), emailAvailable: memberAuthReady(), authenticated: !!account,
    checkoutAvailable: membershipEnabled() && zpayConfig().enabled,
    membership: account ? await membershipForRequest(request) : null });
}
