import { env } from "cloudflare:workers";
import { recentClientErrors } from "./client-errors";

/**
 * Founder cockpit: counts and sums only, from the tables each feature already writes.
 * No names, emails, wishes or message text leave this function. A query whose table does
 * not exist yet (or fails) comes back empty, so one broken corner never blanks the page.
 */

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function first<T>(sql: string, ...binds: unknown[]): Promise<T | null> {
  try { return await env.DB.prepare(sql).bind(...binds).first<T>(); } catch { return null; }
}
async function all<T>(sql: string, ...binds: unknown[]): Promise<T[]> {
  try { return (await env.DB.prepare(sql).bind(...binds).all<T>()).results || []; } catch { return []; }
}

export async function founderOverview() {
  const now = Date.now();
  const since7Ms = now - 7 * DAY_MS;
  const since7Iso = new Date(since7Ms).toISOString();
  const since7Day = dayKey(since7Ms + DAY_MS); // the last 7 calendar days including today
  const since14Day = dayKey(now - 13 * DAY_MS);
  const todayIso = dayKey(now);

  const [
    accounts, newAccounts7, states, referrals, ordersPaid, ordersPending, recentOrders,
    aiByFeature, trendGlobal, trendActive, trendNew, newVisitors7,
    voices, voice7, voiceToday,
    spaces, countries, devices, langs,
    mail, lastMail, letterCount, lastLetter, reportsNew, interest, tools, sends, letterList,
  ] = await Promise.all([
    first<{ n: number }>("SELECT COUNT(DISTINCT account_id) AS n FROM member_accounts"),
    first<{ n: number }>("SELECT COUNT(*) AS n FROM (SELECT account_id, MIN(created_at) AS c FROM member_accounts GROUP BY account_id) WHERE c >= ?", since7Ms),
    first<{ paid: number; deep: number; atelier: number; trial: number }>(
      `SELECT SUM(CASE WHEN plan IN ('deep','atelier') AND period_end_ms > ? THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN plan = 'deep' AND period_end_ms > ? THEN 1 ELSE 0 END) AS deep,
        SUM(CASE WHEN plan = 'atelier' AND period_end_ms > ? THEN 1 ELSE 0 END) AS atelier,
        SUM(CASE WHEN NOT (plan IN ('deep','atelier') AND period_end_ms > ?) AND trial_end_ms > ? THEN 1 ELSE 0 END) AS trial
       FROM member_state`, now, now, now, now, now),
    first<{ n: number; recent: number }>("SELECT COUNT(*) AS n, SUM(CASE WHEN redeemed_at_ms >= ? THEN 1 ELSE 0 END) AS recent FROM member_codes", since7Ms),
    first<{ n: number; fen: number; n7: number; fen7: number; buyers: number }>(
      `SELECT COUNT(*) AS n, SUM(amount_fen) AS fen, SUM(CASE WHEN paid_at_ms >= ? THEN 1 ELSE 0 END) AS n7,
        SUM(CASE WHEN paid_at_ms >= ? THEN amount_fen ELSE 0 END) AS fen7, COUNT(DISTINCT account_id) AS buyers
       FROM member_orders WHERE status = 'paid'`, since7Ms, since7Ms),
    first<{ n: number }>("SELECT COUNT(*) AS n FROM member_orders WHERE status = 'pending' AND created_at_ms >= ?", since7Ms),
    all<{ plan: string; amountFen: number; status: string; createdAtMs: number; paidAtMs: number | null; tradeNo: string | null }>(
      "SELECT plan, amount_fen AS amountFen, status, created_at_ms AS createdAtMs, paid_at_ms AS paidAtMs, provider_trade_no AS tradeNo FROM member_orders ORDER BY created_at_ms DESC LIMIT 15"),
    // prompt_version carries the feature tag (persona, affirm, onboarding…); older rows say 'v1' and fall back to the mode.
    all<{ feature: string; mode: string; calls: number; users: number; tokens: number; input: number; cached: number; failed: number; latency: number }>(
      `SELECT CASE WHEN prompt_version IS NULL OR prompt_version = 'v1' THEN mode ELSE prompt_version END AS feature, mode,
        COUNT(*) AS calls, COUNT(DISTINCT user_hash) AS users, SUM(total_tokens) AS tokens, SUM(input_tokens) AS input, SUM(cached_tokens) AS cached,
        SUM(CASE WHEN total_tokens = 0 THEN 1 ELSE 0 END) AS failed, AVG(latency_ms) AS latency
       FROM beta_events WHERE event_type = 'ai_response' AND created_at >= ? GROUP BY feature ORDER BY calls DESC`, since7Iso),
    all<{ day: string; requests: number; tokens: number; failed: number }>(
      "SELECT usage_date AS day, request_count AS requests, total_tokens AS tokens, failed_requests AS failed FROM beta_global_daily WHERE usage_date >= ? ORDER BY usage_date", since14Day),
    all<{ day: string; n: number }>("SELECT usage_date AS day, COUNT(*) AS n FROM beta_usage_daily WHERE usage_date >= ? AND request_count > 0 GROUP BY usage_date", since14Day),
    all<{ day: string; n: number }>("SELECT substr(first_seen_at, 1, 10) AS day, COUNT(*) AS n FROM beta_profiles WHERE first_seen_at >= ? GROUP BY day", since14Day),
    first<{ n: number; visitors: number }>("SELECT SUM(CASE WHEN first_seen_at >= ? THEN 1 ELSE 0 END) AS n, SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS visitors FROM beta_profiles", since7Day, since7Day),
    first<{ n: number; n7: number }>("SELECT COUNT(*) AS n, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS n7 FROM user_voices", since7Iso),
    first<{ chars: number; requests: number; enrolls: number; users: number }>(
      "SELECT SUM(chars) AS chars, SUM(requests) AS requests, SUM(enrolls) AS enrolls, COUNT(DISTINCT CASE WHEN requests > 0 THEN user_id END) AS users FROM voice_usage_daily WHERE usage_date >= ?", since7Day),
    first<{ chars: number }>("SELECT chars FROM voice_global_daily WHERE usage_date = ?", todayIso),
    first<{ total: number; active7: number; goals: number; withBoard: number; boardItems: number; withStories: number; stories: number; withCheckIns: number; checkIns: number; withRevisions: number; revisions: number; withChats: number }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS active7,
        SUM(1 + COALESCE(json_array_length(payload, '$.otherGoals'), 0)) AS goals,
        SUM(CASE WHEN json_array_length(payload, '$.board') > 0 THEN 1 ELSE 0 END) AS withBoard, SUM(COALESCE(json_array_length(payload, '$.board'), 0)) AS boardItems,
        SUM(CASE WHEN json_array_length(payload, '$.storyLibrary') > 0 THEN 1 ELSE 0 END) AS withStories, SUM(COALESCE(json_array_length(payload, '$.storyLibrary'), 0)) AS stories,
        SUM(CASE WHEN json_array_length(payload, '$.checkIns') > 0 THEN 1 ELSE 0 END) AS withCheckIns, SUM(COALESCE(json_array_length(payload, '$.checkIns'), 0)) AS checkIns,
        SUM(CASE WHEN json_array_length(payload, '$.revisions') > 0 THEN 1 ELSE 0 END) AS withRevisions, SUM(COALESCE(json_array_length(payload, '$.revisions'), 0)) AS revisions,
        SUM(CASE WHEN json_array_length(payload, '$.messages') > 0 OR json_array_length(payload, '$.conversationArchive') > 0 THEN 1 ELSE 0 END) AS withChats
       FROM user_spaces WHERE json_valid(payload)`, since7Iso),
    all<{ label: string; n: number }>("SELECT COALESCE(country, '未知') AS label, COUNT(*) AS n FROM beta_profiles GROUP BY label ORDER BY n DESC LIMIT 8"),
    all<{ label: string; n: number }>("SELECT COALESCE(device, '未知') || ' · ' || COALESCE(os, '?') AS label, COUNT(*) AS n FROM beta_profiles GROUP BY label ORDER BY n DESC LIMIT 6"),
    all<{ label: string; n: number }>("SELECT COALESCE(lang, '未知') AS label, COUNT(*) AS n FROM beta_profiles GROUP BY label ORDER BY n DESC LIMIT 4"),
    first<{ subscribed: number; total: number; linked: number }>("SELECT SUM(subscribed) AS subscribed, COUNT(*) AS total, SUM(CASE WHEN account_id IS NOT NULL THEN 1 ELSE 0 END) AS linked FROM mail_contacts"),
    first<{ subject: string; recipients: number; delivered: number; createdAt: number }>("SELECT subject, recipients, delivered, created_at AS createdAt FROM mail_sends WHERE audience = 'all' ORDER BY created_at DESC LIMIT 1"),
    first<{ n: number }>("SELECT COUNT(*) AS n FROM letters"),
    first<{ subject: string; createdAt: number }>("SELECT subject, created_at AS createdAt FROM letters ORDER BY created_at DESC LIMIT 1"),
    first<{ n: number }>("SELECT COUNT(*) AS n FROM beta_reports WHERE status = 'new'"),
    first<{ n: number }>("SELECT COUNT(*) AS n FROM payment_interest"),
    // Non-AI features (image search, sound search, subliminal recording…): one 'feature_use' event per use, the feature in prompt_version.
    all<{ feature: string; uses: number; users: number; today: number; usesAll: number; usersAll: number }>(
      `SELECT prompt_version AS feature, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS uses,
        COUNT(DISTINCT CASE WHEN created_at >= ? THEN user_hash END) AS users, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
        COUNT(*) AS usesAll, COUNT(DISTINCT user_hash) AS usersAll
       FROM beta_events WHERE event_type = 'feature_use' GROUP BY prompt_version ORDER BY uses DESC, usesAll DESC`, since7Iso, since7Iso, todayIso),
    all<{ audience: string; subject: string; recipients: number; delivered: number; createdAt: number }>("SELECT audience, subject, recipients, delivered, created_at AS createdAt FROM mail_sends ORDER BY created_at DESC LIMIT 10"),
    all<{ subject: string; createdAt: number }>("SELECT subject, created_at AS createdAt FROM letters ORDER BY created_at DESC LIMIT 10"),
  ]);

  // Page crashes reported by browsers (message, page, kind of device; nothing about the person).
  const crashes = await recentClientErrors(now).catch(() => ({ last7: 0, recent: [] }));

  const days: string[] = [];
  for (let i = 13; i >= 0; i -= 1) days.push(dayKey(now - i * DAY_MS));
  const byDay = <T extends { day: string }>(rows: T[]) => new Map(rows.map((row) => [row.day, row]));
  const g = byDay(trendGlobal), a = byDay(trendActive), n = byDay(trendNew);
  const trend = days.map((day) => ({ day, active: a.get(day)?.n || 0, newUsers: n.get(day)?.n || 0, requests: g.get(day)?.requests || 0, tokens: g.get(day)?.tokens || 0, failed: g.get(day)?.failed || 0 }));

  return {
    members: {
      accounts: accounts?.n || 0, newAccounts7: newAccounts7?.n || 0,
      paidActive: states?.paid || 0, deep: states?.deep || 0, atelier: states?.atelier || 0, trial: states?.trial || 0,
      referrals: referrals?.n || 0, referrals7: referrals?.recent || 0, interest: interest?.n || 0,
    },
    revenue: {
      paidOrders: ordersPaid?.n || 0, paidFen: ordersPaid?.fen || 0, paidOrders7: ordersPaid?.n7 || 0, paidFen7: ordersPaid?.fen7 || 0,
      buyers: ordersPaid?.buyers || 0, pending7: ordersPending?.n || 0,
      recent: recentOrders.map((row) => ({ ...row, tradeNo: row.tradeNo ? row.tradeNo.slice(-6) : null })),
    },
    tools,
    features: aiByFeature.map((row) => ({ ...row, latency: Math.round(row.latency || 0) })),
    voice: { cloned: voices?.n || 0, cloned7: voices?.n7 || 0, chars7: voice7?.chars || 0, speaks7: voice7?.requests || 0, enrolls7: voice7?.enrolls || 0, users7: voice7?.users || 0, charsToday: voiceToday?.chars || 0 },
    content: spaces || { total: 0, active7: 0, goals: 0, withBoard: 0, boardItems: 0, withStories: 0, stories: 0, withCheckIns: 0, checkIns: 0, withRevisions: 0, revisions: 0, withChats: 0 },
    audience: { new7: newVisitors7?.n || 0, visitors7: newVisitors7?.visitors || 0, countries, devices, langs },
    mail: { subscribed: mail?.subscribed || 0, contacts: mail?.total || 0, linked: mail?.linked || 0, last: lastMail || null, letters: letterCount?.n || 0, lastLetter: lastLetter || null, sends, letterList },
    reportsNew: reportsNew?.n || 0,
    trend,
    crashes,
  };
}

export type FounderOverview = Awaited<ReturnType<typeof founderOverview>>;
