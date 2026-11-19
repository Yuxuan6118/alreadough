import { env } from "cloudflare:workers";
import { rememberContact } from "./mailing";

const cookieName = "__Host-alreadough";
const sessionMs = 30 * 24 * 60 * 60 * 1000;
const noStore = { "Cache-Control": "no-store" };
let authTablesReady: Promise<void> | null = null;

export function memberAuthReady() {
  return Boolean(process.env.SUPABASE_AUTH_URL && process.env.SUPABASE_AUTH_KEY && process.env.AUTH_EMAIL_ENABLED === "1");
}

export async function ensureMemberAuthTables() {
  if (authTablesReady) return authTablesReady;
  authTablesReady = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS member_accounts (provider_id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS member_sessions (token_hash TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS member_sessions_expiry ON member_sessions (expires_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS member_auth_limits (key TEXT PRIMARY KEY NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL)"),
  ]).then(() => undefined).catch((error: unknown) => { authTablesReady = null; throw error; });
  return authTablesReady;
}

export async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function memberCookie(token: string, maxAge = sessionMs / 1000) {
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function memberJson(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, { status, headers: { ...noStore, ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}

export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function tokenFrom(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1) || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function memberAccount(request: Request) {
  const token = tokenFrom(request);
  if (!token) return null;
  await ensureMemberAuthTables();
  const row = await env.DB.prepare("SELECT account_id AS accountId FROM member_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(token), Date.now()).first<{ accountId: string }>();
  return row?.accountId || null;
}

export async function revokeMemberSession(request: Request) {
  const token = tokenFrom(request);
  if (token) {
    await ensureMemberAuthTables();
    await env.DB.prepare("DELETE FROM member_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
}

export async function createMemberSession(providerId: string, email?: string | null) {
  await ensureMemberAuthTables();
  const accountId = `app:${providerId}`;
  await env.DB.prepare("INSERT OR IGNORE INTO member_accounts (provider_id, account_id, created_at) VALUES (?, ?, ?)").bind(providerId, accountId, Date.now()).run();
  const account = await env.DB.prepare("SELECT account_id AS accountId FROM member_accounts WHERE provider_id = ?").bind(providerId).first<{ accountId: string }>();
  if (!account) throw new Error("ACCOUNT_CREATE_FAILED");
  await rememberContact(email, account.accountId);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("INSERT INTO member_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), account.accountId, Date.now() + sessionMs).run();
  return memberCookie(token);
}

export async function claimAuthLimit(request: Request, email: string, action: "send" | "verify") {
  await ensureMemberAuthTables();
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rules = action === "send"
    ? [[`email:${email}`, 60_000, 1], [`email-day:${email}`, 86_400_000, 10], [`ip:${ip}`, 3_600_000, 20]]
    : [[`email:${email}`, 600_000, 10], [`ip:${ip}`, 600_000, 40]];
  for (const [label, windowMs, max] of rules) {
    const key = await sha256(`${action}:${label}`);
    const result = await env.DB.prepare(`INSERT INTO member_auth_limits (key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start,
      count = CASE WHEN member_auth_limits.window_start = excluded.window_start THEN member_auth_limits.count + 1 ELSE 1 END
      WHERE member_auth_limits.window_start != excluded.window_start OR member_auth_limits.count < ?`)
      .bind(key, Math.floor(Date.now() / Number(windowMs)), max).run();
    if (!result.meta.changes) return false;
  }
  return true;
}

/** Google sign-in goes through the same Supabase project; it is offered only once the provider is set up there. */
export function googleAuthReady() {
  return memberAuthReady() && process.env.AUTH_GOOGLE_ENABLED === "1";
}

export function supabaseAuthOrigin() {
  const base = new URL(process.env.SUPABASE_AUTH_URL || "");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("AUTH_CONFIG_INVALID");
  return base.origin;
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
}

export function base64Url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function supabaseOtp(path: "otp" | "verify", body: Record<string, unknown>) {
  const base = new URL(process.env.SUPABASE_AUTH_URL || "");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("AUTH_CONFIG_INVALID");
  return fetch(`${base.origin}/auth/v1/${path}`, { method: "POST", headers: { apikey: process.env.SUPABASE_AUTH_KEY || "", "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
}
