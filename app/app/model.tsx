// The private space's data model: types, limits, defaults and the pure helpers around them.
// Kept apart from page.tsx so the page component holds only the screen and its state.

import { COVER_DB } from "@/lib/cover-store";
import { storyCategoryFor, type StoryCategory } from "@/lib/story-prompt";
import type { ReflectionAnswers } from "@/lib/reflection";
import { type ProfileSeed } from "@/lib/onboarding-flow";
import { removeStored } from "@/lib/safe-storage";

export type SpaceSection = "wishes" | "about" | "library" | "memory" | "dough" | "membership" | "pet" | "look" | "sync" | "help";
export type View = "home" | "subliminal" | "story" | "revision" | "board" | "persona" | "settings";
export type Lang = "zh" | "en";
export type Message = { id: string; role: "ai" | "user"; text: string; feedback?: "helpful" | "missed"; saved?: boolean; logId?: string; error?: boolean };
export type Conversation = { id: string; title: string; createdAt: string; messages: Message[]; goalId?: string };
export type BoardItem = { id: number; title: string; source: string; image?: string };
export type Revision = { id: number; old: string; revised: string; date: string };
export type GoalStatus = "active" | "embodiment" | "fulfilled" | "paused";
export type WishCategory = "relationship" | "wealth" | "self" | "lifestyle" | "other";
export type CompanionStyle = "gentle" | "anchor" | "friend" | "direct" | "custom" | "";
export type CoachMode = "release" | "assumption" | "subconscious";
export type MemoryKind = "person" | "place" | "event" | "preference" | "insight";
export type MemoryItem = {
  id: string;
  kind: MemoryKind;
  title: string;
  detail: string;
  keywords: string[];
  pinned: boolean;
  source: "user" | "conversation" | "story";
  createdAt: string;
};
export type MemoryDraft = { kind: MemoryKind; title: string; detail: string; keywords: string };
export type GoalProfile = {
  id: string;
  setupComplete: boolean;
  status: GoalStatus;
  /** How much she wants it, 1 (nice to have) to 5 (most). Orders the desire list. */
  intensity: number;
  wishCategory: WishCategory;
  companionStyle: CompanionStyle;
  coachMode: CoachMode;
  companionName: string;
  spName: string;
  spPronunciation: string;
  desire: Record<Lang, string>;
  background: Record<Lang, string>;
  /** What every story script for this desire keeps to: who the person is, their life, what to leave out. */
  storySetting: Record<Lang, string>;
  /** For a relationship desire: a partner, a family member or a friend (from the opening questions). */
  relationKind?: "love" | "family" | "friend";
  beliefs: Record<Lang, string[]>;
  tone: Record<Lang, string>;
  journeySummary: Record<Lang, string>;
  canon: Record<Lang, string[]>;
  responsePreferences: Record<Lang, string[]>;
  acceptedSceneLedger: Record<Lang, string[]>;
  /** Her own 潜音 affirmations for this desire; missing until the first set is made. */
  affirmations?: Record<Lang, string[]>;
  memoryItems: Record<Lang, MemoryItem[]>;
  /** Her own answers to the optional self-reflection questions. Never sent to the AI. */
  reflection: ReflectionAnswers;
  createdAt: string;
};
/** What she told us about herself, shared by every desire. */
export type Profile = ProfileSeed;
export const emptyProfile: Profile = { country: "", about: "", situation: "", people: [], neverInclude: [] };
export const normalizeProfile = (value: unknown): Profile => {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Profile>;
  return {
    country: typeof raw.country === "string" ? raw.country.slice(0, 60) : "",
    about: typeof raw.about === "string" ? raw.about.slice(0, 1200) : "",
    situation: typeof raw.situation === "string" ? raw.situation.slice(0, 1200) : "",
    people: Array.isArray(raw.people) ? raw.people.filter((item) => item && typeof item.name === "string" && item.name.trim()).slice(0, 12).map((item) => ({ id: String(item.id || crypto.randomUUID()), name: item.name.slice(0, 40), relation: typeof item.relation === "string" ? item.relation.slice(0, 80) : "" })) : [],
    neverInclude: Array.isArray(raw.neverInclude) ? raw.neverInclude.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 30).map((item) => item.slice(0, 80)) : [],
  };
};

export type Story = {
  id: string;
  title: Record<Lang, string>;
  city: Record<Lang, string>;
  subtitle: Record<Lang, string>;
  text: Record<Lang, string[]>;
  anchor: Record<Lang, string>;
  tone: "nyc" | "snow" | "seoul";
  sample?: boolean;
  /** The photo on the card. null = the person removed it, so no photo is looked up again. */
  cover?: StoryCover | null;
  /** When the story was saved (ISO). Older stories have none. */
  createdAt?: string;
  /** Her own keywords or scene notes, kept so the script can be written again from them. */
  seed?: Record<Lang, string>;
  /** text holds the AI-written script, not her own notes. */
  scripted?: boolean;
  /** What the story is about (love, wealth, ...), which decides the rules the script is written with. */
  category?: StoryCategory;
  /** The desire this script belongs to (its person, setting and details), or NO_STORY_GOAL. Older stories have none and are matched by category. */
  goalId?: string;
};
export type StoryCover = { image: string; credit?: string; source?: string };
export type StoryDraft = { title: string; city: string; subtitle: string; scene: string; anchor: string; category: StoryCategory | ""; goalId: string; categoryTouched?: boolean };
/** A script that belongs to no desire. */
export const NO_STORY_GOAL = "none";
export type AIResponse = {
  reply?: string;
  journeySummary?: string;
  beliefObserved?: string;
  memoryCandidates?: Array<{ kind: MemoryKind; title: string; detail: string; keywords: string[] }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  error?: string;
  message?: string;
};
export type SearchImage = { title: string; image: string; source: string; credit: string; license: string; provider: string; downloadLocation?: string };
export type BetaStatus = { authenticated: boolean; enabled?: boolean; totalRequests?: number; totalTokens?: number };

/** The reframe reply is the new thought on its first line, optionally followed by one short new reading. */
export const splitThought = (text: string) => {
  const [thought = "", ...rest] = text.trim().split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return { thought, reading: rest.join(" ") };
};

export const emptyStoryDraft: StoryDraft = { title: "", city: "", subtitle: "", scene: "", anchor: "", category: "", goalId: "" };
export const emptyMemoryDraft: MemoryDraft = { kind: "insight", title: "", detail: "", keywords: "" };
export const emptyStory: Story = {
  id: "empty",
  title: { zh: "我的新剧本", en: "My new story" },
  city: { zh: "我的生活", en: "MY LIFE" },
  subtitle: { zh: "", en: "" },
  text: { zh: [], en: [] },
  anchor: { zh: "", en: "" },
  tone: "nyc",
};

export const defaultGoal: GoalProfile = {
  id: "",
  setupComplete: false,
  status: "active",
  intensity: 3,
  wishCategory: "other",
  companionStyle: "",
  coachMode: "assumption",
  companionName: "",
  spName: "",
  spPronunciation: "",
  desire: { zh: "", en: "" },
  background: { zh: "", en: "" },
  storySetting: { zh: "", en: "" },
  beliefs: { zh: [], en: [] },
  tone: { zh: "", en: "" },
  journeySummary: { zh: "", en: "" },
  canon: { zh: [], en: [] },
  responsePreferences: {
    zh: ["不重复固定模板", "不主动争论愿望是否可能", "回应后给出一个可进入的具体场景"],
    en: ["Do not repeat a fixed template", "Do not initiate a feasibility debate", "Offer one concrete scene after responding"],
  },
  acceptedSceneLedger: { zh: [], en: [] },
  memoryItems: { zh: [], en: [] },
  reflection: {},
  createdAt: "",
};

export const MAX_BELIEFS = 12;
export const MAX_GOALS = 30;
/** Device storage key for the copy last agreed with the cloud (the base of the three-way merge). */
export const SYNC_BASE_KEY = "already-sync-base-v1";
/** Short tag of the account whose space this device holds (from /api/space). Kept when the device's data is cleared. */
export const SPACE_OWNER_KEY = "already-space-owner-v1";

/** Set while the page is about to reload after clearing another account's data, so nothing is saved back in the meantime. */
let discardingSpace = false;

/** Removes everything this device keeps about the space: the synced copy and the photos and audio that live only here. */
export function clearDeviceSpace() {
  for (const key of ["already-private-state-v5", SYNC_BASE_KEY, "already-practice-checkins-v1", "already-subliminal-v1", "already-vision-project-v1", "already-opening-v1"]) removeStored(key);
  for (const name of ["already-private-audio-v1", "already-private-vision-v1", COVER_DB]) indexedDB.deleteDatabase(name);
}

/** Another account signed in on this device: clear the previous person's copy and keep anything from being saved back before the reload. */
export function discardDeviceSpace() {
  discardingSpace = true;
  clearDeviceSpace();
}

export const isDiscardingSpace = () => discardingSpace;
/** How many stories one person can keep. One place to change it when membership tiers set their own limits. */
export const MAX_STORIES = 30;
/** Paragraphs kept per story; long enough for a full script. */
export const MAX_STORY_PARAGRAPHS = 20;
/** Fallback titles older builds wrote into the language the story was not saved in. */
export const PLACEHOLDER_STORY_TITLES = new Set(["新的已实现时刻", "A fulfilled moment", "来自陪伴者的剧本", "A story from my companion"]);
/** A short title from the first sentence of a story, for stories saved straight from a chat reply. */
export const storyTitleFrom = (text: string, lang: Lang) => {
  const sentence = text.split(/(?<=[。！？!?])|(?<=\.)\s/)[0]?.trim().replace(/[，,。.!！?？；;:：]+$/, "") || "";
  const max = lang === "zh" ? 18 : 48;
  if (!sentence) return lang === "zh" ? "来自陪伴者的剧本" : "A story from my companion";
  return sentence.length > max ? `${sentence.slice(0, max).trim()}…` : sentence;
};
/** Repairs stories saved from chat by older builds: a placeholder title, or the first 24 characters cut mid-word. */
export const normalizeStory = (story: Story): Story => {
  const title = { ...story.title };
  (["zh", "en"] as Lang[]).forEach((lang) => {
    const first = story.text[lang][0] || "";
    const cut = first.length > 24 && title[lang] === first.slice(0, 24);
    if (first && (cut || PLACEHOLDER_STORY_TITLES.has(title[lang]))) title[lang] = storyTitleFrom(first, lang);
  });
  return { ...story, title };
};
export const storyDate = (story: Story, lang: Lang) => {
  if (!story.createdAt) return "";
  const date = new Date(story.createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" });
};
/** Date and place under a story title; the default place ("我的生活") is left out. */
export const storyMeta = (story: Story, lang: Lang) => [storyDate(story, lang), ["我的生活", "MY LIFE"].includes(story.city[lang]) ? "" : story.city[lang]].filter(Boolean).join(" · ");
export const intensityLabels: Record<Lang, string[]> = {
  zh: ["有也不错", "想要", "很想要", "特别想要", "最想要"],
  en: ["Nice to have", "Want it", "Really want it", "Want it a lot", "Want it most"],
};
export const normalizeGoal = (item: Partial<GoalProfile>): GoalProfile => ({
  ...defaultGoal,
  ...item,
  intensity: Math.min(5, Math.max(1, Math.round(Number(item.intensity) || 3))),
  background: item.background || defaultGoal.background,
  storySetting: item.storySetting || defaultGoal.storySetting,
  spPronunciation: item.spPronunciation || "",
  canon: item.canon || defaultGoal.canon,
  responsePreferences: item.responsePreferences || defaultGoal.responsePreferences,
  acceptedSceneLedger: item.acceptedSceneLedger || defaultGoal.acceptedSceneLedger,
  memoryItems: item.memoryItems || defaultGoal.memoryItems,
  reflection: item.reflection || {},
} as GoalProfile);
export const MAX_BACKGROUND = 4000;
export const MAX_MEMORIES = 48;

// Monotonic local ids for device-only list items, so two actions in the same millisecond cannot collide.
export let localIdCounter = 0;
export const nextLocalId = () => Date.now() * 1000 + (localIdCounter = (localIdCounter + 1) % 1000);

export const memoryKinds: Array<{ id: MemoryKind; zh: string; en: string }> = [
  { id: "person", zh: "人物", en: "People" },
  { id: "place", zh: "地点", en: "Places" },
  { id: "event", zh: "事件", en: "Events" },
  { id: "preference", zh: "偏好", en: "Preferences" },
  { id: "insight", zh: "自我洞察", en: "Insights" },
];

/** Two thoughts count as the same when only punctuation, case, or a leading "I believe" differs. */
export function sameBelief(a: string, b: string) {
  const norm = (text: string) => text.toLowerCase().replace(/[\s，。,.!！？?“”"'、…]/g, "").replace(/^(我相信|我觉得|我认为|i believe|i think)/, "");
  return norm(a) === norm(b);
}

export function parseBeliefs(value: string) {
  return value.split(/[\r\n；;]+/).map((item) => item.trim()).filter(Boolean);
}

export function seedJourneySummary(background: string) {
  const clean = background.trim().replace(/\n{3,}/g, "\n\n");
  if (clean.length <= 1800) return clean;
  const paragraphs = clean.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const selected: string[] = [];
  for (const paragraph of [...paragraphs.slice(0, 4), ...paragraphs.slice(-3)]) {
    if (!selected.includes(paragraph) && [...selected, paragraph].join("\n").length <= 1800) selected.push(paragraph);
  }
  return selected.join("\n").slice(0, 1800);
}

export function normalizeMessages(items: unknown): Message[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is { role: "ai" | "user"; text: string; id?: string; feedback?: "helpful" | "missed"; saved?: boolean } => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { role?: string; text?: string };
    return (candidate.role === "ai" || candidate.role === "user") && typeof candidate.text === "string";
  }).slice(-80).map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
}

export function conversationTitle(items: Message[], lang: Lang) {
  const seed = items.find((item) => item.role === "user")?.text.trim();
  return seed ? `${seed.slice(0, 34)}${seed.length > 34 ? "…" : ""}` : (lang === "zh" ? "新的对话" : "New conversation");
}

export function SurveyScale({ value, onChange, lang }: { value: number; onChange: (score: number) => void; lang: Lang }) {
  return <div className="survey-scale"><div>{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={value === score ? "selected" : ""} onClick={() => onChange(score)} aria-label={`${score} / 5`}>{score}</button>)}</div><small><span>{lang === "zh" ? "完全没有" : "Not at all"}</span><span>{lang === "zh" ? "非常强" : "Very much"}</span></small></div>;
}

export const wishCategories: Array<{ id: WishCategory; zh: string; en: string; zhDescription: string; enDescription: string }> = [
  { id: "relationship", zh: "关系与特定对象", en: "Relationship & SP", zhDescription: "爱情、友情、家庭或一位特定的人", enDescription: "Love, friendship, family, or a specific person" },
  { id: "wealth", zh: "金钱与事业", en: "Money & Career", zhDescription: "收入、工作、项目或机会", enDescription: "Income, work, projects, or opportunities" },
  { id: "self", zh: "自我与状态", en: "Self & Being", zhDescription: "自我概念、身体感受或个人成长", enDescription: "Self-concept, how you feel, or personal growth" },
  { id: "lifestyle", zh: "生活与体验", en: "Life & Experiences", zhDescription: "居住、旅行、物品或生活方式", enDescription: "Home, travel, possessions, or lifestyle" },
  { id: "other", zh: "其他愿望", en: "Something Else", zhDescription: "用你自己的方式定义它", enDescription: "Define it in your own words" },
];

export { withHerName } from "@/lib/her-name";

/** Partner, family or friend for a relationship desire; older desires are read from their background line. */
export const relationKindOf = (item: GoalProfile): "love" | "family" | "friend" | undefined => {
  if (item.wishCategory !== "relationship") return undefined;
  if (item.relationKind) return item.relationKind;
  const text = `${item.background.zh}\n${item.background.en}`;
  if (/这段关系是：家人|This relationship is with: family/i.test(text)) return "family";
  if (/这段关系是：朋友|This relationship is with: a friend/i.test(text)) return "friend";
  return "love";
};
/** The script kind a desire leads to: a family member or a friend is not a love story. */
export const storyKindOfGoal = (item: GoalProfile) => storyCategoryFor(item.wishCategory, relationKindOf(item));

export const goalTitle = (item: GoalProfile, lang: Lang) => {
  const text = (item.desire[lang] || item.desire.zh || item.desire.en || "").trim();
  if (text) return text.length > 16 ? `${text.slice(0, 16)}…` : text;
  const category = wishCategories.find((entry) => entry.id === item.wishCategory);
  return (lang === "zh" ? category?.zh : category?.en) || "";
};

export const coachModes: Array<{ id: CoachMode; zh: string; en: string; zhDescription: string; enDescription: string }> = [
  { id: "release", zh: "释放引导", en: "Release Guide", zhDescription: "不放弃愿望，只松开恐惧、求证和控制带来的紧绷。", enDescription: "Keeps the desire while softening fear, checking, and control." },
  { id: "assumption", zh: "假设法则引导", en: "Assumption Guide", zhDescription: "用已实现视角、SATS、Revision 和具体场景进入完成态。", enDescription: "Uses fulfilled perspective, SATS, Revision, and vivid scenes." },
  { id: "subconscious", zh: "潜意识引导", en: "Subconscious Guide", zhDescription: "把愿望变成自然、可重复的肯定语、睡前练习与 Sub。", enDescription: "Turns the desire into natural affirmations, sleep practice, and Subs." },
];

export const ui = {
  zh: {
    day: "第 1 天", greeting: "欢迎回来", hero: <>你无须说服任何人。<br />回到你已经选择的故事里。</>, wish: "我的愿望", happened: "已经发生", start: "开始对话",
    newStory: "你的新剧本", moment: "今天想进入哪个时刻？", enter: "进入剧本", returnBelief: "快速回到信念", need: "此刻，你需要什么？", talk: "和陪伴者说说话", quiet: "让怀疑停止扩音", rewrite: "重写这一刻", accept: "接纳你选择的新版本",
    companion: "信念陪伴者", here: "我在这里", companionCopy: "把此刻冒出来的念头说出来。AI 会结合你的当前愿望、旧念头和最近的练习，陪你回到愿望已经实现的样子。", chatPlaceholder: "写下此刻冒出的念头……",
    previous: "← 上一个", next: "下一个剧本 →", revisionTitle: "此刻这一句", revisionCopy: "把挡在愿望前面的那句话写下来。旧念头只需要出现一次，接纳后只留下新的那句。", oldLabel: "此刻冒出来的是哪一句？", oldPlaceholder: "", makeRevision: "帮我转这个念头", turning: "正在转这个念头……", chosen: "你的新念头", accepted: "已经接纳 ✓", acceptStory: "接纳这个新念头", history: "我的新念头", toDreamscape: "带入潜音", editThought: "可以改成你自己的话", rephrase: "换个说法",
    boardTitle: "收藏你正在走进的生活", boardCopy: "从授权真实摄影中寻觅灵感，或用自己的照片编织专属愿景板。不会使用 AI 生成图片。", realPhotos: "寻梦灵感", photoCopy: "在可商用授权的真实摄影中，寻找属于你的生活画面", searchPlaceholder: "例如：冬日旅行、理想的新家", searching: "寻觅中", search: "开始寻梦", collect: "＋ 收进我的愿景", manual: "或者添加你已经喜欢的素材", nameScene: "为这个画面命名", pasteLink: "粘贴任意网站的来源链接或图片直链", addLink: "添加链接", local: "从本机添加", source: "查看来源 ↗",
    private: "我的空间", space: "我的已完成空间", privateCopy: "愿望、记忆、对话与练习支持跨设备同步", coreWish: "当前唯一愿望", tone: "陪伴语气", toneCopy: "温柔、坚定，不分析可能性，不用旧故事反驳新选择。", region: "使用范围", regionCopy: "提供中文与英文。", clear: "清除我的练习数据", confirm: "要清除云端与这台设备上保存的所有练习吗？", nav: ["陪伴", "剧本", "转念", "愿景", "潜音"], ariaSettings: "打开私人设定", ariaNav: "主导航", send: "发送", activeGoal: "当前愿望", beliefs: "限制性信念地图", memory: "AI 旅程摘要", saveGoal: "保存更改", savedGoal: "更改已保存", generating: "AI 正在写这个剧本……", generateStory: "让 AI 写成剧本", aiReady: "AI 已连接", aiSetup: "AI 暂时没有回应", trust: "AI 与安全说明",
  },
  en: {
    day: "DAY 1", greeting: "Welcome back", hero: <>You do not need to convince anyone.<br />Return to the story you have already chosen.</>, wish: "MY DESIRE", happened: "ALREADY MINE", start: "Begin today’s practice",
    newStory: "YOUR NEW STORY", moment: "Which moment will you enter today?", enter: "Enter the story", returnBelief: "RETURN TO KNOWING", need: "What do you need right now?", talk: "Talk with your companion", quiet: "Turn down the volume of doubt", rewrite: "Revise this moment", accept: "Choose the version that belongs to you",
    companion: "BELIEF COMPANION · GLOBAL BETA", here: "I’m here", companionCopy: "Tell me the thought that is here right now. Your AI uses your active desire, your old thoughts, and your recent practice to bring you back to your desire already fulfilled.", chatPlaceholder: "Write the thought that just appeared…",
    previous: "← Previous", next: "Next story →", revisionTitle: "Right now", revisionCopy: "Write down the line standing in front of your desire. The old thought only needs to appear once; once you accept, only the new one stays.", oldLabel: "Which thought just came up?", oldPlaceholder: "", makeRevision: "Turn this thought for me", turning: "Turning this thought…", chosen: "YOUR NEW THOUGHT", accepted: "Accepted ✓", acceptStory: "Accept this new thought", history: "MY NEW THOUGHTS", toDreamscape: "Take to Dreamscape", editThought: "Change it into your own words", rephrase: "Say it another way",
    boardTitle: "Collect the life you are entering", boardCopy: "Discover inspiration in licensed real photography, or weave a personal vision board from your own photos. No AI-generated imagery.", realPhotos: "Discover Dreamscapes", photoCopy: "Find the life you imagine through commercially licensed real photography", searchPlaceholder: "e.g. winter travel, dream home", searching: "Dreaming", search: "Discover", collect: "+ Keep in my vision", manual: "or add something you already love", nameScene: "Name this scene", pasteLink: "Paste any source link or direct image URL", addLink: "Add link", local: "Upload", source: "View source ↗",
    private: "PRIVATE SPACE · GLOBAL BETA", space: "My already-done space", privateCopy: "Your desire card, journey summary, chats, and revisions can sync across devices.", coreWish: "ONE ACTIVE DESIRE", tone: "COMPANION TONE", toneCopy: "Gentle and certain. It does not debate possibility or use the old story against your new choice.", region: "BETA REGION", regionCopy: "Available in Chinese and English.", clear: "Clear practice data on this device", confirm: "Clear all practice data saved on this device?", nav: ["Companion", "Scripts", "Reframe", "Vision", "Dreamscape"], ariaSettings: "Open private settings", ariaNav: "Main navigation", send: "Send", activeGoal: "ACTIVE GOAL", beliefs: "LIMITING-BELIEF MAP", memory: "AI JOURNEY SUMMARY", saveGoal: "Save active desire card", savedGoal: "Desire card saved", generating: "Your AI is writing this story…", generateStory: "Let AI expand this story", aiReady: "LIVE AI", aiSetup: "AI isn’t responding right now", trust: "AI & Safety Notice",
  },
};
