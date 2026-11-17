import { base64Url, googleAuthReady, supabaseAuthOrigin } from "@/lib/member-auth";

// Sends the browser to Google through Supabase (PKCE). The verifier stays in a short-lived HttpOnly cookie.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!googleAuthReady()) return Response.redirect(`${origin}/app?login=unavailable`, 302);
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const authorize = new URL(`${supabaseAuthOrigin()}/auth/v1/authorize`);
  authorize.search = new URLSearchParams({
    provider: "google",
    redirect_to: `${origin}/api/member/auth/google/callback`,
    code_challenge: challenge,
    code_challenge_method: "s256",
  }).toString();
  return new Response(null, { status: 302, headers: {
    Location: authorize.toString(),
    "Set-Cookie": `__Host-alreadough-pkce=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    "Cache-Control": "no-store",
  } });
}
