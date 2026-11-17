// "Export my data": one .zip in the same shape as ChatGPT's export. Inside: index.html, a viewer that opens in any
// browser (search and read desires, conversations, memories, stories), plus the raw data as JSON files (which is
// also what Claude's export holds). Built entirely in the browser; nothing is uploaded.

type Lang = "zh" | "en";
type Bi<T> = Partial<Record<Lang, T>>;

export type ExportGoal = {
  id?: string;
  status?: string;
  intensity?: number;
  wishCategory?: string;
  coachMode?: string;
  companionName?: string;
  spName?: string;
  desire?: Bi<string>;
  background?: Bi<string>;
  beliefs?: Bi<string[]>;
  journeySummary?: Bi<string>;
  acceptedSceneLedger?: Bi<string[]>;
  memoryItems?: Bi<Array<{ id?: string; kind?: string; title?: string; detail?: string; keywords?: string[]; pinned?: boolean; createdAt?: string }>>;
  createdAt?: string;
  [key: string]: unknown;
};
export type ExportMessage = { id?: string; role?: string; text?: string; feedback?: string; saved?: boolean; error?: boolean; [key: string]: unknown };
export type ExportConversation = { id?: string; title?: string; createdAt?: string; goalId?: string; messages?: ExportMessage[] };
export type ExportStory = { id?: string; title?: Bi<string>; city?: Bi<string>; subtitle?: Bi<string>; text?: Bi<string[]>; anchor?: Bi<string>; sample?: boolean; [key: string]: unknown };
export type ExportInput = {
  lang: Lang;
  exportedAt: Date;
  current: ExportGoal;
  others: ExportGoal[];
  archived: ExportGoal[];
  profile: { country?: string; about?: string; situation?: string; people?: Array<{ name?: string; relation?: string }>; neverInclude?: string[] };
  stories: ExportStory[];
  revisions: Array<{ id?: number | string; old?: string; revised?: string; date?: string }>;
  checkIns: Array<{ date?: string; feeling?: string }>;
  board: Array<{ id?: number | string; title?: string; source?: string; image?: string }>;
  conversations: ExportConversation[];
  /** Display names from the app, so the viewer uses the same words as the app. */
  labels: { category: (id: string) => string; coachMode: (id: string) => string; memoryKind: (id: string) => string; intensity: (value: number) => string };
};

// ---------------------------------------------------------------------------------------------------------------
// a minimal .zip writer: no compression (the files are small text), UTF-8 names flagged so Windows shows them right

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(files: Array<{ name: string; data: string | Uint8Array }>, when = new Date()) {
  const encoder = new TextEncoder();
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);          // names are UTF-8
    l.setUint16(8, 0, true);               // stored
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true);
    l.setUint16(28, 0, true);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    entry.set(name, 46);
    chunks.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...chunks, ...central, end]) { out.set(part, at); at += part.length; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// the files

const pick = <T,>(value: Bi<T> | undefined, lang: Lang, fallback: T): T => {
  const other: Lang = lang === "zh" ? "en" : "zh";
  const mine = value?.[lang];
  const theirs = value?.[other];
  const filled = (item: T | undefined) => item !== undefined && (Array.isArray(item) ? item.length > 0 : String(item).trim().length > 0);
  return filled(mine) ? mine as T : filled(theirs) ? theirs as T : fallback;
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

export function exportFileName(exportedAt: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `AlreaDough-export-${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}.zip`;
}

/** Every file in the archive, viewer first. */
export function buildExportFiles(input: ExportInput) {
  const goals = [
    { goal: input.current, place: "current" },
    ...input.others.map((goal) => ({ goal, place: "other" })),
    ...input.archived.map((goal) => ({ goal, place: "archived" })),
  ].filter(({ goal }) => goal && (pick(goal.desire, input.lang, "") || goal.setupComplete));
  const conversations = input.conversations
    .filter((item) => (item.messages || []).some((message) => !message.error && message.text?.trim()))
    .map((item) => ({
      id: item.id || "",
      title: item.title || "",
      created_at: item.createdAt || "",
      desire_id: item.goalId || "",
      messages: (item.messages || []).filter((message) => !message.error && message.text?.trim()).map((message) => ({
        role: message.role === "user" ? "user" : "assistant",
        text: message.text || "",
        ...(message.feedback ? { feedback: message.feedback } : {}),
        ...(message.saved ? { saved: true } : {}),
      })),
    }));
  const stories = input.stories.filter((story) => !story.sample);
  const board = input.board.map(({ image, ...item }) => ({ ...item, image_stored_on_device: Boolean(image) }));
  const exportedAt = input.exportedAt.toISOString();
  const files = [
    { name: "desires.json", data: json(goals.map(({ goal, place }) => ({ place, ...goal }))) },
    { name: "conversations.json", data: json(conversations) },
    { name: "profile.json", data: json(input.profile) },
    { name: "stories.json", data: json(stories) },
    { name: "revisions.json", data: json(input.revisions) },
    { name: "check_ins.json", data: json(input.checkIns) },
    { name: "vision_board.json", data: json(board) },
    { name: "export_info.json", data: json({ app: "AlreaDough", format_version: 2, exported_at: exportedAt, language: input.lang, not_included: ["private photos", "audio recordings"] }) },
  ];
  return [{ name: "index.html", data: viewerHtml(input, goals, conversations, stories, board, files.map((file) => file.name)) }, ...files];
}

export function buildExportZip(input: ExportInput) {
  return makeZip(buildExportFiles(input), input.exportedAt);
}

// ---------------------------------------------------------------------------------------------------------------
// the viewer: one self-contained page. Her words travel as JSON and are shown with textContent, never as HTML.

type Block =
  | { kind: "text"; label?: string; text: string }
  | { kind: "list"; label?: string; items: string[] }
  | { kind: "rows"; label?: string; rows: Array<[string, string]> }
  | { kind: "chat"; messages: Array<{ who: string; mine: boolean; text: string }> };
type Card = { title: string; meta?: string; blocks: Block[] };
type Section = { id: string; label: string; intro?: string; empty: string; collapsible?: boolean; cards: Card[] };

function viewerHtml(
  input: ExportInput,
  goals: Array<{ goal: ExportGoal; place: string }>,
  conversations: Array<{ title: string; created_at: string; desire_id: string; messages: Array<{ role: string; text: string }> }>,
  stories: ExportStory[],
  board: Array<{ title?: string; source?: string; image_stored_on_device: boolean }>,
  fileNames: string[],
) {
  const lang = input.lang;
  const zh = lang === "zh";
  const t = (chinese: string, english: string) => zh ? chinese : english;
  const day = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  };
  const status: Record<string, string> = zh
    ? { active: "正在练习", embodiment: "稳定进入", fulfilled: "已经发生", paused: "暂时休息" }
    : { active: "Practising", embodiment: "Embodying", fulfilled: "Already happened", paused: "Paused" };
  const feeling: Record<string, string> = zh
    ? { settled: "安定下来了", soft: "柔软了一点", chosen: "愿望更真实了" }
    : { settled: "Settled", soft: "Softer", chosen: "More real" };
  const desireTitle = (goal: ExportGoal) => pick(goal.desire, lang, "") || t("（没有写愿望）", "(no desire written)");
  const titleById = new Map(goals.map(({ goal }) => [goal.id || "", desireTitle(goal)]));
  const nonEmpty = (blocks: Array<Block | null>) => blocks.filter((block): block is Block => {
    if (!block) return false;
    if (block.kind === "text") return block.text.trim().length > 0;
    if (block.kind === "list") return block.items.length > 0;
    if (block.kind === "rows") return block.rows.some(([, value]) => value.trim().length > 0);
    return block.messages.length > 0;
  }).map((block) => block.kind === "rows" ? { ...block, rows: block.rows.filter(([, value]) => value.trim().length > 0) } : block);

  const sections: Section[] = [
    {
      id: "conversations", label: t("对话", "Conversations"), collapsible: true, empty: t("还没有对话。", "No conversations yet."),
      cards: conversations.map((item) => ({
        title: item.title || t("对话", "Conversation"),
        meta: [day(item.created_at), zh ? `${item.messages.length} 条消息` : `${item.messages.length} messages`, titleById.get(item.desire_id) || ""].filter(Boolean).join(" · "),
        blocks: [{ kind: "chat", messages: item.messages.map((message) => ({ who: message.role === "user" ? t("我", "Me") : "AlreaDough", mine: message.role === "user", text: message.text })) }],
      })),
    },
    {
      id: "desires", label: t("愿望", "Desires"), empty: t("还没有愿望。", "No desires yet."),
      cards: goals.map(({ goal, place }) => ({
        title: desireTitle(goal),
        meta: [input.labels.category(goal.wishCategory || ""), place === "current" ? t("当前", "Current") : place === "archived" ? t("已归档", "Archived") : "", status[goal.status || ""] || "", goal.intensity ? input.labels.intensity(goal.intensity) : ""].filter(Boolean).join(" · "),
        blocks: nonEmpty([
          { kind: "rows", rows: [[goal.wishCategory === "relationship" ? t("显化对象", "Person") : t("愿望焦点", "Focus"), goal.spName || ""], [t("引导方式", "Guidance"), input.labels.coachMode(goal.coachMode || "")], [t("喜欢的称呼", "Called"), goal.companionName || ""], [t("开始于", "Started"), day(goal.createdAt)]] },
          { kind: "text", label: t("我的背景与处境", "My context"), text: pick(goal.background, lang, "") },
          { kind: "list", label: t("想换掉的念头", "Thoughts to turn around"), items: pick(goal.beliefs, lang, [] as string[]) },
          { kind: "list", label: t("已接纳的新场景", "Accepted scenes"), items: pick(goal.acceptedSceneLedger, lang, [] as string[]) },
          { kind: "text", label: t("旅程摘要", "Journey summary"), text: pick(goal.journeySummary, lang, "") },
        ]),
      })),
    },
    {
      id: "memories", label: t("记忆", "Memories"), empty: t("还没有记忆。", "No memories yet."),
      cards: goals.flatMap(({ goal }) => pick(goal.memoryItems, lang, []).map((item) => ({
        title: item.title || "",
        meta: [input.labels.memoryKind(item.kind || ""), item.pinned ? t("已置顶", "Pinned") : "", desireTitle(goal), day(item.createdAt)].filter(Boolean).join(" · "),
        blocks: nonEmpty([
          { kind: "text", text: item.detail || "" },
          item.keywords?.length ? { kind: "text", label: t("检索词", "Keywords"), text: item.keywords.join(zh ? "、" : ", ") } : null,
        ]),
      }))),
    },
    {
      id: "stories", label: t("故事", "Stories"), empty: t("还没有自己写的故事。", "No stories of your own yet."),
      cards: stories.map((story) => ({
        title: pick(story.title, lang, ""),
        meta: [pick(story.city, lang, ""), pick(story.subtitle, lang, "")].filter(Boolean).join(" · "),
        blocks: nonEmpty([
          { kind: "text", text: pick(story.text, lang, [] as string[]).join("\n") },
          { kind: "text", label: t("锚定句", "Anchor line"), text: pick(story.anchor, lang, "") },
        ]),
      })),
    },
    {
      id: "revisions", label: t("重写", "Revisions"), empty: t("还没有重写。", "No revisions yet."),
      cards: input.revisions.map((item) => ({
        title: item.date || t("重写", "Revision"),
        blocks: nonEmpty([
          { kind: "text", label: t("原来的场景", "The old scene"), text: item.old || "" },
          { kind: "text", label: t("重写后", "Rewritten"), text: item.revised || "" },
        ]),
      })),
    },
    {
      id: "checkins", label: t("打卡", "Check-ins"), empty: t("还没有打卡。", "No check-ins yet."),
      cards: input.checkIns.length ? [{ title: zh ? `共 ${input.checkIns.length} 次` : `${input.checkIns.length} in all`, blocks: [{ kind: "rows", rows: input.checkIns.map((item) => [item.date || "", feeling[item.feeling || ""] || item.feeling || ""] as [string, string]) }] }] : [],
    },
    {
      id: "vision", label: t("愿景板", "Vision board"), intro: t("图片本身留在你的设备上，这里只有标题和来源。", "The pictures stay on your device; this lists titles and sources."), empty: t("愿景板是空的。", "The vision board is empty."),
      cards: board.map((item) => ({ title: item.title || t("（无标题）", "(untitled)"), blocks: nonEmpty([{ kind: "rows", rows: [[t("来源", "Source"), item.source || ""]] }]) })),
    },
    {
      id: "profile", label: t("关于我", "About me"), empty: t("还没有填写。", "Nothing written yet."),
      cards: (() => {
        const blocks = nonEmpty([
          { kind: "rows", rows: [[t("住在", "Lives in"), input.profile.country || ""]] },
          { kind: "text", label: t("关于我", "About me"), text: input.profile.about || "" },
          { kind: "text", label: t("现在的处境", "Right now"), text: input.profile.situation || "" },
          { kind: "list", label: t("生活里的人", "People in my life"), items: (input.profile.people || []).filter((person) => person.name).map((person) => person.relation ? `${person.name}${zh ? "：" : ": "}${person.relation}` : person.name || "") },
          { kind: "list", label: t("不想被提到的", "Never mention"), items: input.profile.neverInclude || [] },
        ]);
        return blocks.length ? [{ title: t("关于我", "About me"), blocks }] : [];
      })(),
    },
  ];
  const descriptions: Record<string, string> = zh ? {
    "index.html": "就是你现在看的这一页：在浏览器里查看和搜索导出的内容。",
    "desires.json": "每一张愿望卡，连同它的背景、念头、记忆、旅程摘要和已接纳的场景。place 表示当前、其他或已归档。",
    "conversations.json": "全部对话，每条消息标明是你（user）还是 AlreaDough（assistant）。",
    "profile.json": "「关于我」里填的内容。",
    "stories.json": "你自己写或保存的故事。",
    "revisions.json": "重写记录：原来的场景和重写后的版本。",
    "check_ins.json": "每天的打卡和当时的感受。",
    "vision_board.json": "愿景板的标题和来源（图片留在设备上）。",
    "export_info.json": "导出的时间、语言和格式版本。",
  } : {
    "index.html": "This page: read and search your export in a browser.",
    "desires.json": "Every desire card with its context, thoughts, memories, journey summary and accepted scenes. place is current, other or archived.",
    "conversations.json": "All conversations; each message says whether it is yours (user) or AlreaDough's (assistant).",
    "profile.json": "What you wrote in About me.",
    "stories.json": "Stories you wrote or kept.",
    "revisions.json": "Revisions: the old scene and the rewritten one.",
    "check_ins.json": "Daily check-ins and how they felt.",
    "vision_board.json": "Vision-board titles and sources (the pictures stay on your device).",
    "export_info.json": "When the export was made, its language and format version.",
  };
  sections.push({
    id: "files", label: t("文件说明", "About these files"), empty: "",
    intro: t("压缩包里的 .json 文件是原始数据，可以用任何文本编辑器打开，也方便以后导入别的工具。照片和录音不在导出里。", "The .json files are the raw data: any text editor opens them, and other tools can import them. Photos and audio are not included."),
    cards: fileNames.concat(["index.html"]).sort((a, b) => a === "index.html" ? -1 : b === "index.html" ? 1 : 0).filter((name, index, all) => all.indexOf(name) === index).map((name) => ({ title: name, blocks: [{ kind: "text", text: descriptions[name] || "" }] })),
  });

  const exportedText = input.exportedAt.toLocaleString(zh ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const payload = {
    sections,
    text: { noMatch: t("这一栏里没有找到。", "Nothing matches in this section.") },
  };
  const safe = JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const escape = (text: string) => text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] || ch);
  return `<!doctype html>
<html lang="${zh ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AlreaDough · ${escape(t("我的数据", "My data"))}</title>
<style>
:root { --bg: #f4efea; --panel: #fffaf7; --ink: #2b2423; --muted: #786d68; --line: #ded2cb; --accent: #a65f6b; --soft: #e9d0d2; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg: #1f1b1b; --panel: #2a2424; --ink: #f3ebe7; --muted: #b3a7a2; --line: #3d3433; --accent: #d18b98; --soft: #4a3639; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
.wrap { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
.brand { font: 22px/1 Georgia, "Songti SC", serif; }
.brand span { color: var(--accent); }
h1 { margin: 18px 0 4px; font: 400 32px/1.25 Georgia, "Songti SC", "SimSun", serif; }
header p { margin: 0; color: var(--muted); font-size: 13px; }
.bar { position: sticky; top: 0; z-index: 2; margin: 22px -16px 18px; padding: 10px 16px; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
nav { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 8px; }
nav button { flex: none; padding: 7px 13px; border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--muted); font: inherit; font-size: 14px; cursor: pointer; }
nav button.active { color: var(--panel); background: var(--ink); border-color: var(--ink); }
input[type=search] { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--ink); font: inherit; }
.intro, .empty { color: var(--muted); font-size: 14px; }
.card { margin: 0 0 12px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.card h3, .card summary strong { margin: 0; font: 500 18px/1.4 Georgia, "Songti SC", "SimSun", serif; }
.card summary { cursor: pointer; list-style: none; display: grid; gap: 2px; }
.card summary::-webkit-details-marker { display: none; }
.card small, .meta { display: block; color: var(--muted); font-size: 12px; }
.block { margin-top: 14px; }
.block h4 { margin: 0 0 4px; color: var(--accent); font-size: 12px; letter-spacing: .06em; }
.block p { margin: 0 0 6px; white-space: pre-wrap; overflow-wrap: anywhere; }
.block ul { margin: 0; padding-left: 20px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
.msg { margin: 10px 0; padding: 10px 14px; border-radius: 14px; max-width: 92%; }
.msg.mine { margin-left: auto; background: var(--soft); }
.msg.theirs { background: color-mix(in srgb, var(--bg) 70%, var(--panel)); }
.msg .who { display: block; color: var(--muted); font-size: 12px; margin-bottom: 2px; }
.msg p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body>
<div class="wrap">
<header>
<div class="brand">Alrea<span>Dough</span></div>
<h1>${escape(t("我的数据", "My data"))}</h1>
<p>${escape(t(`导出于 ${exportedText}。这个文件只在你的电脑或手机上打开，不会上传到任何地方。`, `Exported ${exportedText}. This file opens on your own device and uploads nothing.`))}</p>
</header>
<div class="bar"><nav id="tabs"></nav><input id="search" type="search" placeholder="${escape(t("在这一栏里搜索", "Search this section"))}" aria-label="${escape(t("搜索", "Search"))}"></div>
<main id="view"></main>
</div>
<script type="application/json" id="export-data">${safe}</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById("export-data").textContent);
  var nav = document.getElementById("tabs");
  var view = document.getElementById("view");
  var search = document.getElementById("search");
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function block(b) {
    var wrap = el("div", "block");
    if (b.label) wrap.appendChild(el("h4", "", b.label));
    if (b.kind === "text") {
      String(b.text).split(/\\n+/).forEach(function (line) { if (line.trim()) wrap.appendChild(el("p", "", line)); });
    } else if (b.kind === "list") {
      var ul = el("ul");
      b.items.forEach(function (item) { ul.appendChild(el("li", "", item)); });
      wrap.appendChild(ul);
    } else if (b.kind === "rows") {
      var dl = el("dl");
      b.rows.forEach(function (row) { dl.appendChild(el("dt", "", row[0])); dl.appendChild(el("dd", "", row[1])); });
      wrap.appendChild(dl);
    } else if (b.kind === "chat") {
      b.messages.forEach(function (m) {
        var row = el("div", "msg " + (m.mine ? "mine" : "theirs"));
        row.appendChild(el("span", "who", m.who));
        row.appendChild(el("p", "", m.text));
        wrap.appendChild(row);
      });
    }
    return wrap;
  }
  function card(c, index, collapsible) {
    var node;
    if (collapsible) {
      node = el("details", "card");
      if (index === 0) node.open = true;
      var summary = el("summary");
      summary.appendChild(el("strong", "", c.title));
      if (c.meta) summary.appendChild(el("small", "", c.meta));
      node.appendChild(summary);
    } else {
      node = el("article", "card");
      node.appendChild(el("h3", "", c.title));
      if (c.meta) node.appendChild(el("small", "meta", c.meta));
    }
    c.blocks.forEach(function (b) { node.appendChild(block(b)); });
    node.setAttribute("data-search", node.textContent.toLowerCase());
    return node;
  }
  function filter() {
    var query = search.value.trim().toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(view.querySelectorAll(".card"), function (node) {
      var hit = !query || node.getAttribute("data-search").indexOf(query) >= 0;
      node.hidden = !hit;
      if (hit) shown++;
      if (query && hit && node.tagName === "DETAILS") node.open = true;
    });
    var none = view.querySelector(".no-match");
    if (none) view.removeChild(none);
    if (query && !shown) view.appendChild(el("p", "empty no-match", data.text.noMatch));
  }
  function show(id) {
    Array.prototype.forEach.call(nav.children, function (button) { button.className = button.getAttribute("data-id") === id ? "active" : ""; });
    view.textContent = "";
    var section = data.sections.filter(function (s) { return s.id === id; })[0];
    if (!section) return;
    if (section.intro) view.appendChild(el("p", "intro", section.intro));
    if (!section.cards.length) { view.appendChild(el("p", "empty", section.empty)); return; }
    section.cards.forEach(function (c, i) { view.appendChild(card(c, i, section.collapsible)); });
    filter();
  }
  data.sections.forEach(function (s) {
    var button = el("button", "", s.label + (s.cards.length && s.id !== "files" ? " · " + s.cards.length : ""));
    button.type = "button";
    button.setAttribute("data-id", s.id);
    button.onclick = function () { show(s.id); };
    nav.appendChild(button);
  });
  search.oninput = filter;
  if (data.sections.length) show(data.sections[0].id);
})();
</script>
</body>
</html>
`;
}
