import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Already product shell and onboarding", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Already \| Your living desire space<\/title>/i);
  assert.match(html, /Already/);
  assert.match(html, /Opening Already|正在打开 Already/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("ships without the founder's private manifestation defaults", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const privateDefaults = ["瑄瑄", "Xuanxuan", "最要好的朋友", "他会一直喜欢男人", "他只把我当朋友", "身高 180+"];
  for (const value of privateDefaults) assert.doesNotMatch(page, new RegExp(value));
  assert.match(page, /setupComplete: false/);
  assert.match(page, /storyLibrary.*useState<Story\[]>\(\[\]\)/);
  assert.match(page, /board.*useState<BoardItem\[]>\(\[\]\)/);
});

test("keeps public trust pages available", async () => {
  for (const path of ["/privacy", "/trust", "/terms", "/copyright"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
  }
});

test("keeps onboarding limits and three guidance methods in product source", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /MAX_BELIEFS = 12/);
  assert.match(page, /beliefCount > MAX_BELIEFS/);
  for (const mode of ["release", "assumption", "subconscious"]) assert.match(page, new RegExp(`id: "${mode}"`));
});

test("enforces founder beta quotas without storing private conversation content", async () => {
  const guard = await readFile(new URL("../lib/beta-guard.ts", import.meta.url), "utf8");
  assert.match(guard, /chat: 15/);
  assert.match(guard, /revision: 3/);
  assert.match(guard, /story: 1/);
  assert.match(guard, /BETA_TOTAL_REQUESTS \|\| 80/);
  assert.match(guard, /BETA_GLOBAL_DAILY_TOKENS \|\| 2_000_000/);
  assert.match(guard, /INSERT OR IGNORE INTO beta_users/);
  assert.doesNotMatch(guard, /message_text|wish_text|person_name|audio_blob|image_blob/);
});

test("keeps the founder dashboard private and aggregate-only", async () => {
  const admin = await readFile(new URL("../app/api/beta/admin/route.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/beta/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /BETA_FOUNDER_EMAIL/);
  assert.match(admin, /oai-authenticated-user-email/);
  assert.match(dashboard, /不读取用户愿望或聊天内容/);
});

test("shows one anonymous survey after ten minutes of active use", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /accumulated >= 600_000/);
  assert.match(page, /document\.visibilityState === "visible"/);
  assert.match(page, /already-beta-survey-complete-v1/);
  assert.match(page, /eventType: "beta_survey"/);
  assert.doesNotMatch(page, /className="before-rating"|className="effect-rating"/);
});
