// Web addresses in letters become links (in-app 来信 and the email), and nothing else does.
import assert from "node:assert/strict";
import { test } from "node:test";

const { letterParts } = await import("../lib/letter-links.ts");
const { letterHtml } = await import("../lib/mail-template.ts");

const links = (line) => letterParts(line).filter((part) => part.href).map((part) => [part.text, part.href]);

test("full and bare addresses become links; closing punctuation stays text", () => {
  assert.deepEqual(links("点这里做小测试：https://alreadough.com/test"), [["https://alreadough.com/test", "https://alreadough.com/test"]]);
  assert.deepEqual(links("打开 alreadough.com/test。"), [["alreadough.com/test", "https://alreadough.com/test"]]);
  assert.deepEqual(links("See https://alreadough.com/test."), [["https://alreadough.com/test", "https://alreadough.com/test"]]);
  assert.deepEqual(letterParts("打开 alreadough.com/test。").map((part) => part.text).join(""), "打开 alreadough.com/test。");
});

test("an email address, plain text and other schemes are not links", () => {
  assert.deepEqual(links("写信到 hello@alreadough.com 就好"), []);
  assert.deepEqual(links("今天也是你的一天"), []);
  assert.deepEqual(links("javascript:alert(1)"), []);
});

test("the email version links the address and still escapes the text", () => {
  const html = letterHtml("小测试", "选一选：https://alreadough.com/test\n<b>不是标签</b>", "https://alreadough.com/u");
  assert.match(html, /<a href="https:\/\/alreadough\.com\/test" style="[^"]*">https:\/\/alreadough\.com\/test<\/a>/);
  assert.match(html, /&lt;b&gt;不是标签&lt;\/b&gt;/);
});
