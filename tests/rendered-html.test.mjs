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

test("has no per-person daily or trial limit, and saves only anonymous conversation turns (no desire card, name, or media)", async () => {
  const guard = await readFile(new URL("../lib/beta-guard.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/companion/route.ts", import.meta.url), "utf8");
  // Nobody is ever told "you only get N conversations today" or "your trial has ended".
  assert.doesNotMatch(guard, /TRIAL_ENDED|TRIAL_LIMIT_REACHED|DAILY_LIMIT_REACHED/);
  assert.doesNotMatch(route, /TRIAL_ENDED|TRIAL_LIMIT_REACHED|DAILY_LIMIT_REACHED/);
  // The only thing left is a site-wide cost circuit breaker.
  assert.match(guard, /BETA_GLOBAL_DAILY_REQUESTS/);
  assert.match(guard, /BETA_GLOBAL_DAILY_TOKENS/);
  assert.match(guard, /INSERT OR IGNORE INTO beta_users/);
  assert.doesNotMatch(guard, /wish_text|person_name|companion_name|audio_blob|image_blob/);
  // Beta conversations are kept on purpose (users are told up front) but keyed by a hash, never the raw device id.
  assert.match(guard, /beta_conversations/);
  assert.doesNotMatch(guard, /cf-connecting-ip|x-forwarded-for/i); // coarse location only, never the IP address
  assert.doesNotMatch(route, /recordConversation\([^)]*(desire|beliefs|companionName)/s);
});

test("keeps the founder dashboard private and aggregate-only", async () => {
  const admin = await readFile(new URL("../app/api/beta/admin/route.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/beta/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /BETA_FOUNDER_SECRET/);
  assert.match(admin, /Bearer/);
  assert.doesNotMatch(admin, /searchParams\.get\("key"\)/); // secret must not be read from the URL
  assert.match(dashboard, /聊天记录在单独的页面查看/);
  assert.match(dashboard, /不显示昵称、愿望、聊天原文/);
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

test("founder chat viewer shows chat turns only, never the desire card or nickname", async () => {
  const { extractConversations } = await import("../lib/chat-view.ts");
  const payload = JSON.stringify({
    goal: { companionName: "小明", desire: { zh: "私密愿望" }, beliefs: { zh: ["私密信念"] } },
    conversationId: "c1",
    messages: [{ role: "user", text: "你好" }, { role: "ai", text: "嗯，我在。" }, { role: "ai", text: "" }, { role: "x", text: "bad" }],
    conversationArchive: [{ id: "a1", title: "旧对话", createdAt: "2026-10-01T00:00:00Z", messages: [{ role: "user", text: "之前聊的" }] }, { id: "a2", messages: [] }],
  });
  const result = extractConversations(payload);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].messages.map((m) => m.text), ["你好", "嗯，我在。"]);
  assert.equal(result[1].title, "旧对话");
  assert.doesNotMatch(JSON.stringify(result), /小明|私密愿望|私密信念/);
  assert.deepEqual(extractConversations("not json"), []);
});

test("client info keeps coarse facts only and never the IP", async () => {
  const { parseUserAgent, readClientInfo } = await import("../lib/client-info.ts");
  assert.deepEqual(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), { device: "mobile", os: "iOS", browser: "Safari" });
  assert.equal(parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36").device, "desktop");
  assert.equal(parseUserAgent("... MicroMessenger/8.0 ...").browser, "WeChat");
  const headers = new Headers({ "cf-ipcountry": "cn", "accept-language": "zh-CN,zh;q=0.9", "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel) Mobile Chrome/120", "cf-connecting-ip": "203.0.113.9" });
  const info = readClientInfo(headers, { city: "Shenzhen", region: "Guangdong", timezone: "Asia/Shanghai" });
  assert.equal(info.country, "CN");
  assert.equal(info.city, "Shenzhen");
  assert.equal(info.lang, "zh-CN");
  assert.doesNotMatch(JSON.stringify(info), /203\.0\.113\.9/);
  assert.equal(readClientInfo(new Headers({ "cf-ipcountry": "XX" })).country, null);
});

test("reply guards: error bubbles are not AI speech, AI tells are removed, length follows the user", async () => {
  const { cleanReply, isErrorEcho, replyLengthGuidance } = await import("../lib/reply-guards.ts");
  // A: the client's connection-error bubble must never be fed back to the model
  assert.equal(isErrorEcho({ role: "ai", text: "小明，AI 当前没有连接成功：x。你的这句话已经留在本机" }), true);
  assert.equal(isErrorEcho({ role: "user", text: "AI 当前没有连接成功" }), false);
  assert.equal(isErrorEcho({ role: "ai", text: "嗯，我在。" }), false);
  // B: em-dashes, leading name, and extra quotation marks
  assert.equal(cleanReply("Luke，我在。今天——慢慢说。", { mode: "chat", name: "Luke" }), "我在。今天，慢慢说。");
  assert.equal(cleanReply("Luke，", { mode: "chat", name: "Luke" }), "Luke，"); // never reduce a reply to nothing
  assert.equal(cleanReply("他说“a”和“b”还有“c”以及“d”", { mode: "chat" }), "他说“a”和“b”还有c以及d");
  assert.equal(cleanReply("Luke，他说“a”“b”“c”——好。", { mode: "story", name: "Luke" }), "Luke，他说“a”“b”“c”，好。"); // stories keep dialogue and a leading name
  // C: shorter input, shorter reply; English gets proportionally more room
  assert.equal(replyLengthGuidance("你好", "zh").max_chars, 60);
  assert.equal(replyLengthGuidance("x".repeat(20), "zh").max_chars, 110);
  assert.equal(replyLengthGuidance("x".repeat(500), "zh").max_chars, 260);
  assert.ok(replyLengthGuidance("hi", "en").max_chars > 60);
});

test("contrast-frame detector catches 不是X，是Y and its variants without flagging ordinary sentences", async () => {
  const { hasContrastFrame } = await import("../lib/reply-guards.ts");
  for (const bad of ["你白天提不起劲，大概也不是懒，是夜里没歇过来。", "这不是软弱，而是你在扛。", "不是你不够好而是时机没到", "与其说你在逃，不如说你在歇", "It's not laziness, it's exhaustion.", "That isn't weakness, it's weight.", "Not just tired, but worn down."]) assert.equal(hasContrastFrame(bad), true, bad);
  for (const ok of ["我不是很确定。", "这不是问题，是的，你说得对。", "不是每次都要说出来。", "是你自己选的，不是别人。", "你说得对，我在这儿。", "It is fine to rest.", "I'm here, and it is okay to be tired."]) assert.equal(hasContrastFrame(ok), false, ok);
});

test("self-reflection only counts words she wrote more than once, and flags danger words for a caring note", async () => {
  const { repeatedWords, mentionsSelfHarm, reflectionQuestions } = await import("../lib/reflection.ts");
  assert.deepEqual(reflectionQuestions.map((q) => q.id), ["feel", "worry", "give"]);
  const goals = [
    { id: "a", title: "感情", reflection: { feel: "我会觉得很安全，被选择", worry: "担心一个人，没有人选我" } },
    { id: "b", title: "事业", reflection: { give: "希望带来安全和自由", worry: "" } },
  ];
  const words = repeatedWords(goals).map((row) => row.word);
  assert.ok(words.includes("安全"), "a word used in two answers is reported");
  assert.ok(!words.includes("自由"), "a word used once is not reported");
  assert.ok(!words.includes("我") && !words.includes("希望"), "filler words are ignored");
  const safety = repeatedWords(goals).find((row) => row.word === "安全");
  assert.equal(safety.count, 2);
  assert.deepEqual(safety.where.map((place) => place.goalTitle), ["感情", "事业"]);
  assert.deepEqual(repeatedWords([{ id: "a", title: "x", reflection: { feel: "只有一次" } }]), []);
  assert.equal(mentionsSelfHarm("最糟的时候我不想活了"), true);
  assert.equal(mentionsSelfHarm("I want to die"), true);
  assert.equal(mentionsSelfHarm("我担心他不回消息"), false);
});

test("sync code: accepts a pasted device id in any tidy-up form and rejects everything else", async () => {
  const { normalizeSyncCode, isShareableSyncCode } = await import("../lib/sync-code.ts");
  const id = "3f1c9a2e-7b44-4c1d-9e0a-5d2b8c6f1a77";
  assert.equal(normalizeSyncCode(id), id);
  assert.equal(normalizeSyncCode("  " + id.toUpperCase() + "\n"), id, "case and surrounding space are forgiven");
  assert.equal(normalizeSyncCode("我的同步码是 " + id + " 谢谢"), id, "a code inside a sentence is found");
  assert.equal(normalizeSyncCode("d-1793499713000-abc123xyz"), "d-1793499713000-abc123xyz", "fallback ids are accepted");
  for (const bad of ["", "hello", "local-beta", "3f1c9a2e-7b44-4c1d-9e0a", "12345678"]) assert.equal(normalizeSyncCode(bad), null, bad);
  assert.equal(isShareableSyncCode(id), true);
  assert.equal(isShareableSyncCode("local-beta"), false, "the pre-load placeholder is never shown as a code");
});

test("install tip: only Safari is told to add to the home screen; other iPhone browsers are sent to Safari; once per day key", async () => {
  const { detectInstallMode, localDayKey } = await import("../lib/install-mode.ts");
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const chrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
  const firefox = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
  const wechat = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x18003230) NetType/WIFI Language/zh_CN";
  const inApp = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 XiaoHongShu/8.40";
  const androidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const androidWechat = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/116.0 Mobile Safari/537.36 MicroMessenger/8.0.47";
  const ipadDesktopMode = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const mac = ipadDesktopMode;

  assert.equal(detectInstallMode(safari), "ios-safari");
  assert.equal(detectInstallMode(chrome), "ios-other");
  assert.equal(detectInstallMode(firefox), "ios-other");
  assert.equal(detectInstallMode(inApp), "ios-other");
  assert.equal(detectInstallMode(wechat), "wechat-ios");
  assert.equal(detectInstallMode(androidChrome), "android");
  assert.equal(detectInstallMode(androidWechat), "wechat-android");
  assert.equal(detectInstallMode(ipadDesktopMode, 5), "ios-safari");
  assert.equal(detectInstallMode(mac, 0), null);
  assert.equal(detectInstallMode(""), null);
  assert.equal(localDayKey(new Date(2026, 10, 3)), "2026-11-03");
  assert.notEqual(localDayKey(new Date(2026, 10, 3, 23, 59)), localDayKey(new Date(2026, 10, 4, 0, 1)));
});

test("service worker: navigations go to the network with an offline page as fallback, everything else is left alone", async () => {
  const { readFile } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = {};
  const calls = { fetches: [] };
  let online = true;
  class FakeResponse { constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.headers = init.headers ?? {}; } }
  const sandbox = {
    Response: FakeResponse,
    fetch: async (request) => { calls.fetches.push(request.url); if (!online) throw new Error("offline"); return new FakeResponse("page"); },
    self: { addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: () => {}, clients: { claim: async () => {} } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.ok(listeners.fetch && listeners.install && listeners.activate, "registers install, activate and fetch handlers");

  const run = async (request) => {
    let answered;
    listeners.fetch({ request, respondWith: (value) => { answered = value; } });
    return answered === undefined ? undefined : await answered;
  };
  assert.equal((await run({ mode: "navigate", url: "https://x/" })).body, "page");
  assert.equal(await run({ mode: "cors", url: "https://x/api/companion" }), undefined, "API calls are never intercepted");
  assert.equal(await run({ mode: "no-cors", url: "https://x/_next/static/a.js" }), undefined, "assets are never intercepted");
  online = false;
  const offline = await run({ mode: "navigate", url: "https://x/" });
  assert.equal(offline.status, 503);
  assert.match(offline.body, /AlreaDough/);
});

test("payments: off by default, closed for mainland China, and Stripe notifications must carry a valid signature", async () => {
  const { paymentsConfig, channelFor, signStripePayload, verifyStripeSignature } = await import("../lib/payments.ts");
  assert.equal(paymentsConfig({}).enabled, false);
  assert.equal(paymentsConfig({ PAYMENTS_ENABLED: "1", STRIPE_SECRET_KEY: "sk_test_x" }).enabled, false, "needs the webhook secret too");
  const on = paymentsConfig({ PAYMENTS_ENABLED: "1", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
  assert.equal(on.enabled, true);
  assert.equal(channelFor("US", on), "stripe");
  assert.equal(channelFor("CN", on), "reserve", "mainland China has no legitimate channel yet");
  assert.equal(channelFor("US", paymentsConfig({})), "reserve");

  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_700_000_000;
  const good = await signStripePayload("whsec_x", now, body);
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=${good}`, "whsec_x", 300, now), true);
  assert.equal(await verifyStripeSignature(body + " ", `t=${now},v1=${good}`, "whsec_x", 300, now), false, "a changed body fails");
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=${good}`, "whsec_other", 300, now), false, "a wrong secret fails");
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=${good}`, "whsec_x", 300, now + 301), false, "an old signature is a replay");
  assert.equal(await verifyStripeSignature(body, null, "whsec_x", 300, now), false);
  assert.equal(await verifyStripeSignature(body, `t=${now},v1=deadbeef`, "whsec_x", 300, now), false);
});

test("payments: card is a subscription in USD, Alipay and WeChat are one-time in CNY, and the device id rides along", async () => {
  const { buildCheckoutParams, amountFor } = await import("../lib/payments.ts");
  assert.equal(amountFor("deep", "monthly", "usd"), 1299);
  assert.equal(amountFor("deep", "annual", "usd"), 12990, "annual is ten months");
  const base = { plan: "deep", billing: "annual", lang: "zh", deviceId: "device:abc", origin: "https://alreadough.com" };
  const card = buildCheckoutParams({ ...base, method: "card" });
  assert.equal(card.get("mode"), "subscription");
  assert.equal(card.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(card.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(card.get("payment_method_types[0]"), "card");
  assert.equal(card.get("client_reference_id"), "device:abc");
  const wallet = buildCheckoutParams({ ...base, billing: "monthly", method: "wallet" });
  assert.equal(wallet.get("mode"), "payment", "Stripe cannot do Alipay or WeChat in subscription mode");
  assert.equal(wallet.get("line_items[0][price_data][currency]"), "cny");
  assert.equal(wallet.get("line_items[0][price_data][unit_amount]"), "8800");
  assert.equal(wallet.get("payment_method_types[0]"), "alipay");
  assert.equal(wallet.get("payment_method_types[1]"), "wechat_pay");
  assert.equal(wallet.has("line_items[0][price_data][recurring][interval]"), false);
});

test("payments: only a paid checkout grants a plan; renewals extend it and cancellation revokes it", async () => {
  const { entitlementFromEvent, isActive } = await import("../lib/payments.ts");
  const now = Date.parse("2026-11-12T00:00:00Z");
  const session = (extra = {}) => ({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", client_reference_id: "device:abc", customer: "cus_1", subscription: "sub_1", metadata: { device_id: "device:abc", plan: "deep", billing: "monthly", method: "card" }, ...extra } } });
  const grant = entitlementFromEvent(session(), now);
  assert.equal(grant.kind, "grant");
  assert.equal(grant.deviceId, "device:abc");
  assert.equal(grant.plan, "deep");
  assert.equal(Date.parse(grant.periodEnd) - now, 31 * 86_400_000);
  assert.equal(entitlementFromEvent(session({ payment_status: "unpaid" }), now).kind, "ignore", "no money yet, no plan");
  assert.equal(entitlementFromEvent(session({ metadata: { device_id: "device:abc", plan: "gold", billing: "monthly", method: "card" } }), now).kind, "ignore", "an unknown plan is ignored");
  const annualWallet = entitlementFromEvent(session({ subscription: null, metadata: { device_id: "device:abc", plan: "soft", billing: "annual", method: "wallet" } }), now);
  assert.equal(Date.parse(annualWallet.periodEnd) - now, 366 * 86_400_000);
  const paid = entitlementFromEvent({ id: "evt_2", type: "invoice.paid", data: { object: { subscription: "sub_1", lines: { data: [{ period: { end: 1_800_000_000 } }] } } } }, now);
  assert.deepEqual(paid, { kind: "extend", subscription: "sub_1", periodEnd: new Date(1_800_000_000 * 1000).toISOString() });
  assert.deepEqual(entitlementFromEvent({ id: "evt_3", type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } }, now), { kind: "revoke", subscription: "sub_1" });
  assert.equal(entitlementFromEvent({ id: "evt_4", type: "charge.refunded", data: { object: {} } }, now).kind, "ignore");
  assert.equal(entitlementFromEvent({}, now).kind, "ignore", "a malformed event never throws");
  assert.equal(isActive({ status: "active", periodEnd: "2027-01-01T00:00:00Z" }, now), true);
  assert.equal(isActive({ status: "canceled", periodEnd: "2027-01-01T00:00:00Z" }, now), false);
  assert.equal(isActive({ status: "active", periodEnd: "2026-01-01T00:00:00Z" }, now), false);
  assert.equal(isActive(null, now), false);
});

test("leaving: only a whole-message goodbye ends the chat; ordinary sentences never do", async () => {
  const { isExitIntent, exitReply } = await import("../lib/reply-guards.ts");
  for (const text of ["不聊了", "我先走了", "再见", "拜拜～", "晚安", "好的，我下线了", "先这样吧", "今天就到这里吧", "别聊了", "bye", "Good night!", "I have to go", "talk later", "那我去睡了"]) {
    assert.equal(isExitIntent(text), true, text);
  }
  for (const text of ["", "不用了", "结束了", "我不想聊他了", "再见到他我会怎样", "他走了", "我要退出这段关系吗", "晚安之后他还会找我吗", "stop being so negative about him", "I do not want to go back to him"]) {
    assert.equal(isExitIntent(text), false, text);
  }
  assert.ok(!/[?？]/.test(exitReply("zh")) && !/[?？]/.test(exitReply("en")), "the goodbye asks nothing");
});

test("crisis replies name a local help line by country, and the prompts carry a content boundary", async () => {
  const { readFile } = await import("node:fs/promises");
  const { crisisResources } = await import("../lib/crisis-resources.ts");
  assert.match(crisisResources("zh", "CN"), /12356/);
  assert.match(crisisResources("zh", null), /12356/, "Chinese text with no country falls back to the mainland line");
  assert.match(crisisResources("en", "US"), /988/);
  assert.match(crisisResources("zh", "US"), /988/);
  assert.equal(crisisResources("en", "FR"), "");
  const source = await readFile(new URL("../lib/already-ai.ts", import.meta.url), "utf8");
  assert.match(source, /crisisResources\(lang, country\)/, "the self-harm reply appends the local line");
  assert.match(source, /你的价值不取决于它/, "and still tells her she is not rejected");
  assert.match(source, /内容边界/);
  assert.match(source, /Content boundary/);
  assert.match(source, /她说要结束/);
});

test("break reminder: fires after 2 hours of continuous chatting, never while idle or hidden, and resets after a long pause", async () => {
  const { BREAK_AFTER_MS, newUsageState, markActive, tickUsage } = await import("../lib/usage-break.ts");
  const TICK = 30_000;
  let now = 0;
  let state = newUsageState(now);
  let reminders = 0;
  const chat = (ms, { visible = true, send = true } = {}) => {
    for (let spent = 0; spent < ms; spent += TICK) {
      now += TICK;
      if (send && spent % (5 * 60_000) === 0) state = markActive(state, now); // a message every 5 minutes
      const result = tickUsage(state, now, visible, TICK);
      state = result.state;
      if (result.remind) reminders += 1;
    }
  };
  chat(BREAK_AFTER_MS - 10 * 60_000);
  assert.equal(reminders, 0, "not before 2 hours");
  chat(15 * 60_000);
  assert.equal(reminders, 1, "once at about 2 hours");
  chat(60 * 60_000);
  assert.equal(reminders, 1, "not again within the next 2 hours");
  chat(65 * 60_000);
  assert.equal(reminders, 2, "again after another 2 hours");

  // Hidden tab or no messages: nothing counts.
  now = 0; state = newUsageState(now); reminders = 0;
  chat(3 * 60 * 60_000, { visible: false });
  assert.equal(reminders, 0, "a hidden page never counts");
  chat(3 * 60 * 60_000, { send: false });
  assert.equal(reminders, 0, "idle with no messages never counts");

  // A pause longer than 30 minutes starts the clock over.
  now = 0; state = newUsageState(now); reminders = 0;
  chat(100 * 60_000);
  now += 40 * 60_000;
  state = tickUsage(state, now, true, TICK).state;
  chat(100 * 60_000);
  assert.equal(reminders, 0, "100 min + pause + 100 min is not 2 hours in a row");
});
