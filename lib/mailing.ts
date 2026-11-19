import { env } from "cloudflare:workers";

// Mail to signed-in users. Everyone who signs in (email code or Google) is on the list by default;
// every letter carries a one-click unsubscribe link, and an unsubscribed address stays off for good.
// Sending goes through Resend from hello@alreadough.com (Worker secret RESEND_API_KEY).

const FROM = "AlreaDough <hello@alreadough.com>";
const SITE = "https://alreadough.com";
let ready: Promise<void> | null = null;

function base64Url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function mailReady() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && unsubscribeSecret());
}

function unsubscribeSecret() {
  return (process.env.MAIL_UNSUBSCRIBE_SECRET || process.env.BETA_FOUNDER_SECRET || "").trim();
}

export async function ensureMailTables() {
  if (ready) return ready;
  ready = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS mail_contacts (email TEXT PRIMARY KEY NOT NULL, account_id TEXT, subscribed INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS mail_sends (id TEXT PRIMARY KEY NOT NULL, audience TEXT NOT NULL, subject TEXT NOT NULL, recipients INTEGER NOT NULL, delivered INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
  ]).then(() => undefined).catch((error: unknown) => { ready = null; throw error; });
  return ready;
}

/** Called on every sign-in. Keeps an earlier unsubscribe in place. Never throws: mail must not block login. */
export async function rememberContact(email: string | null | undefined, accountId: string) {
  const address = email?.trim().toLowerCase();
  if (!address || !address.includes("@")) return;
  try {
    await ensureMailTables();
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO mail_contacts (email, account_id, subscribed, created_at, updated_at) VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at`)
      .bind(address, accountId, now, now).run();
  } catch (error) {
    console.error("mail contact not saved", { error: String(error).slice(0, 200) });
  }
}

async function sign(email: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(unsubscribeSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsubscribe:${email}`)));
  return base64Url(mac.slice(0, 18));
}

export async function unsubscribeUrl(email: string) {
  const e = base64Url(new TextEncoder().encode(email));
  return `${SITE}/api/mail/unsubscribe?e=${e}&t=${await sign(email)}`;
}

/** Reads and checks an unsubscribe link. Returns the address, or null when the link was altered. */
export async function verifyUnsubscribe(e: string | null, t: string | null) {
  if (!e || !t || !unsubscribeSecret()) return null;
  try {
    const email = new TextDecoder().decode(Uint8Array.from(atob(e.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
    const expected = await sign(email);
    if (expected.length !== t.length) return null;
    let mismatch = 0;
    for (let i = 0; i < t.length; i += 1) mismatch |= expected.charCodeAt(i) ^ t.charCodeAt(i);
    return mismatch === 0 ? email : null;
  } catch { return null; }
}

export async function unsubscribe(email: string) {
  await ensureMailTables();
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO mail_contacts (email, account_id, subscribed, created_at, updated_at) VALUES (?, NULL, 0, ?, ?)
    ON CONFLICT(email) DO UPDATE SET subscribed = 0, updated_at = excluded.updated_at`).bind(email, now, now).run();
}

export async function audienceStats() {
  await ensureMailTables();
  const row = await env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(subscribed), 0) AS subscribed FROM mail_contacts").first<{ total: number; subscribed: number }>();
  const sends = await env.DB.prepare("SELECT audience, subject, recipients, delivered, created_at AS createdAt FROM mail_sends ORDER BY created_at DESC LIMIT 20").all();
  return { total: row?.total || 0, subscribed: row?.subscribed || 0, sends: sends.results };
}

async function subscribedEmails() {
  await ensureMailTables();
  const rows = await env.DB.prepare("SELECT email FROM mail_contacts WHERE subscribed = 1 ORDER BY created_at").all<{ email: string }>();
  return rows.results.map((row: { email: string }) => row.email);
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function letter(to: string, subject: string, body: string) {
  const link = await unsubscribeUrl(to);
  const text = `${body}\n\n—\nAlreaDough · ${SITE}\n不想再收到这类邮件 / Unsubscribe: ${link}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;font-size:16px;line-height:1.7;color:#2b2622;max-width:560px">`
    + `<div>${escapeHtml(body).replace(/\n/g, "<br>")}</div>`
    + `<p style="margin-top:40px;font-size:12px;color:#8a817a">AlreaDough · <a href="${SITE}" style="color:#8a817a">alreadough.com</a><br>`
    + `<a href="${link}" style="color:#8a817a">不想再收到这类邮件 · Unsubscribe</a></p></div>`;
  return {
    from: FROM,
    to: [to],
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

async function sendBatch(emails: Awaited<ReturnType<typeof letter>>[]) {
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(emails),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { name?: string; message?: string } | null;
    throw new Error(`RESEND_${response.status}: ${detail?.name || ""} ${detail?.message || ""}`.trim());
  }
}

export type Audience = "test" | "all";

/** Sends one letter. "test" goes to a single address; "all" to every subscribed contact, 100 per Resend batch. */
export async function sendLetter(audience: Audience, subject: string, body: string, testEmail?: string) {
  const recipients: string[] = audience === "test" ? [testEmail as string] : await subscribedEmails();
  let delivered = 0;
  let failure: string | null = null;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    try {
      await sendBatch(await Promise.all(chunk.map(to => letter(to, subject, body))));
      delivered += chunk.length;
    } catch (error) {
      failure = String(error).slice(0, 300);
      break;
    }
    if (i + 100 < recipients.length) await new Promise(resolve => setTimeout(resolve, 600)); // Resend allows ~2 requests/s
  }
  await ensureMailTables();
  await env.DB.prepare("INSERT INTO mail_sends (id, audience, subject, recipients, delivered, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), audience, subject, recipients.length, delivered, Date.now()).run();
  return { recipients: recipients.length, delivered, failure };
}
