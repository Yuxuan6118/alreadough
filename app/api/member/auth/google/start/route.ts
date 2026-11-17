import { base64Url, googleAuthReady, supabaseAuthOrigin } from "@/lib/member-auth";
import { flowCookie, googleDirect, sha256Hex } from "@/lib/google-direct";

// Sends the browser to Google (PKCE). The verifier, and for the direct flow the state and nonce, stay in short-lived
// HttpOnly cookies.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!googleAuthReady()) return Response.redirect(`${origin}/app?login=unavailable`, 302);
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", flowCookie("pkce", verifier));
  let authorize: URL;
  if (googleDirect()) {
    const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
    const nonce = base64Url(crypto.getRandomValues(new Uint8Array(24)));
    authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: `${origin}/api/member/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce: await sha256Hex(nonce),
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    headers.append("Set-Cookie", flowCookie("gstate", state));
    headers.append("Set-Cookie", flowCookie("gnonce", nonce));
  } else {
    authorize = new URL(`${supabaseAuthOrigin()}/auth/v1/authorize`);
    authorize.search = new URLSearchParams({
      provider: "google",
      redirect_to: `${origin}/api/member/auth/google/callback`,
      code_challenge: challenge,
      code_challenge_method: "s256",
    }).toString();
  }
  headers.set("Location", authorize.toString());
  return new Response(null, { status: 302, headers });
}
