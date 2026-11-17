import { createMemberSession, googleAuthReady, readCookie, supabaseAuthOrigin } from "@/lib/member-auth";

const clearPkce = "__Host-alreadough-pkce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

// Supabase sends the browser back here with a one-time code; it is exchanged with the verifier for the user.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (location: string, session?: string) => {
    const headers = new Headers({ Location: `${url.origin}${location}`, "Cache-Control": "no-store" });
    if (session) headers.append("Set-Cookie", session);
    headers.append("Set-Cookie", clearPkce);
    return new Response(null, { status: 302, headers });
  };
  const code = url.searchParams.get("code");
  const verifier = readCookie(request, "__Host-alreadough-pkce");
  if (!googleAuthReady() || !code || !verifier || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return back("/app?login=failed");
  try {
    const response = await fetch(`${supabaseAuthOrigin()}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_AUTH_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error("google sign-in exchange refused", { status: response.status });
      return back("/app?login=failed");
    }
    const data = await response.json() as { user?: { id?: string } };
    if (!data.user?.id) return back("/app?login=failed");
    return back("/app", await createMemberSession(data.user.id));
  } catch (error) {
    console.error("google sign-in failed", { error: String(error).slice(0, 200) });
    return back("/app?login=failed");
  }
}
