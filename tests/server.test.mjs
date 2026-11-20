// Server-side money, sign-in and privacy rules, run against a real SQLite copy of the D1 schema.
// Run with: node --import ./tests/support/register.mjs --test tests/server.test.mjs
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { env } from "cloudflare:workers";
import { createD1 } from "./support/d1.mjs";

Object.assign(process.env, {
  MEMBERSHIP_ENABLED: "1",
  AUTH_EMAIL_ENABLED: "1",
  SUPABASE_AUTH_URL: "https://auth.example.test",
  SUPABASE_AUTH_KEY: "test-key",
  BETA_FOUNDER_SECRET: "founder-secret-for-tests",
});

const membership = await import("../lib/membership.ts");
const auth = await import("../lib/member-auth.ts");
const owner = await import("../lib/request-owner.ts");
const waffo = await import("../lib/waffo.ts");
const { founderAuthorized } = await import("../lib/founder-auth.ts");
const { withHerName } = await import("../lib/her-name.ts");
const space = await import("../app/api/space/route.ts");
const waffoWebhook = await import("../app/api/pay/waffo/webhook/route.ts");

const DAY = 86_400_000;
const month = 30 * DAY;

beforeEach(() => { env.DB = createD1(); });

async function signIn(providerId = crypto.randomUUID()) {
  const cookie = await auth.createMemberSession(providerId, `${providerId}@example.test`);
  return { accountId: `app:${providerId}`, cookie: cookie.split(";")[0] };
}

async function order(accountId, plan) {
  const created = await membership.createMemberOrder(accountId, plan);
  return { ...created, accountId, status: "pending" };
}

const state = (accountId) => env.DB.prepare("SELECT plan, period_end_ms AS end FROM member_state WHERE account_id = ?").bind(accountId).first();
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 60_000, `${label}: ${actual} vs ${expected}`);

test("paid order: grants 30 days once, even when the provider calls back twice", async () => {
  const first = await order("app:a", "deep");
  await membership.grantPaidOrder(first, "trade-1");
  await membership.grantPaidOrder(first, "trade-1");
  const row = await state("app:a");
  assert.equal(row.plan, "deep");
  near(row.end, Date.now() + month, "one month");
  const again = await order("app:a", "deep");
  await membership.grantPaidOrder(again, "trade-2");
  near((await state("app:a")).end, Date.now() + 2 * month, "a second order adds a month on top");
});

test("paid order: switching plans converts the days left by price instead of dropping them", async () => {
  const now = Date.now();
  await env.DB.prepare("INSERT INTO member_state (account_id, plan, period_end_ms, updated_at_ms) VALUES ('app:down', 'atelier', ?, ?), ('app:up', 'deep', ?, ?)")
    .bind(now + 20 * DAY, now, now + 20 * DAY, now).run();
  await membership.grantPaidOrder(await order("app:down", "deep"), "t");
  await membership.grantPaidOrder(await order("app:up", "atelier"), "t");
  const down = await state("app:down"), up = await state("app:up");
  assert.equal(down.plan, "deep");
  near(down.end, now + month + 20 * DAY * 14900 / 3900, "20 Atelier days become ~76 Deep Practice days");
  assert.equal(up.plan, "atelier");
  near(up.end, now + month + 20 * DAY * 3900 / 14900, "20 Deep Practice days become ~5 Atelier days");
});

test("paid order: an expired plan or an unexpired trial is handled as before", async () => {
  const now = Date.now();
  await env.DB.prepare("INSERT INTO member_state (account_id, plan, period_end_ms, trial_end_ms, updated_at_ms) VALUES ('app:old', 'atelier', ?, NULL, ?), ('app:trial', 'soft', NULL, ?, ?)")
    .bind(now - DAY, now, now + 3 * DAY, now).run();
  await membership.grantPaidOrder(await order("app:old", "deep"), "t");
  await membership.grantPaidOrder(await order("app:trial", "deep"), "t");
  near((await state("app:old")).end, now + month, "expired days are not converted");
  near((await state("app:trial")).end, now + 3 * DAY + month, "trial days still count");
});

test("allowance: a free account gets its chat and story limits, and failed replies are given back", async () => {
  await env.DB.prepare("INSERT INTO member_accounts (provider_id, account_id, created_at) VALUES ('old', 'app:old', ?)").bind(Date.now() - 30 * DAY).run();
  for (let i = 0; i < membership.MEMBER_LIMITS.soft.fiveHours; i += 1) assert.equal((await membership.reserveMemberUnit("app:old")).ok, true);
  assert.equal((await membership.reserveMemberUnit("app:old")).ok, false, "over the 5-hour limit");
  await membership.finishMemberUnit("app:old", 1, false);
  assert.equal((await membership.reserveMemberUnit("app:old")).ok, true, "a failed reply does not count");
  for (let i = 0; i < membership.STORY_LIMITS.soft; i += 1) assert.equal(await membership.reserveStory("app:old"), true);
  assert.equal(await membership.reserveStory("app:old"), false);
});

test("sign-in codes: one email a minute per address", async () => {
  const request = new Request("https://alreadough.com/api/member/auth/otp", { headers: { "cf-connecting-ip": "1.2.3.4" } });
  assert.equal(await auth.claimAuthLimit(request, "a@example.test", "send"), true);
  assert.equal(await auth.claimAuthLimit(request, "a@example.test", "send"), false);
  assert.equal(await auth.claimAuthLimit(request, "b@example.test", "send"), true);
});

test("request owner: with membership on, a made-up device id alone opens nothing", async () => {
  const deviceOnly = new Request("https://alreadough.com/api/images?q=x", { headers: { "x-already-session-id": "3f1c9a2e-7b44-4c1d-9e0a-5d2b8c6f1a77" } });
  assert.equal(await owner.requestOwner(deviceOnly), null);
  const { accountId, cookie } = await signIn();
  const signed = await owner.requestOwner(new Request("https://alreadough.com/api/images?q=x", { headers: { cookie } }));
  assert.equal(signed.key, `account:${accountId}`);
  for (let i = 0; i < 3; i += 1) assert.equal(await owner.claimDaily(signed, "test", 3), true);
  assert.equal(await owner.claimDaily(signed, "test", 3), false, "daily allowance used up");
});

test("founder access: only the bearer secret, never a header anyone can send", async () => {
  process.env.BETA_FOUNDER_EMAIL = "founder@example.test";
  const forged = new Request("https://alreadough.com/api/beta/admin", { headers: { "oai-authenticated-user-email": "founder@example.test" } });
  assert.equal(founderAuthorized(forged), false);
  const real = new Request("https://alreadough.com/api/beta/admin", { headers: { authorization: "Bearer founder-secret-for-tests" } });
  assert.equal(founderAuthorized(real), true);
  delete process.env.BETA_FOUNDER_EMAIL;
});

test("space: belongs to the account; a device's old space moves over once and the device id stops working", async () => {
  const device = "3f1c9a2e-7b44-4c1d-9e0a-5d2b8c6f1a77";
  await env.DB.prepare("INSERT INTO user_spaces (user_id, payload, revision, updated_at) VALUES (?, ?, 4, 'then')").bind(`device:${device}`, JSON.stringify({ goal: "old" })).run();
  const deviceOnly = () => new Request("https://alreadough.com/api/space", { headers: { "x-already-session-id": device } });
  assert.equal((await space.GET(deviceOnly())).status, 401, "the sync code alone no longer opens the space");

  const { cookie } = await signIn();
  const signed = (init = {}) => new Request("https://alreadough.com/api/space", { ...init, headers: { cookie, "x-already-session-id": device, "Content-Type": "application/json", origin: "https://alreadough.com" } });
  const loaded = await (await space.GET(signed())).json();
  assert.deepEqual(loaded.space, { goal: "old" });
  assert.equal(loaded.revision, 4);
  assert.match(loaded.owner, /^[0-9a-f]{16}$/);
  assert.equal(await env.DB.prepare("SELECT 1 FROM user_spaces WHERE user_id = ?").bind(`device:${device}`).first(), null, "device row removed");

  const saved = await space.PUT(signed({ method: "PUT", body: JSON.stringify({ space: { goal: "new" }, baseRevision: 4 }) }));
  assert.equal((await saved.json()).revision, 5);
  const stale = await space.PUT(signed({ method: "PUT", body: JSON.stringify({ space: { goal: "stale" }, baseRevision: 4 }) }));
  assert.equal(stale.status, 409, "a device holding an old copy must reload before saving");

  const other = await signIn();
  const theirs = await (await space.GET(new Request("https://alreadough.com/api/space", { headers: { cookie: other.cookie, "x-already-session-id": device } }))).json();
  assert.equal(theirs.space, null, "another account on the same device does not get this space");
  assert.notEqual(theirs.owner, loaded.owner);
});

test("card payments: webhook amounts are read in cents, and unsigned or tampered notices are refused", async () => {
  assert.equal(waffo.displayAmountFen("6.49"), 649);
  assert.equal(waffo.displayAmountFen("22.9"), 2290);
  assert.equal(waffo.displayAmountFen("1e3"), null);
  const body = JSON.stringify({ eventType: "order.completed", mode: "prod", data: {} });
  assert.equal(await waffo.verifyWaffoWebhook(body, null, "prod"), null);
  assert.equal(await waffo.verifyWaffoWebhook(body, `t=${Date.now()},v1=${btoa("forged")}`, "prod"), null);
  assert.equal(await waffo.verifyWaffoWebhook(body, `t=${Date.now() - 2 * 3_600_000},v1=${btoa("x")}`, "prod"), null, "too old");

  Object.assign(process.env, { WAFFO_ENABLED: "1", WAFFO_MERCHANT_ID: "m", WAFFO_PRIVATE_KEY: "k", WAFFO_PRODUCT_DEEP: "p1", WAFFO_PRODUCT_ATELIER: "p2", WAFFO_ENV: "prod" });
  const response = await waffoWebhook.POST(new Request("https://alreadough.com/api/pay/waffo/webhook", { method: "POST", body, headers: { "x-waffo-signature": `t=${Date.now()},v1=${btoa("forged")}` } }));
  assert.equal(response.status, 401);
  assert.equal(await env.DB.prepare("SELECT COUNT(*) AS n FROM member_state").first("n"), 0, "nothing granted");
  for (const name of ["WAFFO_ENABLED", "WAFFO_MERCHANT_ID", "WAFFO_PRIVATE_KEY", "WAFFO_PRODUCT_DEEP", "WAFFO_PRODUCT_ATELIER", "WAFFO_ENV"]) delete process.env[name];
});

test("memory library: the AI's old \"用户\" / \"the user\" shows as her own name", () => {
  assert.equal(withHerName("用户希望gay好友Elvin变成恋人，用户偏好简短的肯定语", "瑄瑄"), "瑄瑄希望gay好友Elvin变成恋人，瑄瑄偏好简短的肯定语");
  assert.equal(withHerName("The user wants a short list; the user's friend agreed", "Mia"), "Mia wants a short list; Mia's friend agreed");
  assert.equal(withHerName("用户希望……", "  "), "用户希望……", "no name: shown as it was");
  assert.equal(withHerName("", "瑄瑄"), "");
});

test("crisis: the words readers really use reach the crisis path; everyday venting does not", async () => {
  const { mentionsSuicide } = await import("../lib/crisis-signals.ts");
  for (const text of ["我真的不想活了", "哪天想不开了要紫砂", "活着没意思", "我想一了百了", "没有我大家会更好", "I want to die", "everyone is better off without me"]) {
    assert.equal(mentionsSuicide(text), true, text);
  }
  for (const text of ["旧版本的 sp 去死，都是假的", "上班和家里的压力，感觉自己快撑不住了", "不想上班了", "我想放下执念"]) {
    assert.equal(mentionsSuicide(text), false, text);
  }
  const companion = await import("../app/api/companion/route.ts");
  const goal = { companionName: "", spName: "", desire: "和阿哲复合", beliefs: [], journeySummary: "", wishCategory: "relationship", coachMode: "assumption" };
  const ask = (mode, userInput) => companion.POST(new Request("https://alreadough.com/api/companion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, lang: "zh", userInput, sessionId: `crisis-${mode}-${Math.random()}`, goal, recentMessages: [], recentRevisions: [] }) }));
  const reframe = await (await ask("revision", "我不想活了")).json();
  assert.equal(reframe.model, "crisis-pause-route", "Reframe never turns this into a new thought");
  assert.match(reframe.reply, /安全/);
  const lines = await ask("affirm", "想不开");
  assert.equal(lines.status, 422);
  assert.equal((await lines.json()).error, "CRISIS_PAUSE");
});

test("slang: the companion is told what 💐, a, kdy, md, sp and 3D mean only when she used them", async () => {
  const { slangNotes, slangBlock } = await import("../lib/slang-glossary.ts");
  const notes = slangNotes("我💐sp三个月了，每天a kdy，md 也在做，可 3d 一点没动").join("\n");
  for (const word of ["显化", "肯定语", "mental diet", "特定的人", "眼前的现实"]) assert.match(notes, new RegExp(word));
  assert.equal(slangBlock("zh", "我今天心情很好，想去散步"), "", "no shorthand, nothing added");
  assert.equal(slangNotes("I have a dream about my spa day").length, 0, "English words are not mistaken for shorthand");
  assert.equal(slangBlock("en", "💐"), "");
});

test("crisis: everyday 控制不住 (anxiety, crying) is not an emergency; 控制不住 with self-harm is", async () => {
  const { desirePreservingSafetyReply } = await import("../lib/already-ai.ts");
  assert.equal(desirePreservingSafetyReply("申请季结果很差，我现在每天控制不住的焦虑难过", "zh", "小愿"), null);
  assert.equal(desirePreservingSafetyReply("我现在控制不住地一直哭", "zh", "小愿"), null);
  assert.ok(desirePreservingSafetyReply("我现在控制不住想伤害自己", "zh", "小愿"));
  assert.ok(desirePreservingSafetyReply("我准备今晚去死", "zh", "小愿"));
});
