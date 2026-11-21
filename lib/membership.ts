import { env } from "cloudflare:workers";
import { memberAccount, memberAuthReady } from "./member-auth";

export type PaidPlan = "deep" | "atelier";
export type MemberPlan = "soft" | PaidPlan;
export const MEMBER_PRICE_FEN: Record<PaidPlan, number> = { deep: 3900, atelier: 14900 };
/** What an order can buy: a 30-day plan, one screenshot import for TA (lib/screenshot-import.ts), or a chat pack. */
export type OrderItem = PaidPlan | "screenshots" | "chats";
/**
 * A chat pack: replies beyond the plan's 5-hour and weekly allowance, used only once those run out, never expiring.
 * ¥15 for 100 costs at most ¥9.6 on qwen3.8-max (¥0.096 a reply), about ¥5 with the prompt cache.
 */
export const CHAT_PACK = { replies: 100 } as const;
export const ORDER_PRICE_FEN: Record<OrderItem, number> = { ...MEMBER_PRICE_FEN, screenshots: 990, chats: 1500 };
export function isOrderItem(value: unknown): value is OrderItem { return isPaidPlan(value) || value === "screenshots" || value === "chats"; }
/**
 * Chat units per 5 hours and per week (chat, reframe and 此刻这一句 share them; TA too, on Porcelain). Every plan uses
 * qwen3.8-max: about ¥0.05 a unit with the prompt cache, ¥0.096 at most. Used to the full, Celadon about breaks even
 * and Porcelain stays in profit; typical use leaves about 70% (2026-11-21, reports/定价限额与成本测算.md and the cache
 * measurement). The free plan is kept small: its users have no ceiling. Beyond these, chat credits (CHAT_PACK).
 */
export const MEMBER_LIMITS: Record<MemberPlan, { fiveHours: number; week: number }> = {
  soft: { fiveHours: 6, week: 15 },
  deep: { fiveHours: 30, week: 100 },
  atelier: { fiveHours: 80, week: 300 },
};
/** Story scripts a week, counted apart from chat. Every plan writes with the same model; only the count differs. */
export const STORY_LIMITS: Record<MemberPlan, number> = { soft: 1, deep: 5, atelier: 20 };
/** Every new account has Porcelain (atelier) for its first seven days. */
const welcomeMs = 7 * 24 * 60 * 60 * 1000;
const fiveHoursMs = 5 * 60 * 60 * 1000;
const monthMs = 30 * 24 * 60 * 60 * 1000;
const referralMs = monthMs;
/**
 * Invitation code: 30 days of Porcelain (atelier), once per account. The founder hands it out by hand to people who
 * posted about AlreaDough on two platforms and brought a friend who signed in. (Until 2026-11-20 the same code gave 7 days.)
 */
const REFERRAL_CODES = new Set(["20260910"]);
/** Accounts with no allowance at all (the founder's own account, for testing). */
const UNLIMITED_ACCOUNTS = new Set(["app:d4b537ab-a8d5-4feb-936d-e1596d083750"]);
export function isUnlimitedAccount(accountId: string) { return UNLIMITED_ACCOUNTS.has(accountId); }

export function membershipEnabled() {
  return process.env.MEMBERSHIP_ENABLED === "1" && memberAuthReady();
}

export function isPaidPlan(value: unknown): value is PaidPlan { return value === "deep" || value === "atelier"; }
export function weekWindow(now: number) {
  const day = new Date(now).getUTCDay();
  const midnight = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  return midnight - ((day + 6) % 7) * 86_400_000;
}
export function fiveHourWindow(now: number) { return Math.floor(now / fiveHoursMs) * fiveHoursMs; }

type StateRow = { plan: MemberPlan; periodEndMs: number | null; trialEndMs: number | null };
type CodeRow = { kind: string; startsAtMs: number; endsAtMs: number };
async function readMember(accountId: string, now: number) {
  const [row, codes, accountRow] = await Promise.all([
    env.DB.prepare("SELECT plan, period_end_ms AS periodEndMs, trial_end_ms AS trialEndMs FROM member_state WHERE account_id = ?").bind(accountId).first() as Promise<StateRow | null>,
    env.DB.prepare("SELECT kind, starts_at_ms AS startsAtMs, ends_at_ms AS endsAtMs FROM member_codes WHERE account_id = ?").bind(accountId).all<CodeRow>().then((result) => result.results),
    env.DB.prepare("SELECT MIN(created_at) AS createdAt FROM member_accounts WHERE account_id = ?").bind(accountId).first<{ createdAt: number | null }>().catch(() => null),
  ]);
  const paid = !!row?.periodEndMs && row.periodEndMs > now && (row.plan === "deep" || row.plan === "atelier");
  const trial = !paid && !!row?.trialEndMs && row.trialEndMs > now;
  // Code days are a temporary overlay: Atelier while one of their windows runs, then the account's own plan again.
  const referral = codes.some((code) => code.startsAtMs <= now && now < code.endsAtMs);
  const codesEndMs = Math.max(0, ...codes.map((code) => code.endsAtMs));
  // A new account's first seven days are Porcelain (atelier), unless a paid plan already covers them.
  const welcomeEndMs = accountRow?.createdAt ? accountRow.createdAt + welcomeMs : null;
  const welcome = !paid && !!welcomeEndMs && welcomeEndMs > now;
  const ownPlan: MemberPlan = paid ? row!.plan : welcome ? "atelier" : trial ? "deep" : "soft";
  const plan: MemberPlan = referral ? "atelier" : ownPlan;
  const state = { plan, trial: trial || welcome, welcome, referral, referralUsed: codes.some((code) => code.kind === "invite"),
    // the plan she is paying for right now, apart from any free days on top (welcome week, invitation code)
    paidPlan: paid ? row!.plan as PaidPlan : null,
    // the last day of code-given Atelier, also while those days are still waiting behind her first week or a paid month
    referralEndMs: codesEndMs > now ? codesEndMs : null,
    periodEndMs: paid ? row!.periodEndMs : welcome ? welcomeEndMs : trial ? row!.trialEndMs : null };
  // When the Atelier days she already has run out; days from a new code start there instead of overlapping them.
  const atelierEndMs = Math.max(now, paid && row!.plan === "atelier" ? row!.periodEndMs! : 0, welcome ? welcomeEndMs! : 0, codesEndMs);
  return { state, atelierEndMs };
}

export async function memberState(accountId: string, now = Date.now()) {
  return (await readMember(accountId, now)).state;
}

export async function createMemberOrder(accountId: string, plan: OrderItem) {
  const orderId = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, "0")).join("");
  const amountFen = ORDER_PRICE_FEN[plan];
  await env.DB.prepare("INSERT INTO member_orders (order_id, account_id, plan, amount_fen, created_at_ms) VALUES (?, ?, ?, ?, ?)")
    .bind(orderId, accountId, plan, amountFen, Date.now()).run();
  return { orderId, amountFen, plan };
}

export type MemberOrder = { orderId: string; accountId: string; plan: OrderItem; amountFen: number; status: string };
export async function readMemberOrder(orderId: string) {
  return env.DB.prepare("SELECT order_id AS orderId, account_id AS accountId, plan, amount_fen AS amountFen, status FROM member_orders WHERE order_id = ?")
    .bind(orderId).first<MemberOrder>();
}

/**
 * D1 batches are one transaction. The entitlement SELECT only sees pending orders, so repeated or concurrent callbacks cannot extend twice.
 * Days still left on a paid plan are kept at their value: switching plans converts them by price (20 days of
 * Porcelain become about 76 days of Celadon, 20 days of Celadon about 5 of Porcelain), then the 30 bought days are added.
 * With no paid days left, an unexpired trial still counts, as before.
 */
export async function grantPaidOrder(order: MemberOrder, providerTradeNo: string) {
  const now = Date.now();
  const markPaid = env.DB.prepare("UPDATE member_orders SET status = 'paid', provider_trade_no = ?, paid_at_ms = ? WHERE order_id = ? AND status = 'pending'")
    .bind(providerTradeNo, now, order.orderId);
  if (order.plan === "screenshots" || order.plan === "chats") {
    // One screenshot import, or a chat pack, added to her balance; same pending-only guard as the plans below.
    const kind = order.plan === "chats" ? "chat" : "screenshots";
    const amount = order.plan === "chats" ? CHAT_PACK.replies : 1;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO member_credits (account_id, kind, balance, updated_at_ms)
        SELECT account_id, ?, ?, ? FROM member_orders WHERE order_id = ? AND status = 'pending'
        ON CONFLICT(account_id, kind) DO UPDATE SET balance = member_credits.balance + excluded.balance, updated_at_ms = excluded.updated_at_ms`)
        .bind(kind, amount, now, order.orderId),
      markPaid,
    ]);
    return;
  }
  const price = (column: string) => `(CASE ${column} WHEN 'atelier' THEN ${MEMBER_PRICE_FEN.atelier} ELSE ${MEMBER_PRICE_FEN.deep} END)`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO member_state (account_id, plan, period_end_ms, updated_at_ms)
      SELECT account_id, plan, ? + ?, ? FROM member_orders WHERE order_id = ? AND status = 'pending'
      ON CONFLICT(account_id) DO UPDATE SET plan = excluded.plan,
      period_end_ms = CASE
        WHEN member_state.plan IN ('deep', 'atelier') AND COALESCE(member_state.period_end_ms, 0) > ?
          THEN ? + ? + CAST((member_state.period_end_ms - ?) * ${price("member_state.plan")} / ${price("excluded.plan")} AS INTEGER)
        ELSE MAX(?, COALESCE(member_state.trial_end_ms, 0)) + ?
      END,
      updated_at_ms = excluded.updated_at_ms`)
      .bind(now, monthMs, now, order.orderId, now, now, monthMs, now, now, monthMs),
    markPaid,
  ]);
}

export async function memberUsage(accountId: string, now = Date.now()) {
  const row = await env.DB.prepare("SELECT five_start_ms AS fiveStart, five_units AS fiveUnits, week_start_ms AS weekStart, week_units AS weekUnits FROM member_usage WHERE account_id = ?")
    .bind(accountId).first<{ fiveStart: number; fiveUnits: number; weekStart: number; weekUnits: number }>();
  return { fiveUnits: row?.fiveStart === fiveHourWindow(now) ? row.fiveUnits : 0, weekUnits: row?.weekStart === weekWindow(now) ? row.weekUnits : 0,
    fiveResetMs: fiveHourWindow(now) + fiveHoursMs, weekResetMs: weekWindow(now) + 7 * 86_400_000 };
}

export async function reserveMemberUnit(accountId: string, now = Date.now()) {
  const state = await memberState(accountId, now);
  const limits = isUnlimitedAccount(accountId) ? { fiveHours: 1_000_000_000, week: 1_000_000_000 } : MEMBER_LIMITS[state.plan];
  const five = fiveHourWindow(now), week = weekWindow(now);
  await env.DB.prepare("INSERT OR IGNORE INTO member_usage (account_id, five_start_ms, week_start_ms) VALUES (?, ?, ?)").bind(accountId, five, week).run();
  const result = await env.DB.prepare(`UPDATE member_usage SET
    five_units = CASE WHEN five_start_ms = ? THEN five_units + 1 ELSE 1 END,
    week_units = CASE WHEN week_start_ms = ? THEN week_units + 1 ELSE 1 END,
    five_start_ms = ?, week_start_ms = ?
    WHERE account_id = ? AND (five_start_ms != ? OR five_units < ?) AND (week_start_ms != ? OR week_units < ?)`)
    .bind(five, week, five, week, accountId, five, limits.fiveHours, week, limits.week).run();
  if (result.meta.changes) return { ok: true, state, limits, source: "plan" as const };
  // the plan's 5-hour or weekly allowance is used up: one reply from her chat pack, if she bought one
  const spent = await env.DB.prepare("UPDATE member_credits SET balance = balance - 1, updated_at_ms = ? WHERE account_id = ? AND kind = 'chat' AND balance > 0")
    .bind(now, accountId).run();
  return { ok: !!spent.meta.changes, state, limits, source: "credit" as const };
}

/** Replies left in her chat packs. */
export async function chatCredits(accountId: string) {
  const row = await env.DB.prepare("SELECT balance FROM member_credits WHERE account_id = ? AND kind = 'chat'").bind(accountId).first<{ balance: number }>();
  return row?.balance || 0;
}

/**
 * One reply the user sees is one unit. A normal turn, including the internal rewrite pass, is about
 * 4,000-8,000 weighted tokens (measured 2026-11-16: ~3,300 input + ~250 output per model call), so only
 * unusually long conversations count as more than one.
 */
export function usageUnits(usage: { input_tokens?: number; output_tokens?: number } | null) {
  return Math.max(1, Math.ceil(((usage?.input_tokens || 0) + 3 * (usage?.output_tokens || 0)) / 8000));
}

export async function finishMemberUnit(accountId: string, units: number, succeeded: boolean, now = Date.now(), source: "plan" | "credit" = "plan") {
  // a reply from a chat pack is one credit however long it was; a failed one gives the credit back
  if (source === "credit") {
    if (!succeeded) await env.DB.prepare("UPDATE member_credits SET balance = balance + 1, updated_at_ms = ? WHERE account_id = ? AND kind = 'chat'").bind(now, accountId).run();
    return;
  }
  const five = fiveHourWindow(now), week = weekWindow(now);
  const delta = succeeded ? Math.max(0, units - 1) : -1;
  if (!delta) return;
  await env.DB.prepare(`UPDATE member_usage SET
    five_units = CASE WHEN five_start_ms = ? THEN MAX(0, five_units + ?) ELSE five_units END,
    week_units = CASE WHEN week_start_ms = ? THEN MAX(0, week_units + ?) ELSE week_units END
    WHERE account_id = ?`).bind(five, delta, week, delta, accountId).run();
}

/** Stories written this week and the plan's weekly allowance. */
export async function storyUsage(accountId: string, plan: MemberPlan, now = Date.now()) {
  const row = await env.DB.prepare("SELECT week_start_ms AS weekStart, count FROM member_story_usage WHERE account_id = ?").bind(accountId).first<{ weekStart: number; count: number }>();
  return { used: row?.weekStart === weekWindow(now) ? row.count : 0, limit: isUnlimitedAccount(accountId) ? 1_000_000 : STORY_LIMITS[plan], resetMs: weekWindow(now) + 7 * 86_400_000 };
}

/** Takes one story from this week's allowance; false when it is used up. A rewrite she asks for is a new story. */
export async function reserveStory(accountId: string, now = Date.now()) {
  const state = await memberState(accountId, now);
  const limit = isUnlimitedAccount(accountId) ? 1_000_000 : STORY_LIMITS[state.plan];
  const week = weekWindow(now);
  await env.DB.prepare("INSERT OR IGNORE INTO member_story_usage (account_id, week_start_ms) VALUES (?, ?)").bind(accountId, week).run();
  const result = await env.DB.prepare(`UPDATE member_story_usage SET
    count = CASE WHEN week_start_ms = ? THEN count + 1 ELSE 1 END, week_start_ms = ?
    WHERE account_id = ? AND (week_start_ms != ? OR count < ?)`).bind(week, week, accountId, week, limit).run();
  return !!result.meta.changes;
}

/** Gives the story back when the AI could not write it. */
export async function releaseStory(accountId: string, now = Date.now()) {
  const week = weekWindow(now);
  await env.DB.prepare("UPDATE member_story_usage SET count = MAX(0, count - 1) WHERE account_id = ? AND week_start_ms = ?").bind(accountId, week).run();
}

export async function membershipForRequest(request: Request) {
  const accountId = await memberAccount(request);
  if (!accountId) return null;
  const [state, usage, credits] = await Promise.all([memberState(accountId), memberUsage(accountId), chatCredits(accountId)]);
  return { ...state, usage, limits: MEMBER_LIMITS[state.plan], story: await storyUsage(accountId, state.plan), unlimited: isUnlimitedAccount(accountId), chatCredits: credits };
}

export function isReferralCode(value: unknown) {
  return typeof value === "string" && REFERRAL_CODES.has(value.trim());
}

/**
 * Thirty days of Porcelain (atelier), once per account (the table's key). They begin when the Atelier days she already
 * has end (her first week, a paid Atelier month, the old 7-day code), so none are lost. Nothing in member_state
 * changes, so when they end the account is back on its own plan (free, or its paid period).
 */
export async function redeemReferral(accountId: string, code: string) {
  const now = Date.now();
  const { atelierEndMs } = await readMember(accountId, now);
  try {
    await env.DB.prepare("INSERT INTO member_codes (account_id, kind, code, starts_at_ms, ends_at_ms, redeemed_at_ms) VALUES (?, 'invite', ?, ?, ?, ?)")
      .bind(accountId, code.trim(), atelierEndMs, atelierEndMs + referralMs, now).run();
  } catch {
    const used = await env.DB.prepare("SELECT 1 AS used FROM member_codes WHERE account_id = ? AND kind = 'invite'").bind(accountId).first();
    if (used) return { ok: false as const, error: "REFERRAL_USED" };
    throw new Error("REFERRAL_FAILED");
  }
  return { ok: true as const, membership: await memberState(accountId) };
}
