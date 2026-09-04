import { env } from "cloudflare:workers";

export type BetaMode = "chat" | "revision" | "story";
export type TokenUsage = { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;

const LIMITS = {
  trialDays: Number(process.env.BETA_TRIAL_DAYS || 7),
  total: Number(process.env.BETA_TOTAL_REQUESTS || 80),
  daily: { chat: 15, revision: 3, story: 1 } as Record<BetaMode, number>,
  globalRequests: Number(process.env.BETA_GLOBAL_DAILY_REQUESTS || 300),
  globalTokens: Number(process.env.BETA_GLOBAL_DAILY_TOKENS || 2_000_000),
};

type UserRow = { started_at: string; expires_at: string; total_requests: number; total_tokens: number; active: number };
type DailyRow = { request_count: number; chat_requests: number; revision_requests: number; story_requests: number; input_tokens: number; output_tokens: number; total_tokens: number };
type GlobalRow = { request_count: number; total_tokens: number };

export type BetaTicket = { reservationId: string; userId: string; userHash: string; day: string; mode: BetaMode };

export async function ensureBetaTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS beta_users (user_id TEXT PRIMARY KEY NOT NULL, started_at TEXT NOT NULL, expires_at TEXT NOT NULL, total_requests INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS beta_usage_daily (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0, chat_requests INTEGER NOT NULL DEFAULT 0, revision_requests INTEGER NOT NULL DEFAULT 0, story_requests INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, failed_requests INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, usage_date))`,
    `CREATE TABLE IF NOT EXISTS beta_global_daily (usage_date TEXT PRIMARY KEY NOT NULL, request_count INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, failed_requests INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS beta_events (id TEXT PRIMARY KEY NOT NULL, user_hash TEXT NOT NULL, event_type TEXT NOT NULL, mode TEXT, wish_category TEXT, coach_mode TEXT, prompt_version TEXT, feedback TEXT, rating_before INTEGER, rating_after INTEGER, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS beta_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS beta_request_reservations (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, user_hash TEXT NOT NULL, usage_date TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'reserved', created_at TEXT NOT NULL, settled_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS beta_events_created_idx ON beta_events(created_at)`,
    `CREATE INDEX IF NOT EXISTS beta_events_user_idx ON beta_events(user_hash, created_at)`,
    `CREATE INDEX IF NOT EXISTS beta_reservations_user_idx ON beta_request_reservations(user_id, created_at)`,
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
}

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function isoAfterDays(days: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); }
function modeColumn(mode: BetaMode) { return `${mode}_requests`; }

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`already-beta:${value}`));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requestIdentity(request: Request, sessionId?: string) {
  const id = request.headers.get("oai-authenticated-user-id");
  if (id) return id;
  const host = new URL(request.url).hostname;
  if ((host === "localhost" || host === "127.0.0.1") && sessionId) return `local:${sessionId.slice(0, 128)}`;
  return null;
}

export async function betaStatus(request: Request, sessionId?: string) {
  await ensureBetaTables();
  const userId = requestIdentity(request, sessionId);
  if (!userId) return { authenticated: false as const };
  const now = new Date().toISOString();
  const day = dayKey();
  let user = await env.DB.prepare("SELECT started_at, expires_at, total_requests, total_tokens, active FROM beta_users WHERE user_id = ?").bind(userId).first<UserRow>();
  if (!user) {
    await env.DB.prepare("INSERT OR IGNORE INTO beta_users (user_id, started_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?)").bind(userId, now, isoAfterDays(LIMITS.trialDays), now).run();
    user = await env.DB.prepare("SELECT started_at, expires_at, total_requests, total_tokens, active FROM beta_users WHERE user_id = ?").bind(userId).first<UserRow>();
  }
  const daily = await env.DB.prepare("SELECT request_count, chat_requests, revision_requests, story_requests, input_tokens, output_tokens, total_tokens FROM beta_usage_daily WHERE user_id = ? AND usage_date = ?").bind(userId, day).first<DailyRow>();
  const setting = await env.DB.prepare("SELECT value FROM beta_settings WHERE key = 'ai_enabled'").first<{ value: string }>();
  const used = { chat: daily?.chat_requests || 0, revision: daily?.revision_requests || 0, story: daily?.story_requests || 0 };
  return {
    authenticated: true as const,
    enabled: process.env.BETA_AI_ENABLED !== "false" && setting?.value !== "false",
    active: Boolean(user?.active),
    expired: !user || user.expires_at <= now,
    startedAt: user?.started_at,
    expiresAt: user?.expires_at,
    totalRequests: user?.total_requests || 0,
    totalTokens: user?.total_tokens || 0,
    usedToday: used,
    remaining: {
      chat: Math.max(0, LIMITS.daily.chat - used.chat),
      revision: Math.max(0, LIMITS.daily.revision - used.revision),
      story: Math.max(0, LIMITS.daily.story - used.story),
      total: Math.max(0, LIMITS.total - (user?.total_requests || 0)),
    },
    limits: { ...LIMITS.daily, total: LIMITS.total, trialDays: LIMITS.trialDays },
    resetAt: `${day}T24:00:00.000Z`,
  };
}

export async function beginBetaRequest(request: Request, sessionId: string, mode: BetaMode) {
  const status = await betaStatus(request, sessionId);
  if (!status.authenticated) return { ok: false as const, code: "SIGN_IN_REQUIRED" };
  if (!status.enabled) return { ok: false as const, code: "AI_PAUSED" };
  if (!status.active || status.expired) return { ok: false as const, code: "TRIAL_ENDED" };
  if (status.remaining.total <= 0) return { ok: false as const, code: "TRIAL_LIMIT_REACHED" };
  if (status.remaining[mode] <= 0) return { ok: false as const, code: "DAILY_LIMIT_REACHED" };
  const userId = requestIdentity(request, sessionId)!;
  const day = dayKey();
  const global = await env.DB.prepare("SELECT request_count, total_tokens FROM beta_global_daily WHERE usage_date = ?").bind(day).first<GlobalRow>();
  if ((global?.request_count || 0) >= LIMITS.globalRequests || (global?.total_tokens || 0) >= LIMITS.globalTokens) return { ok: false as const, code: "BETA_BUDGET_PAUSED" };
  const now = new Date().toISOString();
  const reservationId = crypto.randomUUID();
  const userHash = await sha256(userId);
  const changes = (result: { meta?: { changes?: number } }) => Number(result.meta?.changes || 0);
  let userReserved = false;
  let dailyReserved = false;
  try {
    await env.DB.prepare("INSERT INTO beta_request_reservations (id, user_id, user_hash, usage_date, mode, status, created_at) VALUES (?, ?, ?, ?, ?, 'reserved', ?)").bind(reservationId, userId, userHash, day, mode, now).run();
    const userClaim = await env.DB.prepare("UPDATE beta_users SET total_requests = total_requests + 1, last_seen_at = ? WHERE user_id = ? AND active = 1 AND expires_at > ? AND total_requests < ?").bind(now, userId, now, LIMITS.total).run();
    userReserved = changes(userClaim) === 1;
    if (!userReserved) {
      await env.DB.prepare("UPDATE beta_request_reservations SET status = 'rejected', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, reservationId).run();
      return { ok: false as const, code: "TRIAL_LIMIT_REACHED" };
    }
    const dailyClaim = await env.DB.prepare(`INSERT INTO beta_usage_daily (user_id, usage_date, request_count, ${modeColumn(mode)}, updated_at)
      VALUES (?, ?, 1, 1, ?)
      ON CONFLICT(user_id, usage_date) DO UPDATE SET request_count = request_count + 1, ${modeColumn(mode)} = ${modeColumn(mode)} + 1, updated_at = excluded.updated_at
      WHERE ${modeColumn(mode)} < ?`).bind(userId, day, now, LIMITS.daily[mode]).run();
    dailyReserved = changes(dailyClaim) === 1;
    if (!dailyReserved) {
      await env.DB.batch([
        env.DB.prepare("UPDATE beta_users SET total_requests = MAX(0, total_requests - 1) WHERE user_id = ?").bind(userId),
        env.DB.prepare("UPDATE beta_request_reservations SET status = 'rejected', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, reservationId),
      ]);
      return { ok: false as const, code: "DAILY_LIMIT_REACHED" };
    }
    const globalClaim = await env.DB.prepare(`INSERT INTO beta_global_daily (usage_date, request_count, updated_at)
      VALUES (?, 1, ?)
      ON CONFLICT(usage_date) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at
      WHERE request_count < ? AND total_tokens < ?`).bind(day, now, LIMITS.globalRequests, LIMITS.globalTokens).run();
    if (changes(globalClaim) !== 1) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE beta_usage_daily SET request_count = MAX(0, request_count - 1), ${modeColumn(mode)} = MAX(0, ${modeColumn(mode)} - 1), updated_at = ? WHERE user_id = ? AND usage_date = ?`).bind(now, userId, day),
        env.DB.prepare("UPDATE beta_users SET total_requests = MAX(0, total_requests - 1) WHERE user_id = ?").bind(userId),
        env.DB.prepare("UPDATE beta_request_reservations SET status = 'rejected', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, reservationId),
      ]);
      return { ok: false as const, code: "BETA_BUDGET_PAUSED" };
    }
    return { ok: true as const, ticket: { reservationId, userId, userHash, day, mode } satisfies BetaTicket };
  } catch (error) {
    const cleanup = [];
    if (dailyReserved) cleanup.push(env.DB.prepare(`UPDATE beta_usage_daily SET request_count = MAX(0, request_count - 1), ${modeColumn(mode)} = MAX(0, ${modeColumn(mode)} - 1), updated_at = ? WHERE user_id = ? AND usage_date = ?`).bind(now, userId, day));
    if (userReserved) cleanup.push(env.DB.prepare("UPDATE beta_users SET total_requests = MAX(0, total_requests - 1) WHERE user_id = ?").bind(userId));
    cleanup.push(env.DB.prepare("UPDATE beta_request_reservations SET status = 'rejected', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, reservationId));
    await env.DB.batch(cleanup).catch(() => null);
    throw error;
  }
}

export async function settleBetaRequest(ticket: BetaTicket, usage: TokenUsage, metadata: { wishCategory?: string; coachMode?: string; success: boolean; latencyMs: number; failureCode?: string }) {
  const input = Math.max(0, usage?.input_tokens || 0), output = Math.max(0, usage?.output_tokens || 0), total = Math.max(0, usage?.total_tokens || input + output);
  const now = new Date().toISOString();
  const stillReserved = "EXISTS (SELECT 1 FROM beta_request_reservations WHERE id = ? AND status = 'reserved')";
  const mode = modeColumn(ticket.mode);
  if (metadata.success) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE beta_usage_daily SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, total_tokens = total_tokens + ?, updated_at = ? WHERE user_id = ? AND usage_date = ? AND ${stillReserved}`).bind(input, output, total, now, ticket.userId, ticket.day, ticket.reservationId),
      env.DB.prepare(`UPDATE beta_users SET total_tokens = total_tokens + ? WHERE user_id = ? AND ${stillReserved}`).bind(total, ticket.userId, ticket.reservationId),
      env.DB.prepare(`UPDATE beta_global_daily SET total_tokens = total_tokens + ?, updated_at = ? WHERE usage_date = ? AND ${stillReserved}`).bind(total, now, ticket.day, ticket.reservationId),
      env.DB.prepare(`INSERT INTO beta_events (id, user_hash, event_type, mode, wish_category, coach_mode, prompt_version, input_tokens, output_tokens, total_tokens, latency_ms, created_at) SELECT ?, ?, 'ai_response', ?, ?, ?, 'v1', ?, ?, ?, ?, ? WHERE ${stillReserved}`).bind(crypto.randomUUID(), ticket.userHash, ticket.mode, metadata.wishCategory || null, metadata.coachMode || null, input, output, total, metadata.latencyMs, now, ticket.reservationId),
      env.DB.prepare("UPDATE beta_request_reservations SET status = 'settled', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, ticket.reservationId),
    ]);
    return;
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE beta_usage_daily SET request_count = MAX(0, request_count - 1), ${mode} = MAX(0, ${mode} - 1), input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, total_tokens = total_tokens + ?, failed_requests = failed_requests + 1, updated_at = ? WHERE user_id = ? AND usage_date = ? AND ${stillReserved}`).bind(input, output, total, now, ticket.userId, ticket.day, ticket.reservationId),
    env.DB.prepare(`UPDATE beta_users SET total_requests = MAX(0, total_requests - 1), total_tokens = total_tokens + ? WHERE user_id = ? AND ${stillReserved}`).bind(total, ticket.userId, ticket.reservationId),
    env.DB.prepare(`UPDATE beta_global_daily SET request_count = MAX(0, request_count - 1), total_tokens = total_tokens + ?, failed_requests = failed_requests + 1, updated_at = ? WHERE usage_date = ? AND ${stillReserved}`).bind(total, now, ticket.day, ticket.reservationId),
    env.DB.prepare(`INSERT INTO beta_events (id, user_hash, event_type, mode, wish_category, coach_mode, prompt_version, feedback, input_tokens, output_tokens, total_tokens, latency_ms, created_at) SELECT ?, ?, 'ai_failure', ?, ?, ?, 'v1', ?, ?, ?, ?, ?, ? WHERE ${stillReserved}`).bind(crypto.randomUUID(), ticket.userHash, ticket.mode, metadata.wishCategory || null, metadata.coachMode || null, metadata.failureCode?.slice(0, 80) || "unknown", input, output, total, metadata.latencyMs, now, ticket.reservationId),
    env.DB.prepare("UPDATE beta_request_reservations SET status = 'released', settled_at = ? WHERE id = ? AND status = 'reserved'").bind(now, ticket.reservationId),
  ]);
}

export async function recordAnonymousEvent(request: Request, sessionId: string, event: { eventType: string; mode?: string; wishCategory?: string; coachMode?: string; feedback?: string; ratingBefore?: number; ratingAfter?: number }) {
  await ensureBetaTables();
  const userId = requestIdentity(request, sessionId);
  if (!userId) return false;
  const allowedTypes = new Set(["reply_feedback", "state_rating", "practice_checkin", "beta_survey"]);
  if (!allowedTypes.has(event.eventType)) return false;
  const allowedModes = new Set(["chat", "revision", "story", "steadiness", "understood", "return_intent", "helpful_feature"]);
  const allowedFeedback = new Set(["helpful", "missed", "chosen", "calm", "certain", "chat", "story", "revision", "audio", "vision", "unsure"]);
  const safeMode = event.mode && allowedModes.has(event.mode) ? event.mode : null;
  const safeFeedback = event.feedback && allowedFeedback.has(event.feedback) ? event.feedback : null;
  const rating = (value?: number) => Number.isInteger(value) && value! >= 1 && value! <= 5 ? value : null;
  await env.DB.prepare("INSERT INTO beta_events (id, user_hash, event_type, mode, wish_category, coach_mode, prompt_version, feedback, rating_before, rating_after, created_at) VALUES (?, ?, ?, ?, ?, ?, 'v1', ?, ?, ?, ?)").bind(crypto.randomUUID(), await sha256(userId), event.eventType, safeMode, event.wishCategory || null, event.coachMode || null, safeFeedback, rating(event.ratingBefore), rating(event.ratingAfter), new Date().toISOString()).run();
  return true;
}

export async function founderSnapshot() {
  await ensureBetaTables();
  const day = dayKey();
  const today = await env.DB.prepare("SELECT request_count, total_tokens, failed_requests FROM beta_global_daily WHERE usage_date = ?").bind(day).first<{ request_count: number; total_tokens: number; failed_requests: number }>();
  const users = await env.DB.prepare("SELECT COUNT(*) AS count FROM beta_users").first<{ count: number }>();
  const activeToday = await env.DB.prepare("SELECT COUNT(*) AS count FROM beta_usage_daily WHERE usage_date = ? AND request_count > 0").bind(day).first<{ count: number }>();
  const feedback = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN feedback = 'helpful' THEN 1 ELSE 0 END) AS helpful FROM beta_events WHERE event_type = 'reply_feedback'").first<{ total: number; helpful: number }>();
  const ratings = await env.DB.prepare("SELECT COUNT(*) AS total, AVG(rating_after - rating_before) AS average_change FROM beta_events WHERE ((event_type = 'state_rating') OR (event_type = 'beta_survey' AND mode = 'steadiness')) AND rating_before IS NOT NULL AND rating_after IS NOT NULL").first<{ total: number; average_change: number }>();
  const survey = await env.DB.prepare("SELECT AVG(CASE WHEN mode = 'understood' THEN rating_after END) AS understood, AVG(CASE WHEN mode = 'return_intent' THEN rating_after END) AS return_intent FROM beta_events WHERE event_type = 'beta_survey'").first<{ understood: number; return_intent: number }>();
  const topFeature = await env.DB.prepare("SELECT feedback, COUNT(*) AS count FROM beta_events WHERE event_type = 'beta_survey' AND mode = 'helpful_feature' AND feedback IS NOT NULL GROUP BY feedback ORDER BY count DESC LIMIT 1").first<{ feedback: string; count: number }>();
  const setting = await env.DB.prepare("SELECT value FROM beta_settings WHERE key = 'ai_enabled'").first<{ value: string }>();
  return { day, enabled: process.env.BETA_AI_ENABLED !== "false" && setting?.value !== "false", totalUsers: users?.count || 0, activeToday: activeToday?.count || 0, requestsToday: today?.request_count || 0, tokensToday: today?.total_tokens || 0, failedToday: today?.failed_requests || 0, feedbackCount: feedback?.total || 0, helpfulRate: feedback?.total ? Math.round((feedback.helpful || 0) / feedback.total * 100) : null, ratingCount: ratings?.total || 0, averageChange: ratings?.average_change == null ? null : Number(ratings.average_change.toFixed(2)), understoodAverage: survey?.understood == null ? null : Number(survey.understood.toFixed(2)), returnIntentAverage: survey?.return_intent == null ? null : Number(survey.return_intent.toFixed(2)), topFeature: topFeature?.feedback || null, globalLimits: { requests: LIMITS.globalRequests, tokens: LIMITS.globalTokens } };
}

export async function setBetaEnabled(enabled: boolean) {
  await ensureBetaTables();
  await env.DB.prepare("INSERT INTO beta_settings (key, value, updated_at) VALUES ('ai_enabled', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(String(enabled), new Date().toISOString()).run();
}

export { LIMITS };
