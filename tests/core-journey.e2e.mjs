import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:4173";
const pnpmStore = new URL("../node_modules/.pnpm/", import.meta.url);
const playwrightFolder = (await readdir(pnpmStore)).find((name) => /^playwright@1\.62\.1/.test(name));
if (!playwrightFolder) throw new Error("Playwright runtime is unavailable");
const playwrightPath = join(pnpmStore.pathname, playwrightFolder, "node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.getByText("我已阅读并同意以上说明。").click();
    await page.getByRole("button", { name: "同意并进入" }).click();
    await page.getByLabel("你的称呼").fill("测试用户");
    await page.getByRole("button", { name: "继续" }).click();
    await page.getByRole("button", { name: /金钱与事业/ }).click();
    await page.getByLabel("它已经实现时，我的生活是").fill("我已经顺利完成重要的学习目标。 ");
    await page.getByRole("button", { name: "继续" }).click();
    await page.getByRole("button", { name: /温柔抱持型/ }).click();
    await page.getByRole("button", { name: /进入 AlreaDough/ }).click();
    await assert.doesNotReject(() => page.getByRole("heading", { name: /欢迎回来，测试用户/ }).waitFor());

    await page.route("**/api/companion", async (route) => route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "AI_REQUEST_FAILED", message: "这次没有发送成功，你的内容仍在，可以重新尝试。" }),
    }));
    await page.getByLabel("写下此刻冒出的念头……").fill("我今天对学习目标有点动摇");
    await page.getByRole("button", { name: "发送" }).click();
    await page.getByRole("button", { name: "重新尝试" }).waitFor();
    assert.equal(await page.getByText(/HTTP|AI_REQUEST_FAILED|OpenAI/).count(), 0);
    assert.match(await page.locator("body").innerText(), /我今天对学习目标有点动摇/);
    await page.close();
  }
} finally {
  await browser.close();
}
