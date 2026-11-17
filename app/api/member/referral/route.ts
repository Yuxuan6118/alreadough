import { claimAuthLimit, memberAccount, memberJson, sameOrigin } from "@/lib/member-auth";
import { isReferralCode, membershipEnabled, redeemReferral } from "@/lib/membership";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  if (!membershipEnabled()) return memberJson({ error: "MEMBERSHIP_OFF" }, 503);
  const account = await memberAccount(request);
  if (!account) return memberJson({ error: "SIGN_IN_REQUIRED" }, 401);
  // Same attempt limits as email codes, so the invitation code cannot be guessed by brute force.
  if (!(await claimAuthLimit(request, `referral:${account}`, "verify"))) return memberJson({ error: "TOO_MANY_REQUESTS" }, 429);
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  if (!isReferralCode(body?.code)) return memberJson({ error: "INVALID_REFERRAL" }, 400);
  try {
    const result = await redeemReferral(account, String(body?.code));
    return result.ok ? memberJson({ membership: result.membership }) : memberJson({ error: result.error }, 409);
  } catch { return memberJson({ error: "REFERRAL_FAILED" }, 503); }
}
