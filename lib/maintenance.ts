const DAY_MS = 86_400_000;

/**
 * Runs once a day (the cron trigger in wrangler.jsonc; worker/index.ts passes its D1 binding): removes rows that only pile up.
 * - sign-in sessions past their expiry (the cookie no longer works anyway)
 * - sign-in and search limit counters not used for two days (every window is at most a day long)
 * - page crash reports older than 30 days
 */
export async function dailyCleanup(db: D1Database, now = Date.now()) {
  const results = await db.batch([
    db.prepare("DELETE FROM member_sessions WHERE expires_at < ?").bind(now),
    db.prepare("DELETE FROM member_auth_limits WHERE updated_at_ms IS NULL OR updated_at_ms < ?").bind(now - 2 * DAY_MS),
    db.prepare("DELETE FROM client_errors WHERE created_at_ms < ?").bind(now - 30 * DAY_MS),
  ]);
  const [sessions, limits, crashes] = results.map((result) => result.meta.changes || 0);
  return { sessions, limits, crashes };
}
