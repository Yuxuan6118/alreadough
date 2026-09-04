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

test("renders the AlreaDough product shell and onboarding", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>AlreaDough \| Your living desire space<\/title>/i);
  assert.match(html, /AlreaDough/);
  assert.match(html, /Opening AlreaDough|正在打开 AlreaDough/);
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
  assert.match(guard, /beta_request_reservations/);
  assert.match(guard, /status = 'released'/);
  assert.match(guard, /total_requests = MAX\(0, total_requests - 1\)/);
  assert.match(guard, /request_count = MAX\(0, request_count - 1\)/);
  assert.doesNotMatch(guard, /message_text|wish_text|person_name|audio_blob|image_blob/);
});

test("uses recoverable product errors and never exposes an upstream provider message", async () => {
  const route = await readFile(new URL("../app/api/companion/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(route, /AbortSignal\.timeout\(45_000\)/);
  assert.match(route, /failureCode: "AI_RESPONSE_INVALID"/);
  assert.doesNotMatch(route, /message:\s*data\.error\?\.message/);
  assert.match(page, /recoverable-error/);
  assert.match(page, /重新尝试/);
  assert.doesNotMatch(page, /AI 当前没有连接成功：\$\{message\}/);
});

test("ships the forward-only request reservation migration", async () => {
  const migration = await readFile(new URL("../drizzle/0002_goofy_skin.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `beta_request_reservations`/);
  assert.match(migration, /`status` text DEFAULT 'reserved' NOT NULL/);
  assert.match(migration, /CREATE INDEX `beta_reservations_user_idx`/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/);
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

test("keeps the chosen vision-board color connected to the live canvas", async () => {
  const studio = await readFile(new URL("../app/components/VisionCanvasStudio.tsx", import.meta.url), "utf8");
  const theme = await readFile(new URL("../app/already.css", import.meta.url), "utf8");
  assert.match(studio, /"--vision-background": background/);
  assert.match(studio, /vision-color-button" style=\{\{ backgroundColor: background/);
  assert.match(theme, /\.app-shell \.vision-preview\s*\{[^}]*background:\s*var\(--vision-background,var\(--app-panel\)\)\s*!important/s);
});

test("shows only one primary memory action in each memory-library state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /currentMemoryItems\.length > 0 && <button className="primary memory-add"/);
  assert.match(page, /currentMemoryItems\.length === 0 \? <div className="memory-empty"/);
  assert.match(page, /memory-filter-empty/);
  assert.match(page, /setMemoryFilter\("all"\)/);
});

test("keeps only fade controls in the lightweight audio editor", async () => {
  const studio = await readFile(new URL("../app/components/SubliminalStudio.tsx", import.meta.url), "utf8");
  const mixer = await readFile(new URL("../lib/audio-mix.ts", import.meta.url), "utf8");
  for (const removed of ["开始位置", "裁掉开头", "裁掉结尾", "Start position", "Trim start", "Trim end"]) {
    assert.doesNotMatch(studio, new RegExp(removed));
  }
  assert.doesNotMatch(mixer, /delay|trimStart|trimEnd/);
  assert.match(studio, /\["fadeIn", copy\.fadeIn\], \["fadeOut", copy\.fadeOut\]/);
});

test("does not presume that a new user's desire is romantic", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/components/SubliminalStudio.tsx", import.meta.url), "utf8");
  const studioDefaults = studio.slice(studio.indexOf("const defaults"), studio.indexOf("function timeLabel"));

  for (const romanticDefault of [
    "他很久没有回复",
    "He took a long time to reply",
    "我们在东京醒来的早晨",
    "Our morning in Tokyo",
    "被爱已经是我最熟悉的日常",
    "Being loved is my most familiar reality",
    "浪漫约会",
    "Romantic date",
    "couple in Hokkaido snow",
  ]) assert.doesNotMatch(page, new RegExp(romanticDefault));

  for (const romanticDefault of [
    "我被坚定选择",
    "I Am Fully Chosen",
    "我们的关系稳定",
    "Our relationship is secure",
    "被选择很真实",
    "Being chosen feels real",
  ]) assert.doesNotMatch(studioDefaults, new RegExp(romanticDefault));

  assert.match(page, /wishCategory: "other"/);
  assert.match(page, /一个结果、消息或眼前情况/);
  assert.match(page, /愿望实现后的普通一天/);
  assert.match(page, /拥有它已经是我熟悉的日常/);
  assert.match(studio, /我的愿望已经实现/);
  assert.match(studio, /My Desire Is Already Mine/);
  assert.match(studio, /replaceLegacyRomanticTemplate/);
});
