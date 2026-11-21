import { env } from "cloudflare:workers";
import { BLIND_CHOICES, blindTest, type BlindChoice } from "./blind-tests";
import { claimWindow } from "./member-auth";

/** Per browser address an hour, and for the whole site a day: a script cannot flood the table. */
const PER_ADDRESS_HOURLY = 30;
const SITE_DAILY = 5000;

export type BlindTally = Record<BlindChoice, number>;
export type BlindResults = { voters: number; items: Record<string, BlindTally>; totals: BlindTally };

const VOTER = /^[A-Za-z0-9-]{16,64}$/;
const empty = (): BlindTally => ({ m1: 0, m2: 0, tie: 0 });

/**
 * Stores one visitor's picks for a test (any number of its questions; a repeat replaces the earlier pick).
 * Returns an error code instead of throwing for anything the visitor sent wrong.
 */
export async function recordBlindVotes(input: { testId?: unknown; voter?: unknown; picks?: unknown }, address: string, now = Date.now()) {
  const test = typeof input.testId === "string" ? blindTest(input.testId) : null;
  if (!test) return { ok: false as const, error: "UNKNOWN_TEST" };
  if (typeof input.voter !== "string" || !VOTER.test(input.voter)) return { ok: false as const, error: "BAD_VOTER" };
  if (!input.picks || typeof input.picks !== "object" || Array.isArray(input.picks)) return { ok: false as const, error: "BAD_PICKS" };
  const itemIds = new Set(test.items.map((item) => item.id));
  const picks = Object.entries(input.picks as Record<string, unknown>)
    .filter((entry): entry is [string, BlindChoice] => itemIds.has(entry[0]) && BLIND_CHOICES.includes(entry[1] as BlindChoice));
  if (!picks.length) return { ok: false as const, error: "BAD_PICKS" };
  if (!(await claimWindow(`blind-vote:${address}`, 3_600_000, PER_ADDRESS_HOURLY))) return { ok: false as const, error: "TOO_MANY" };
  if (!(await claimWindow("blind-vote:site", 86_400_000, SITE_DAILY))) return { ok: false as const, error: "TOO_MANY" };
  await env.DB.batch(picks.map(([itemId, choice]) => env.DB.prepare(
    "INSERT INTO blind_votes (test_id, voter, item_id, choice, created_at_ms) VALUES (?, ?, ?, ?, ?) ON CONFLICT(test_id, voter, item_id) DO UPDATE SET choice = excluded.choice, created_at_ms = excluded.created_at_ms",
  ).bind(test.id, input.voter, itemId, choice, now)));
  return { ok: true as const, saved: picks.length };
}

/** How everyone has voted so far: per question and overall, plus how many people took part. */
export async function blindResults(testId: string): Promise<BlindResults | null> {
  const test = blindTest(testId);
  if (!test) return null;
  const [rows, people] = await Promise.all([
    env.DB.prepare("SELECT item_id AS itemId, choice, COUNT(*) AS n FROM blind_votes WHERE test_id = ? GROUP BY item_id, choice").bind(test.id).all<{ itemId: string; choice: BlindChoice; n: number }>(),
    env.DB.prepare("SELECT COUNT(DISTINCT voter) AS n FROM blind_votes WHERE test_id = ?").bind(test.id).first<{ n: number }>(),
  ]);
  const items: Record<string, BlindTally> = Object.fromEntries(test.items.map((item) => [item.id, empty()]));
  const totals = empty();
  for (const row of rows.results ?? []) {
    if (!items[row.itemId] || !BLIND_CHOICES.includes(row.choice)) continue;
    items[row.itemId][row.choice] += Number(row.n);
    totals[row.choice] += Number(row.n);
  }
  return { voters: Number(people?.n ?? 0), items, totals };
}
