import { claimAuthLimit, memberAuthReady, memberJson, normalizeEmail, sameOrigin, supabaseOtp } from "@/lib/member-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return memberJson({ error: "INVALID_ORIGIN" }, 403);
  if (!memberAuthReady()) return memberJson({ error: "AUTH_UNAVAILABLE" }, 503);
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return memberJson({ error: "INVALID_EMAIL" }, 400);
  if (!(await claimAuthLimit(request, email, "send"))) return memberJson({ error: "TOO_MANY_REQUESTS" }, 429);
  try {
    const response = await supabaseOtp("otp", { email, create_user: true });
    if (response.ok) return memberJson({ sent: true });
    // Log why the auth provider refused, never the address itself.
    const detail = await response.json().catch(() => null) as { error_code?: string; error?: string } | null;
    console.error("member otp refused", { status: response.status, code: detail?.error_code || detail?.error || "unknown" });
    return memberJson({ error: "DELIVERY_UNAVAILABLE" }, 503);
  } catch (error) {
    console.error("member otp failed", { error: String(error).slice(0, 200) });
    return memberJson({ error: "DELIVERY_UNAVAILABLE" }, 503);
  }
}
