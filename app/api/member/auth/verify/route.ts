import { claimAuthLimit, createMemberSession, memberAuthReady, memberJson, normalizeEmail, sameOrigin, supabaseOtp } from "@/lib/member-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  if (!memberAuthReady()) return memberJson({ error: "AUTH_UNAVAILABLE" }, 503);
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email || typeof body?.code !== "string" || !/^\d{6,8}$/.test(body.code)) return memberJson({ error: "INVALID_CODE" }, 400);
  if (!(await claimAuthLimit(request, email, "verify"))) return memberJson({ error: "TOO_MANY_REQUESTS" }, 429);
  try {
    const response = await supabaseOtp("verify", { email, token: body.code, type: "email" });
    if (!response.ok) return memberJson({ error: "INVALID_CODE" }, 400);
    const result = await response.json() as { user?: { id?: string; email?: string; email_confirmed_at?: string } };
    const user = result.user;
    if (!user?.id || !user.email_confirmed_at || user.email?.toLowerCase() !== email) return memberJson({ error: "INVALID_CODE" }, 400);
    return memberJson({ authenticated: true }, 200, await createMemberSession(user.id, user.email));
  } catch { return memberJson({ error: "AUTH_UNAVAILABLE" }, 503); }
}
