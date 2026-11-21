import { env } from "cloudflare:workers";
import { extractConversations, type ViewUser } from "./chat-view";
import { readClientInfo } from "./client-info";
import { memberAccount } from "./member-auth";
import { finishMemberUnit, membershipEnabled, releaseStory, reserveMemberUnit, reserveStory, usageUnits } from "./membership";

export type BetaMode = "chat" | "revision" | "story";
export type TokenUsage = { input_tokens?: number; output_tokens?: number; total_tokens?: number; cached_tokens?: number } | null;

export function combineTokenUsage(first: TokenUsage, second: TokenUsage): TokenUsage {
  if (!second) return first;
  if (!first) return second;
  return {
    input_tokens: (first.input_tokens || 0) + (second.input_tokens || 0),
    output_tokens: (first.output_tokens || 0) + (second.output_tokens || 0),
    total_tokens: (first.total_tokens || 0) + (second.total_tokens || 0),
    cached_tokens: (first.cached_tokens || 0) + (second.cached_tokens || 0),
  };
}

// No per-person limit: nobody using AlreaDough is ever told "you only get N
// conversations today" or "your trial has ended." The only thing left here is a
// site-wide cost circuit breaker — if total traffic spikes abnormally (a bug, a
// bot, a leaked key) this stops the bill from running away. It is sized well
// above any real usage pattern, so a real person should never hit it.
const LIMITS = {
  globalRequests: Number(process.env.BETA_GLOBAL_DAILY_REQUESTS || 3000),
  // about ¥30 a day on qwen3.8-max; raise it as revenue grows (reports/定价限额与成本测算.md)
  globalTokens: Number(process.env.BETA_GLOBAL_DAILY_TOKENS || 2_000_000),
};
// How long a device's row is kept around for the founder dashboard's usage stats.
// Not a trial window — nothing reads this to decide whether to allow a request.
const DEVICE_ROW_RETENTION_DAYS = 3650;

type UserRow = { total_requests: number; total_tokens: number };
type GlobalRow = { request_count: number; total_tokens: number };

/** `memberSource`: the reply came from the plan's allowance or from her chat pack (settled differently). */
export type BetaTicket = { userId: string; userHash: string; day: string; mode: BetaMode; memberAccountId?: string; memberSettled?: boolean; memberSource?: "plan" | "credit" };

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function isoAfterDays(days: number) { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); }
function modeColumn(mode: BetaMode) { return `${mode}_requests`; }

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`already-beta:${value}`));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requestIdentity(request: Request, sessionId?: string) {
  // Account-free beta: identity is the device session id the client generates and
  // persists locally, sent as a header (and as the sessionId arg on some routes).
  const device = (request.headers.get("x-already-session-id") || sessionId || "").trim();
  if (device) return `device:${device.slice(0, 128)}`;
  return null;
}

export async function betaStatus(request: Request, sessionId?: string) {
  const userId = requestIdentity(request, sessionId);
  if (!userId) return { authenticated: false as const };
  const now = new Date().toISOString();
  let user = await env.DB.prepare("SELECT total_requests, total_tokens FROM beta_users WHERE user_id = ?").bind(userId).first<UserRow>();
  if (!user) {
    await env.DB.prepare("INSERT OR IGNORE INTO beta_users (user_id, started_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?)").bind(userId, now, isoAfterDays(DEVICE_ROW_RETENTION_DAYS), now).run();
    user = await env.DB.prepare("SELECT total_requests, total_tokens FROM beta_users WHERE user_id = ?").bind(userId).first<UserRow>();
  }
  const setting = await env.DB.prepare("SELECT value FROM beta_settings WHERE key = 'ai_enabled'").first<{ value: string }>();
  return {
    authenticated: true as const,
    // Founder kill switch only. There is no per-person count or trial window here.
    enabled: process.env.BETA_AI_ENABLED !== "false" && setting?.value !== "false",
    totalRequests: user?.total_requests || 0,
    totalTokens: user?.total_tokens || 0,
  };
}

/** Remember that this account uses this device, so "clear everything" can reach what every device left behind. Never throws. */
async function linkDevice(accountId: string | null, userId: string | null) {
  if (!accountId || !userId) return;
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO account_devices (account_id, device_key, first_seen_ms) VALUES (?, ?, ?)").bind(accountId, userId, Date.now()).run();
  } catch (error) {
    console.error("linkDevice failed", String(error));
  }
}

export async function beginBetaRequest(request: Request, sessionId: string, mode: BetaMode) {
  const memberAccountId = membershipEnabled() ? await memberAccount(request) : null;
  if (membershipEnabled() && !memberAccountId) return { ok: false as const, code: "MEMBERSHIP_SIGN_IN_REQUIRED" };
  const status = await betaStatus(request, sessionId);
  if (!status.authenticated) return { ok: false as const, code: "SIGN_IN_REQUIRED" };
  if (!status.enabled) return { ok: false as const, code: "AI_PAUSED" };
  const userId = requestIdentity(request, sessionId)!;
  await linkDevice(memberAccountId, userId);
  const day = dayKey();
  const global = await env.DB.prepare("SELECT request_count, total_tokens FROM beta_global_daily WHERE usage_date = ?").bind(day).first<GlobalRow>();
  if ((global?.request_count || 0) >= LIMITS.globalRequests || (global?.total_tokens || 0) >= LIMITS.globalTokens) return { ok: false as const, code: "BETA_BUDGET_PAUSED" };
  // A story script is counted in its own weekly allowance, not in the chat allowance.
  if (memberAccountId && mode === "story") {
    if (!await reserveStory(memberAccountId)) return { ok: false as const, code: "STORY_LIMIT" };
  }
  let memberSource: "plan" | "credit" | undefined;
  if (memberAccountId && mode !== "story") {
    const reservation = await reserveMemberUnit(memberAccountId);
    if (!reservation.ok) return { ok: false as const, code: "MEMBERSHIP_LIMIT" };
    memberSource = reservation.source;
  }
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO beta_usage_daily (user_id, usage_date, request_count, ${modeColumn(mode)}, updated_at) VALUES (?, ?, 1, 1, ?) ON CONFLICT(user_id, usage_date) DO UPDATE SET request_count = request_count + 1, ${modeColumn(mode)} = ${modeColumn(mode)} + 1, updated_at = excluded.updated_at`).bind(userId, day, now).run();
  await env.DB.prepare("UPDATE beta_users SET total_requests = total_requests + 1, last_seen_at = ? WHERE user_id = ?").bind(now, userId).run();
  await env.DB.prepare("INSERT INTO beta_global_daily (usage_date, request_count, updated_at) VALUES (?, 1, ?) ON CONFLICT(usage_date) DO UPDATE SET request_count = request_count + 1, updated_at = excluded.updated_at").bind(day, now).run();
  return { ok: true as const, ticket: { userId, userHash: await sha256(userId), day, mode, memberAccountId: memberAccountId || undefined, memberSource } satisfies BetaTicket };
}

export async function settleBetaRequest(ticket: BetaTicket, usage: TokenUsage, metadata: { wishCategory?: string; coachMode?: string; success: boolean; latencyMs: number; /** Which product feature made the call (persona, affirm, onboarding…); shown per feature in the founder cockpit. */ feature?: string }) {
  const input = Math.max(0, usage?.input_tokens || 0), output = Math.max(0, usage?.output_tokens || 0), total = Math.max(0, usage?.total_tokens || input + output);
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE beta_usage_daily SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, total_tokens = total_tokens + ?, failed_requests = failed_requests + ?, updated_at = ? WHERE user_id = ? AND usage_date = ?").bind(input, output, total, metadata.success ? 0 : 1, now, ticket.userId, ticket.day).run();
  await env.DB.prepare("UPDATE beta_users SET total_tokens = total_tokens + ? WHERE user_id = ?").bind(total, ticket.userId).run();
  await env.DB.prepare("UPDATE beta_global_daily SET total_tokens = total_tokens + ?, failed_requests = failed_requests + ?, updated_at = ? WHERE usage_date = ?").bind(total, metadata.success ? 0 : 1, now, ticket.day).run();
  if (!metadata.success) {
    // Keep the analytics counters honest: a failed call shouldn't count as a served request.
    // (There's no per-person allowance left to protect — this is just accurate bookkeeping.)
    await env.DB.prepare(`UPDATE beta_usage_daily SET request_count = MAX(request_count - 1, 0), ${modeColumn(ticket.mode)} = MAX(${modeColumn(ticket.mode)} - 1, 0), updated_at = ? WHERE user_id = ? AND usage_date = ?`).bind(now, ticket.userId, ticket.day).run();
    await env.DB.prepare("UPDATE beta_users SET total_requests = MAX(total_requests - 1, 0) WHERE user_id = ?").bind(ticket.userId).run();
    await env.DB.prepare("UPDATE beta_global_daily SET request_count = MAX(request_count - 1, 0), updated_at = ? WHERE usage_date = ?").bind(now, ticket.day).run();
  }
  const cached = Math.min(input, Math.max(0, usage?.cached_tokens || 0));
  await env.DB.prepare("INSERT INTO beta_events (id, user_hash, event_type, mode, wish_category, coach_mode, prompt_version, input_tokens, output_tokens, total_tokens, cached_tokens, latency_ms, created_at) VALUES (?, ?, 'ai_response', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), ticket.userHash, ticket.mode, metadata.wishCategory || null, metadata.coachMode || null, metadata.feature || "v1", input, output, total, cached, metadata.latencyMs, now).run();
}

/** Called once per user-visible answer, not once per upstream model call or internal rewrite. */
export async function finishMemberRequest(ticket: BetaTicket, usage: TokenUsage, succeeded: boolean) {
  if (!ticket.memberAccountId || ticket.memberSettled) return;
  if (ticket.mode === "story") {
    if (!succeeded) await releaseStory(ticket.memberAccountId);
  } else {
    await finishMemberUnit(ticket.memberAccountId, usageUnits(usage), succeeded, undefined, ticket.memberSource);
  }
  ticket.memberSettled = true;
}

/** Features the founder cockpit counts that are not AI calls. Server-side ones are written by their routes; the client may only send the client-side ones. */
export const SERVER_FEATURES = ["image_search", "sound_search"] as const;
export const CLIENT_FEATURES = ["subliminal_record", "subliminal_upload", "subliminal_play", "subliminal_export"] as const;

/** One use of a non-AI feature (event_type 'feature_use', the feature name in prompt_version). Never throws. */
export async function recordFeatureUse(identity: string | null, feature: (typeof SERVER_FEATURES)[number] | (typeof CLIENT_FEATURES)[number]) {
  if (!identity) return;
  try {
    await env.DB.prepare("INSERT INTO beta_events (id, user_hash, event_type, prompt_version, created_at) VALUES (?, ?, 'feature_use', ?, ?)").bind(crypto.randomUUID(), await sha256(identity), feature, new Date().toISOString()).run();
  } catch (error) {
    console.error("recordFeatureUse failed", String(error));
  }
}

export async function recordAnonymousEvent(request: Request, sessionId: string, event: { eventType: string; mode?: string; wishCategory?: string; coachMode?: string; feedback?: string; ratingBefore?: number; ratingAfter?: number; feature?: string }) {
  const userId = requestIdentity(request, sessionId);
  if (!userId) return false;
  if (event.eventType === "feature_use") {
    const feature = CLIENT_FEATURES.find((item) => item === event.feature);
    if (!feature) return false;
    await recordFeatureUse(userId, feature);
    return true;
  }
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

const clipText = (value: string, max: number) => value.trim().slice(0, max);

/** Store one beta conversation turn (no desire card, name, or beliefs — only the turn itself). `mode` names features that share the chat ticket (affirm, onboarding, persona). Never throws. */
export async function recordConversation(ticket: BetaTicket, entry: { lang: string; mode?: string; coachMode?: string; wishCategory?: string; persona?: { id: string; name: string }; context: Array<{ role: string; text: string }>; userText: string; aiReply: string; model?: string }) {
  try {
    const id = crypto.randomUUID();
    const context = JSON.stringify(entry.context.slice(-6).map((item) => ({ role: item.role, text: clipText(item.text, 600) })));
    const values = [id, ticket.userHash, new Date().toISOString(), entry.mode || ticket.mode, entry.coachMode || null, entry.wishCategory || null, entry.lang, context, clipText(entry.userText, 4000), clipText(entry.aiReply, 6000), entry.model || null];
    // a TA turn also says which TA it was with
    const statement = entry.persona
      ? env.DB.prepare("INSERT INTO beta_conversations (id, user_hash, created_at, mode, coach_mode, wish_category, lang, context, user_text, ai_reply, model, persona_id, persona_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(...values, clipText(entry.persona.id, 64), clipText(entry.persona.name, 40))
      : env.DB.prepare("INSERT INTO beta_conversations (id, user_hash, created_at, mode, coach_mode, wish_category, lang, context, user_text, ai_reply, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(...values);
    await statement.run();
    return id;
  } catch (error) {
    console.error("recordConversation failed", String(error));
    return null;
  }
}

/** Attach the user's 👍/👎 to a stored sample. Only the same device can label its own sample. */
export async function markConversationFeedback(request: Request, sessionId: string, logId: string, feedback: string) {
  const userId = requestIdentity(request, sessionId);
  if (!userId || !["helpful", "missed"].includes(feedback) || !/^[0-9a-f-]{36}$/.test(logId)) return false;
  const result = await env.DB.prepare("UPDATE beta_conversations SET feedback = ?, feedback_at = ? WHERE id = ? AND user_hash = ?").bind(feedback, new Date().toISOString(), logId, await sha256(userId)).run();
  return Boolean(result.meta?.changes);
}

type ConversationRow = { id: string; user_hash: string; created_at: string; mode: string; coach_mode: string | null; wish_category: string | null; lang: string | null; context: string | null; user_text: string; ai_reply: string; model: string | null; feedback: string | null; persona_name: string | null };

export async function listConversations(limit = 500) {
  const rows = await env.DB.prepare("SELECT id, user_hash, created_at, mode, coach_mode, wish_category, lang, context, user_text, ai_reply, model, feedback, persona_name FROM beta_conversations ORDER BY created_at DESC LIMIT ?").bind(Math.max(1, Math.min(2000, limit))).all<ConversationRow>();
  return (rows.results || []).map(({ user_hash, ...row }: ConversationRow) => ({ ...row, user: user_hash.slice(0, 8), context: row.context ? JSON.parse(row.context) as Array<{ role: string; text: string }> : [] }));
}

export type PersonaThread = { id: string; name: string; updatedAt: string; turns: Array<{ at: string; her: string; ta: string }> };
export type PersonaChatUser = { label: string; updatedAt: string; turnCount: number; personas: PersonaThread[] };

/** TA chats for the founder chat page: per user (same 8-char label as the other views), then per TA, oldest turn first. */
export async function listPersonaChats(limit = 3000): Promise<PersonaChatUser[]> {
  const rows = (await env.DB.prepare("SELECT user_hash, created_at, persona_id, persona_name, user_text, ai_reply FROM beta_conversations WHERE mode = 'persona' ORDER BY created_at DESC LIMIT ?")
    .bind(Math.max(1, Math.min(5000, limit))).all<{ user_hash: string; created_at: string; persona_id: string | null; persona_name: string | null; user_text: string; ai_reply: string }>()).results || [];
  const users = new Map<string, PersonaChatUser>();
  for (const row of rows) {
    let user = users.get(row.user_hash);
    if (!user) { user = { label: row.user_hash.slice(0, 8), updatedAt: row.created_at, turnCount: 0, personas: [] }; users.set(row.user_hash, user); }
    const key = row.persona_id || row.persona_name || "";
    let thread = user.personas.find((item) => item.id === key);
    // newest row first, so a renamed TA shows its current name
    if (!thread) { thread = { id: key, name: row.persona_name || "TA", updatedAt: row.created_at, turns: [] }; user.personas.push(thread); }
    thread.turns.push({ at: row.created_at, her: row.user_text, ta: row.ai_reply });
    user.turnCount += 1;
  }
  for (const user of users.values()) for (const thread of user.personas) thread.turns.reverse();
  return [...users.values()];
}

/** Every synced user's chat threads (chat turns only). The label is the first 8 chars of the same hash used in beta_conversations. */
export async function listUserChats(limit = 200): Promise<ViewUser[]> {
  let rows: Array<{ user_id: string; payload: string; updated_at: string }>;
  try {
    const result = await env.DB.prepare("SELECT user_id, payload, updated_at FROM user_spaces ORDER BY updated_at DESC LIMIT ?").bind(Math.max(1, Math.min(500, limit))).all<{ user_id: string; payload: string; updated_at: string }>();
    rows = result.results || [];
  } catch {
    return []; // table not created yet: nobody has synced
  }
  const users: ViewUser[] = [];
  for (const row of rows) {
    const conversations = extractConversations(row.payload);
    if (!conversations.length) continue;
    users.push({ label: (await sha256(row.user_id)).slice(0, 8), updatedAt: row.updated_at, messageCount: conversations.reduce((sum, item) => sum + item.messages.length, 0), conversations });
  }
  return users;
}

/** Record that this device opened the app (called from the status route, once per app open). Never throws. */
export async function touchProfile(request: Request, sessionId?: string) {
  try {
    const userId = requestIdentity(request, sessionId);
    if (!userId) return;
    await linkDevice(await memberAccount(request), userId);
    const info = readClientInfo(request.headers, (request as unknown as { cf?: Record<string, unknown> }).cf);
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO beta_profiles (user_hash, first_seen_at, last_seen_at, visits, country, region, city, timezone, lang, device, os, browser) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_hash) DO UPDATE SET last_seen_at = excluded.last_seen_at, visits = visits + 1, country = COALESCE(excluded.country, country), region = COALESCE(excluded.region, region), city = COALESCE(excluded.city, city), timezone = COALESCE(excluded.timezone, timezone), lang = COALESCE(excluded.lang, lang), device = excluded.device, os = excluded.os, browser = excluded.browser")
      .bind(await sha256(userId), now, now, info.country, info.region, info.city, info.timezone, info.lang, info.device, info.os, info.browser).run();
  } catch (error) {
    console.error("touchProfile failed", String(error));
  }
}

type ProfileRow = { user_hash: string; first_seen_at: string; last_seen_at: string; visits: number; country: string | null; region: string | null; city: string | null; timezone: string | null; lang: string | null; device: string | null; os: string | null; browser: string | null; turns: number; active_days: number; helpful: number; missed: number; wish_category: string | null; coach_mode: string | null };

/** One row per device with usage so far. The label matches the 8-char user label in the chat viewer. */
export async function listProfiles(limit = 500) {
  const rows = await env.DB.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM beta_conversations c WHERE c.user_hash = p.user_hash) AS turns,
      (SELECT COUNT(DISTINCT substr(c.created_at, 1, 10)) FROM beta_conversations c WHERE c.user_hash = p.user_hash) AS active_days,
      (SELECT COUNT(*) FROM beta_conversations c WHERE c.user_hash = p.user_hash AND c.feedback = 'helpful') AS helpful,
      (SELECT COUNT(*) FROM beta_conversations c WHERE c.user_hash = p.user_hash AND c.feedback = 'missed') AS missed,
      (SELECT c.wish_category FROM beta_conversations c WHERE c.user_hash = p.user_hash AND c.wish_category IS NOT NULL ORDER BY c.created_at DESC LIMIT 1) AS wish_category,
      (SELECT c.coach_mode FROM beta_conversations c WHERE c.user_hash = p.user_hash AND c.coach_mode IS NOT NULL ORDER BY c.created_at DESC LIMIT 1) AS coach_mode
    FROM beta_profiles p ORDER BY p.last_seen_at DESC LIMIT ?`).bind(Math.max(1, Math.min(1000, limit))).all<ProfileRow>();
  return (rows.results || []).map(({ user_hash, ...row }: ProfileRow) => ({ ...row, user: user_hash.slice(0, 8) }));
}

export async function setBetaEnabled(enabled: boolean) {
  await env.DB.prepare("INSERT INTO beta_settings (key, value, updated_at) VALUES ('ai_enabled', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(String(enabled), new Date().toISOString()).run();
}

const REPORT_REASONS = new Set(["illegal", "sexual", "violence", "minors", "harassment", "self_harm", "other"]);

export async function recordReport(request: Request, sessionId: string, report: { reason: string; detail?: string; replyExcerpt?: string; lang?: string }) {
  const userId = requestIdentity(request, sessionId);
  if (!userId) return { ok: false as const, code: "SIGN_IN_REQUIRED" };
  if (!REPORT_REASONS.has(report.reason)) return { ok: false as const, code: "INVALID_REASON" };
  const hash = await sha256(userId);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM beta_reports WHERE user_hash = ? AND created_at > ?").bind(hash, since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 20) return { ok: false as const, code: "TOO_MANY_REPORTS" };
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO beta_reports (id, user_hash, reason, detail, reply_excerpt, lang, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)")
    .bind(id, hash, report.reason, (report.detail || "").trim().slice(0, 1000) || null, (report.replyExcerpt || "").trim().slice(0, 800) || null, report.lang === "en" ? "en" : "zh", new Date().toISOString()).run();
  return { ok: true as const, id };
}

type ReportRow = { id: string; user_hash: string; reason: string; detail: string | null; reply_excerpt: string | null; lang: string | null; status: string; created_at: string; handled_at: string | null };

export async function listReports(limit = 200) {
  const rows = await env.DB.prepare("SELECT id, user_hash, reason, detail, reply_excerpt, lang, status, created_at, handled_at FROM beta_reports ORDER BY created_at DESC LIMIT ?").bind(Math.max(1, Math.min(500, limit))).all<ReportRow>();
  return (rows.results || []).map((row: ReportRow) => ({ id: row.id, user: row.user_hash.slice(0, 8), reason: row.reason, detail: row.detail, replyExcerpt: row.reply_excerpt, lang: row.lang, status: row.status, createdAt: row.created_at, handledAt: row.handled_at }));
}

export async function setReportStatus(id: string, status: "new" | "handled") {
  const result = await env.DB.prepare("UPDATE beta_reports SET status = ?, handled_at = ? WHERE id = ?").bind(status, status === "handled" ? new Date().toISOString() : null, id).run();
  return Boolean(result.meta?.changes);
}

export { LIMITS };

/**
 * "Delete my data": removes everything we keep beyond the synced space itself: her chats, her profile rows,
 * usage events, reports she sent, and her usage counters. These are recorded per device, so with an account it
 * covers every device the account has been used on (account_devices), not only the one she is holding.
 * Payment records are left alone on purpose (a paid plan must keep working and be refundable).
 */
export async function deleteBetaRecords(request: Request) {
  const current = requestIdentity(request);
  const accountId = await memberAccount(request);
  const linked = accountId
    ? ((await env.DB.prepare("SELECT device_key AS deviceKey FROM account_devices WHERE account_id = ?").bind(accountId).all<{ deviceKey: string }>()).results || []).map((row) => row.deviceKey)
    : [];
  const devices = [...new Set([current, ...linked].filter((id): id is string => Boolean(id)))];
  if (!devices.length) return { deleted: false as const };
  const statements = [];
  for (const userId of devices) {
    const userHash = await sha256(userId);
    statements.push(
      env.DB.prepare("DELETE FROM beta_conversations WHERE user_hash = ?").bind(userHash),
      env.DB.prepare("DELETE FROM beta_profiles WHERE user_hash = ?").bind(userHash),
      env.DB.prepare("DELETE FROM beta_events WHERE user_hash = ?").bind(userHash),
      env.DB.prepare("DELETE FROM beta_reports WHERE user_hash = ?").bind(userHash),
      env.DB.prepare("DELETE FROM beta_usage_daily WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM beta_users WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM voice_usage_daily WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM user_spaces WHERE user_id = ?").bind(userId),
    );
  }
  if (accountId) statements.push(env.DB.prepare("DELETE FROM account_devices WHERE account_id = ?").bind(accountId));
  await env.DB.batch(statements);
  return { deleted: true as const, devices: devices.length };
}
