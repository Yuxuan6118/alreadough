import { googleAuthReady, memberAccount, memberAuthReady, memberJson } from "@/lib/member-auth";
import { isUnlimitedAccount, membershipEnabled, membershipForRequest } from "@/lib/membership";
import { waffoAvailableFor } from "@/lib/waffo";
import { zpayConfig } from "@/lib/zpay";

export async function GET(request: Request) {
  const account = await memberAccount(request);
  return memberJson({ enabled: membershipEnabled(), emailAvailable: memberAuthReady(), googleAvailable: googleAuthReady(), authenticated: !!account,
    checkoutAvailable: membershipEnabled() && zpayConfig().enabled,
    cardCheckoutAvailable: membershipEnabled() && waffoAvailableFor(account, isUnlimitedAccount),
    membership: account ? await membershipForRequest(request) : null });
}
