// Public blind test votes (/test), run against a real SQLite copy of the D1 schema.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, test } from "node:test";
import { env } from "cloudflare:workers";
import { createD1 } from "./support/d1.mjs";

const { recordBlindVotes, blindResults } = await import("../lib/blind-votes.ts");
const { CURRENT_BLIND_TEST_ID, blindTest } = await import("../lib/blind-tests.ts");

beforeEach(() => { env.DB = createD1(); });
const TEST = CURRENT_BLIND_TEST_ID;
const voter = (n) => `voter-${String(n).padStart(12, "0")}`;

test("the current test exists and every question has both sides", () => {
  const data = blindTest(TEST);
  assert.ok(data && data.items.length > 0);
  for (const item of data.items) {
    if (item.kind === "single") assert.ok(item.replies.m1 && item.replies.m2, item.id);
    else assert.ok(item.turns.m1.length && item.turns.m1.length === item.turns.m2.length, item.id);
  }
});

test("the test data names no model and no private name", async () => {
  const raw = await readFile(new URL("../lib/blind-test-data/2611-reply.ts", import.meta.url), "utf8");
  assert.doesNotMatch(raw, /qwen|kimi|deepseek|glm|minimax|瑄瑄/i);
});

test("bad input is refused without writing", async () => {
  assert.equal((await recordBlindVotes({ testId: "nope", voter: voter(1), picks: { s01: "m1" } }, "a")).error, "UNKNOWN_TEST");
  assert.equal((await recordBlindVotes({ testId: TEST, voter: "short", picks: { s01: "m1" } }, "a")).error, "BAD_VOTER");
  assert.equal((await recordBlindVotes({ testId: TEST, voter: voter(1), picks: { s01: "kimi", zz: "m1" } }, "a")).error, "BAD_PICKS");
  assert.equal((await blindResults(TEST)).voters, 0);
});

test("votes are counted per question and overall, and voting again replaces the earlier pick", async () => {
  assert.equal((await recordBlindVotes({ testId: TEST, voter: voter(1), picks: { s01: "m1", s02: "tie", unknown: "m2" } }, "a")).saved, 2);
  await recordBlindVotes({ testId: TEST, voter: voter(2), picks: { s01: "m2" } }, "b");
  await recordBlindVotes({ testId: TEST, voter: voter(1), picks: { s01: "m2" } }, "a");
  const results = await blindResults(TEST);
  assert.equal(results.voters, 2);
  assert.deepEqual(results.items.s01, { m1: 0, m2: 2, tie: 0 });
  assert.deepEqual(results.items.s02, { m1: 0, m2: 0, tie: 1 });
  assert.deepEqual(results.totals, { m1: 0, m2: 2, tie: 1 });
  assert.equal(await blindResults("nope"), null);
});

test("one address can submit 30 times an hour", async () => {
  for (let i = 0; i < 30; i += 1) assert.equal((await recordBlindVotes({ testId: TEST, voter: voter(i), picks: { s01: "m1" } }, "same")).ok, true);
  assert.equal((await recordBlindVotes({ testId: TEST, voter: voter(99), picks: { s01: "m1" } }, "same")).error, "TOO_MANY");
  assert.equal((await recordBlindVotes({ testId: TEST, voter: voter(99), picks: { s01: "m1" } }, "other")).ok, true);
});
