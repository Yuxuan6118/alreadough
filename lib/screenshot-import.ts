import { env } from "cloudflare:workers";
import { isUnlimitedAccount, memberState, weekWindow } from "./membership";

/**
 * Screenshot import for TA: chat screenshots are read into text once and handed back; nothing is stored.
 * Paid Porcelain (atelier) includes it (a weekly fair-use count keeps the model bill in check). Everyone else who can open TA,
 * which means the free Atelier days of the welcome week and the invitation code, buys single uses at ORDER_PRICE_FEN.screenshots.
 */
export const SCREENSHOT_LIMITS = {
  /** screenshots she picks for one use */
  files: 20,
  /** pieces the browser cuts them into (a long screenshot becomes several) */
  tiles: 40,
  /** characters of one piece's data URL */
  tileChars: 2_000_000,
  /** uses a week that paid Porcelain (atelier) includes; past that a bought use is taken if she has one */
  includedPerWeek: 10,
} as const;

const KIND = "screenshots";

export type ScreenshotAccess = { mode: "included" | "credit" | "buy"; credits: number; weekLeft: number | null };
export type ScreenshotUse = "included" | "credit" | "unlimited";

async function credits(accountId: string) {
  const row = await env.DB.prepare("SELECT balance FROM member_credits WHERE account_id = ? AND kind = ?").bind(accountId, KIND).first<{ balance: number }>();
  return row?.balance || 0;
}

async function weekUsed(accountId: string, now: number) {
  const row = await env.DB.prepare("SELECT week_start_ms AS weekStart, count FROM member_feature_usage WHERE account_id = ? AND feature = ?")
    .bind(accountId, KIND).first<{ weekStart: number; count: number }>();
  return row?.weekStart === weekWindow(now) ? row.count : 0;
}

async function included(accountId: string, now: number) {
  return (await memberState(accountId, now)).paidPlan === "atelier";
}

export async function screenshotAccess(accountId: string, now = Date.now()): Promise<ScreenshotAccess> {
  const [isIncluded, balance, used] = await Promise.all([included(accountId, now), credits(accountId), weekUsed(accountId, now)]);
  if (isUnlimitedAccount(accountId)) return { mode: "included", credits: balance, weekLeft: null };
  const weekLeft = isIncluded ? Math.max(0, SCREENSHOT_LIMITS.includedPerWeek - used) : null;
  if (isIncluded && weekLeft) return { mode: "included", credits: balance, weekLeft };
  return { mode: balance > 0 ? "credit" : "buy", credits: balance, weekLeft };
}

/** Takes one use before the screenshots are read: from paid Atelier's week first, otherwise one she bought. */
export async function reserveScreenshotUse(accountId: string, now = Date.now()): Promise<{ ok: true; use: ScreenshotUse } | { ok: false; code: string }> {
  if (isUnlimitedAccount(accountId)) return { ok: true, use: "unlimited" };
  const isIncluded = await included(accountId, now);
  if (isIncluded) {
    const week = weekWindow(now);
    await env.DB.prepare("INSERT OR IGNORE INTO member_feature_usage (account_id, feature, week_start_ms) VALUES (?, ?, ?)").bind(accountId, KIND, week).run();
    const taken = await env.DB.prepare(`UPDATE member_feature_usage SET count = CASE WHEN week_start_ms = ? THEN count + 1 ELSE 1 END, week_start_ms = ?
      WHERE account_id = ? AND feature = ? AND (week_start_ms != ? OR count < ?)`).bind(week, week, accountId, KIND, week, SCREENSHOT_LIMITS.includedPerWeek).run();
    if (taken.meta.changes) return { ok: true, use: "included" };
  }
  const spent = await env.DB.prepare("UPDATE member_credits SET balance = balance - 1, updated_at_ms = ? WHERE account_id = ? AND kind = ? AND balance > 0")
    .bind(now, accountId, KIND).run();
  if (spent.meta.changes) return { ok: true, use: "credit" };
  return { ok: false, code: isIncluded ? "SCREENSHOTS_WEEK_LIMIT" : "SCREENSHOTS_PAYMENT_REQUIRED" };
}

/** Gives the use back when nothing could be read. */
export async function releaseScreenshotUse(accountId: string, use: ScreenshotUse, now = Date.now()) {
  if (use === "included") {
    await env.DB.prepare("UPDATE member_feature_usage SET count = MAX(0, count - 1) WHERE account_id = ? AND feature = ? AND week_start_ms = ?")
      .bind(accountId, KIND, weekWindow(now)).run();
  } else if (use === "credit") {
    await env.DB.prepare("UPDATE member_credits SET balance = balance + 1, updated_at_ms = ? WHERE account_id = ? AND kind = ?").bind(now, accountId, KIND).run();
  }
}
