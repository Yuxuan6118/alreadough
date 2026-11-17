import { createMemberSession, googleAuthReady, readCookie, supabaseAuthOrigin } from "@/lib/member-auth";
import { flowCookie, googleDirect } from "@/lib/google-direct";

const cookiePattern = /^[A-Za-z0-9_-]{32,128}$/;

// Google (direct flow) or Supabase sends the browser back here with a one-time code, exchanged for the user.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (location: string, session?: string) => {
    const headers = new Headers({ Location: `${url.origin}${location}`, "Cache-Control": "no-store" });
    if (session) headers.append("Set-Cookie", session);
    for (const name of ["pkce", "gstate", "gnonce"]) headers.append("Set-Cookie", flowCookie(name, "", 0));
    return new Response(null, { status: 302, headers });
  };
  const code = url.searchParams.get("code");
  const verifier = readCookie(request, "__Host-alreadough-pkce");
  if (!googleAuthReady() || !code || !verifier || !cookiePattern.test(verifier)) return back("/app?login=failed");
  const supabase = (grant: string, body: Record<string, string>) => fetch(`${supabaseAuthOrigin()}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_AUTH_KEY || "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  try {
    let response: Response;
    if (googleDirect() && url.searchParams.has("state")) {
      const state = readCookie(request, "__Host-alreadough-gstate");
      const nonce = readCookie(request, "__Host-alreadough-gnonce");
      if (!state || state !== url.searchParams.get("state") || !nonce || !cookiePattern.test(nonce)) return back("/app?login=failed");
      const google = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: `${url.origin}/api/member/auth/google/callback`,
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const tokens = await google.json().catch(() => ({})) as { id_token?: string; error?: string };
      if (!google.ok || !tokens.id_token) {
        console.error("google token exchange refused", { status: google.status, error: tokens.error });
        return back("/app?login=failed");
      }
      response = await supabase("id_token", { provider: "google", id_token: tokens.id_token, nonce });
    } else {
      response = await supabase("pkce", { auth_code: code, code_verifier: verifier });
    }
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
