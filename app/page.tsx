"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  House,
  ImagesSquare,
  Moon,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Sun,
  Trash,
  Waveform,
  ArrowsClockwise,
  Brain,
  CaretDown,
  List,
  UserCircle,
  GearSix,
  Check,
  ArrowClockwise,
  BookmarkSimple,
  ChatCircleDots,
  CloudCheck,
  CloudSlash,
  ArrowDown,
  ArrowElbowDownLeft,
  ArrowLeft,
  Copy,
  FloppyDisk,
  NotePencil,
  StopCircle,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import SubliminalStudio, { PracticeCheckIn, practiceStreak, todayKey } from "./components/SubliminalStudio";
import Dreamscape from "./components/Dreamscape";
import VisionCanvasStudio from "./components/VisionCanvasStudio";
import DoughPet from "./components/DoughPet";
import ReflectionPanel from "./components/ReflectionPanel";
import { AiNote, BreakReminder, ReportButton, ReportDialog, SiteRecord } from "./components/Compliance";
import SyncPanel from "./components/SyncPanel";
import GuidedOnboarding from "./components/GuidedOnboarding";
import ProfilePanel from "./components/ProfilePanel";
import SpaceNav from "./components/SpaceNav";
import VoiceSettings from "./components/VoiceSettings";
import FontSizePanel from "./components/FontSizePanel";
import type { ReflectionAnswers, ReflectionQuestionId } from "@/lib/reflection";
import { validateSpName } from "@/lib/name-policy";
import { answersToSeeds, type GoalSeed, type OnboardingAnswers, type ProfileSeed } from "@/lib/onboarding-flow";
import { readStored, writeStored, removeStored } from "@/lib/safe-storage";

type SpaceSection = "wishes" | "about" | "companion" | "reflect" | "memory" | "look" | "voice" | "sync" | "help";
type View = "home" | "subliminal" | "story" | "revision" | "board" | "memory" | "settings";
type Lang = "zh" | "en";
type Message = { id: string; role: "ai" | "user"; text: string; feedback?: "helpful" | "missed"; saved?: boolean; logId?: string; error?: boolean };
type Conversation = { id: string; title: string; createdAt: string; messages: Message[]; goalId?: string };
type BoardItem = { id: number; title: string; source: string; image?: string };
type Revision = { id: number; old: string; revised: string; date: string };
type GoalStatus = "active" | "embodiment" | "fulfilled" | "paused";
type WishCategory = "relationship" | "wealth" | "self" | "lifestyle" | "other";
type CompanionStyle = "gentle" | "anchor" | "friend" | "direct" | "custom" | "";
type CoachMode = "release" | "assumption" | "subconscious";
type MemoryKind = "person" | "place" | "event" | "preference" | "insight";
type MemoryItem = {
  id: string;
  kind: MemoryKind;
  title: string;
  detail: string;
  keywords: string[];
  pinned: boolean;
  source: "user" | "conversation" | "story";
  createdAt: string;
};
type MemoryDraft = { kind: MemoryKind; title: string; detail: string; keywords: string };
type GoalProfile = {
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
  beliefs: Record<Lang, string[]>;
  tone: Record<Lang, string>;
  journeySummary: Record<Lang, string>;
  canon: Record<Lang, string[]>;
  responsePreferences: Record<Lang, string[]>;
  acceptedSceneLedger: Record<Lang, string[]>;
  memoryItems: Record<Lang, MemoryItem[]>;
  /** Her own answers to the optional self-reflection questions. Never sent to the AI. */
  reflection: ReflectionAnswers;
  createdAt: string;
};
/** What she told us about herself, shared by every desire. */
type Profile = ProfileSeed;
const emptyProfile: Profile = { country: "", about: "", situation: "", people: [], neverInclude: [] };
const normalizeProfile = (value: unknown): Profile => {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Profile>;
  return {
    country: typeof raw.country === "string" ? raw.country.slice(0, 60) : "",
    about: typeof raw.about === "string" ? raw.about.slice(0, 400) : "",
    situation: typeof raw.situation === "string" ? raw.situation.slice(0, 400) : "",
    people: Array.isArray(raw.people) ? raw.people.filter((item) => item && typeof item.name === "string" && item.name.trim()).slice(0, 12).map((item) => ({ id: String(item.id || crypto.randomUUID()), name: item.name.slice(0, 40), relation: typeof item.relation === "string" ? item.relation.slice(0, 80) : "" })) : [],
    neverInclude: Array.isArray(raw.neverInclude) ? raw.neverInclude.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 30).map((item) => item.slice(0, 80)) : [],
  };
};

type Story = {
  id: string;
  title: Record<Lang, string>;
  city: Record<Lang, string>;
  subtitle: Record<Lang, string>;
  text: Record<Lang, string[]>;
  anchor: Record<Lang, string>;
  tone: "nyc" | "snow" | "seoul";
  sample?: boolean;
};
type StoryDraft = { title: string; city: string; subtitle: string; scene: string; anchor: string };
type AIResponse = {
  reply?: string;
  journeySummary?: string;
  beliefObserved?: string;
  memoryCandidates?: Array<{ kind: MemoryKind; title: string; detail: string; keywords: string[] }>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  error?: string;
  message?: string;
};
type SearchImage = { title: string; image: string; source: string; credit: string; license: string; provider: string; downloadLocation?: string };
type ImageSearchPlan = { original: string; translated: string; queries: string[] };
type BetaStatus = { authenticated: boolean; enabled?: boolean; totalRequests?: number; totalTokens?: number };

const emptyStoryDraft: StoryDraft = { title: "", city: "", subtitle: "", scene: "", anchor: "" };
const emptyMemoryDraft: MemoryDraft = { kind: "insight", title: "", detail: "", keywords: "" };
const emptyStory: Story = {
  id: "empty",
  title: { zh: "我的新故事", en: "My new story" },
  city: { zh: "我的生活", en: "MY LIFE" },
  subtitle: { zh: "", en: "" },
  text: { zh: [], en: [] },
  anchor: { zh: "", en: "" },
  tone: "nyc",
};

const defaultGoal: GoalProfile = {
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

const MAX_BELIEFS = 12;
const MAX_GOALS = 30;
const intensityLabels: Record<Lang, string[]> = {
  zh: ["有也不错", "想要", "很想要", "特别想要", "最想要"],
  en: ["Nice to have", "Want it", "Really want it", "Want it a lot", "Want it most"],
};
const normalizeGoal = (item: Partial<GoalProfile>): GoalProfile => ({
  ...defaultGoal,
  ...item,
  intensity: Math.min(5, Math.max(1, Math.round(Number(item.intensity) || 3))),
  background: item.background || defaultGoal.background,
  spPronunciation: item.spPronunciation || "",
  canon: item.canon || defaultGoal.canon,
  responsePreferences: item.responsePreferences || defaultGoal.responsePreferences,
  acceptedSceneLedger: item.acceptedSceneLedger || defaultGoal.acceptedSceneLedger,
  memoryItems: item.memoryItems || defaultGoal.memoryItems,
  reflection: item.reflection || {},
} as GoalProfile);
const MAX_BACKGROUND = 4000;
const MAX_MEMORIES = 48;

// Monotonic local ids for device-only list items, so two actions in the same millisecond cannot collide.
let localIdCounter = 0;
const nextLocalId = () => Date.now() * 1000 + (localIdCounter = (localIdCounter + 1) % 1000);

const memoryKinds: Array<{ id: MemoryKind; zh: string; en: string }> = [
  { id: "person", zh: "人物", en: "People" },
  { id: "place", zh: "地点", en: "Places" },
  { id: "event", zh: "事件", en: "Events" },
  { id: "preference", zh: "偏好", en: "Preferences" },
  { id: "insight", zh: "自我洞察", en: "Insights" },
];

/** Two thoughts count as the same when only punctuation, case, or a leading "I believe" differs. */
function sameBelief(a: string, b: string) {
  const norm = (text: string) => text.toLowerCase().replace(/[\s，。,.!！？?“”"'、…]/g, "").replace(/^(我相信|我觉得|我认为|i believe|i think)/, "");
  return norm(a) === norm(b);
}

function parseBeliefs(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function seedJourneySummary(background: string) {
  const clean = background.trim().replace(/\n{3,}/g, "\n\n");
  if (clean.length <= 1800) return clean;
  const paragraphs = clean.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const selected: string[] = [];
  for (const paragraph of [...paragraphs.slice(0, 4), ...paragraphs.slice(-3)]) {
    if (!selected.includes(paragraph) && [...selected, paragraph].join("\n").length <= 1800) selected.push(paragraph);
  }
  return selected.join("\n").slice(0, 1800);
}

function normalizeMessages(items: unknown): Message[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is { role: "ai" | "user"; text: string; id?: string; feedback?: "helpful" | "missed"; saved?: boolean } => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { role?: string; text?: string };
    return (candidate.role === "ai" || candidate.role === "user") && typeof candidate.text === "string";
  }).slice(-80).map((item) => ({ ...item, id: item.id || crypto.randomUUID() }));
}

function conversationTitle(items: Message[], lang: Lang) {
  const seed = items.find((item) => item.role === "user")?.text.trim();
  return seed ? `${seed.slice(0, 34)}${seed.length > 34 ? "…" : ""}` : (lang === "zh" ? "新的对话" : "New conversation");
}

function SurveyScale({ value, onChange, lang }: { value: number; onChange: (score: number) => void; lang: Lang }) {
  return <div className="survey-scale"><div>{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={value === score ? "selected" : ""} onClick={() => onChange(score)} aria-label={`${score} / 5`}>{score}</button>)}</div><small><span>{lang === "zh" ? "完全没有" : "Not at all"}</span><span>{lang === "zh" ? "非常强" : "Very much"}</span></small></div>;
}

const wishCategories: Array<{ id: WishCategory; zh: string; en: string; zhDescription: string; enDescription: string }> = [
  { id: "relationship", zh: "关系与特定对象", en: "Relationship & SP", zhDescription: "爱情、友情、家庭或一位特定的人", enDescription: "Love, friendship, family, or a specific person" },
  { id: "wealth", zh: "金钱与事业", en: "Money & Career", zhDescription: "收入、工作、项目或机会", enDescription: "Income, work, projects, or opportunities" },
  { id: "self", zh: "自我与状态", en: "Self & Being", zhDescription: "自我概念、身体感受或个人成长", enDescription: "Self-concept, how you feel, or personal growth" },
  { id: "lifestyle", zh: "生活与体验", en: "Life & Experiences", zhDescription: "居住、旅行、物品或生活方式", enDescription: "Home, travel, possessions, or lifestyle" },
  { id: "other", zh: "其他愿望", en: "Something Else", zhDescription: "用你自己的方式定义它", enDescription: "Define it in your own words" },
];

const goalTitle = (item: GoalProfile, lang: Lang) => {
  const text = (item.desire[lang] || item.desire.zh || item.desire.en || "").trim();
  if (text) return text.length > 16 ? `${text.slice(0, 16)}…` : text;
  const category = wishCategories.find((entry) => entry.id === item.wishCategory);
  return (lang === "zh" ? category?.zh : category?.en) || "";
};

const companionStyles: Array<{ id: Exclude<CompanionStyle, "">; zh: string; en: string; zhDescription: string; enDescription: string; zhPrompt: string; enPrompt: string }> = [
  { id: "gentle", zh: "温柔抱持型", en: "Gentle Holder", zhDescription: "先接住情绪，再缓缓回到已经选择的状态。", enDescription: "Meets the feeling first, then gently returns to the chosen state.", zhPrompt: "温柔、细腻、富有安抚感。先准确接住我的感受，再自然地陪我回到已经选择的完成态。", enPrompt: "Gentle, emotionally precise, and soothing. Meet my feeling accurately, then guide me naturally into the fulfilled state I chose." },
  { id: "anchor", zh: "坚定锚定型", en: "Steady Anchor", zhDescription: "不跟旧故事拉扯，稳定地回到新版本。", enDescription: "Does not wrestle with the old story and returns steadily to the new version.", zhPrompt: "坚定、清醒、稳定。不放大旧故事，也不绕圈，直接帮我锚定在已经选定的新版本里。", enPrompt: "Certain, clear, and steady. Do not amplify the old story or circle around it. Anchor me directly in the new version I chose." },
  { id: "friend", zh: "甜蜜好友型", en: "Sweet Friend", zhDescription: "亲近、有生活感，像很懂你的朋友。", enDescription: "Warm, intimate, and natural, like a friend who knows you deeply.", zhPrompt: "亲近、甜蜜、有生活感，像一个很懂我的朋友。语言自然，不像客服，也不使用生硬模板。", enPrompt: "Warm, sweet, and lived-in, like a friend who knows me deeply. Sound natural, never corporate or templated." },
  { id: "direct", zh: "简洁直给型", en: "Clear & Direct", zhDescription: "少解释，用一句核心回应和一个画面完成转换。", enDescription: "Uses one core response and one vivid scene with minimal explanation.", zhPrompt: "简洁、直接、有力量。少解释，用一句核心回应和一个具体画面迅速带我回到完成态。", enPrompt: "Concise, direct, and strong. Use one core response and one concrete scene to return me quickly to the fulfilled state." },
  { id: "custom", zh: "自定义", en: "Custom", zhDescription: "写下你独有的表达偏好和禁区。", enDescription: "Describe your own expression preferences and dislikes.", zhPrompt: "", enPrompt: "" },
];

const coachModes: Array<{ id: CoachMode; zh: string; en: string; zhDescription: string; enDescription: string }> = [
  { id: "release", zh: "释放引导", en: "Release Guide", zhDescription: "不放弃愿望，只松开恐惧、求证和控制带来的紧绷。", enDescription: "Keeps the desire while softening fear, checking, and control." },
  { id: "assumption", zh: "假设法则引导", en: "Assumption Guide", zhDescription: "用已实现视角、SATS、Revision 和具体场景进入完成态。", enDescription: "Uses fulfilled perspective, SATS, Revision, and vivid scenes." },
  { id: "subconscious", zh: "潜意识引导", en: "Subconscious Guide", zhDescription: "把愿望变成自然、可重复的肯定语、睡前练习与 Sub。", enDescription: "Turns the desire into natural affirmations, sleep practice, and Subs." },
];

const ui = {
  zh: {
    day: "第 1 天", greeting: "欢迎回来", hero: <>你无须说服任何人。<br />回到你已经选择的故事里。</>, wish: "我的愿望", happened: "已经发生", start: "开始对话",
    newStory: "你的新故事", moment: "今天想进入哪个时刻？", enter: "进入故事", returnBelief: "快速回到信念", need: "此刻，你需要什么？", talk: "和陪伴者说说话", quiet: "让怀疑停止扩音", rewrite: "重写这一刻", accept: "接纳你选择的新版本",
    companion: "信念陪伴者", here: "我在这里", companionCopy: "把旧故事交出来。AI 会结合你的当前愿望、限制性信念和最近旅程，陪你回到选择的版本。", chatPlaceholder: "写下此刻冒出的念头……",
    previous: "← 上一个", next: "下一个故事 →", revisionTitle: "让这一刻按你的方式发生", revisionCopy: "旧版本只需出现一次。接纳后，我们只保留你的新故事。", oldLabel: "刚刚什么让你离开了新故事？", oldPlaceholder: "例如：一个结果、消息或眼前情况，让我开始怀疑自己的愿望……", makeRevision: "✶ 为我重写这一刻", chosen: "你选择的新版本", accepted: "已经接纳 ✓", acceptStory: "接纳为我的新故事", history: "已接纳",
    boardTitle: "收藏你正在走进的生活", boardCopy: "从授权真实摄影中寻觅灵感，或用自己的照片编织专属愿景板。不会使用 AI 生成图片。", realPhotos: "寻梦灵感", photoCopy: "在可商用授权的真实摄影中，寻找属于你的生活画面", searchPlaceholder: "例如：冬日旅行、理想的新家", searching: "寻觅中", search: "开始寻梦", collect: "＋ 收进我的愿景", manual: "或者添加你已经喜欢的素材", nameScene: "为这个画面命名", pasteLink: "粘贴任意网站的来源链接或图片直链", addLink: "添加链接", local: "从本机添加", source: "查看来源 ↗",
    private: "我的空间", space: "我的已完成空间", privateCopy: "愿望、记忆、对话与练习保存在这台设备", coreWish: "当前唯一愿望", tone: "陪伴语气", toneCopy: "温柔、坚定，不分析可能性，不用旧故事反驳新选择。", region: "使用范围", regionCopy: "面向 OpenAI 支持地区的海外中文与英文用户。", clear: "清除我的练习数据", confirm: "要清除云端与这台设备上保存的所有练习吗？", nav: ["陪伴", "故事", "重写", "愿景", "入梦声场"], ariaSettings: "打开私人设定", ariaNav: "主导航", send: "发送", activeGoal: "当前愿望", beliefs: "限制性信念地图", memory: "AI 旅程摘要", saveGoal: "保存更改", savedGoal: "更改已保存", generating: "AI 正在进入这个场景……", generateStory: "✶ 为这一刻生成专属故事", aiReady: "AI 已连接", aiSetup: "AI 暂时没有回应", trust: "AI 与安全说明",
  },
  en: {
    day: "DAY 1", greeting: "Welcome back", hero: <>You do not need to convince anyone.<br />Return to the story you have already chosen.</>, wish: "MY DESIRE", happened: "ALREADY MINE", start: "Begin today’s practice",
    newStory: "YOUR NEW STORY", moment: "Which moment will you enter today?", enter: "Enter the story", returnBelief: "RETURN TO KNOWING", need: "What do you need right now?", talk: "Talk with your companion", quiet: "Turn down the volume of doubt", rewrite: "Revise this moment", accept: "Choose the version that belongs to you",
    companion: "BELIEF COMPANION · GLOBAL BETA", here: "I’m here", companionCopy: "Give me the old story. Your AI uses your active desire, belief map, and recent journey to bring you back to the version you chose.", chatPlaceholder: "Write the thought that just appeared…",
    previous: "← Previous", next: "Next story →", revisionTitle: "Let this moment happen your way", revisionCopy: "The old version only needs to appear once. After revision, we keep your new story.", oldLabel: "What just pulled you away from your new story?", oldPlaceholder: "For example: A result, message, or present circumstance made me doubt my desire…", makeRevision: "✶ Revise this moment for me", chosen: "THE VERSION YOU CHOOSE", accepted: "Accepted ✓", acceptStory: "Accept as my new story", history: "ACCEPTED",
    boardTitle: "Collect the life you are entering", boardCopy: "Discover inspiration in licensed real photography, or weave a personal vision board from your own photos. No AI-generated imagery.", realPhotos: "Discover Dreamscapes", photoCopy: "Find the life you imagine through commercially licensed real photography", searchPlaceholder: "e.g. winter travel, dream home", searching: "Dreaming", search: "Discover", collect: "+ Keep in my vision", manual: "or add something you already love", nameScene: "Name this scene", pasteLink: "Paste any source link or direct image URL", addLink: "Add link", local: "Upload", source: "View source ↗",
    private: "PRIVATE SPACE · GLOBAL BETA", space: "My already-done space", privateCopy: "Your desire card, journey summary, chats, and revisions stay on this device.", coreWish: "ONE ACTIVE DESIRE", tone: "COMPANION TONE", toneCopy: "Gentle and certain. It does not debate possibility or use the old story against your new choice.", region: "BETA REGION", regionCopy: "Created for Chinese- and English-speaking users in OpenAI-supported regions.", clear: "Clear practice data on this device", confirm: "Clear all practice data saved on this device?", nav: ["Companion", "Stories", "Revise", "Vision", "Dreamscape"], ariaSettings: "Open private settings", ariaNav: "Main navigation", send: "Send", activeGoal: "ACTIVE GOAL", beliefs: "LIMITING-BELIEF MAP", memory: "AI JOURNEY SUMMARY", saveGoal: "Save active desire card", savedGoal: "Desire card saved", generating: "Your AI is entering this scene…", generateStory: "✶ Create my personal story", aiReady: "LIVE AI", aiSetup: "AI isn’t responding right now", trust: "AI & Safety Notice",
  },
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [view, setView] = useState<View>("home");
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [beliefDraft, setBeliefDraft] = useState("");
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyLibrary, setStoryLibrary] = useState<Story[]>([]);
  const [storyReading, setStoryReading] = useState(false);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [storyEditingId, setStoryEditingId] = useState<string | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>(emptyStoryDraft);
  const [goal, setGoal] = useState<GoalProfile>(defaultGoal);
  const [goalArchive, setGoalArchive] = useState<GoalProfile[]>([]);
  const [otherGoals, setOtherGoals] = useState<GoalProfile[]>([]);
  const [spNameDraft, setSpNameDraft] = useState(defaultGoal.spName);
  const [sessionId, setSessionId] = useState("local-beta");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [conversationArchive, setConversationArchive] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SpaceSection | null>(null);
  const [memoryFilter, setMemoryFilter] = useState<MemoryKind | "all">("all");
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryEditingId, setMemoryEditingId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "saving" | "offline">("loading");
  const [cloudReady, setCloudReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [plusSection, setPlusSection] = useState<"goal" | "coach" | null>(null);
  const [petOpen, setPetOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpenRef = useRef(false);
  const [aiError, setAiError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [oldScene, setOldScene] = useState("");
  const [rewritingBelief, setRewritingBelief] = useState("");
  const [newScene, setNewScene] = useState("");
  const [generatedStory, setGeneratedStory] = useState("");
  const [storyGenerating, setStoryGenerating] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [boardMode, setBoardMode] = useState<"licensed" | "mine">("licensed");
  const [checkIns, setCheckIns] = useState<PracticeCheckIn[]>([]);
  const [imageQuery, setImageQuery] = useState("");
  const [imageResults, setImageResults] = useState<SearchImage[]>([]);
  const [imageSearching, setImageSearching] = useState(false);
  const [imageSearchError, setImageSearchError] = useState("");
  const [imageSearchPlan, setImageSearchPlan] = useState<ImageSearchPlan | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);
  const [goalSavedPulse, setGoalSavedPulse] = useState(false);
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [reportTarget, setReportTarget] = useState<{ excerpt?: string } | null>(null);
  const [declined, setDeclined] = useState(false);
  const [betaStatus, setBetaStatus] = useState<BetaStatus | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyBefore, setSurveyBefore] = useState(0);
  const [surveyNow, setSurveyNow] = useState(0);
  const [surveyUnderstood, setSurveyUnderstood] = useState(0);
  const [surveyReturn, setSurveyReturn] = useState(0);
  const [surveyFeature, setSurveyFeature] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const lastLogIdRef = useRef<string | undefined>(undefined);
  const openedChatRef = useRef("");
  const lastMessageCountRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const box = chatInputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 220)}px`;
  }, [chatInput, view, hydrated]);

  // Chat position, like any messenger: opening a conversation lands on the newest message, new messages follow
  // along while she is at the bottom, and a small down arrow appears when she has scrolled up.
  const chatScroller = () => {
    const stage = document.querySelector<HTMLElement>(".app-stage");
    if (stage && getComputedStyle(stage).overflowY === "auto" && stage.scrollHeight > stage.clientHeight) return stage; // phones: the stage scrolls inside the shell
    return (document.scrollingElement || document.documentElement) as HTMLElement; // desktop: the page scrolls
  };
  const scrollChatToBottom = (smooth: boolean) => {
    const scroller = chatScroller();
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  const distanceFromBottom = () => {
    const scroller = chatScroller();
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  };

  useEffect(() => {
    if (view !== "home") { openedChatRef.current = ""; return; }
    if (!messages.length) return;
    const key = conversationId || "none";
    if (openedChatRef.current === key) return;
    openedChatRef.current = key;
    const land = () => scrollChatToBottom(false);
    window.requestAnimationFrame(() => window.requestAnimationFrame(land));
    const later = window.setTimeout(land, 300); // fonts and layout may still be settling
    return () => window.clearTimeout(later);
  }, [view, conversationId, messages.length]);

  useEffect(() => {
    const previous = lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    if (view !== "home" || previous === 0 || messages.length <= previous) return;
    if (distanceFromBottom() < 420 || messages[messages.length - 1]?.role === "user") window.requestAnimationFrame(() => scrollChatToBottom(true));
  }, [messages.length, view]);

  useEffect(() => {
    if (isTyping && view === "home" && distanceFromBottom() < 420) window.requestAnimationFrame(() => scrollChatToBottom(true));
  }, [isTyping, view]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the arrow shows or hides from the scroll position */
    if (view !== "home") { setShowJump(false); return; }
    const update = () => setShowJump(messages.length > 0 && distanceFromBottom() > 240);
    update();
    const stage = document.querySelector(".app-stage");
    stage?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const timer = window.setInterval(update, 800); // the thread grows while a reply streams in
    return () => {
      stage?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.clearInterval(timer);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [view, messages.length, isTyping]);

  // Side panel on phones, like ChatGPT and Claude: swipe right to pull it out (the page follows the finger and
  // slides over), swipe left or tap the page to put it away. The panel lives outside the app shell and only the
  // shell moves. While it moves the shell gets a plain inline transform (cheap, one write per frame) and the
  // expensive effects (blur, grain) are switched off by the .drawer-moving class.
  const drawerWidth = () => Math.min(window.innerWidth * 0.82, 330);
  const shellTransform = (x: number) => (x > 0 ? `translate3d(${Math.round(x)}px, var(--vv-top, 0px), 0)` : "");
  const DRAWER_EASE = "transform .32s cubic-bezier(.32,.72,0,1)";
  const moveSidebar = (open: boolean) => {
    if (shellEl) {
      shellEl.classList.add("drawer-moving");
      shellEl.style.transition = DRAWER_EASE;
      window.setTimeout(() => { shellEl.style.transition = ""; shellEl.classList.remove("drawer-moving"); }, 360);
    }
    setSidebarOpen(open);
  };
  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
    document.documentElement.style.setProperty("--drawer-w", `${Math.round(drawerWidth())}px`);
    if (shellEl) shellEl.style.transform = shellTransform(sidebarOpen ? drawerWidth() : 0);
  }, [sidebarOpen, shellEl]);
  useEffect(() => {
    const shell = shellEl;
    if (!shell) return;
    const phone = window.matchMedia("(max-width: 820px)");
    let startX = 0, startY = 0, lastX = 0, lastT = 0, base = 0, velocity = 0, currentX = 0, frame = 0;
    let decided = false, dragging = false, ignore = false;
    const paint = () => { frame = 0; shell.style.transform = shellTransform(currentX); };
    const setX = (x: number) => { currentX = x; if (!frame) frame = window.requestAnimationFrame(paint); };
    const settle = (open: boolean) => {
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      shell.classList.add("drawer-moving");
      shell.style.transition = DRAWER_EASE;
      window.setTimeout(() => { shell.style.transition = ""; shell.classList.remove("drawer-moving"); }, 360);
      currentX = open ? drawerWidth() : 0;
      shell.style.transform = shellTransform(currentX);
      setSidebarOpen(open);
    };
    // a swipe that begins in a field or a sideways-scrolling strip belongs to that control
    const owned = (target: EventTarget | null) => {
      let node = target as HTMLElement | null;
      while (node && node !== shell) {
        if (node.matches?.("textarea, input, select, [data-no-drawer]")) return true;
        const style = getComputedStyle(node);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 2) return true;
        node = node.parentElement;
      }
      return false;
    };
    const onStart = (event: TouchEvent) => {
      if (!phone.matches || event.touches.length !== 1) { ignore = true; return; }
      const touch = event.touches[0];
      startX = lastX = touch.clientX; startY = touch.clientY; lastT = Date.now();
      decided = false; dragging = false; velocity = 0;
      base = currentX = sidebarOpenRef.current ? drawerWidth() : 0;
      ignore = !sidebarOpenRef.current && owned(event.target);
    };
    const onMove = (event: TouchEvent) => {
      if (ignore) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX, dy = touch.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        decided = true;
        const open = sidebarOpenRef.current;
        dragging = Math.abs(dx) > Math.abs(dy) * 1.4 && ((!open && dx > 0) || (open && dx < 0));
        if (dragging) { shell.style.transition = "none"; shell.classList.add("drawer-moving"); }
      }
      if (!dragging) return;
      const now = Date.now();
      velocity = (touch.clientX - lastX) / Math.max(1, now - lastT);
      lastX = touch.clientX; lastT = now;
      setX(Math.max(0, Math.min(drawerWidth(), base + dx)));
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      settle(velocity > 0.4 ? true : velocity < -0.4 ? false : currentX > drawerWidth() / 2);
    };
    // while the panel is out, a tap on the page only puts the panel away
    const onTap = (event: Event) => {
      if (!sidebarOpenRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      settle(false);
    };
    shell.addEventListener("touchstart", onStart, { passive: true });
    shell.addEventListener("touchmove", onMove, { passive: true });
    shell.addEventListener("touchend", onEnd);
    shell.addEventListener("touchcancel", onEnd);
    shell.addEventListener("click", onTap, true);
    // The panel is a sibling of the shell, not inside it, so a swipe that starts on the panel
    // needs the same handlers; otherwise it only closes when the finger starts on the page.
    const panel = document.querySelector<HTMLElement>(".swipe-sidebar");
    panel?.addEventListener("touchstart", onStart, { passive: true });
    panel?.addEventListener("touchmove", onMove, { passive: true });
    panel?.addEventListener("touchend", onEnd);
    panel?.addEventListener("touchcancel", onEnd);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      panel?.removeEventListener("touchstart", onStart);
      panel?.removeEventListener("touchmove", onMove);
      panel?.removeEventListener("touchend", onEnd);
      panel?.removeEventListener("touchcancel", onEnd);
      shell.removeEventListener("touchstart", onStart);
      shell.removeEventListener("touchmove", onMove);
      shell.removeEventListener("touchend", onEnd);
      shell.removeEventListener("touchcancel", onEnd);
      shell.removeEventListener("click", onTap, true);
    };
  }, [shellEl]);

  // Theme: follow the phone's light/dark setting until she picks one, then remember her pick.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the system and saved theme */
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const saved = readStored("already-theme-v1");
    if (saved === "dark" || saved === "light") { setDark(saved === "dark"); return; }
    if (!media) return;
    setDark(media.matches);
    /* eslint-enable react-hooks/set-state-in-effect */
    const follow = (event: MediaQueryListEvent) => { if (!readStored("already-theme-v1")) setDark(event.matches); };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  // The page edge (status bar strip, overscroll area) and the browser's bar colour follow the theme in use,
  // not only the phone's system setting.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-app-theme]');
    if (!meta) {
      document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove());
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.setAttribute("data-app-theme", "yes");
      document.head.appendChild(meta);
    }
    meta.content = dark ? "#211d1d" : "#f4efea";
  }, [dark]);

  const toggleDark = () => {
    const next = !dark;
    writeStored("already-theme-v1", next ? "dark" : "light");
    setDark(next);
  };

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restoration from device storage */
  useEffect(() => {
    const restore = (data: Record<string, unknown>) => {
      const restoredLang: Lang = data.lang === "en" ? "en" : "zh";
      if (data.lang === "zh" || data.lang === "en") setLang(data.lang);
      const savedGoal = data.goal as Partial<GoalProfile> | undefined;
      if (savedGoal?.setupComplete && savedGoal.desire && savedGoal.beliefs) {
        const restoredGoal: GoalProfile = {
          ...defaultGoal,
          ...savedGoal,
          id: savedGoal.id || crypto.randomUUID(),
          intensity: Math.min(5, Math.max(1, Math.round(Number(savedGoal.intensity) || 3))),
          background: savedGoal.background || defaultGoal.background,
          spPronunciation: savedGoal.spPronunciation || "",
          canon: savedGoal.canon || defaultGoal.canon,
          responsePreferences: savedGoal.responsePreferences || defaultGoal.responsePreferences,
          acceptedSceneLedger: savedGoal.acceptedSceneLedger || defaultGoal.acceptedSceneLedger,
          memoryItems: savedGoal.memoryItems || defaultGoal.memoryItems,
          reflection: savedGoal.reflection || {},
        } as GoalProfile;
        setGoal(restoredGoal);
        setSpNameDraft(restoredGoal.spName);
        setBeliefDraft((restoredGoal.beliefs[restoredLang] || []).join("\n"));
      }
      if (data.profile) setProfile(normalizeProfile(data.profile));
      if (Array.isArray(data.storyLibrary)) setStoryLibrary((data.storyLibrary as Story[]).slice(0, 6));
      if (Array.isArray(data.goalArchive)) setGoalArchive((data.goalArchive as GoalProfile[]).slice(0, 20));
      if (Array.isArray(data.otherGoals)) setOtherGoals((data.otherGoals as Partial<GoalProfile>[]).filter((item) => item?.setupComplete && item.desire && item.beliefs && item.id).map(normalizeGoal).slice(0, MAX_GOALS));
      if (Array.isArray(data.messages)) setMessages(normalizeMessages(data.messages));
      if (typeof data.conversationId === "string") setConversationId(data.conversationId);
      if (Array.isArray(data.conversationArchive)) setConversationArchive((data.conversationArchive as Conversation[]).slice(0, 30).map((item) => ({ ...item, messages: normalizeMessages(item.messages) })));
      if (Array.isArray(data.revisions)) setRevisions((data.revisions as Revision[]).slice(0, 20));
      if (Array.isArray(data.board)) setBoard(data.board as BoardItem[]);
      if (Array.isArray(data.checkIns)) setCheckIns(data.checkIns as PracticeCheckIn[]);
    };
    let activeSession = readStored("already-session-id") || "";
    if (!activeSession) {
      try { activeSession = crypto.randomUUID(); }
      catch { activeSession = `d-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      writeStored("already-session-id", activeSession);
    }
    setSessionId(activeSession);
    try {
      const saved = readStored("already-private-state-v5");
      if (saved) restore(JSON.parse(saved));
      const savedCheckIns = readStored("already-practice-checkins-v1");
      if (savedCheckIns) setCheckIns(JSON.parse(savedCheckIns));
    } catch { /* the private space can always start fresh */ }
    finally {
      setAcknowledged(readStored("already-acknowledged-v3") === "yes");
      setHydrated(true);
      fetch("/api/space", { cache: "no-store", headers: { "x-already-session-id": activeSession } })
        .then(async (response) => ({ response, data: await response.json() as { space?: Record<string, unknown> | null } }))
        .then(({ response, data }) => {
          if (response.ok && data.space) restore(data.space);
          setSyncStatus(response.ok ? "saved" : "offline");
        })
        .catch(() => setSyncStatus("offline"))
        .finally(() => setCloudReady(true));
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refreshBetaStatus = () => fetch("/api/beta/status", { cache: "no-store", headers: { "x-already-session-id": sessionId } })
    .then((response) => response.json() as Promise<BetaStatus>)
    .then(setBetaStatus)
    .catch(() => null);

  useEffect(() => {
    if (!hydrated || sessionId === "local-beta") return;
    fetch("/api/beta/status", { cache: "no-store", headers: { "x-already-session-id": sessionId } })
      .then((response) => response.json() as Promise<BetaStatus>).then(setBetaStatus).catch(() => null);
  }, [hydrated, sessionId]);

  useEffect(() => {
    if (!hydrated || readStored("already-beta-survey-complete-v1") === "yes") return;
    let accumulated = Number(readStored("already-active-use-ms-v1") || 0);
    let lastTick = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") accumulated += Math.max(0, Math.min(6000, now - lastTick));
      lastTick = now;
      writeStored("already-active-use-ms-v1", String(accumulated));
      // The stamp is written when the survey opens (not only when it is dismissed), so a reload cannot bring it back the same day.
      const lastShownAt = Number(readStored("already-beta-survey-dismissed-v1") || 0);
      if (accumulated >= 600_000 && (!lastShownAt || now - lastShownAt >= 86_400_000)) {
        writeStored("already-beta-survey-dismissed-v1", String(now));
        setSurveyOpen(true);
      }
    };
    const resetTick = () => { lastTick = Date.now(); };
    document.addEventListener("visibilitychange", resetTick);
    const timer = window.setInterval(tick, 5000);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resetTick); };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const space = { lang, goal, goalArchive: goalArchive.slice(0, 20), otherGoals: otherGoals.slice(0, MAX_GOALS), conversationId, conversationArchive: conversationArchive.slice(0, 30), messages: messages.slice(-80), revisions: revisions.slice(0, 20), board, storyLibrary, checkIns, profile };
    writeStored("already-private-state-v5", JSON.stringify(space));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    if (!cloudReady) return;
    const timeout = window.setTimeout(() => {
      setSyncStatus("saving");
      fetch("/api/space", { method: "PUT", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId }, body: JSON.stringify({ space }) })
        .then((response) => setSyncStatus(response.ok ? "saved" : "offline"))
        .catch(() => setSyncStatus("offline"));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [hydrated, cloudReady, sessionId, lang, goal, goalArchive, otherGoals, conversationId, conversationArchive, messages, revisions, board, storyLibrary, checkIns, profile]);

  useEffect(() => {
    writeStored("already-practice-checkins-v1", JSON.stringify(checkIns));
  }, [checkIns]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), [lang]);
  const t = ui[lang];
  const currentStory = storyLibrary[Math.min(storyIndex, Math.max(0, storyLibrary.length - 1))] || emptyStory;
  const storyText = currentStory.text[lang];
  const spNameError = spNameDraft.trim() ? validateSpName(spNameDraft, lang) : "";
  const beliefCount = parseBeliefs(beliefDraft).length;
  const currentMemoryItems = goal.memoryItems[lang] || [];
  const filteredMemoryItems = currentMemoryItems
    .filter((item) => memoryFilter === "all" || item.kind === memoryFilter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const sessionMessages = messages;
  const streak = useMemo(() => practiceStreak(checkIns), [checkIns]);
  const checkedToday = checkIns.some((item) => item.date === todayKey());
  const suggestions = lang === "zh" ? ["冬日旅行", "理想的新家", "事业里程碑", "丰盛日常"] : ["Winter trip", "Dream home", "Career milestone", "Abundant everyday life"];
  const primaryNav = [
    { id: "home" as View, label: t.nav[0], icon: House },
    { id: "story" as View, label: t.nav[1], icon: BookOpenText },
    { id: "revision" as View, label: t.nav[2], icon: ArrowsClockwise },
    { id: "board" as View, label: t.nav[3], icon: ImagesSquare },
    { id: "subliminal" as View, label: t.nav[4], icon: Waveform },
  ];

  const goalFromSeed = (seed: GoalSeed, base: GoalProfile): GoalProfile => ({
    ...base,
    id: crypto.randomUUID(),
    setupComplete: true,
    status: "active",
    wishCategory: seed.wishCategory,
    intensity: seed.intensity,
    spName: seed.spName,
    desire: { ...base.desire, [lang]: seed.desire },
    background: { ...base.background, [lang]: seed.background },
    beliefs: { ...base.beliefs, [lang]: seed.beliefs.slice(0, MAX_BELIEFS) },
    journeySummary: { ...base.journeySummary, [lang]: seedJourneySummary(seed.background) },
    canon: { ...base.canon, [lang]: [seed.desire] },
    createdAt: new Date().toISOString(),
  });

  /** The whole opening is done: every desire becomes a card, and what she said about herself is kept once. */
  const finishGuidedOpening = (answers: OnboardingAnswers) => {
    const { goals: seeds, profile: seedProfile } = answersToSeeds(answers, lang);
    if (!seeds.length || !answers.name.trim()) return;
    const preset = companionStyles.find((item) => item.id === answers.style);
    const base: GoalProfile = {
      ...defaultGoal,
      companionName: answers.name.trim(),
      companionStyle: (answers.style as CompanionStyle) || "gentle",
      tone: { ...defaultGoal.tone, [lang]: answers.style === "custom" ? answers.customTone.trim() : (lang === "zh" ? preset?.zhPrompt : preset?.enPrompt) || "" },
    };
    const cards = seeds.map((seed) => goalFromSeed(seed, base));
    const [first, ...rest] = cards;
    setProfile((current) => ({ ...normalizeProfile({ ...seedProfile, neverInclude: [...current.neverInclude, ...seedProfile.neverInclude] }) }));
    setGoal(first);
    setOtherGoals(rest.slice(0, MAX_GOALS));
    setSpNameDraft(first.spName);
    setBeliefDraft(first.beliefs[lang].join("\n"));
    setMessages([]);
    setConversationId(crypto.randomUUID());
    setOnboardingStep(0);
  };

  /** One more desire added from inside the app: it keeps her name and way of being accompanied. */
  const finishExtraWish = (answers: OnboardingAnswers) => {
    const { goals: seeds, profile: seedProfile } = answersToSeeds(answers, lang);
    const seed = seeds[0];
    if (!seed) return;
    const completed = goalFromSeed(seed, goal);
    if (seedProfile.neverInclude.length) setProfile((current) => normalizeProfile({ ...current, neverInclude: [...current.neverInclude, ...seedProfile.neverInclude] }));
    setGoal(completed);
    setSpNameDraft(completed.spName);
    setBeliefDraft(completed.beliefs[lang].join("\n"));
    setMessages([]);
    setConversationId(crypto.randomUUID());
    setOnboardingStep(0);
  };

  const finishOnboarding = () => {
    const name = goal.companionName.trim();
    const desire = goal.desire[lang].trim();
    if (!name || !desire) return;
    const beliefs = parseBeliefs(beliefDraft).slice(0, MAX_BELIEFS);
    const completed: GoalProfile = {
      ...goal,
      id: crypto.randomUUID(),
      setupComplete: true,
      companionName: name,
      spName: spNameDraft.trim(),
      desire: { ...goal.desire, [lang]: desire },
      beliefs: { ...goal.beliefs, [lang]: beliefs },
      journeySummary: {
        ...goal.journeySummary,
        [lang]: goal.journeySummary[lang] || seedJourneySummary(goal.background[lang]),
      },
      canon: { ...goal.canon, [lang]: [desire] },
      createdAt: new Date().toISOString(),
    };
    setGoal(completed);
    setMessages([]);
    setConversationId(crypto.randomUUID());
    setOnboardingStep(0);
  };

  const chooseCompanionStyle = (style: Exclude<CompanionStyle, "">) => {
    const preset = companionStyles.find((item) => item.id === style);
    setGoal((current) => ({
      ...current,
      companionStyle: style,
      tone: style === "custom" ? current.tone : {
        ...current.tone,
        [lang]: lang === "zh" ? preset?.zhPrompt || "" : preset?.enPrompt || "",
      },
    }));
  };

  const addMemoryCandidates = (candidates: NonNullable<AIResponse["memoryCandidates"]>) => {
    if (!candidates.length) return;
    setGoal((current) => {
      const existing = current.memoryItems[lang] || [];
      const keys = new Set(existing.map((item) => `${item.title}|${item.detail}`.toLowerCase()));
      const additions: MemoryItem[] = candidates
        .filter((candidate) => candidate.title.trim() && candidate.detail.trim())
        .filter((candidate) => {
          const key = `${candidate.title.trim()}|${candidate.detail.trim()}`.toLowerCase();
          if (keys.has(key)) return false;
          keys.add(key);
          return true;
        })
        .map((candidate) => ({
          id: crypto.randomUUID(),
          kind: candidate.kind,
          title: candidate.title.trim().slice(0, 80),
          detail: candidate.detail.trim().slice(0, 600),
          keywords: candidate.keywords.map((item) => item.trim()).filter(Boolean).slice(0, 5),
          pinned: false,
          source: "conversation",
          createdAt: new Date().toISOString(),
        }));
      if (!additions.length) return current;
      return { ...current, memoryItems: { ...current.memoryItems, [lang]: [...additions, ...existing].slice(0, MAX_MEMORIES) } };
    });
  };

  const openMemoryEditor = (item?: MemoryItem) => {
    setMemoryEditingId(item?.id || null);
    setMemoryDraft(item ? { kind: item.kind, title: item.title, detail: item.detail, keywords: item.keywords.join(", ") } : emptyMemoryDraft);
    setMemoryEditorOpen(true);
  };

  const saveMemoryItem = () => {
    if (!memoryDraft.title.trim() || !memoryDraft.detail.trim()) return;
    setGoal((current) => {
      const items = current.memoryItems[lang] || [];
      const memory: MemoryItem = {
        id: memoryEditingId || crypto.randomUUID(),
        kind: memoryDraft.kind,
        title: memoryDraft.title.trim().slice(0, 80),
        detail: memoryDraft.detail.trim().slice(0, 600),
        keywords: memoryDraft.keywords.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 5),
        pinned: items.find((item) => item.id === memoryEditingId)?.pinned || false,
        source: "user",
        createdAt: items.find((item) => item.id === memoryEditingId)?.createdAt || new Date().toISOString(),
      };
      const next = memoryEditingId ? items.map((item) => item.id === memoryEditingId ? memory : item) : [memory, ...items];
      return { ...current, memoryItems: { ...current.memoryItems, [lang]: next.slice(0, MAX_MEMORIES) } };
    });
    setMemoryEditorOpen(false);
    setMemoryEditingId(null);
    setMemoryDraft(emptyMemoryDraft);
  };

  const deleteMemoryItem = (id: string) => setGoal((current) => ({
    ...current,
    memoryItems: { ...current.memoryItems, [lang]: current.memoryItems[lang].filter((item) => item.id !== id) },
  }));

  const toggleMemoryPin = (id: string) => setGoal((current) => ({
    ...current,
    memoryItems: { ...current.memoryItems, [lang]: current.memoryItems[lang].map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item) },
  }));

  const callCompanion = async (mode: "chat" | "revision" | "story", userInput: string, signal?: AbortSignal, recentOverride?: Message[]) => {
    const response = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-already-session-id": sessionId },
      signal,
      body: JSON.stringify({
        mode,
        lang,
        userInput,
        sessionId,
        goal: {
          wishCategory: goal.wishCategory,
          coachMode: goal.coachMode,
          companionName: goal.companionName,
          spName: goal.spName,
          spPronunciation: goal.spPronunciation,
          desire: goal.desire[lang],
          beliefs: goal.beliefs[lang],
          journeySummary: goal.journeySummary[lang],
          tone: goal.tone[lang],
          status: goal.status,
          canon: goal.canon[lang],
          responsePreferences: goal.responsePreferences[lang],
          acceptedSceneLedger: goal.acceptedSceneLedger[lang],
          memoryItems: goal.memoryItems[lang],
          profile: { about: profile.about, situation: profile.situation, people: profile.people.map((person) => ({ name: person.name, relation: person.relation })), neverInclude: profile.neverInclude },
        },
        recentMessages: (recentOverride || (mode === "chat" ? sessionMessages : messages)).filter((item) => !item.error).slice(-10),
        recentRevisions: revisions.slice(0, 4).map((item) => item.revised),
      }),
    });
    const data = await response.json() as AIResponse;
    void refreshBetaStatus();
    if (!response.ok || !data.reply) throw new Error(data.message || data.error || "AI_REQUEST_FAILED");
    setAiConnected(data.model !== "desire-preserving-safety-route" ? true : aiConnected);
    if (data.journeySummary) {
      setGoal((current) => ({
        ...current,
        journeySummary: { ...current.journeySummary, [lang]: data.journeySummary || current.journeySummary[lang] },
      }));
    }
    if (data.memoryCandidates?.length) addMemoryCandidates(data.memoryCandidates);
    if (data.beliefObserved?.trim()) {
      const belief = data.beliefObserved.trim().slice(0, 360);
      setGoal((current) => {
        const beliefs = current.beliefs[lang] || [];
        if (beliefs.some((item) => sameBelief(item, belief)) || beliefs.length >= MAX_BELIEFS) return current;
        return { ...current, beliefs: { ...current.beliefs, [lang]: [...beliefs, belief] } };
      });
      setBeliefDraft((current) => {
        const beliefs = parseBeliefs(current);
        return beliefs.some((item) => sameBelief(item, belief)) || beliefs.length >= MAX_BELIEFS ? current : [...beliefs, belief].join("\n");
      });
    }
    lastLogIdRef.current = typeof (data as { logId?: unknown }).logId === "string" ? (data as { logId: string }).logId : undefined;
    return data.reply;
  };

  const sendChat = async (text = chatInput) => {
    if (!text.trim() || isTyping) return;
    const userText = text.trim();
    if (!conversationId) setConversationId(crypto.randomUUID());
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: userText }]);
    setChatInput(""); setIsTyping(true); setAiError("");
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const reply = await callCompanion("chat", userText, controller.signal);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "ai", text: reply, logId: lastLogIdRef.current }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "ai",
        error: true,
        text: lang === "zh"
          ? `${goal.companionName || "你"}，AI 当前没有连接成功：${message}。你的这句话已经留在本机，请稍后再试。`
          : `${goal.companionName || "You"}, the AI could not connect: ${message}. Your message remains on this device. Please try again shortly.`,
      }]);
    } finally {
      requestControllerRef.current = null;
      setIsTyping(false);
    }
  };

  const regenerateReply = async (messageIndex: number) => {
    const preceding = messages.slice(0, messageIndex).reverse().find((item) => item.role === "user");
    if (!preceding || isTyping) return;
    const kept = messages.slice(0, messageIndex);
    setMessages(kept); setIsTyping(true); setAiError("");
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const reply = await callCompanion("chat", preceding.text, controller.signal, kept.slice(-10));
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "ai", text: reply, logId: lastLogIdRef.current }]);
    } catch (error) {
      if (!controller.signal.aborted) setAiError(error instanceof Error ? error.message : "AI_REQUEST_FAILED");
    } finally { requestControllerRef.current = null; setIsTyping(false); }
  };

  const editUserMessage = (messageIndex: number) => {
    setChatInput(messages[messageIndex].text);
    setMessages((items) => items.slice(0, messageIndex));
    window.setTimeout(() => chatInputRef.current?.focus(), 60);
  };

  const saveReplyAsStory = (message: Message) => {
    if (storyLibrary.length >= 6) { setView("story"); return; }
    const paragraphs = message.text.split(/\n+/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
    const title = paragraphs[0]?.slice(0, 24) || (lang === "zh" ? "来自陪伴者的故事" : "A story from my companion");
    const created: Story = {
      id: crypto.randomUUID(),
      title: { zh: lang === "zh" ? title : "新的已实现时刻", en: lang === "en" ? title : "A fulfilled moment" },
      city: { zh: "我的生活", en: "MY LIFE" }, subtitle: { zh: "", en: "" },
      text: { zh: paragraphs, en: paragraphs },
      anchor: { zh: "", en: "" }, tone: "snow",
    };
    setStoryLibrary((items) => [...items, created]);
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, saved: true } : item));
  };

  const onChatKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line; Enter that only confirms an IME candidate must not send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      sendChat();
    }
  };

  const makeRevision = async () => {
    if (!oldScene.trim() || isTyping) return;
    setIsTyping(true); setAiError("");
    try {
      setNewScene(await callCompanion("revision", oldScene.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
    } finally { setIsTyping(false); }
  };

  const makeStory = async () => {
    setStoryGenerating(true); setAiError("");
    try {
      const prompt = lang === "zh"
        ? `请以“${currentStory.title.zh}”为主题，为我写今天的专属完成态故事。地点是 ${currentStory.city.zh}，核心感受是：${currentStory.anchor.zh}`
        : `Create today's personal fulfilled-state story around “${currentStory.title.en}.” The place is ${currentStory.city.en}, and the core feeling is: ${currentStory.anchor.en}`;
      setGeneratedStory(await callCompanion("story", prompt));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
    } finally { setStoryGenerating(false); }
  };

  const acceptGeneratedStory = () => {
    if (!generatedStory.trim()) return;
    setGoal((current) => {
      const compact = generatedStory.trim().slice(0, 900);
      const existing = current.acceptedSceneLedger[lang].filter((item) => item !== compact);
      return {
        ...current,
        acceptedSceneLedger: { ...current.acceptedSceneLedger, [lang]: [compact, ...existing].slice(0, 8) },
      };
    });
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1800);
  };

  const removeBelief = (text: string) => {
    setGoal((current) => ({ ...current, beliefs: { ...current.beliefs, [lang]: (current.beliefs[lang] || []).filter((item) => item !== text) } }));
    setBeliefDraft((current) => parseBeliefs(current).filter((item) => item !== text).join("\n"));
  };

  /** Send a recorded thought into the rewrite studio; accepting the new version retires the old thought. */
  const turnBelief = (text: string) => {
    setOldScene(text);
    setNewScene("");
    setRewritingBelief(text);
    setView("revision");
  };

  const acceptRevision = () => {
    if (!newScene) return;
    if (rewritingBelief && oldScene.trim() === rewritingBelief.trim()) removeBelief(rewritingBelief);
    setRewritingBelief("");
    setRevisions((items) => [{ id: nextLocalId(), old: oldScene, revised: newScene, date: new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") }, ...items]);
    setGoal((current) => ({
      ...current,
      acceptedSceneLedger: {
        ...current.acceptedSceneLedger,
        [lang]: [newScene.slice(0, 500), ...current.acceptedSceneLedger[lang]].slice(0, 8),
      },
    }));
    setOldScene(""); setNewScene(""); setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1800);
  };

  const searchRealImages = async (suggested?: string) => {
    const query = (suggested || imageQuery).trim();
    if (!query) return;
    setImageQuery(query); setImageSearching(true); setImageSearchError(""); setImageSearchPlan(null);
    try {
      const response = await fetch(`/api/images?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("search failed");
      const data = await response.json() as { results?: SearchImage[]; plan?: ImageSearchPlan };
      const results = data.results || [];
      setImageResults(results);
      setImageSearchPlan(data.plan || null);
      if (!results.length) setImageSearchError(lang === "zh" ? "这组关键词暂时没有找到合适的真实照片，换一个更宽泛的描述试试。" : "No suitable real photos appeared for that phrase. Try a broader description.");
    } catch {
      setImageSearchError(lang === "zh" ? "授权照片搜索暂时没有连接成功，请稍后再试，或使用“用我的照片制作”。" : "Licensed-photo search could not connect. Try again later or use Create from My Photos.");
    } finally { setImageSearching(false); }
  };

  const collectSearchImage = (item: SearchImage) => {
    setBoard((items) => [{ id: nextLocalId(), title: item.title, source: item.source, image: item.image }, ...items]);
    if (item.downloadLocation) fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadLocation: item.downloadLocation }) }).catch(() => null);
  };

  const recordCheckIn = (feeling: PracticeCheckIn["feeling"]) => {
    const date = todayKey();
    const alreadyCheckedIn = checkIns.some((item) => item.date === date);
    setCheckIns((items) => [{ date, feeling }, ...items.filter((item) => item.date !== date)]);
    // One check-in event per day: tapping the dough repeatedly must not spam the beta log.
    if (!alreadyCheckedIn) void recordBetaEvent({ eventType: "practice_checkin", feedback: feeling });
  };

  const recordBetaEvent = (event: { eventType: string; mode?: string; feedback?: string; logId?: string; ratingBefore?: number; ratingAfter?: number }) => fetch("/api/beta/events", {
    method: "POST", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId },
    body: JSON.stringify({ sessionId, wishCategory: goal.wishCategory, coachMode: goal.coachMode, ...event }),
  }).catch(() => null);

  const feedbackReply = (message: Message, feedback: "helpful" | "missed") => {
    const next = message.feedback === feedback ? undefined : feedback;
    setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: next } : item));
    if (next) void recordBetaEvent({ eventType: "reply_feedback", mode: "chat", feedback: next, logId: message.logId });
  };

  const dismissSurvey = () => {
    writeStored("already-beta-survey-dismissed-v1", String(Date.now()));
    setSurveyOpen(false);
  };

  const submitSurvey = () => {
    if (!surveyBefore || !surveyNow || !surveyUnderstood || !surveyReturn || !surveyFeature) return;
    void Promise.all([
      recordBetaEvent({ eventType: "beta_survey", mode: "steadiness", ratingBefore: surveyBefore, ratingAfter: surveyNow }),
      recordBetaEvent({ eventType: "beta_survey", mode: "understood", ratingAfter: surveyUnderstood }),
      recordBetaEvent({ eventType: "beta_survey", mode: "return_intent", ratingAfter: surveyReturn }),
      recordBetaEvent({ eventType: "beta_survey", mode: "helpful_feature", feedback: surveyFeature }),
    ]);
    writeStored("already-beta-survey-complete-v1", "yes");
    setSurveyOpen(false);
  };

  const openStoryEditor = (story?: Story) => {
    if (story) {
      setStoryEditingId(story.id);
      setStoryDraft({ title: story.title[lang], city: story.city[lang], subtitle: story.subtitle[lang], scene: story.text[lang].join("\n\n"), anchor: story.anchor[lang] });
    } else {
      setStoryEditingId(null);
      setStoryDraft(emptyStoryDraft);
    }
    setStoryEditorOpen(true);
  };

  const saveStory = () => {
    if (!storyDraft.title.trim() || !storyDraft.scene.trim()) return;
    const paragraphs = storyDraft.scene.split(/\n+/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (storyEditingId) {
      setStoryLibrary((items) => items.map((story) => story.id === storyEditingId ? {
        ...story,
        title: { ...story.title, [lang]: storyDraft.title.trim() },
        city: { ...story.city, [lang]: storyDraft.city.trim() || (lang === "zh" ? "我的生活" : "MY LIFE") },
        subtitle: { ...story.subtitle, [lang]: storyDraft.subtitle.trim() },
        text: { ...story.text, [lang]: paragraphs },
        anchor: { ...story.anchor, [lang]: storyDraft.anchor.trim() },
        sample: false,
      } : story));
    } else if (storyLibrary.length < 6) {
      const fallback = lang === "zh" ? "我的新故事" : "My New Story";
      const created: Story = {
        id: crypto.randomUUID(),
        title: { zh: lang === "zh" ? storyDraft.title.trim() : fallback, en: lang === "en" ? storyDraft.title.trim() : fallback },
        city: { zh: lang === "zh" ? (storyDraft.city.trim() || "我的生活") : "MY LIFE", en: lang === "en" ? (storyDraft.city.trim() || "MY LIFE") : "MY LIFE" },
        subtitle: { zh: lang === "zh" ? storyDraft.subtitle.trim() : "", en: lang === "en" ? storyDraft.subtitle.trim() : "" },
        text: { zh: lang === "zh" ? paragraphs : [fallback], en: lang === "en" ? paragraphs : [fallback] },
        anchor: { zh: lang === "zh" ? storyDraft.anchor.trim() : "", en: lang === "en" ? storyDraft.anchor.trim() : "" },
        tone: ["nyc", "snow", "seoul"][storyLibrary.length % 3] as Story["tone"],
      };
      setStoryLibrary((items) => [...items, created]);
      setStoryIndex(storyLibrary.length);
    }
    setStoryEditorOpen(false);
    setStoryDraft(emptyStoryDraft);
  };

  const deleteStory = (id: string) => {
    const confirmed = window.confirm(lang === "zh" ? "删除这个故事吗？此操作只会删除保存在这台设备上的版本。" : "Delete this story? This removes only the copy saved on this device.");
    if (!confirmed) return;
    setStoryLibrary((items) => items.filter((story) => story.id !== id));
    setStoryIndex((index) => Math.max(0, index - 1));
    setStoryReading(false);
  };

  const saveGoalSettings = () => {
    if (spNameError || beliefCount > MAX_BELIEFS) return;
    setGoal((current) => ({
      ...current,
      spName: spNameDraft.trim(),
      beliefs: { ...current.beliefs, [lang]: parseBeliefs(beliefDraft).slice(0, MAX_BELIEFS) },
      canon: { ...current.canon, [lang]: current.desire[lang].trim() ? [current.desire[lang].trim()] : [] },
      journeySummary: {
        ...current.journeySummary,
        [lang]: seedJourneySummary([current.background[lang], current.journeySummary[lang]].filter(Boolean).join("\n\n")),
      },
    }));
    setGoalSavedPulse(true);
    window.setTimeout(() => setGoalSavedPulse(false), 1600);
  };

  const switchLanguage = () => {
    const next: Lang = lang === "zh" ? "en" : "zh";
    setGoal((current) => ({
      ...current,
      beliefs: {
        ...current.beliefs,
        [lang]: parseBeliefs(beliefDraft).slice(0, MAX_BELIEFS),
      },
    }));
    setBeliefDraft(goal.beliefs[next].join("\n"));
    setLang(next);
  };

  const exportMyData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      language: lang,
      activeGoal: goal,
      otherGoals,
      profile,
      archivedGoals: goalArchive,
      stories: storyLibrary,
      acceptedRevisions: revisions,
      visionItems: board.map(({ image, ...item }) => ({ ...item, imageStored: Boolean(image) })),
      checkIns,
      conversations: [{ id: conversationId, title: conversationTitle(messages, lang), createdAt: new Date().toISOString(), messages }, ...conversationArchive],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `already-my-space-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const archiveAndBeginAgain = () => {
    const confirmed = window.confirm(lang === "zh"
      ? "将当前愿望标记为已经发生并归档，然后开启一张新的愿望卡吗？故事、愿景和练习记录仍会保留在这台设备上。"
      : "Mark this desire as fulfilled, archive it, and begin a new desire card? Stories, visions, and practice history will remain on this device.");
    if (!confirmed) return;
    setGoalArchive((items) => [{ ...goal, status: "fulfilled" }, ...items].slice(0, 20));
    setGoal({ ...defaultGoal });
    setSpNameDraft("");
    setBeliefDraft("");
    setMessages([]);
    setOnboardingStep(0);
    setView("home");
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    if (nextView === "story") setStoryReading(false);
  };

  const beginNewConversation = () => {
    if (messages.length) {
      setConversationArchive((items) => [{
        id: conversationId || crypto.randomUUID(),
        title: conversationTitle(messages, lang),
        createdAt: new Date().toISOString(),
        messages,
        goalId: goal.id,
      }, ...items.filter((item) => item.id !== conversationId)].slice(0, 30));
    }
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setChatInput("");
    setAiError("");
    setView("home");
    setHistoryOpen(false);
    window.setTimeout(() => chatInputRef.current?.focus(), 80);
  };

  const openConversation = (conversation: Conversation) => {
    if (messages.length) {
      setConversationArchive((items) => [{ id: conversationId || crypto.randomUUID(), title: conversationTitle(messages, lang), createdAt: new Date().toISOString(), messages, goalId: goal.id }, ...items.filter((item) => item.id !== conversation.id && item.id !== conversationId)].slice(0, 30));
    } else {
      setConversationArchive((items) => items.filter((item) => item.id !== conversation.id));
    }
    const owner = conversation.goalId && conversation.goalId !== goal.id ? otherGoals.find((item) => item.id === conversation.goalId) : undefined;
    if (owner) {
      const leaving = currentGoalSnapshot();
      setOtherGoals((items) => [leaving, ...items.filter((item) => item.id !== owner.id)].slice(0, MAX_GOALS));
      setGoal(owner);
      setSpNameDraft(owner.spName);
      setBeliefDraft((owner.beliefs[lang] || []).join("\n"));
    }
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    setHistoryOpen(false);
    setView("home");
  };

  const currentGoalSnapshot = (): GoalProfile => ({
    ...goal,
    spName: spNameError ? goal.spName : spNameDraft.trim(),
    beliefs: { ...goal.beliefs, [lang]: beliefCount > MAX_BELIEFS ? goal.beliefs[lang] : parseBeliefs(beliefDraft).slice(0, MAX_BELIEFS) },
  });

  const archiveCurrentConversation = () => {
    if (!messages.length) return;
    setConversationArchive((items) => [{ id: conversationId || crypto.randomUUID(), title: conversationTitle(messages, lang), createdAt: new Date().toISOString(), messages, goalId: goal.id }, ...items.filter((item) => item.id !== conversationId)].slice(0, 30));
  };

  const showGoal = (target: GoalProfile) => {
    setGoal(target);
    setSpNameDraft(target.spName);
    setBeliefDraft((target.beliefs[lang] || []).join("\n"));
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setChatInput("");
    setAiError("");
  };

  const switchGoal = (id: string) => {
    const target = otherGoals.find((item) => item.id === id);
    if (!target) return;
    archiveCurrentConversation();
    const leaving = currentGoalSnapshot();
    setOtherGoals((items) => [leaving, ...items.filter((item) => item.id !== id)].slice(0, MAX_GOALS));
    showGoal(target);
    setView("home");
    window.setTimeout(() => chatInputRef.current?.focus(), 80);
  };

  const addGoal = () => {
    if (otherGoals.length + 1 >= MAX_GOALS) {
      window.alert(lang === "zh" ? `愿望卡已经有 ${MAX_GOALS} 张，请先删掉一些再添加。` : `You already have ${MAX_GOALS} desire cards. Please remove some before adding more.`);
      return;
    }
    archiveCurrentConversation();
    const leaving = currentGoalSnapshot();
    setOtherGoals((items) => [leaving, ...items].slice(0, MAX_GOALS));
    setGoal({ ...defaultGoal, companionName: goal.companionName, companionStyle: goal.companionStyle, coachMode: goal.coachMode, tone: goal.tone, responsePreferences: goal.responsePreferences });
    setSpNameDraft("");
    setBeliefDraft("");
    setMessages([]);
    setConversationId("");
    setOnboardingStep(1);
    setView("home");
  };

  const cancelAddGoal = () => {
    const [previous, ...rest] = otherGoals;
    if (!previous) return;
    setOtherGoals(rest);
    showGoal(previous);
    setOnboardingStep(0);
  };

  const deleteOtherGoal = (id: string) => {
    const target = otherGoals.find((item) => item.id === id);
    if (!target) return;
    const confirmed = window.confirm(lang === "zh" ? `删除愿望「${goalTitle(target, lang)}」及它的记忆吗？这不能恢复。` : `Delete the desire “${goalTitle(target, lang)}” and its memories? This cannot be undone.`);
    if (!confirmed) return;
    setOtherGoals((items) => items.filter((item) => item.id !== id));
    setConversationArchive((items) => items.filter((item) => item.goalId !== id));
  };

  const setGoalIntensity = (id: string, value: number) => {
    if (id === goal.id) setGoal((current) => ({ ...current, intensity: value }));
    else setOtherGoals((items) => items.map((item) => item.id === id ? { ...item, intensity: value } : item));
  };

  const setReflectionAnswer = (id: string, question: ReflectionQuestionId, text: string) => {
    const apply = (item: GoalProfile): GoalProfile => ({ ...item, reflection: { ...(item.reflection || {}), [question]: text } });
    if (id === goal.id) setGoal(apply);
    else setOtherGoals((items) => items.map((item) => item.id === id ? apply(item) : item));
  };

  const sortedGoals = [goal, ...otherGoals].filter((item) => item.setupComplete).sort((a, b) => b.intensity - a.intensity);

  const goalMenuItems = (<>{sortedGoals.map((item) => <button type="button" className={item.id === goal.id ? "selected" : ""} key={item.id} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); if (item.id !== goal.id) switchGoal(item.id); }}><span><strong>{goalTitle(item, lang)}</strong><small>{lang === "zh" ? wishCategories.find((entry) => entry.id === item.wishCategory)?.zh : wishCategories.find((entry) => entry.id === item.wishCategory)?.en} · {intensityLabels[lang][item.intensity - 1]}</small></span>{item.id === goal.id && <Check size={17} weight="bold"/>}</button>)}<button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); addGoal(); }}><span><strong>{lang === "zh" ? "添加愿望" : "Add a desire"}</strong><small>{lang === "zh" ? "新开一张愿望卡，各有各的记忆" : "A new card with its own memory"}</small></span><Plus size={17}/></button></>);
  const coachMenuItems = (<>{coachModes.map((coach) => <button type="button" className={goal.coachMode === coach.id ? "selected" : ""} key={coach.id} onClick={(event) => { setGoal((current) => ({ ...current, coachMode: coach.id })); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span><strong>{lang === "zh" ? coach.zh : coach.en}</strong><small>{lang === "zh" ? coach.zhDescription : coach.enDescription}</small></span>{goal.coachMode === coach.id && <Check size={17} weight="bold"/>}</button>)}</>);

  const onboardingCanContinue = [
    Boolean(goal.companionName.trim()),
    Boolean(goal.desire[lang].trim()),
    Boolean(goal.companionStyle && (goal.companionStyle !== "custom" || goal.tone[lang].trim())),
  ][onboardingStep];

  if (!hydrated) {
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}><div className="onboarding-loading" aria-label={lang === "zh" ? "正在打开 AlreaDough" : "Opening AlreaDough"}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></div></main>;
  }

  if (!acknowledged) {
    return <main className="app-shell acknowledge-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <section className="acknowledge-card">
        <span className="brand"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></span>
        {declined ? <><p className="eyebrow">YOUR CHOICE</p><h1>{lang === "zh" ? "你尚未进入 AlreaDough" : "You have not entered AlreaDough"}</h1><p>{lang === "zh" ? "这台设备没有保存同意记录。你可以关闭页面，或返回重新查看。" : "No consent record was saved on this device. You may close this page or go back to review."}</p><button className="outline-button" onClick={() => setDeclined(false)}>{lang === "zh" ? "返回" : "Go back"}</button></> : <>
          <p className="eyebrow">BEFORE YOU ENTER</p>
          <h1>{lang === "zh" ? "先确认这是一段你愿意进入的体验。" : "Confirm that this is an experience you choose to enter."}</h1>
          <p>{lang === "zh" ? "继续即表示你已阅读并同意测试版条款、隐私说明、AI 与安全说明及素材与版权规则。完整文本会一直保留在“我的空间”。内测期间，你与 AI 的对话会被保存，创始人会阅读这些对话，并结合你的大致地区（国家或城市）、设备类型和使用情况来改进 AlreaDough。我们的数据库不记录 IP 地址。" : "By continuing, you confirm that you have read and accept the beta terms, privacy notice, AI and safety notice, and content and copyright rules. They remain available in My Space. During this beta, your conversations with the AI are saved and the founder reads them, together with your approximate location (country or city), device type, and usage, to improve AlreaDough. Our database does not record IP addresses."}</p>
          <div className="acknowledge-links"><a href="/terms" target="_blank">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a href="/privacy" target="_blank">{lang === "zh" ? "隐私说明" : "Privacy"}</a><a href="/trust" target="_blank">{lang === "zh" ? "AI 与安全" : "AI & safety"}</a><a href="/copyright" target="_blank">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
          <label className="acknowledge-check"><input type="checkbox" id="acknowledge-choice"/><span>{lang === "zh" ? "我已阅读并同意以上说明。" : "I have read and agree to the notices above."}</span></label>
          <label className="acknowledge-check"><input type="checkbox" id="acknowledge-adult"/><span>{lang === "zh" ? "我已年满 18 周岁，并理解本服务面向成年人。" : "I am 18 or older and understand this service is for adults."}</span></label>
          <div className="acknowledge-actions"><button className="outline-button" onClick={() => setDeclined(true)}>{lang === "zh" ? "不同意并退出" : "Decline and exit"}</button><button className="primary" onClick={() => { const input = document.querySelector<HTMLInputElement>("#acknowledge-choice"); if (!input?.checked) { input?.focus(); return; } const adult = document.querySelector<HTMLInputElement>("#acknowledge-adult"); if (!adult?.checked) { adult?.focus(); return; } writeStored("already-acknowledged-v3", "yes"); setAcknowledged(true); }}>{lang === "zh" ? "同意并进入" : "Agree and enter"}</button></div>
          <SiteRecord lang={lang} />
        </>}
      </section>
    </main>;
  }

  if (!goal.setupComplete) {
    const adding = otherGoals.length > 0;
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <header className="onboarding-topbar"><span className="brand"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></span><div className="top-actions"><button className="language-toggle" onClick={switchLanguage}>{lang === "zh" ? "EN" : "中"}</button><button className="theme-toggle" onClick={toggleDark} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></div></header>
      <GuidedOnboarding
        key={`${lang}-${adding ? "extra" : "first"}`}
        lang={lang}
        sessionId={sessionId}
        mode={adding ? "extra" : "first"}
        initialName={goal.companionName}
        maxWishes={Math.max(1, MAX_GOALS - otherGoals.length)}
        styleOptions={companionStyles}
        syncSlot={<details className="onboarding-sync"><summary>{lang === "zh" ? "已经在另一台设备用过？用同步码继续" : "Already used it on another device? Continue with a sync code"}</summary><SyncPanel enterOnly lang={lang} sessionId={sessionId} syncStatus={syncStatus} hasLocalData={false} /></details>}
        onCancel={adding ? cancelAddGoal : undefined}
        onComplete={adding ? finishExtraWish : finishGuidedOpening}
      />
    </main>;
  }

  /** One way into My space: from the list (phone) or straight to a section. On a wide screen the first section is already open. */
  const openSpace = (section?: SpaceSection) => {
    setSettingsSection(section ?? (typeof window !== "undefined" && window.matchMedia("(min-width: 1000px)").matches ? "wishes" : null));
    setView("settings");
  };

  return (
    <>
    <aside className={`swipe-sidebar${sidebarOpen ? " open" : ""}`} aria-label={lang === "zh" ? "侧边栏" : "Sidebar"} aria-hidden={!sidebarOpen} inert={!sidebarOpen} data-theme={dark ? "dark" : "light"}>
      <header><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></header>
      <button type="button" className="swipe-new" onClick={() => { beginNewConversation(); moveSidebar(false); }}><Plus size={18}/>{lang === "zh" ? "新对话" : "New conversation"}</button>
      <nav className="swipe-nav" aria-label={t.ariaNav}>
        {primaryNav.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => { navigate(item.id); moveSidebar(false); }}><Icon size={20} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="swipe-history">
        <small>{lang === "zh" ? "对话记录" : "Conversations"}</small>
        {conversationArchive.length ? conversationArchive.map((conversation) => <button type="button" key={conversation.id} onClick={() => { openConversation(conversation); moveSidebar(false); }}><span>{conversation.title}</span><small>{new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button>) : <p>{lang === "zh" ? "完成第一段对话后，它会出现在这里。" : "Your first conversation will appear here."}</p>}
      </div>
      <footer><button type="button" onClick={() => { openSpace(); moveSidebar(false); }}><UserCircle size={24}/><span>{goal.companionName || (lang === "zh" ? "我的空间" : "My space")}</span><GearSix size={20} className="swipe-gear" aria-hidden="true"/></button></footer>
    </aside>
    <main ref={setShellEl} className={`app-shell${sidebarOpen ? " drawer-open" : ""}`} data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <aside className="app-rail">
        <button className="brand" onClick={() => navigate("home")} aria-label="AlreaDough home"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
        <button className="rail-new-chat" onClick={beginNewConversation}><Plus size={18}/><span>{lang === "zh" ? "新对话" : "New conversation"}</span></button>
        <button className="rail-history" onClick={() => setHistoryOpen(true)}><ChatCircleDots size={18}/><span>{lang === "zh" ? "对话记录" : "Conversation history"}</span><small>{conversationArchive.length}</small></button>
        <nav className="rail-nav" aria-label={t.ariaNav}>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="rail-footer">
          <button className={`rail-menu-button${view === "settings" || view === "memory" ? " active" : ""}`} onClick={() => openSpace()}><span className="rail-avatar"><UserCircle size={18}/></span><span>{goal.companionName || (lang === "zh" ? "我的空间" : "My space")}</span></button>
        </div>
      </aside>

      <section className="app-stage">
      <header className="topbar">
        <button type="button" className="topbar-menu" onClick={() => moveSidebar(true)} aria-label={lang === "zh" ? "打开侧边栏" : "Open the sidebar"}><List size={22}/></button>
        <button className="brand" onClick={() => setPetOpen((open) => !open)} aria-expanded={petOpen} aria-label={lang === "zh" ? "打开面团" : "Open the dough"}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
        <div className="top-actions"><span className={`sync-badge ${syncStatus}`}>{syncStatus === "saved" ? <CloudCheck size={15}/> : <CloudSlash size={15}/>}<span>{syncStatus === "saved" ? (lang === "zh" ? "已同步" : "Synced") : syncStatus === "saving" || syncStatus === "loading" ? (lang === "zh" ? "同步中" : "Syncing") : (lang === "zh" ? "本机模式" : "On device")}</span></span></div>
      </header>

      {historyOpen && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><aside className="history-drawer"><header><div><p className="eyebrow">{lang === "zh" ? "对话记录" : "CONVERSATION HISTORY"}</p><h2>{lang === "zh" ? "回到之前的片段" : "Return to an earlier moment"}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><button className="history-new" onClick={beginNewConversation}><Plus size={17}/>{lang === "zh" ? "开始新对话" : "Start a new conversation"}</button><div className="history-list">{conversationArchive.length ? conversationArchive.map((conversation) => <article key={conversation.id}><button onClick={() => openConversation(conversation)}><strong>{conversation.title}</strong><small>{new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button><button aria-label={lang === "zh" ? "删除对话" : "Delete conversation"} onClick={() => setConversationArchive((items) => items.filter((item) => item.id !== conversation.id))}><Trash size={16}/></button></article>) : <p>{lang === "zh" ? "完成第一段对话后，它会安全地出现在这里。" : "Your first completed conversation will appear here."}</p>}</div></aside></div>}

      {view === "home" && <section className={`home-ai-view ${sessionMessages.length ? "has-conversation" : "is-empty"}`}>
        {sessionMessages.length === 0 && <div className="home-ai-welcome">
          <p className="eyebrow" suppressHydrationWarning>{dateLabel}</p>
          <h1>{lang === "zh" ? `欢迎回来，${goal.companionName}` : `Welcome back, ${goal.companionName}`}</h1>
          <p>{t.hero}</p>
        </div>}
        <div className="home-ai-thread">
          {sessionMessages.map((message, index) => <div className={`message-group ${message.role}`} key={message.id}><div className={`message ${message.role}`}>{message.text}</div><div className="message-actions">
            <button onClick={() => navigator.clipboard.writeText(message.text)} aria-label={lang === "zh" ? "复制" : "Copy"}><Copy size={15}/><span>{lang === "zh" ? "复制" : "Copy"}</span></button>
            {message.role === "user" ? <button onClick={() => editUserMessage(index)}><NotePencil size={15}/><span>{lang === "zh" ? "编辑并重发" : "Edit and resend"}</span></button> : <><button onClick={() => regenerateReply(index)}><ArrowClockwise size={15}/><span>{lang === "zh" ? "重新回答" : "Regenerate"}</span></button><button onClick={() => saveReplyAsStory(message)}><BookmarkSimple size={15}/><span>{message.saved ? (lang === "zh" ? "已保存" : "Saved") : (lang === "zh" ? "存为故事" : "Save as story")}</span></button><button onClick={() => { setOldScene(message.text); setView("revision"); }}><ArrowsClockwise size={15}/><span>{lang === "zh" ? "带入重写" : "Take to revision"}</span></button><button onClick={() => { setGoal((current) => ({ ...current, acceptedSceneLedger: { ...current.acceptedSceneLedger, [lang]: [message.text.slice(0, 500), ...current.acceptedSceneLedger[lang]].slice(0, 8) } })); setView("subliminal"); }}><Waveform size={15}/><span>{lang === "zh" ? "带入声场" : "Take to Dreamscape"}</span></button><button className={message.feedback === "helpful" ? "selected" : ""} onClick={() => feedbackReply(message, "helpful")}><ThumbsUp size={15}/><span>{lang === "zh" ? "懂我" : "Helpful"}</span></button><button className={message.feedback === "missed" ? "selected" : ""} onClick={() => feedbackReply(message, "missed")}><ThumbsDown size={15}/><span>{lang === "zh" ? "不适合" : "Not for me"}</span></button><ReportButton lang={lang} onClick={() => setReportTarget({ excerpt: message.text })}/></>}
          </div></div>)}
          {isTyping && <div className="message ai typing"><i/><i/><i/></div>}
        </div>
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        <div className={`composer home-composer ${sessionMessages.length ? "is-active" : "is-empty"}`}>{showJump && sessionMessages.length > 0 && <button type="button" className="scroll-bottom-button" onClick={() => scrollChatToBottom(true)} aria-label={lang === "zh" ? "回到最新消息" : "Jump to the latest message"}><ArrowDown size={18} weight="bold"/></button>}<details className="coach-model-menu composer-plus" onToggle={(event) => { if (!event.currentTarget.open) setPlusSection(null); }}><summary aria-label={lang === "zh" ? "更多选项" : "More options"}><Plus size={20}/></summary><div className="coach-model-popover plus-sections"><button type="button" className={`plus-section-head${plusSection === "goal" ? " open" : ""}`} aria-expanded={plusSection === "goal"} onClick={() => setPlusSection((current) => current === "goal" ? null : "goal")}><span><small>{lang === "zh" ? "现在聊哪个愿望" : "Which desire now"}</small><strong>{goalTitle(goal, lang)}</strong></span><CaretDown size={16}/></button>{plusSection === "goal" && goalMenuItems}<button type="button" className={`plus-section-head${plusSection === "coach" ? " open" : ""}`} aria-expanded={plusSection === "coach"} onClick={() => setPlusSection((current) => current === "coach" ? null : "coach")}><span><small>{lang === "zh" ? "引导方式" : "Guidance method"}</small><strong>{lang === "zh" ? coachModes.find((coach) => coach.id === goal.coachMode)?.zh : coachModes.find((coach) => coach.id === goal.coachMode)?.en}</strong></span><CaretDown size={16}/></button>{plusSection === "coach" && coachMenuItems}</div></details><div className="composer-main"><textarea ref={chatInputRef} rows={1} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={onChatKey} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder}/></div><button className="composer-send" onClick={() => isTyping ? requestControllerRef.current?.abort() : sendChat()} aria-label={isTyping ? (lang === "zh" ? "停止生成" : "Stop generating") : t.send}>{isTyping ? <StopCircle size={20}/> : <><span className="send-up">↑</span><ArrowElbowDownLeft className="send-return" size={20}/></>}</button><AiNote lang={lang} /></div>
      </section>}

      {view === "subliminal" && !studioOpen && <Dreamscape
        lang={lang}
        sessionId={sessionId}
        desire={goal.desire[lang]}
        story={(() => { const mine = storyLibrary.find((item) => !item.sample && item.text[lang].length > 0) || storyLibrary.find((item) => item.text[lang].length > 0); return mine ? { title: mine.title[lang], paragraphs: mine.text[lang] } : null; })()}
        onCheckIn={recordCheckIn}
        makeAffirmations={async () => {
          const ask = lang === "zh"
            ? "请为我写 6 句睡前肯定语。每句 20 个字以内，第一人称，现在时，当作已经成立的事。只用我愿望里已有的内容，不添加我没提过的细节。每行一句，没有序号，没有引号，没有别的话。"
            : "Write me 6 bedtime affirmations. Each under 15 words, first person, present tense, as already true. Use only what is in my desire and add no details I never gave. One per line, no numbers, no quotes, nothing else.";
          const reply = await callCompanion("chat", ask, undefined, []);
          return (reply || "").split(/\r?\n/).map((line) => line.replace(/^[\s\-*\d.、)）]+/, "").trim()).filter(Boolean);
        }}
        onOpenStudio={() => setStudioOpen(true)}
      />}
      {view === "subliminal" && studioOpen && <>
        <button type="button" className="dream-studio-back" onClick={() => setStudioOpen(false)}>{lang === "zh" ? "返回入梦声场" : "Back to Dreamscape"}</button>
        <SubliminalStudio lang={lang} desire={goal.desire[lang]} focusText={goal.acceptedSceneLedger[lang][0]} checkIns={checkIns} onCheckIn={recordCheckIn}/>
      </>}

      {view === "memory" && <section className="full-view memory-view">
        <div className="memory-heading"><div className="view-heading"><p className="eyebrow">{lang === "zh" ? "记忆库" : "ALREADOUGH MEMORY"}</p><h1>{lang === "zh" ? "被记住，也由你掌控" : "Remembered, on your terms"}</h1><p>{lang === "zh" ? "AlreaDough 会从对话中提炼长期有用的内容，每次只取回与眼前话题相关的少量记忆。你可以修改、置顶或删除任何一条。" : "AlreaDough distills durable context from conversations and retrieves only a small relevant set for each message. You can edit, pin, or delete anything."}</p></div>{currentMemoryItems.length > 0 && <button className="primary memory-add" onClick={() => openMemoryEditor()}><Plus size={18}/>{lang === "zh" ? "添加记忆" : "Add memory"}</button>}</div>
        <div className="memory-overview"><article><span>{lang === "zh" ? "当前愿望卡" : "ACTIVE DESIRE CARD"}</span><p>{goal.desire[lang]}</p><small>{lang === "zh" ? "每次对话都会携带" : "Included in every conversation"}</small></article><article><span>{goal.wishCategory === "relationship" ? (lang === "zh" ? "显化对象" : "MANIFESTATION PERSON") : (lang === "zh" ? "愿望焦点" : "DESIRE FOCUS")}</span><p>{goal.spName || (lang === "zh" ? "未设置" : "Not set")}</p><small>{lang === "zh" ? `${goal.memoryItems[lang].length} 条长期记忆` : `${goal.memoryItems[lang].length} durable memories`}</small></article></div>
        <div className="memory-filter" role="group" aria-label={lang === "zh" ? "筛选记忆" : "Filter memories"}><button className={memoryFilter === "all" ? "active" : ""} onClick={() => setMemoryFilter("all")}>{lang === "zh" ? "全部" : "All"}<small>{goal.memoryItems[lang].length}</small></button>{memoryKinds.map((kind) => <button key={kind.id} className={memoryFilter === kind.id ? "active" : ""} onClick={() => setMemoryFilter(kind.id)}>{lang === "zh" ? kind.zh : kind.en}<small>{goal.memoryItems[lang].filter((item) => item.kind === kind.id).length}</small></button>)}</div>
        <div className="memory-items">
          {filteredMemoryItems.length ? filteredMemoryItems.map((item) => <article key={item.id} className={item.pinned ? "pinned" : ""}><header><span>{lang === "zh" ? memoryKinds.find((kind) => kind.id === item.kind)?.zh : memoryKinds.find((kind) => kind.id === item.kind)?.en}</span><div><button onClick={() => toggleMemoryPin(item.id)} aria-label={item.pinned ? (lang === "zh" ? "取消置顶" : "Unpin") : (lang === "zh" ? "置顶" : "Pin")}>{item.pinned ? "●" : "○"}</button><button onClick={() => openMemoryEditor(item)} aria-label={lang === "zh" ? "编辑记忆" : "Edit memory"}><PencilSimple size={16}/></button><button onClick={() => deleteMemoryItem(item.id)} aria-label={lang === "zh" ? "删除记忆" : "Delete memory"}><Trash size={16}/></button></div></header><h3>{item.title}</h3><p>{item.detail}</p>{item.keywords.length > 0 && <footer>{item.keywords.map((keyword) => <small key={keyword}>{keyword}</small>)}</footer>}</article>) : currentMemoryItems.length === 0 ? <div className="memory-empty"><Brain size={28}/><h3>{lang === "zh" ? "这里会慢慢长出你的上下文" : "Your context will grow here"}</h3><p>{lang === "zh" ? "继续聊天，AlreaDough 会建议值得记住的内容；你也可以亲手添加第一条。" : "Keep talking and AlreaDough will suggest durable memories, or add the first one yourself."}</p><button className="outline-button" onClick={() => openMemoryEditor()}>{lang === "zh" ? "添加第一条记忆" : "Add the first memory"}</button></div> : <div className="memory-empty memory-filter-empty"><Brain size={28}/><h3>{lang === "zh" ? "这一类还没有记忆" : "No memories in this category yet"}</h3><p>{lang === "zh" ? "换一个分类，或回到全部记忆。" : "Choose another category or return to all memories."}</p><button className="outline-button" onClick={() => setMemoryFilter("all")}>{lang === "zh" ? "查看全部记忆" : "View all memories"}</button></div>}
        </div>
        <div className="memory-library-grid">
          <article className="belief-card"><header><strong>{lang === "zh" ? "想换掉的念头" : "THOUGHTS TO TURN AROUND"}</strong><small>{goal.beliefs[lang].length}</small></header>{goal.beliefs[lang].length ? <details className="belief-turn-list"><summary>{lang === "zh" ? "展开，选一句来转念" : "Open and pick one to turn around"}</summary><ul>{goal.beliefs[lang].map((item, index) => <li key={`${index}-${item}`}><span>{item}</span><span className="belief-actions"><button type="button" onClick={() => turnBelief(item)}>{lang === "zh" ? "转念" : "Turn it"}</button><button type="button" aria-label={lang === "zh" ? "删除这一条" : "Delete this one"} onClick={() => removeBelief(item)}>{lang === "zh" ? "删除" : "Delete"}</button></span></li>)}</ul></details> : <p>{lang === "zh" ? "还没有想换掉的念头" : "Nothing to turn around yet"}</p>}</article>
          <article><header><strong>{lang === "zh" ? "回应偏好" : "RESPONSE PREFERENCES"}</strong><small>{goal.responsePreferences[lang].length}</small></header><ul>{goal.responsePreferences[lang].map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></article>
          <article><header><strong>{lang === "zh" ? "已接纳的新场景" : "ACCEPTED SCENES"}</strong><small>{goal.acceptedSceneLedger[lang].length}</small></header>{goal.acceptedSceneLedger[lang].length ? <ul>{goal.acceptedSceneLedger[lang].map((item, index) => <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>)}</ul> : <p>{lang === "zh" ? "在故事或重写中接纳的场景会出现在这里。" : "Scenes accepted from Stories or Revision will appear here."}</p>}</article>
          <article className="journey-memory"><header><strong>{lang === "zh" ? "旅程摘要" : "JOURNEY SUMMARY"}</strong><small>{lang === "zh" ? "自动压缩" : "AUTO-COMPRESSED"}</small></header><p>{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成一段简短摘要。" : "A short summary will form here after conversations begin.")}</p></article>
        </div>
        <div className="memory-actions"><button className="outline-button" onClick={() => openSpace("wishes")}>{lang === "zh" ? "编辑愿望与偏好" : "Edit desire and preferences"}</button><button className="primary" onClick={() => setView("home")}>{lang === "zh" ? "回到对话" : "Back to chat"}</button></div>
        {memoryEditorOpen && <div className="memory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMemoryEditorOpen(false); }}><section className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-editor-title"><header><div><p className="eyebrow">{lang === "zh" ? "由你决定保留什么" : "YOU CHOOSE WHAT STAYS"}</p><h2 id="memory-editor-title">{memoryEditingId ? (lang === "zh" ? "编辑这条记忆" : "Edit this memory") : (lang === "zh" ? "添加一条记忆" : "Add a memory")}</h2></div><button onClick={() => setMemoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><label><span>{lang === "zh" ? "类型" : "TYPE"}</span><select value={memoryDraft.kind} onChange={(event) => setMemoryDraft((current) => ({ ...current, kind: event.target.value as MemoryKind }))}>{memoryKinds.map((kind) => <option key={kind.id} value={kind.id}>{lang === "zh" ? kind.zh : kind.en}</option>)}</select></label><label><span>{lang === "zh" ? "标题" : "TITLE"}</span><input maxLength={80} value={memoryDraft.title} onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))} placeholder={lang === "zh" ? "例如：我喜欢先被理解" : "For example: Meet the feeling first"}/></label><label><span>{lang === "zh" ? "具体内容" : "DETAIL"}</span><textarea maxLength={600} value={memoryDraft.detail} onChange={(event) => setMemoryDraft((current) => ({ ...current, detail: event.target.value }))} placeholder={lang === "zh" ? "写下以后对话中仍然有用的语境。" : "Write the context that will still matter later."}/></label><label><span>{lang === "zh" ? "检索词" : "KEYWORDS"}</span><input value={memoryDraft.keywords} onChange={(event) => setMemoryDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder={lang === "zh" ? "用逗号分隔，最多 5 个" : "Comma-separated, up to 5"}/></label><footer><button className="outline-button" onClick={() => setMemoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button className="primary" disabled={!memoryDraft.title.trim() || !memoryDraft.detail.trim()} onClick={saveMemoryItem}>{lang === "zh" ? "保存到记忆库" : "Save to memory"}</button></footer></section></div>}
      </section>}


      {view === "story" && !storyReading && <section className="full-view story-library-view">
        <div className="view-heading"><p className="eyebrow">{lang === "zh" ? "你的故事库" : "YOUR STORY LIBRARY"}</p><h1>{lang === "zh" ? "写下已经发生的生活" : "Write the life already lived"}</h1><p>{lang === "zh" ? "每个故事都是一个可以反复进入、随时编辑的完成态场景。" : "Each story is a fulfilled scene you can revisit and edit at any time."}</p></div>
        <div className="story-library-meta"><span>{storyLibrary.length} / 6</span><small>{lang === "zh" ? "最多保存 6 个故事" : "Up to 6 saved stories"}</small></div>
        <div className="story-library-grid">
          {storyLibrary.map((story, index) => <article className="story-library-card" key={story.id}>
            <button className={`story-card-cover ${story.tone}`} onClick={() => { setStoryIndex(index); setStoryReading(true); setGeneratedStory(""); }}><span>{story.city[lang]}</span><strong>{story.title[lang]}</strong></button>
            <div><p>{story.subtitle[lang] || story.text[lang][0]}</p><div className="story-card-actions"><button onClick={() => openStoryEditor(story)}><PencilSimple size={17}/>{lang === "zh" ? "编辑" : "Edit"}</button><button onClick={() => deleteStory(story.id)}><Trash size={17}/>{lang === "zh" ? "删除" : "Delete"}</button></div></div>
          </article>)}
          {storyLibrary.length < 6 && <button className="story-add-card" onClick={() => openStoryEditor()}><span><Plus size={28}/></span><strong>{lang === "zh" ? "添加新故事" : "Add a story"}</strong><small>{lang === "zh" ? "地点、场景和感受都由你决定" : "Choose the place, scene, and feeling"}</small></button>}
        </div>
      </section>}

      {view === "story" && storyReading && <section className="full-view story-view">
        <div className={`story-cover ${currentStory.tone}`}><p>{currentStory.city[lang]}</p><h1>{currentStory.title[lang]}</h1><span>{currentStory.subtitle[lang]}</span></div>
        <article className="story-body">{storyText.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}{currentStory.anchor[lang] && <blockquote>{currentStory.anchor[lang]}</blockquote>}</article>
        <div className="personal-story-action story-reader-actions"><button onClick={() => setStoryReading(false)}>{lang === "zh" ? "返回故事库" : "Back to stories"}</button><button onClick={() => openStoryEditor(currentStory)}><PencilSimple size={17}/>{lang === "zh" ? "编辑故事" : "Edit story"}</button><button className="primary" onClick={makeStory} disabled={storyGenerating}>{storyGenerating ? t.generating : t.generateStory}</button></div>
        {aiError && <div className="ai-notice story-ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {generatedStory && <article className="generated-story"><span>AI PERSONAL STORY</span>{generatedStory.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}<button className="outline-button" onClick={acceptGeneratedStory}>{savedPulse ? (lang === "zh" ? "已收进长期故事 ✓" : "Saved to your story memory ✓") : (lang === "zh" ? "收进我的长期故事" : "Keep in my story memory")}</button></article>}
        {storyLibrary.length > 1 && <div className="story-controls"><button onClick={() => { setStoryIndex((storyIndex - 1 + storyLibrary.length) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.previous}</button><button className="dark-button" onClick={() => { setStoryIndex((storyIndex + 1) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.next}</button></div>}
      </section>}

      {view === "revision" && <section className="full-view revision-view">
        <div className="view-heading"><p className="eyebrow">{lang === "zh" ? "重写这一刻" : "REVISION STUDIO"}</p><h1>{t.revisionTitle}</h1><p>{t.revisionCopy}</p></div>
        <label className="field-label">{t.oldLabel}</label>
        <textarea value={oldScene} onChange={(e) => setOldScene(e.target.value)} placeholder={t.oldPlaceholder} />
        <button className="primary" onClick={makeRevision} disabled={isTyping}>{isTyping ? t.generating : t.makeRevision}</button>
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {newScene && <div className="revised-card"><span>{t.chosen}</span><p>{newScene}</p><button onClick={acceptRevision}>{savedPulse ? t.accepted : t.acceptStory}</button></div>}
        {revisions.length > 0 && <div className="revision-history"><p className="eyebrow">{t.history}</p>{revisions.slice(0, 4).map((item) => <div key={item.id}><span>{item.date}</span><p>{item.revised}</p></div>)}</div>}
      </section>}

      {view === "board" && <section className="full-view board-view">
        <div className="view-heading"><p className="eyebrow">{lang === "zh" ? "我的愿景" : "VISION BOARD"}</p><h1>{t.boardTitle}</h1><p>{t.boardCopy}</p></div>
        <div className="vision-mode-tabs"><button className={boardMode === "licensed" ? "active" : ""} onClick={() => setBoardMode("licensed")}>{lang === "zh" ? "寻梦灵感" : "Discover Dreamscapes"}</button><button className={boardMode === "mine" ? "active" : ""} onClick={() => setBoardMode("mine")}>{lang === "zh" ? "编织我的愿景" : "Weave My Vision"}</button></div>
        {boardMode === "licensed" ? <>
        <div className="real-search">
          <div className="search-title"><span>✦</span><div><strong>{t.realPhotos}</strong><small>{t.photoCopy}</small></div></div>
          <div className="search-bar"><input value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchRealImages(); }} placeholder={t.searchPlaceholder} aria-label={t.realPhotos}/><button onClick={() => searchRealImages()}>{imageSearching ? t.searching : t.search}</button></div>
          <div className="search-suggestions">{suggestions.map((term) => <button key={term} onClick={() => searchRealImages(term)}>{term}</button>)}</div>
          {imageSearchPlan && <div className="image-search-plan"><small>{lang === "zh" ? "已拆分搜索" : "Searched separately"}</small><div>{imageSearchPlan.queries.map((query) => <span key={query}>{query}</span>)}</div></div>}
          {imageSearchError && <p className="search-error">{imageSearchError}</p>}
        </div>
        {imageResults.length > 0 && <div className="search-results">{imageResults.map((item) => <article key={item.source}><img src={item.image} alt={item.title}/><div><strong>{item.title}</strong><small>{item.credit} · {item.license}</small><button onClick={() => collectSearchImage(item)}>{t.collect}</button></div></article>)}</div>}
        <div className="moodboard">{board.map((item, index) => <article className={`board-card card-${index % 4}`} key={item.id}>{item.image ? <img src={item.image} alt={item.title}/> : <div className="board-placeholder">✦</div>}<div><h3>{item.title}</h3>{/^https?:/.test(item.source) ? <a href={item.source} target="_blank" rel="noreferrer">{t.source}</a> : <span>{item.source}</span>}<button onClick={() => setBoard((items) => items.filter((entry) => entry.id !== item.id))} aria-label={`${lang === "zh" ? "删除" : "Delete "}${item.title}`}>×</button></div></article>)}</div>
        </> : <VisionCanvasStudio lang={lang}/>} 
      </section>}

      {view === "settings" && (() => {
        const shown: SpaceSection = settingsSection ?? "wishes";
        const zhText = lang === "zh";
        const titles: Record<SpaceSection, string> = { wishes: zhText ? "我的愿望" : "My desires", about: zhText ? "关于我" : "About me", companion: zhText ? "陪伴方式" : "Companion style", reflect: zhText ? "自我觉察" : "Self-reflection", memory: zhText ? "背景与念头" : "Background and thoughts", look: zhText ? "外观与语言" : "Look and language", voice: zhText ? "我的声音" : "My voice", sync: zhText ? "同步与数据" : "Sync and data", help: zhText ? "帮助与条款" : "Help and terms" };
        return <section className="full-view settings-view space">
          <div className={`space-layout${settingsSection ? " has-detail" : ""}`}>
            <SpaceNav
              title={zhText ? "我的空间" : "My space"}
              intro={zhText ? "愿望、记忆和设置都在这里。" : "Your desires, memory and settings live here."}
              active={settingsSection}
              onSelect={(id) => id === "library" ? setView("memory") : setSettingsSection(id as SpaceSection)}
              groups={[
                { title: zhText ? "我" : "Me", rows: [
                  { id: "wishes", label: titles.wishes, value: String(sortedGoals.length) },
                  { id: "about", label: titles.about },
                  { id: "companion", label: titles.companion },
                  { id: "reflect", label: titles.reflect },
                ] },
                { title: zhText ? "记忆" : "Memory", rows: [
                  { id: "library", label: zhText ? "记忆库" : "Memory library", value: String(currentMemoryItems.length) },
                  { id: "memory", label: titles.memory },
                ] },
                { title: zhText ? "应用" : "App", rows: [
                  { id: "look", label: titles.look, value: dark ? (zhText ? "深色" : "Dark") : (zhText ? "浅色" : "Light") },
                  { id: "voice", label: titles.voice },
                  { id: "sync", label: titles.sync },
                  { id: "help", label: titles.help },
                ] },
              ]}
            />
            <div className="space-detail">
              <header className="space-detail-head"><button type="button" className="space-back" onClick={() => setSettingsSection(null)} aria-label={zhText ? "返回我的空间" : "Back to My space"}><ArrowLeft size={22}/></button><h2>{titles[shown]}</h2></header>
              {shown === "wishes" && <div className="settings-section">
                <div className="goal-status"><label><span>{t.activeGoal}</span><select value={goal.status} onChange={(event) => setGoal((current) => ({ ...current, status: event.target.value as GoalStatus }))}><option value="active">{lang === "zh" ? "正在练习" : "Active"}</option><option value="embodiment">{lang === "zh" ? "稳定进入" : "Embodying"}</option><option value="fulfilled">{lang === "zh" ? "已经发生" : "Already happened"}</option><option value="paused">{lang === "zh" ? "暂时休息" : "Paused"}</option></select></label><small>{lang === "zh" ? "每次对话只加载当前选中的这一张愿望卡" : "Only the selected desire card is loaded into each conversation"}</small></div>
                <div className="setting-card goal-list-card"><label>{lang === "zh" ? "我的愿望" : "MY DESIRES"}</label><p>{lang === "zh" ? "按想要的程度排序。每个愿望有自己的记忆和对话。" : "Sorted by how much you want each one. Each desire has its own memory and conversations."}</p>{sortedGoals.map((item) => <div key={item.id} className={`goal-row ${item.id === goal.id ? "current" : ""}`}><div><strong>{goalTitle(item, lang)}</strong><small>{lang === "zh" ? wishCategories.find((entry) => entry.id === item.wishCategory)?.zh : wishCategories.find((entry) => entry.id === item.wishCategory)?.en}{item.id === goal.id ? (lang === "zh" ? " · 当前" : " · Current") : ""}</small></div><select aria-label={lang === "zh" ? "想要的程度" : "How much you want it"} value={item.intensity} onChange={(event) => setGoalIntensity(item.id, Number(event.target.value))}>{intensityLabels[lang].map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>{item.id !== goal.id && <><button className="outline-button" onClick={() => switchGoal(item.id)}>{lang === "zh" ? "切换" : "Open"}</button><button className="outline-button" aria-label={lang === "zh" ? "删除愿望" : "Delete desire"} onClick={() => deleteOtherGoal(item.id)}><Trash size={16}/></button></>}</div>)}<button className="outline-button" onClick={addGoal}><Plus size={16}/> {lang === "zh" ? "添加愿望" : "Add a desire"}</button></div>
                <div className="setting-card editable-card"><label>{lang === "zh" ? "我喜欢的称呼" : "WHAT ALREADOUGH CALLS ME"}</label><input value={goal.companionName} onChange={(event) => setGoal((current) => ({ ...current, companionName: event.target.value }))}/></div>
                <div className="setting-card editable-card"><label>{lang === "zh" ? "愿望方向" : "DESIRE CATEGORY"}</label><div className="option-card-grid category-grid">{wishCategories.map((category) => <button key={category.id} className={goal.wishCategory === category.id ? "selected" : ""} onClick={() => setGoal((current) => ({ ...current, wishCategory: category.id }))}><strong>{lang === "zh" ? category.zh : category.en}</strong><small>{lang === "zh" ? category.zhDescription : category.enDescription}</small></button>)}</div></div>
                <div className="setting-card editable-card sp-name-card"><label>{goal.wishCategory === "relationship" ? (lang === "zh" ? "显化对象" : "MANIFESTATION PERSON") : (lang === "zh" ? "愿望焦点" : "DESIRE FOCUS")}</label><input value={spNameDraft} maxLength={24} aria-invalid={Boolean(spNameError)} onChange={(event) => setSpNameDraft(event.target.value)}/>{spNameError && <p className="field-error" role="alert">{spNameError}</p>}</div>
                <div className="setting-card editable-card"><label>{t.coreWish}</label><textarea value={goal.desire[lang]} onChange={(event) => setGoal((current) => ({ ...current, desire: { ...current.desire, [lang]: event.target.value } }))}/></div>
                <div className="setting-card goal-lifecycle-card"><span>{lang === "zh" ? "愿望生命周期" : "DESIRE LIFECYCLE"}</span><p>{lang === "zh" ? "愿望完成后，把它留在历程中，再开启一张新的愿望卡。" : "When this desire is complete, keep it in your journey and open a fresh desire card."}</p><button className="outline-button" onClick={archiveAndBeginAgain}>{lang === "zh" ? "完成并归档，开启新愿望" : "Complete, archive, and begin again"}</button></div>
                {goalArchive.length > 0 && <div className="setting-card archive-card"><span>{lang === "zh" ? `已经发生的愿望 · ${goalArchive.length}` : `FULFILLED DESIRES · ${goalArchive.length}`}</span>{goalArchive.slice(0, 5).map((item) => <article key={item.id}><strong>{item.desire[lang] || item.desire[lang === "zh" ? "en" : "zh"]}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : ""}</small></article>)}</div>}
              </div>}
              {shown === "about" && <ProfilePanel lang={lang} profile={profile} onChange={(next) => setProfile(normalizeProfile(next))} />}
              {shown === "companion" && <div className="settings-section">
                <div className="setting-card editable-card"><label>{t.tone}</label><div className="option-card-grid companion-style-grid">{companionStyles.map((style) => <button key={style.id} className={goal.companionStyle === style.id ? "selected" : ""} onClick={() => chooseCompanionStyle(style.id)}><strong>{lang === "zh" ? style.zh : style.en}</strong><small>{lang === "zh" ? style.zhDescription : style.enDescription}</small></button>)}</div>{goal.companionStyle === "custom" && <textarea value={goal.tone[lang]} onChange={(event) => setGoal((current) => ({ ...current, tone: { ...current.tone, [lang]: event.target.value } }))}/>}</div>
                <div className="setting-card editable-card"><label>{lang === "zh" ? "引导方式" : "GUIDANCE METHOD"}</label><div className="option-card-grid coach-settings-grid">{coachModes.map((coach) => <button key={coach.id} className={goal.coachMode === coach.id ? "selected" : ""} onClick={() => setGoal((current) => ({ ...current, coachMode: coach.id }))}><strong>{lang === "zh" ? coach.zh : coach.en}</strong><small>{lang === "zh" ? coach.zhDescription : coach.enDescription}</small></button>)}</div></div>
                <div className="setting-card pet-card"><span>{lang === "zh" ? "桌面小面团（Mac）" : "DESKTOP DOUGH (MAC)"}</span><p>{lang === "zh" ? "让面团住在你的电脑桌面上：它会呼吸，轻点会弹一下，拉一拉会拉长再弹回去，连点三下会开一场醒发派对。没有打卡，也不打扰你。" : "Let the dough live on your Mac desktop. It breathes, bounces when you tap it, stretches when you pull it, and throws a proofing party on three quick taps. No check-ins, no interruptions."}</p><a className="primary pet-download" href="/downloads/AlreaDough-Pet-mac.zip" download>{lang === "zh" ? "下载 Mac 桌宠" : "Download for Mac"}</a><ol><li>{lang === "zh" ? "解压后，把「AlreaDough Pet」拖进「应用程序」文件夹。" : "Unzip it and drag “AlreaDough Pet” into your Applications folder."}</li><li>{lang === "zh" ? "第一次打开如果提示无法验证开发者：到「系统设置 → 隐私与安全性」，点「仍要打开」。" : "If macOS says it cannot verify the developer: System Settings → Privacy & Security → Open Anyway."}</li><li>{lang === "zh" ? "拉一拉面团会拉长；拉得够远它就会挣脱，跟着你走，放在屏幕任何地方都行。右键可以换大小、放回右下角或退出。" : "Pull the dough and it stretches; pull far enough and it breaks free and follows you, so you can leave it anywhere on screen. Right-click for size, to send it back to the corner, or to quit."}</li></ol><small>{lang === "zh" ? "仅限 Mac 电脑，手机上请直接使用 AlreaDough。" : "Mac only. On a phone, just use AlreaDough."}</small></div>
              </div>}
              {shown === "reflect" && <ReflectionPanel lang={lang} currentGoalId={goal.id} goals={sortedGoals.map((item) => ({ id: item.id, title: goalTitle(item, lang), reflection: item.reflection || {} }))} onChange={setReflectionAnswer} />}
              {shown === "memory" && <div className="settings-section">
                <div className="setting-card editable-card"><label>{lang === "zh" ? "我的背景与处境" : "MY CONTEXT"}</label><textarea maxLength={MAX_BACKGROUND} value={goal.background[lang]} onChange={(event) => setGoal((current) => ({ ...current, background: { ...current.background, [lang]: event.target.value } }))}/><div className="field-counter"><span>{goal.background[lang].length} / {MAX_BACKGROUND}</span></div></div>
                <div className="setting-card editable-card"><label>{lang === "zh" ? "想换掉的念头" : "THOUGHTS TO TURN AROUND"}</label><textarea aria-invalid={beliefCount > MAX_BELIEFS} value={beliefDraft} onChange={(event) => setBeliefDraft(event.target.value)} placeholder={lang === "zh" ? `每行写一个，最多 ${MAX_BELIEFS} 条` : `One per line, up to ${MAX_BELIEFS}`}/><div className={`field-counter ${beliefCount > MAX_BELIEFS ? "over" : ""}`}><span>{beliefCount} / {MAX_BELIEFS}</span></div></div>
                <div className="setting-card memory-card"><span>{t.memory}</span><p>{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成简短摘要。" : "A short summary will form after conversations begin.")}</p><small>{lang === "zh" ? "每次回复后自动压缩更新，不重复发送全部历史。" : "Compressed after each response, so the full history is never resent."}</small></div>
                <button className="outline-button" onClick={() => setView("memory")}>{lang === "zh" ? "打开完整记忆库" : "Open full memory library"}</button>
              </div>}
              {shown === "look" && <div className="settings-section">
                <div className="language-card"><div><span>{lang === "zh" ? "外观" : "APPEARANCE"}</span><strong>{dark ? (lang === "zh" ? "深色" : "Dark") : (lang === "zh" ? "浅色" : "Light")}</strong></div><button onClick={toggleDark}>{dark ? (lang === "zh" ? "切换浅色" : "Use light") : (lang === "zh" ? "切换深色" : "Use dark")}</button></div>
                <div className="language-card"><div><span>{lang === "zh" ? "界面语言" : "LANGUAGE"}</span><strong>{lang === "zh" ? "简体中文" : "English"}</strong></div><button onClick={switchLanguage}>{lang === "zh" ? "Switch to English" : "切换到中文"}</button></div>
                <FontSizePanel lang={lang} />
              </div>}
              {shown === "voice" && <VoiceSettings lang={lang} sessionId={sessionId} onRecord={() => navigate("subliminal")} />}
              {shown === "sync" && <div className="settings-section">
                <div className="setting-card sync-card"><span>{lang === "zh" ? "跨设备同步" : "CROSS-DEVICE SYNC"}</span><p>{syncStatus === "saved" ? (lang === "zh" ? "愿望、记忆、对话、故事和练习记录已安全同步。" : "Your desire, memory, conversations, stories, and practice history are synced.") : (lang === "zh" ? "当前使用本机副本；恢复连接后会自动继续同步。" : "Using the on-device copy. Sync resumes automatically when available.")}</p></div>
                <SyncPanel lang={lang} sessionId={sessionId} syncStatus={syncStatus} hasLocalData={goal.setupComplete} />
                <div className="setting-card data-control-card"><span>{lang === "zh" ? "我的数据" : "MY DATA"}</span><p>{lang === "zh" ? "下载愿望卡、故事、对话、重写与打卡记录。私密照片和音频文件不会写入导出文件。" : "Download desire cards, stories, conversations, revisions, and check-ins. Private photo and audio files are excluded."}</p><button className="outline-button" onClick={exportMyData}>{lang === "zh" ? "导出我的数据" : "Export my data"}</button></div>
                <button className="outline-button danger-button" onClick={() => { if (window.confirm(t.confirm)) { void fetch("/api/space", { method: "DELETE", headers: { "x-already-session-id": sessionId } }); removeStored("already-private-state-v5"); removeStored("already-practice-checkins-v1"); removeStored("already-subliminal-v1"); removeStored("already-vision-project-v1"); indexedDB.deleteDatabase("already-private-audio-v1"); indexedDB.deleteDatabase("already-private-vision-v1"); removeStored("already-opening-v1"); setProfile(emptyProfile); setOtherGoals([]); setGoal({ ...defaultGoal }); setGoalArchive([]); setConversationArchive([]); setConversationId(""); setSpNameDraft(""); setBeliefDraft(""); setStoryLibrary([]); setMessages([]); setRevisions([]); setCheckIns([]); setBoard([]); setView("home"); setOnboardingStep(0); } }}>{t.clear}</button>
              </div>}
              {shown === "help" && <div className="settings-section">
                <div className="setting-card beta-quota-card"><span>{lang === "zh" ? "AI 对话" : "AI CONVERSATIONS"}</span><p>{betaStatus?.authenticated === false ? (lang === "zh" ? "正在连接这台设备…" : "Connecting this device…") : betaStatus?.enabled === false ? (lang === "zh" ? "AI 正在由创始人暂时维护，请稍后再来。" : "AI is temporarily paused by the founder. Please check back shortly.") : (lang === "zh" ? "不限制对话、重写与故事的次数。" : "No limit on chats, revisions, or stories.")}</p></div>
                <div className="setting-card report-card"><span>{lang === "zh" ? "联系与举报" : "CONTACT & REPORTS"}</span><p>{lang === "zh" ? "发现不当、违法或让你不舒服的内容，可以在这里举报。每条 AI 回复下面也有“举报”按钮。我们会尽快查看。" : "If you see anything inappropriate, unlawful, or upsetting, report it here. Every AI reply also has a Report button. We read these as soon as we can."}</p><button className="outline-button" onClick={() => setReportTarget({})}>{lang === "zh" ? "举报内容或反馈问题" : "Report content or send feedback"}</button><SiteRecord lang={lang} /></div>
                <div className="legal-links"><a className="trust-link" href="/pricing">{lang === "zh" ? "会员与价格" : "Membership & pricing"}</a><a className="trust-link" href="/trust">{t.trust}</a><a className="trust-link" href="/privacy">{lang === "zh" ? "隐私说明" : "Privacy"}</a><a className="trust-link" href="/terms">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a className="trust-link" href="/copyright">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
              </div>}
              {shown !== "sync" && shown !== "help" && shown !== "voice" && shown !== "look" && <div className="settings-savebar"><span>{syncStatus === "saved" ? <CloudCheck size={18}/> : <FloppyDisk size={18}/>} {syncStatus === "saved" ? (lang === "zh" ? "会自动同步" : "Auto-sync is on") : (lang === "zh" ? "本机副本已保留" : "On-device copy retained")}</span><button className="primary" onClick={saveGoalSettings} disabled={Boolean(spNameError) || beliefCount > MAX_BELIEFS || !goal.companionStyle}>{goalSavedPulse ? t.savedGoal : t.saveGoal}</button></div>}
            </div>
          </div>
        </section>;
      })()}

      </section>

      {surveyOpen && <div className="survey-backdrop" role="presentation"><section className="beta-survey" role="dialog" aria-modal="true" aria-labelledby="beta-survey-title"><header><div><p className="eyebrow">10-MINUTE CHECK-IN</p><h2 id="beta-survey-title">{lang === "zh" ? "刚刚这十分钟，对你有帮助吗？" : "Did these ten minutes help?"}</h2><span>{lang === "zh" ? "四个简短问题，大约 30 秒。" : "Four quick questions, about 30 seconds."}</span></div><button type="button" onClick={dismissSurvey} aria-label={lang === "zh" ? "稍后再说" : "Ask me later"}>×</button></header><div className="survey-scroll"><fieldset><legend>{lang === "zh" ? "1. “我的愿望已经属于我”这件事，稳定感有多少？" : "1. How steady does “my desire is already mine” feel?"}</legend><div className="survey-pair"><label><span>{lang === "zh" ? "刚打开时" : "When I opened"}</span><SurveyScale value={surveyBefore} onChange={setSurveyBefore} lang={lang}/></label><label><span>{lang === "zh" ? "现在" : "Right now"}</span><SurveyScale value={surveyNow} onChange={setSurveyNow} lang={lang}/></label></div></fieldset><fieldset><legend>{lang === "zh" ? "2. AlreaDough 有没有在不否定愿望的情况下，真正理解你？" : "2. Did AlreaDough understand you without denying your desire?"}</legend><SurveyScale value={surveyUnderstood} onChange={setSurveyUnderstood} lang={lang}/></fieldset><fieldset><legend>{lang === "zh" ? "3. 下次动摇时，你有多愿意再次打开 AlreaDough？" : "3. How likely are you to open AlreaDough the next time doubt appears?"}</legend><SurveyScale value={surveyReturn} onChange={setSurveyReturn} lang={lang}/></fieldset><fieldset><legend>{lang === "zh" ? "4. 今天最帮到你的部分是什么？" : "4. What helped you most today?"}</legend><div className="survey-features">{[
        ["chat", lang === "zh" ? "AI 对话" : "AI chat"], ["story", lang === "zh" ? "故事" : "Stories"], ["revision", lang === "zh" ? "重写" : "Revision"], ["audio", lang === "zh" ? "声音练习" : "Audio"], ["vision", lang === "zh" ? "愿景板" : "Vision board"], ["unsure", lang === "zh" ? "还不确定" : "Not sure yet"],
      ].map(([id, label]) => <button type="button" key={id} className={surveyFeature === id ? "selected" : ""} onClick={() => setSurveyFeature(id)}>{label}</button>)}</div></fieldset></div><footer><small>{lang === "zh" ? "只记录匿名选项，不保存你的愿望或聊天内容。" : "Only anonymous choices are recorded—never your desire or chat content."}</small><div><button type="button" className="survey-later" onClick={dismissSurvey}>{lang === "zh" ? "稍后再说" : "Later"}</button><button type="button" className="primary" disabled={!surveyBefore || !surveyNow || !surveyUnderstood || !surveyReturn || !surveyFeature} onClick={submitSurvey}>{lang === "zh" ? "提交，继续练习" : "Submit and continue"}</button></div></footer></section></div>}

      {storyEditorOpen && <div className="story-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStoryEditorOpen(false); }}>
        <form className="story-editor-modal" onSubmit={(event) => { event.preventDefault(); saveStory(); }}>
          <header><div><p className="eyebrow">{storyEditingId ? (lang === "zh" ? "编辑故事" : "EDIT STORY") : (lang === "zh" ? "新的已实现时刻" : "A NEW FULFILLED MOMENT")}</p><h2>{storyEditingId ? (lang === "zh" ? "把这个故事写成你的版本" : "Make this story yours") : (lang === "zh" ? "它已经发生在哪里？" : "Where has it already happened?")}</h2></div><button type="button" onClick={() => setStoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header>
          <div className="story-editor-grid">
            <label><span>{lang === "zh" ? "故事标题" : "STORY TITLE"}</span><input value={storyDraft.title} onChange={(event) => setStoryDraft((draft) => ({ ...draft, title: event.target.value }))} maxLength={42} placeholder={lang === "zh" ? "例如：愿望实现后的普通一天" : "For example: An ordinary day after it came true"}/></label>
            <label><span>{lang === "zh" ? "地点" : "PLACE"}</span><input value={storyDraft.city} onChange={(event) => setStoryDraft((draft) => ({ ...draft, city: event.target.value }))} maxLength={32} placeholder={lang === "zh" ? "家里、校园、办公室、旅途中" : "Home, campus, work, or on a trip"}/></label>
          </div>
          <label><span>{lang === "zh" ? "一句氛围" : "MOOD IN ONE LINE"}</span><input value={storyDraft.subtitle} onChange={(event) => setStoryDraft((draft) => ({ ...draft, subtitle: event.target.value }))} maxLength={80} placeholder={lang === "zh" ? "这个时刻最真实的感受" : "How this moment feels"}/></label>
          <label><span>{lang === "zh" ? "故事场景" : "THE SCENE"}</span><textarea value={storyDraft.scene} onChange={(event) => setStoryDraft((draft) => ({ ...draft, scene: event.target.value }))} placeholder={lang === "zh" ? "用已经发生的语气，写下你看见、听见和感受到的细节。分段书写会更好读。" : "Write what you see, hear, and feel as something already lived. Use paragraphs for an easier read."}/></label>
          <label><span>{lang === "zh" ? "锚定句" : "ANCHOR LINE"}</span><input value={storyDraft.anchor} onChange={(event) => setStoryDraft((draft) => ({ ...draft, anchor: event.target.value }))} maxLength={100} placeholder={lang === "zh" ? "例如：拥有它已经是我熟悉的日常。" : "For example: Having it is already part of my everyday life."}/></label>
          <footer><small>{lang === "zh" ? `${storyLibrary.length} / 6 个故事` : `${storyLibrary.length} / 6 stories`}</small><div><button type="button" className="outline-button" onClick={() => setStoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="submit" className="primary" disabled={!storyDraft.title.trim() || !storyDraft.scene.trim()}>{lang === "zh" ? "保存故事" : "Save story"}</button></div></footer>
        </form>
      </div>}

      {view === "home" && <DoughPet lang={lang} checked={checkedToday} streak={streak} onCheckIn={() => recordCheckIn("chosen")}/>}

      {petOpen && <>
        <button type="button" className="pet-sheet-backdrop" aria-label={lang === "zh" ? "关闭" : "Close"} onClick={() => setPetOpen(false)} />
        <section className="pet-sheet" role="dialog" aria-label={lang === "zh" ? "面团" : "Dough"}>
          <header><button type="button" onClick={() => setPetOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header>
          <DoughPet inline lang={lang} checked={checkedToday} streak={streak} onCheckIn={() => recordCheckIn("chosen")}/>
        </section>
      </>}

      <nav className="bottom-nav" aria-label={t.ariaNav}>
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return <button key={item.id} className={active ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={21} weight={active ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
      {reportTarget && <ReportDialog lang={lang} sessionId={sessionId} excerpt={reportTarget.excerpt} onClose={() => setReportTarget(null)} />}
      <BreakReminder lang={lang} activity={messages.length + (isTyping ? 1 : 0)} />
    </main>
    </>
  );
}
