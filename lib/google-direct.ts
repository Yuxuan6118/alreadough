// Google sign-in on our own domain. When GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set (the same OAuth client
// Supabase uses), Google's consent page names alreadough.com instead of the Supabase project address. The site gets
// Google's ID token itself and hands it to Supabase (grant_type=id_token), so accounts are exactly the same as before.
// Without the two secrets, sign-in keeps going through Supabase's own Google redirect.

export function googleDirect() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const flowCookie = (name: string, value: string, maxAge = 600) =>
  `__Host-alreadough-${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** Google gets the SHA-256 of the nonce (hex); Supabase gets the nonce itself and checks it against the ID token. */
export async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
