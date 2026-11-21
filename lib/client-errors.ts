import { env } from "cloudflare:workers";
import { readClientInfo } from "./client-info";
import { claimWindow } from "./member-auth";

/** Per browser address an hour, and for the whole site a day: a crash loop or a bot cannot fill the table. */
const PER_ADDRESS_HOURLY = 20;
const SITE_DAILY = 500;

const clip = (value: string | null, max: number) => (value || "").replace(/\p{Cc}+/gu, " ").trim().slice(0, max);

/**
 * Stores one page crash: the error message, a short stack and the page path, plus the coarse kind of device.
 * Nothing that identifies the person (no account, device id or address is kept). Returns false when skipped.
 */
export async function recordClientError(request: Request, now = Date.now()) {
  const params = new URL(request.url).searchParams;
  const message = clip(params.get("m"), 300);
  if (!message) return false;
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await claimWindow(`client-error:${address}`, 3_600_000, PER_ADDRESS_HOURLY))) return false;
  if (!(await claimWindow("client-error:site", 86_400_000, SITE_DAILY))) return false;
  const path = clip(params.get("u"), 200);
  const stack = clip(params.get("s"), 600);
  const info = readClientInfo(request.headers, (request as Request & { cf?: Record<string, unknown> }).cf);
  console.error("page crash", { message, path, device: info.device, os: info.os, browser: info.browser });
  await env.DB.prepare("INSERT INTO client_errors (id, created_at_ms, message, stack, path, device, os, browser) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), now, message, stack || null, path || null, info.device, info.os, info.browser).run();
  return true;
}

/** For the founder cockpit: crashes in the last 7 days and the most recent ones. */
export async function recentClientErrors(now = Date.now()) {
  const since = now - 7 * 86_400_000;
  const [count, recent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM client_errors WHERE created_at_ms >= ?").bind(since).first<{ n: number }>(),
    env.DB.prepare("SELECT created_at_ms AS createdAt, message, path, device, os, browser FROM client_errors ORDER BY created_at_ms DESC LIMIT 20")
      .all<{ createdAt: number; message: string; path: string | null; device: string | null; os: string | null; browser: string | null }>(),
  ]);
  return { last7: count?.n || 0, recent: recent.results || [] };
}
