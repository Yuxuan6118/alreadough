// Turn exported beta conversations (JSONL from /beta → "导出内测对话样本") into a review report.
// Usage: node scripts/analyze-conversations.mjs conversations.jsonl [report.md]
// No network, no model calls: it only measures the habits we are trying to remove.
import fs from "node:fs";

const [input, output = "evals/results/conversation-report.md"] = process.argv.slice(2);
if (!input) { console.error("usage: node scripts/analyze-conversations.mjs <conversations.jsonl> [report.md]"); process.exit(1); }

const rows = fs.readFileSync(input, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((row) => row.ai_reply);
if (!rows.length) { console.error("no conversation rows found"); process.exit(1); }

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const opening = (text) => text.split(/[。！？!?.\n]/)[0].trim().slice(0, 14);
const count = (text, pattern) => (text.match(pattern) || []).length;

// Habits to watch. Patterns are deliberately simple so the numbers are easy to trust.
const habits = [
  ["“不是……而是 / 不是……，是……”类对仗", /(?:并)?不是[^。！？\n，,；;]{0,20}[，,；;]\s*(?:而)?是(?![的否不吗])|不是[^。！？\n]{0,24}而是|与其说[^。！？\n]{0,30}不如|not [^.\n]{0,30}, (?:but|it'?s)/gi],
  ["“这说明 / 不等于”", /这说明|这不等于|不等于/g],
  ["“已经在结果里 / 已经属于你”", /已经在结果|已经是我|已经属于|already (?:done|yours|mine)/gi],
  ["“被选择的感觉”类收尾", /被选择的感觉|what being chosen feels like/gi],
  ["引号（成对）", /[“”"]/g],
  ["破折号", /——/g],
  ["加粗", /\*\*/g],
];

const stats = habits.map(([name, re]) => {
  const per = rows.map((row) => count(row.ai_reply, re));
  const hit = per.filter((n) => n > 0).length;
  return { name, hit, total: per.reduce((a, b) => a + b, 0) };
});

// Repeated openings and repeated sentences across replies.
const openings = new Map();
const sentences = new Map();
for (const row of rows) {
  const o = opening(row.ai_reply);
  if (o.length >= 4) openings.set(o, (openings.get(o) || 0) + 1);
  for (const sentence of new Set(row.ai_reply.split(/[。！？!?\n]/).map((x) => x.trim()).filter((x) => x.length >= 8))) sentences.set(sentence, (sentences.get(sentence) || 0) + 1);
}
const top = (map, min = 2, n = 10) => [...map.entries()].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, n);

const rated = rows.filter((row) => row.feedback);
const missed = rows.filter((row) => row.feedback === "missed");
const helpful = rows.filter((row) => row.feedback === "helpful");
const lengths = rows.map((row) => row.ai_reply.length).sort((a, b) => a - b);
const median = lengths[Math.floor(lengths.length / 2)];

const byCoach = {};
for (const row of rows) {
  const key = row.coach_mode || "unknown";
  byCoach[key] ||= { n: 0, helpful: 0, missed: 0 };
  byCoach[key].n += 1;
  if (row.feedback === "helpful") byCoach[key].helpful += 1;
  if (row.feedback === "missed") byCoach[key].missed += 1;
}

const clip = (text, n = 140) => text.replace(/\s+/g, " ").slice(0, n);
const lines = [
  "# 对话样本分析",
  `样本数：${rows.length}　已评价：${rated.length}（👍 ${helpful.length} / 👎 ${missed.length}，👍率 ${pct(helpful.length, rated.length)}）　回复长度中位数：${median} 字`,
  "",
  "## 习惯指标（命中的回复占比 / 总次数）",
  "| 习惯 | 命中回复 | 总次数 |",
  "|---|---:|---:|",
  ...stats.map((x) => `| ${x.name} | ${pct(x.hit, rows.length)} | ${x.total} |`),
  "",
  "## 重复最多的开头（≥2 次）",
  ...(top(openings).length ? top(openings).map(([text, c]) => `- ${c}× ${text}`) : ["- 没有"]),
  "",
  "## 重复最多的整句（≥2 次）",
  ...(top(sentences).length ? top(sentences).map(([text, c]) => `- ${c}× ${text}`) : ["- 没有"]),
  "",
  "## 按引导方式",
  "| 引导方式 | 条数 | 👍 | 👎 |",
  "|---|---:|---:|---:|",
  ...Object.entries(byCoach).map(([k, v]) => `| ${k} | ${v.n} | ${v.helpful} | ${v.missed} |`),
  "",
  "## 被点 👎 的回复（先看这些）",
  ...(missed.length ? missed.slice(0, 15).flatMap((row) => [`- 用户：${clip(row.user_text, 80)}`, `  AI：${clip(row.ai_reply)}`]) : ["- 暂无"]),
  "",
  "## 被点 👍 的回复（可以挑出来当范例）",
  ...(helpful.length ? helpful.slice(0, 10).flatMap((row) => [`- 用户：${clip(row.user_text, 80)}`, `  AI：${clip(row.ai_reply)}`]) : ["- 暂无"]),
  "",
  "> 这是描述性统计，不是效果证明。看到某个习惯偏高时，去改提示词，然后用新的样本再跑一次对比。",
  "",
];

fs.mkdirSync(output.split("/").slice(0, -1).join("/") || ".", { recursive: true });
fs.writeFileSync(output, lines.join("\n"));
console.log(lines.slice(0, 13).join("\n"));
console.log(`\n完整报告：${output}`);
