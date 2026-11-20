// Founder cockpit numbers, run against a real SQLite copy of the D1 schema.
// Every query in founderOverview swallows its own error so one broken corner never blanks the page;
// these tests make sure each one actually runs and counts what its label says.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { env } from "cloudflare:workers";
import { createD1 } from "./support/d1.mjs";

const { founderOverview } = await import("../lib/founder-overview.ts");

const DAY = 86_400_000;
beforeEach(() => { env.DB = createD1(); });
const run = (sql, ...binds) => env.DB.prepare(sql).bind(...binds).run();

test("empty database gives zeros, not errors", async () => {
  const data = await founderOverview();
  assert.equal(data.members.accounts, 0);
  assert.equal(data.revenue.paidFen, 0);
  assert.equal(data.trend.length, 14);
  assert.equal(data.content.total, 0);
});

test("members, revenue, features, voice, content and audience are counted", async () => {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const today = iso.slice(0, 10);
  // two accounts, one paid Deep, one in trial
  await run("INSERT INTO member_accounts (provider_id, account_id, created_at) VALUES ('p1','a1',?), ('p2','a2',?)", now - 40 * DAY, now - DAY);
  await run("INSERT INTO member_state (account_id, plan, period_end_ms, trial_end_ms, updated_at_ms) VALUES ('a1','deep',?,NULL,?), ('a2','soft',NULL,?,?)", now + 20 * DAY, now, now + 3 * DAY, now);
  await run("INSERT INTO member_orders (order_id, account_id, plan, amount_fen, status, provider_trade_no, created_at_ms, paid_at_ms) VALUES ('o1','a1','deep',3900,'paid','TRADE123456',?,?), ('o2','a2','atelier',14900,'pending',NULL,?,NULL)", now - DAY, now - DAY, now - 3600_000);
  await run("INSERT INTO member_referrals (account_id, code, redeemed_at_ms) VALUES ('a2','X',?)", now - DAY);
  // AI calls: two chat, one persona (feature tag in prompt_version)
  for (const [mode, tag, user] of [["chat", "v1", "u1"], ["chat", "v1", "u2"], ["chat", "persona", "u1"]]) {
    await run("INSERT INTO beta_events (id, user_hash, event_type, mode, prompt_version, total_tokens, latency_ms, created_at) VALUES (?, ?, 'ai_response', ?, ?, 100, 2000, ?)", crypto.randomUUID(), user, mode, tag, iso);
  }
  await run("INSERT INTO beta_global_daily (usage_date, request_count, total_tokens, failed_requests, updated_at) VALUES (?, 3, 300, 0, ?)", today, iso);
  await run("INSERT INTO user_voices (user_id, voice_id, model, consented_at, created_at) VALUES ('a1','v','m',?,?)", iso, iso);
  await run("INSERT INTO voice_usage_daily (user_id, usage_date, chars, requests, enrolls) VALUES ('a1', ?, 120, 2, 1)", today);
  await run("INSERT INTO user_spaces (user_id, payload, updated_at) VALUES ('a1', ?, ?), ('a2', 'not json', ?)", JSON.stringify({ board: [{}, {}], storyLibrary: [{}], checkIns: [], revisions: [{}], otherGoals: [{}], messages: [{}] }), iso, iso);
  await run("INSERT INTO beta_profiles (user_hash, first_seen_at, last_seen_at, country, device, os, lang) VALUES ('u1', ?, ?, 'US', 'mobile', 'iOS', 'zh'), ('u2', ?, ?, 'CA', 'desktop', 'macOS', 'en')", iso, iso, new Date(now - 30 * DAY).toISOString(), iso);
  await run("INSERT INTO mail_contacts (email, account_id, subscribed, created_at, updated_at) VALUES ('x@example.test','a1',1,?,?), ('y@example.test',NULL,0,?,?)", now, now, now, now);

  const data = await founderOverview();
  assert.deepEqual(
    { accounts: data.members.accounts, newAccounts7: data.members.newAccounts7, paid: data.members.paidActive, deep: data.members.deep, trial: data.members.trial, referrals7: data.members.referrals7 },
    { accounts: 2, newAccounts7: 1, paid: 1, deep: 1, trial: 1, referrals7: 1 },
  );
  assert.equal(data.revenue.paidFen, 3900);
  assert.equal(data.revenue.pending7, 1);
  assert.equal(data.revenue.recent[0].tradeNo, null); // newest first: the pending order
  assert.equal(data.revenue.recent[1].tradeNo, "123456"); // only the tail of the provider's number
  const features = Object.fromEntries(data.features.map((row) => [row.feature, row]));
  assert.equal(features.chat.calls, 2);
  assert.equal(features.chat.users, 2);
  assert.equal(features.persona.calls, 1);
  assert.deepEqual({ cloned: data.voice.cloned, speaks7: data.voice.speaks7, chars7: data.voice.chars7 }, { cloned: 1, speaks7: 2, chars7: 120 });
  assert.deepEqual({ total: data.content.total, boardItems: data.content.boardItems, stories: data.content.stories, withCheckIns: data.content.withCheckIns, goals: data.content.goals, withChats: data.content.withChats }, { total: 1, boardItems: 2, stories: 1, withCheckIns: 0, goals: 2, withChats: 1 });
  assert.equal(data.audience.new7, 1);
  assert.equal(data.audience.visitors7, 2);
  assert.equal(data.mail.subscribed, 1);
  assert.equal(data.trend.at(-1).requests, 3);
  assert.equal(data.trend.at(-1).newUsers, 1);
});
