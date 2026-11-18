"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Moon,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Sun,
  Trash,
  Waveform,
  ArrowsClockwise,
  Brain,
  PushPin,
  CaretDown,
  List,
  GearSix,
  Check,
  ArrowClockwise,
  BookmarkSimple,
  CloudCheck,
  ArrowDown,
  ArrowElbowDownLeft,
  ArrowLeft,
  Copy,
  FloppyDisk,
  NotePencil,
  StopCircle,
  ThumbsDown,
  ThumbsUp,
  X,
  DownloadSimple,
  ArrowCounterClockwise,
  CaretRight,
  Copyright,
  Crown,
  FileText,
  Flag,
  LockSimple,
  ShieldCheck,
  Sparkle,
  UserCircle,
  Lightbulb,
  Desktop,
  Palette,
  Question,
} from "@phosphor-icons/react";
import SubliminalStudio, { PracticeCheckIn, practiceStreak, todayKey } from "../components/SubliminalStudio";
import Dreamscape from "../components/Dreamscape";
import VisionCanvasStudio from "../components/VisionCanvasStudio";
import DoughPet from "../components/DoughPet";
import { AiNote, BreakReminder, ReportButton, ReportDialog, SiteRecord } from "../components/Compliance";
import MembershipPanel, { memberPlanLabel, UsageBanner, UsageMeter, useMemberStatus } from "../components/MembershipPanel";
import DesktopPetPanel from "../components/DesktopPetPanel";
import SyncPanel from "../components/SyncPanel";
import GuidedOnboarding from "../components/GuidedOnboarding";
import ProfilePanel from "../components/ProfilePanel";
import WishList, { type WishItem } from "../components/WishList";
import ConfirmHost, { askConfirm, showUndo } from "../components/ConfirmHost";
import SpaceNav from "../components/SpaceNav";
import FontSizePanel from "../components/FontSizePanel";
import type { ReflectionAnswers } from "@/lib/reflection";
import { validateSpName } from "@/lib/name-policy";
import { answersToSeeds, sharedMemories, splitLines, type GoalSeed, type MemorySeed, type OnboardingAnswers, type ProfileSeed } from "@/lib/onboarding-flow";
import { readStored, writeStored, removeStored } from "@/lib/safe-storage";
import { formatGreeting, pickGreeting } from "@/lib/greetings";
import { pickQuote, type Quote } from "@/lib/quotes";
import { buildExportZip, exportFileName } from "@/lib/export-archive";
import { getDeviceSessionId } from "@/lib/device-session";
import DoughLineMark from "../components/DoughLineMark";
import { CompanionIcon, DreamscapeIcon, HistoryIcon, ReviseIcon, StoriesIcon, VisionIcon } from "../components/NavIcons";

type SpaceSection = "wishes" | "about" | "library" | "memory" | "membership" | "pet" | "look" | "sync" | "help";
type View = "home" | "subliminal" | "story" | "revision" | "board" | "settings";
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
    about: typeof raw.about === "string" ? raw.about.slice(0, 1200) : "",
    situation: typeof raw.situation === "string" ? raw.situation.slice(0, 1200) : "",
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
  return value.split(/[\r\n；;]+/).map((item) => item.trim()).filter(Boolean);
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
    private: "我的空间", space: "我的已完成空间", privateCopy: "愿望、记忆、对话与练习支持跨设备同步", coreWish: "当前唯一愿望", tone: "陪伴语气", toneCopy: "温柔、坚定，不分析可能性，不用旧故事反驳新选择。", region: "使用范围", regionCopy: "提供中文与英文。", clear: "清除我的练习数据", confirm: "要清除云端与这台设备上保存的所有练习吗？", nav: ["陪伴", "故事", "重写", "愿景", "入梦声场"], ariaSettings: "打开私人设定", ariaNav: "主导航", send: "发送", activeGoal: "当前愿望", beliefs: "限制性信念地图", memory: "AI 旅程摘要", saveGoal: "保存更改", savedGoal: "更改已保存", generating: "AI 正在进入这个场景……", generateStory: "✶ 为这一刻生成专属故事", aiReady: "AI 已连接", aiSetup: "AI 暂时没有回应", trust: "AI 与安全说明",
  },
  en: {
    day: "DAY 1", greeting: "Welcome back", hero: <>You do not need to convince anyone.<br />Return to the story you have already chosen.</>, wish: "MY DESIRE", happened: "ALREADY MINE", start: "Begin today’s practice",
    newStory: "YOUR NEW STORY", moment: "Which moment will you enter today?", enter: "Enter the story", returnBelief: "RETURN TO KNOWING", need: "What do you need right now?", talk: "Talk with your companion", quiet: "Turn down the volume of doubt", rewrite: "Revise this moment", accept: "Choose the version that belongs to you",
    companion: "BELIEF COMPANION · GLOBAL BETA", here: "I’m here", companionCopy: "Give me the old story. Your AI uses your active desire, belief map, and recent journey to bring you back to the version you chose.", chatPlaceholder: "Write the thought that just appeared…",
    previous: "← Previous", next: "Next story →", revisionTitle: "Let this moment happen your way", revisionCopy: "The old version only needs to appear once. After revision, we keep your new story.", oldLabel: "What just pulled you away from your new story?", oldPlaceholder: "For example: A result, message, or present circumstance made me doubt my desire…", makeRevision: "✶ Revise this moment for me", chosen: "THE VERSION YOU CHOOSE", accepted: "Accepted ✓", acceptStory: "Accept as my new story", history: "ACCEPTED",
    boardTitle: "Collect the life you are entering", boardCopy: "Discover inspiration in licensed real photography, or weave a personal vision board from your own photos. No AI-generated imagery.", realPhotos: "Discover Dreamscapes", photoCopy: "Find the life you imagine through commercially licensed real photography", searchPlaceholder: "e.g. winter travel, dream home", searching: "Dreaming", search: "Discover", collect: "+ Keep in my vision", manual: "or add something you already love", nameScene: "Name this scene", pasteLink: "Paste any source link or direct image URL", addLink: "Add link", local: "Upload", source: "View source ↗",
    private: "PRIVATE SPACE · GLOBAL BETA", space: "My already-done space", privateCopy: "Your desire card, journey summary, chats, and revisions can sync across devices.", coreWish: "ONE ACTIVE DESIRE", tone: "COMPANION TONE", toneCopy: "Gentle and certain. It does not debate possibility or use the old story against your new choice.", region: "BETA REGION", regionCopy: "Available in Chinese and English.", clear: "Clear practice data on this device", confirm: "Clear all practice data saved on this device?", nav: ["Companion", "Stories", "Revise", "Vision", "Dreamscape"], ariaSettings: "Open private settings", ariaNav: "Main navigation", send: "Send", activeGoal: "ACTIVE GOAL", beliefs: "LIMITING-BELIEF MAP", memory: "AI JOURNEY SUMMARY", saveGoal: "Save active desire card", savedGoal: "Desire card saved", generating: "Your AI is entering this scene…", generateStory: "✶ Create my personal story", aiReady: "LIVE AI", aiSetup: "AI isn’t responding right now", trust: "AI & Safety Notice",
  },
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const explicitLanguage = useRef<Lang | null>(null);
  const [view, setView] = useState<View>("home");
  // Theme: "system" follows the phone's light/dark setting (the only way the phone's own top strip matches the page).
  const [themePref, setThemePref] = useState<"system" | "light" | "dark">("system");
  const [systemDark, setSystemDark] = useState(false);
  const dark = themePref === "system" ? systemDark : themePref === "dark";
  const [hydrated, setHydrated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [beliefDraft, setBeliefDraft] = useState("");
  const [beliefInput, setBeliefInput] = useState("");
  const [openScene, setOpenScene] = useState<number | null>(null);
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
  // Version of the cloud copy this device last loaded or saved. Saves are sent on top of it, so a stale device can't overwrite newer work.
  const cloudRevisionRef = useRef<number | null>(null);
  const restoreSpaceRef = useRef<((data: Record<string, unknown>) => void) | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [plusSection, setPlusSection] = useState<"goal" | "coach" | null>(null);
  const [petOpen, setPetOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
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
  // the reply only matters for its side effect (the server notes the device); nothing on screen reads it
  const [, setBetaStatus] = useState<BetaStatus | null>(null);
  // membership and usage: one fetch shared by the meter by the chat box, the out-of-usage notice, and My space
  const { member, refresh: refreshMember, gate: memberGate, setGate: setMemberGate } = useMemberStatus();
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

  // Theme: read her saved pick (none = follow the phone) and keep listening to the phone's setting.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the system and saved theme */
    const saved = readStored("already-theme-v1");
    if (saved === "dark" || saved === "light") setThemePref(saved);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    setSystemDark(media.matches);
    /* eslint-enable react-hooks/set-state-in-effect */
    const follow = (event: MediaQueryListEvent) => setSystemDark(event.matches);
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
    meta.content = dark ? "#211d1d" : getComputedStyle(root).getPropertyValue("--app-bg").trim() || "#f4efea";
  }, [dark]);

  const chooseTheme = (next: "system" | "light" | "dark") => {
    if (next === "system") removeStored("already-theme-v1");
    else writeStored("already-theme-v1", next);
    setThemePref(next);
  };
  const toggleDark = () => chooseTheme(dark ? "light" : "dark");

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restoration from device storage */
  useEffect(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
    if (requestedLanguage === "en" || requestedLanguage === "zh") {
      explicitLanguage.current = requestedLanguage;
      setLang(requestedLanguage);
    }
    const restore = (data: Record<string, unknown>) => {
      const restoredLang = explicitLanguage.current ?? (data.lang === "en" ? "en" : "zh");
      if (explicitLanguage.current || data.lang === "zh" || data.lang === "en") setLang(restoredLang);
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
    restoreSpaceRef.current = restore;
    const activeSession = getDeviceSessionId();
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
        .then(async (response) => ({ response, data: await response.json() as { space?: Record<string, unknown> | null; revision?: number } }))
        .then(({ response, data }) => {
          if (response.ok) cloudRevisionRef.current = data.space ? data.revision ?? 0 : 0;
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

  /** Load the newest cloud copy when another device saved after this one (on returning to the app, or when a save was refused as stale). */
  const pullCloudSpace = (force = false) => {
    if (!sessionId || sessionId === "local-beta") return;
    fetch("/api/space", { cache: "no-store", headers: { "x-already-session-id": sessionId } })
      .then((response) => response.ok ? response.json() as Promise<{ space?: Record<string, unknown> | null; revision?: number }> : null)
      .then((data) => {
        if (!data?.space || typeof data.revision !== "number") return;
        if (!force && cloudRevisionRef.current !== null && data.revision <= cloudRevisionRef.current) return;
        cloudRevisionRef.current = data.revision;
        restoreSpaceRef.current?.(data.space);
        setSyncStatus("saved");
      })
      .catch(() => setSyncStatus("offline"));
  };

  useEffect(() => {
    if (!cloudReady) return;
    const onShow = () => { if (document.visibilityState === "visible") pullCloudSpace(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => { document.removeEventListener("visibilitychange", onShow); window.removeEventListener("pageshow", onShow); };
  }, [cloudReady, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    const space = { lang, goal, goalArchive: goalArchive.slice(0, 20), otherGoals: otherGoals.slice(0, MAX_GOALS), conversationId, conversationArchive: conversationArchive.slice(0, 30), messages: messages.slice(-80), revisions: revisions.slice(0, 20), board, storyLibrary, checkIns, profile };
    writeStored("already-private-state-v5", JSON.stringify(space));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    if (!cloudReady) return;
    const timeout = window.setTimeout(() => {
      setSyncStatus("saving");
      const baseRevision = cloudRevisionRef.current;
      fetch("/api/space", { method: "PUT", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId }, body: JSON.stringify(baseRevision === null ? { space } : { space, baseRevision }) })
        .then(async (response) => {
          if (response.status === 409) { pullCloudSpace(true); return; }
          const data = await response.json().catch(() => ({})) as { revision?: number };
          if (response.ok && typeof data.revision === "number") cloudRevisionRef.current = data.revision;
          setSyncStatus(response.ok ? "saved" : "offline");
        })
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
  const otherGoalMemoryCount = otherGoals.reduce((sum, item) => sum + (item.memoryItems?.[lang]?.length || 0) + (item.acceptedSceneLedger?.[lang]?.length || 0), 0);
  const filteredMemoryItems = currentMemoryItems
    .filter((item) => memoryFilter === "all" || item.kind === memoryFilter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  const sessionMessages = messages;
  const streak = useMemo(() => practiceStreak(checkIns), [checkIns]);
  const checkedToday = checkIns.some((item) => item.date === todayKey());
  // Home greeting: picked once per open (time of day, holidays by IP country, special moments), never during SSR.
  const [greeting, setGreeting] = useState<ReturnType<typeof pickGreeting> | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const greetingPicked = useRef(false);
  useEffect(() => {
    if (!hydrated || !goal.setupComplete || greetingPicked.current) return;
    greetingPicked.current = true;
    const now = new Date();
    const lastVisit = readStored("already-last-visit-v1");
    const lastMs = lastVisit ? Date.parse(lastVisit) : NaN;
    const daysAway = Number.isFinite(lastMs) ? Math.floor((now.getTime() - lastMs) / 86400000) : null;
    // Set only when the first-time onboarding finishes, so existing users never see "第一次见面".
    const firstVisit = readStored("already-greeting-first-v1") === "1";
    if (firstVisit) removeStored("already-greeting-first-v1");
    let recent: string[] = [];
    try { const parsed = JSON.parse(readStored("already-greeting-recent-v1") || "[]"); if (Array.isArray(parsed)) recent = parsed.filter((item): item is string => typeof item === "string"); } catch { /* ignore */ }
    const choose = (country: string | null) => {
      const next = pickGreeting({ now, lang, country, firstVisit, daysAway, streak, recent });
      setGreeting(next);
      writeStored("already-greeting-recent-v1", JSON.stringify([next.id, ...recent.filter((id) => id !== next.id)].slice(0, 5)));
      writeStored("already-last-visit-v1", now.toISOString());
    };
    let recentQuotes: string[] = [];
    try { const parsed = JSON.parse(readStored("already-quote-recent-v1") || "[]"); if (Array.isArray(parsed)) recentQuotes = parsed.filter((item): item is string => typeof item === "string"); } catch { /* ignore */ }
    const nextQuote = pickQuote(now, recentQuotes);
    setQuote(nextQuote);
    writeStored("already-quote-recent-v1", JSON.stringify([nextQuote.id, ...recentQuotes.filter((id) => id !== nextQuote.id)].slice(0, 30)));
    const cached = readStored("already-region-v1");
    const refresh = fetch("/api/region", { cache: "no-store" }).then((response) => response.json()).then((data: { country?: string | null }) => {
      const country = typeof data.country === "string" ? data.country : "";
      writeStored("already-region-v1", country);
      return country || null;
    }).catch(() => null);
    if (cached !== null) choose(cached || null);
    else Promise.race([refresh, new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))]).then(choose);
  }, [hydrated, goal.setupComplete, lang, streak]);
  const suggestions = lang === "zh" ? ["冬日旅行", "理想的新家", "事业里程碑", "丰盛日常"] : ["Winter trip", "Dream home", "Career milestone", "Abundant everyday life"];
  const primaryNav = [
    { id: "home" as View, label: t.nav[0], icon: CompanionIcon },
    { id: "story" as View, label: t.nav[1], icon: StoriesIcon },
    { id: "revision" as View, label: t.nav[2], icon: ReviseIcon },
    { id: "board" as View, label: t.nav[3], icon: VisionIcon },
    { id: "subliminal" as View, label: t.nav[4], icon: DreamscapeIcon },
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
    // what she wrote in the opening also goes into her memory library, in her own words
    memoryItems: {
      ...base.memoryItems,
      [lang]: seed.memories.map((memory) => ({ id: crypto.randomUUID(), kind: memory.kind, title: memory.title, detail: memory.detail, keywords: memory.keywords, pinned: false, source: "user" as const, createdAt: new Date().toISOString() })).slice(0, MAX_MEMORIES),
    },
    createdAt: new Date().toISOString(),
  });

  /** The whole opening is done: every desire becomes a card, and what she said about herself is kept once. */
  const finishGuidedOpening = (answers: OnboardingAnswers) => {
    writeStored("already-greeting-first-v1", "1");
    const { goals: seeds, profile: seedProfile } = answersToSeeds(answers, lang);
    if (!seeds.length || !answers.name.trim()) return;
    const base: GoalProfile = {
      ...defaultGoal,
      companionName: answers.name.trim(),
      companionStyle: "gentle",
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

  /**
   * Run the opening again from inside the app. Nothing is deleted: her new answers are added to the account she
   * already has (profile, memories, and any desire that is not already a card).
   */
  const finishReplay = (answers: OnboardingAnswers) => {
    const { goals: seeds, profile: seedProfile } = answersToSeeds(answers, lang);
    const addMemories = (existing: MemoryItem[], incoming: MemorySeed[]): MemoryItem[] => {
      const keys = new Set(existing.map((item) => `${item.title}|${item.detail}`.toLowerCase()));
      const added: MemoryItem[] = incoming
        .filter((item) => !keys.has(`${item.title}|${item.detail}`.toLowerCase()))
        .map((item) => ({ id: crypto.randomUUID(), kind: item.kind, title: item.title, detail: item.detail, keywords: item.keywords, pinned: false, source: "user" as const, createdAt: new Date().toISOString() }));
      return [...added, ...existing].slice(0, MAX_MEMORIES);
    };
    const updated = [goal, ...otherGoals].map((item) => ({ ...item }));
    const base: GoalProfile = { ...defaultGoal, companionName: goal.companionName, companionStyle: goal.companionStyle, coachMode: goal.coachMode, tone: goal.tone, responsePreferences: goal.responsePreferences };
    const created: GoalProfile[] = [];
    for (const seed of seeds) {
      const index = updated.findIndex((item) => item.desire[lang].trim() === seed.desire.trim());
      if (index < 0) { created.push(goalFromSeed(seed, base)); continue; }
      const current = updated[index];
      const beliefs = current.beliefs[lang] || [];
      updated[index] = {
        ...current,
        spName: current.spName || seed.spName,
        background: seed.background && !(current.background[lang] || "").includes(seed.background) ? { ...current.background, [lang]: [current.background[lang], seed.background].filter(Boolean).join("\n\n") } : current.background,
        beliefs: { ...current.beliefs, [lang]: [...beliefs, ...seed.beliefs.filter((belief) => !beliefs.some((item) => sameBelief(item, belief)))].slice(0, MAX_BELIEFS) },
        memoryItems: { ...current.memoryItems, [lang]: addMemories(current.memoryItems[lang] || [], seed.memories) },
      };
    }
    // the card she is on always receives what she said about herself and her world
    updated[0] = { ...updated[0], memoryItems: { ...updated[0].memoryItems, [lang]: addMemories(updated[0].memoryItems[lang] || [], sharedMemories(answers, lang)) } };
    setGoal(updated[0]);
    setOtherGoals([...created, ...updated.slice(1)].slice(0, MAX_GOALS));
    setSpNameDraft(updated[0].spName);
    setBeliefDraft((updated[0].beliefs[lang] || []).join("\n"));
    setProfile((current) => {
      const people = [...current.people];
      for (const person of seedProfile.people) if (!people.some((item) => item.name.trim().toLowerCase() === person.name.trim().toLowerCase())) people.push(person);
      return normalizeProfile({
        country: seedProfile.country || current.country,
        about: seedProfile.about || current.about,
        situation: seedProfile.situation || current.situation,
        people,
        neverInclude: splitLines([...current.neverInclude, ...seedProfile.neverInclude].join("\n"), 30),
      });
    });
    setReplaying(false);
    openSpace("library");
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

  const deleteMemoryItem = async (id: string) => {
    const ok = await askConfirm({ title: lang === "zh" ? "删除这条记忆？" : "Delete this memory?", body: lang === "zh" ? "AlreaDough 之后不会再用到它，删除后不能恢复。" : "AlreaDough won't use it again. This can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" });
    if (!ok) return;
    setGoal((current) => ({ ...current, memoryItems: { ...current.memoryItems, [lang]: current.memoryItems[lang].filter((item) => item.id !== id) } }));
  };

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
    void refreshMember();
    if (data.error === "MEMBERSHIP_LIMIT" || data.error === "MEMBERSHIP_SIGN_IN_REQUIRED") setMemberGate(data.error);
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

  const removeBeliefWithUndo = (text: string) => {
    const before = parseBeliefs(beliefDraft);
    removeBelief(text);
    showUndo(lang === "zh" ? "已删除这个念头" : "Thought deleted", lang === "zh" ? "撤销" : "Undo", () => { setBeliefDraft(before.join("\n")); setGoal((current) => ({ ...current, beliefs: { ...current.beliefs, [lang]: before } })); });
  };

  const removeBelief = (text: string) => {
    setGoal((current) => ({ ...current, beliefs: { ...current.beliefs, [lang]: (current.beliefs[lang] || []).filter((item) => item !== text) } }));
    setBeliefDraft((current) => parseBeliefs(current).filter((item) => item !== text).join("\n"));
  };

  /** A thought added in 背景与念头 is kept right away, like turning or deleting one. */
  const addBelief = () => {
    const text = beliefInput.trim();
    if (!text) return;
    const current = parseBeliefs(beliefDraft);
    setBeliefInput("");
    if (current.length >= MAX_BELIEFS || current.some((item) => sameBelief(item, text))) return;
    const next = [...current, text];
    setBeliefDraft(next.join("\n"));
    setGoal((value) => ({ ...value, beliefs: { ...value.beliefs, [lang]: next } }));
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

  const deleteStory = async (id: string) => {
    const confirmed = await askConfirm({ title: lang === "zh" ? "删除这个故事？" : "Delete this story?", body: lang === "zh" ? "只会删除保存在这台设备上的版本，删除后不能恢复。" : "This removes only the copy saved on this device and can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" });
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
    explicitLanguage.current = next;
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
    setLang(next);
  };

  /** Same shape as ChatGPT's export: a .zip with index.html (read and search it in a browser) and the raw data as JSON. */
  const exportMyData = () => {
    const exportedAt = new Date();
    const zip = buildExportZip({
      lang,
      exportedAt,
      current: goal,
      others: otherGoals,
      archived: goalArchive,
      profile,
      stories: storyLibrary,
      revisions,
      checkIns,
      board,
      conversations: [{ id: conversationId, title: conversationTitle(messages, lang), createdAt: exportedAt.toISOString(), goalId: goal.id, messages }, ...conversationArchive],
      labels: {
        category: (id) => { const item = wishCategories.find((entry) => entry.id === id); return item ? item[lang] : ""; },
        coachMode: (id) => { const item = coachModes.find((entry) => entry.id === id); return item ? item[lang] : ""; },
        memoryKind: (id) => { const item = memoryKinds.find((entry) => entry.id === id); return item ? item[lang] : ""; },
        intensity: (value) => intensityLabels[lang][Math.min(5, Math.max(1, Math.round(value))) - 1] || "",
      },
    });
    const href = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = exportFileName(exportedAt);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
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

  const deleteOtherGoal = async (id: string) => {
    const target = otherGoals.find((item) => item.id === id);
    if (!target) return;
    const confirmed = await askConfirm({ title: lang === "zh" ? `删除愿望「${goalTitle(target, lang)}」？` : `Delete “${goalTitle(target, lang)}”?`, body: lang === "zh" ? "它的记忆和对话会一起删除，不能恢复。" : "Its memories and conversations go with it. This can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" });
    if (!confirmed) return;
    setOtherGoals((items) => items.filter((item) => item.id !== id));
    setConversationArchive((items) => items.filter((item) => item.goalId !== id));
  };

  const updateGoalById = (id: string, patch: Partial<WishItem>) => {
    const next = patch as Partial<GoalProfile>;
    if (id === goal.id) {
      setGoal((current) => ({ ...current, ...next }));
      if (patch.spName !== undefined) setSpNameDraft(patch.spName);
    } else setOtherGoals((items) => items.map((item) => item.id === id ? { ...item, ...next, spName: next.spName !== undefined ? next.spName.trim() : item.spName } : item));
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
    return <main className="app-shell acknowledge-shell" lang={lang === "zh" ? "zh-CN" : "en"} data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <section className="acknowledge-card">
        <span className="brand"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></span>
        {declined ? <><p className="eyebrow">YOUR CHOICE</p><h1>{lang === "zh" ? "你尚未进入 AlreaDough" : "You have not entered AlreaDough"}</h1><p>{lang === "zh" ? "这台设备没有保存同意记录。你可以关闭页面，或返回重新查看。" : "No consent record was saved on this device. You may close this page or go back to review."}</p><button className="outline-button" onClick={() => setDeclined(false)}>{lang === "zh" ? "返回" : "Go back"}</button></> : <>
          <p className="eyebrow">BEFORE YOU ENTER</p>
          <h1>{lang === "zh" ? "先确认这是一段你愿意进入的体验。" : "Confirm that this is an experience you choose to enter."}</h1>
          <div className="acknowledge-links"><a href={lang === "zh" ? "/terms" : "/terms#english"} target="_blank">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a href={lang === "zh" ? "/privacy" : "/privacy#english"} target="_blank">{lang === "zh" ? "隐私说明" : "Privacy Notice"}</a><a href={lang === "zh" ? "/trust" : "/en/trust"} target="_blank">{lang === "zh" ? "AI 与安全" : "AI & safety"}</a><a href={lang === "zh" ? "/copyright" : "/copyright#english"} target="_blank">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
          <label className="acknowledge-check"><input type="checkbox" id="acknowledge-choice"/><span>{lang === "zh" ? "我已阅读并同意以上说明。" : "I have read and agree to the notices above."}</span></label>
          <label className="acknowledge-check"><input type="checkbox" id="acknowledge-adult"/><span>{lang === "zh" ? "我已年满 18 周岁，并理解本服务面向成年人。" : "I am 18 or older and understand this service is for adults."}</span></label>
          <div className="acknowledge-actions"><button className="outline-button" onClick={() => setDeclined(true)}>{lang === "zh" ? "不同意并退出" : "Decline and exit"}</button><button className="primary" onClick={() => { const input = document.querySelector<HTMLInputElement>("#acknowledge-choice"); if (!input?.checked) { input?.focus(); return; } const adult = document.querySelector<HTMLInputElement>("#acknowledge-adult"); if (!adult?.checked) { adult?.focus(); return; } writeStored("already-acknowledged-v3", "yes"); setAcknowledged(true); }}>{lang === "zh" ? "同意并进入" : "Agree and enter"}</button></div>
          <SiteRecord lang={lang} />
        </>}
      </section>
    </main>;
  }

  if (!goal.setupComplete || replaying) {
    const adding = !replaying && otherGoals.length > 0;
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <ConfirmHost />
      <div className="app-grain" aria-hidden="true" />
      <header className="onboarding-topbar"><span className="brand"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></span><div className="top-actions"><button className="language-toggle" onClick={switchLanguage}>{lang === "zh" ? "EN" : "中"}</button><button className="theme-toggle" onClick={toggleDark} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></div></header>
      <GuidedOnboarding
        key={`${lang}-${replaying ? "replay" : adding ? "extra" : "first"}`}
        lang={lang}
        sessionId={sessionId}
        mode={adding ? "extra" : "first"}
        initialName={goal.companionName}
        maxWishes={Math.max(1, MAX_GOALS - otherGoals.length)}
        syncSlot={<details className="onboarding-sync"><summary>{lang === "zh" ? "已经在另一台设备用过？用同步码继续" : "Already used it on another device? Continue with a sync code"}</summary><SyncPanel enterOnly lang={lang} sessionId={sessionId} syncStatus={syncStatus} hasLocalData={false} /></details>}
        onCancel={replaying ? () => setReplaying(false) : adding ? cancelAddGoal : undefined}
        onComplete={replaying ? finishReplay : adding ? finishExtraWish : finishGuidedOpening}
      />
    </main>;
  }

  /** One way into My space: from the list (phone) or straight to a section. On a wide screen the first section is already open. */
  const openSpace = (section?: SpaceSection) => {
    setSettingsSection(section ?? (typeof window !== "undefined" && window.matchMedia("(min-width: 1000px)").matches ? "wishes" : null));
    setView("settings");
    scrollSpaceToTop();
  };
  /** A newly opened section starts at its title (and its back arrow on a phone), not wherever the list was scrolled to. */
  const scrollSpaceToTop = () => window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0 });
    document.querySelector(".app-stage")?.scrollTo({ top: 0 });
  });

  return (
    <>
    <aside className={`swipe-sidebar${sidebarOpen ? " open" : ""}`} aria-label={lang === "zh" ? "侧边栏" : "Sidebar"} aria-hidden={!sidebarOpen} inert={!sidebarOpen} data-theme={dark ? "dark" : "light"}>
      <header><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></header>
      <button type="button" className="swipe-new" onClick={() => { beginNewConversation(); moveSidebar(false); }}><Plus size={18}/>{lang === "zh" ? "新对话" : "New conversation"}</button>
      <nav className="swipe-nav" aria-label={t.ariaNav}>
        {primaryNav.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => { navigate(item.id); moveSidebar(false); }}><Icon size={24} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="swipe-history">
        <small>{lang === "zh" ? "对话记录" : "Conversations"}</small>
        {conversationArchive.length ? conversationArchive.map((conversation) => <button type="button" key={conversation.id} onClick={() => { openConversation(conversation); moveSidebar(false); }}><span>{conversation.title}</span><small>{new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button>) : <p>{lang === "zh" ? "完成第一段对话后，它会出现在这里。" : "Your first conversation will appear here."}</p>}
      </div>
      <footer><button type="button" onClick={() => { openSpace(); moveSidebar(false); }}><DoughLineMark className="avatar-mark avatar-mark-lg" /><span>{goal.companionName || (lang === "zh" ? "我的空间" : "My space")}</span><GearSix size={20} className="swipe-gear" aria-hidden="true"/></button></footer>
    </aside>
    <main ref={setShellEl} className={`app-shell${sidebarOpen ? " drawer-open" : ""}`} data-theme={dark ? "dark" : "light"} data-lang={lang}><ConfirmHost />
      <div className="app-grain" aria-hidden="true" />
      <aside className="app-rail">
        <button className="brand" onClick={() => navigate("home")} aria-label="AlreaDough home"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
        <button className="rail-new-chat" onClick={beginNewConversation}><Plus size={18}/><span>{lang === "zh" ? "新对话" : "New conversation"}</span></button>
        <button className="rail-history" onClick={() => setHistoryOpen(true)}><HistoryIcon size={22}/><span>{lang === "zh" ? "对话记录" : "Conversation history"}</span><small>{conversationArchive.length}</small></button>
        <nav className="rail-nav" aria-label={t.ariaNav}>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={23} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="rail-footer">
          <button className={`rail-menu-button${view === "settings" ? " active" : ""}`} onClick={() => openSpace()}><span className="rail-avatar"><DoughLineMark className="avatar-mark" /></span><span>{goal.companionName || (lang === "zh" ? "我的空间" : "My space")}</span></button>
        </div>
      </aside>

      <section className="app-stage">
      <header className="topbar">
        <button type="button" className="topbar-menu" onClick={() => moveSidebar(true)} aria-label={lang === "zh" ? "打开侧边栏" : "Open the sidebar"}><List size={22}/></button>
        <button className="brand" onClick={() => setPetOpen((open) => !open)} aria-expanded={petOpen} aria-label={lang === "zh" ? "打开面团" : "Open the dough"}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
        <div className="top-actions" aria-hidden="true" />
      </header>

      {historyOpen && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><aside className="history-drawer"><header><div><p className="eyebrow">{lang === "zh" ? "对话记录" : "CONVERSATION HISTORY"}</p><h2>{lang === "zh" ? "回到之前的片段" : "Return to an earlier moment"}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><button className="history-new" onClick={beginNewConversation}><Plus size={17}/>{lang === "zh" ? "开始新对话" : "Start a new conversation"}</button><div className="history-list">{conversationArchive.length ? conversationArchive.map((conversation) => <article key={conversation.id}><button onClick={() => openConversation(conversation)}><strong>{conversation.title}</strong><small>{new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button><button aria-label={lang === "zh" ? "删除对话" : "Delete conversation"} onClick={async () => { if (await askConfirm({ title: lang === "zh" ? "删除这段对话？" : "Delete this conversation?", body: lang === "zh" ? "删除后不能恢复。" : "This can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" })) setConversationArchive((items) => items.filter((item) => item.id !== conversation.id)); }}><Trash size={16}/></button></article>) : <p>{lang === "zh" ? "完成第一段对话后，它会安全地出现在这里。" : "Your first completed conversation will appear here."}</p>}</div></aside></div>}

      {view === "home" && <section className={`home-ai-view ${sessionMessages.length ? "has-conversation" : "is-empty"}`}>
        {sessionMessages.length === 0 && <div className="home-ai-welcome">
          <p className="eyebrow" suppressHydrationWarning>{dateLabel}</p>
          <h1 style={greeting ? undefined : { visibility: "hidden" }}>{formatGreeting(greeting ?? { zh: "欢迎回来", en: "Welcome back", ask: false }, lang, goal.companionName)}</h1>
          <p style={quote ? undefined : { visibility: "hidden" }}>{quote ? (lang === "zh" ? quote.zh.map((part, index) => <span key={index}>{index > 0 && <br />}{part}</span>) : quote.en) : t.hero}</p>
        </div>}
        <div className="home-ai-thread">
          {sessionMessages.map((message, index) => <div className={`message-group ${message.role}`} key={message.id}><div className={`message ${message.role}`}>{message.text}</div><div className="message-actions">
            <button onClick={() => navigator.clipboard.writeText(message.text)} aria-label={lang === "zh" ? "复制" : "Copy"}><Copy size={15}/><span>{lang === "zh" ? "复制" : "Copy"}</span></button>
            {message.role === "user" ? <button onClick={() => editUserMessage(index)}><NotePencil size={15}/><span>{lang === "zh" ? "编辑并重发" : "Edit and resend"}</span></button> : <><button onClick={() => regenerateReply(index)}><ArrowClockwise size={15}/><span>{lang === "zh" ? "重新回答" : "Regenerate"}</span></button><button onClick={() => saveReplyAsStory(message)}><BookmarkSimple size={15}/><span>{message.saved ? (lang === "zh" ? "已保存" : "Saved") : (lang === "zh" ? "存为故事" : "Save as story")}</span></button><button onClick={() => { setOldScene(message.text); setView("revision"); }}><ArrowsClockwise size={15}/><span>{lang === "zh" ? "带入重写" : "Take to revision"}</span></button><button onClick={() => { setGoal((current) => ({ ...current, acceptedSceneLedger: { ...current.acceptedSceneLedger, [lang]: [message.text.slice(0, 500), ...current.acceptedSceneLedger[lang]].slice(0, 8) } })); setView("subliminal"); }}><Waveform size={15}/><span>{lang === "zh" ? "带入声场" : "Take to Dreamscape"}</span></button><button className={message.feedback === "helpful" ? "selected" : ""} onClick={() => feedbackReply(message, "helpful")}><ThumbsUp size={15}/><span>{lang === "zh" ? "懂我" : "Helpful"}</span></button><button className={message.feedback === "missed" ? "selected" : ""} onClick={() => feedbackReply(message, "missed")}><ThumbsDown size={15}/><span>{lang === "zh" ? "不适合" : "Not for me"}</span></button><ReportButton lang={lang} onClick={() => setReportTarget({ excerpt: message.text })}/></>}
          </div></div>)}
          {isTyping && <div className="message ai typing"><i/><i/><i/></div>}
        </div>
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        <div className={`composer home-composer ${sessionMessages.length ? "is-active" : "is-empty"}`}><UsageBanner lang={lang} member={member} gate={memberGate} onOpen={() => openSpace("membership")} />{showJump && sessionMessages.length > 0 && <button type="button" className="scroll-bottom-button" onClick={() => scrollChatToBottom(true)} aria-label={lang === "zh" ? "回到最新消息" : "Jump to the latest message"}><ArrowDown size={18} weight="bold"/></button>}<details className="coach-model-menu composer-plus" onToggle={(event) => { if (!event.currentTarget.open) setPlusSection(null); }}><summary aria-label={lang === "zh" ? "更多选项" : "More options"}><Plus size={20}/></summary><div className="coach-model-popover plus-sections"><button type="button" className={`plus-section-head${plusSection === "goal" ? " open" : ""}`} aria-expanded={plusSection === "goal"} onClick={() => setPlusSection((current) => current === "goal" ? null : "goal")}><span><small>{lang === "zh" ? "现在聊哪个愿望" : "Which desire now"}</small><strong>{goalTitle(goal, lang)}</strong></span><CaretDown size={16}/></button>{plusSection === "goal" && goalMenuItems}<button type="button" className={`plus-section-head${plusSection === "coach" ? " open" : ""}`} aria-expanded={plusSection === "coach"} onClick={() => setPlusSection((current) => current === "coach" ? null : "coach")}><span><small>{lang === "zh" ? "引导方式" : "Guidance method"}</small><strong>{lang === "zh" ? coachModes.find((coach) => coach.id === goal.coachMode)?.zh : coachModes.find((coach) => coach.id === goal.coachMode)?.en}</strong></span><CaretDown size={16}/></button>{plusSection === "coach" && coachMenuItems}</div></details><div className="composer-main"><textarea ref={chatInputRef} rows={1} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={onChatKey} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder}/></div><UsageMeter lang={lang} member={member} onOpen={() => openSpace("membership")} /><button className="composer-send" onClick={() => isTyping ? requestControllerRef.current?.abort() : sendChat()} aria-label={isTyping ? (lang === "zh" ? "停止生成" : "Stop generating") : t.send}>{isTyping ? <StopCircle size={20}/> : <><span className="send-up">↑</span><ArrowElbowDownLeft className="send-return" size={20}/></>}</button><AiNote lang={lang} /></div>
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

      {memoryEditorOpen && <div className="memory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMemoryEditorOpen(false); }}><section className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-editor-title"><header><div><p className="eyebrow">{lang === "zh" ? "由你决定保留什么" : "YOU CHOOSE WHAT STAYS"}</p><h2 id="memory-editor-title">{memoryEditingId ? (lang === "zh" ? "编辑这条记忆" : "Edit this memory") : (lang === "zh" ? "添加一条记忆" : "Add a memory")}</h2></div><button onClick={() => setMemoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><label><span>{lang === "zh" ? "类型" : "TYPE"}</span><select value={memoryDraft.kind} onChange={(event) => setMemoryDraft((current) => ({ ...current, kind: event.target.value as MemoryKind }))}>{memoryKinds.map((kind) => <option key={kind.id} value={kind.id}>{lang === "zh" ? kind.zh : kind.en}</option>)}</select></label><label><span>{lang === "zh" ? "标题" : "TITLE"}</span><input maxLength={80} value={memoryDraft.title} onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))} placeholder={lang === "zh" ? "例如：我喜欢先被理解" : "For example: Meet the feeling first"}/></label><label><span>{lang === "zh" ? "具体内容" : "DETAIL"}</span><textarea maxLength={600} value={memoryDraft.detail} onChange={(event) => setMemoryDraft((current) => ({ ...current, detail: event.target.value }))} placeholder={lang === "zh" ? "写下以后对话中仍然有用的语境。" : "Write the context that will still matter later."}/></label><label><span>{lang === "zh" ? "检索词" : "KEYWORDS"}</span><input value={memoryDraft.keywords} onChange={(event) => setMemoryDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder={lang === "zh" ? "用逗号分隔，最多 5 个" : "Comma-separated, up to 5"}/></label><footer><button className="outline-button" onClick={() => setMemoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button className="primary" disabled={!memoryDraft.title.trim() || !memoryDraft.detail.trim()} onClick={saveMemoryItem}>{lang === "zh" ? "保存到记忆库" : "Save to memory"}</button></footer></section></div>}


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
        const titles: Record<SpaceSection, string> = { wishes: zhText ? "我的愿望" : "My desires", about: zhText ? "关于我" : "About me", library: zhText ? "记忆库" : "Memory library", memory: zhText ? "背景与念头" : "Background and thoughts", membership: zhText ? "会员与用量" : "Membership and usage", pet: zhText ? "下载桌宠" : "Desktop pet", look: zhText ? "外观与语言" : "Look and language", sync: zhText ? "同步与数据" : "Sync and data", help: zhText ? "帮助与条款" : "Help and terms" };
        return <section className="full-view settings-view space">
          <div className={`space-layout${settingsSection ? " has-detail" : ""}`}>
            <SpaceNav
              title={zhText ? "我的空间" : "My space"}
              intro={zhText ? "愿望、记忆和设置都在这里。" : "Your desires, memory and settings live here."}
              active={settingsSection}
              onSelect={(id) => { setSettingsSection(id as SpaceSection); scrollSpaceToTop(); }}
              groups={[
                { title: zhText ? "我" : "Me", rows: [
                  { id: "wishes", icon: Sparkle, label: titles.wishes, value: String(sortedGoals.length) },
                  { id: "about", icon: UserCircle, label: titles.about },
                ] },
                { title: zhText ? "记忆" : "Memory", rows: [
                  { id: "library", icon: Brain, label: titles.library, value: String(currentMemoryItems.length) },
                  { id: "memory", icon: Lightbulb, label: titles.memory },
                ] },
                { title: zhText ? "应用" : "App", rows: [
                  // The iPhone app must not link to web checkout (App Store rules).
                  ...(Capacitor.isNativePlatform() ? [] : [{ id: "membership", icon: Crown, label: titles.membership, value: memberPlanLabel(member, lang) }]),
                  // a desktop pet is for computers; the phone app already has the dough on its home screen
                  ...(Capacitor.isNativePlatform() ? [] : [{ id: "pet", icon: Desktop, label: titles.pet }]),
                  { id: "look", icon: Palette, label: titles.look, value: dark ? (zhText ? "深色" : "Dark") : (zhText ? "浅色" : "Light") },
                  { id: "sync", icon: ArrowsClockwise, label: titles.sync },
                  { id: "help", icon: Question, label: titles.help },
                ] },
              ]}
            />
            <div className="space-detail">
              <header className="space-detail-head"><button type="button" className="space-back" onClick={() => setSettingsSection(null)} aria-label={zhText ? "返回我的空间" : "Back to My space"}><ArrowLeft size={22}/></button><h2>{titles[shown]}</h2></header>
              {(shown === "wishes" || shown === "about" || shown === "memory") && <div className="settings-savebar"><span>{syncStatus === "saved" ? <CloudCheck size={18}/> : <FloppyDisk size={18}/>} {syncStatus === "saved" ? (lang === "zh" ? "会自动同步" : "Auto-sync is on") : (lang === "zh" ? "本机副本已保留" : "On-device copy retained")}</span><button className="primary" onClick={saveGoalSettings} disabled={Boolean(spNameError) || beliefCount > MAX_BELIEFS || !goal.companionStyle}>{goalSavedPulse ? t.savedGoal : t.saveGoal}</button></div>}
              {shown === "wishes" && <div className="settings-section">
                <div className="setting-card wish-list-card"><WishList lang={lang} items={sortedGoals} currentId={goal.id} categories={wishCategories} intensityLabels={intensityLabels[lang]} onUpdate={updateGoalById} onOpen={switchGoal} onDelete={deleteOtherGoal} onAdd={addGoal} /></div>
                {goalArchive.length > 0 && <div className="setting-card archive-card"><label>{lang === "zh" ? `已经发生的愿望 · ${goalArchive.length}` : `FULFILLED DESIRES · ${goalArchive.length}`}</label>{goalArchive.slice(0, 5).map((item) => <article key={item.id}><strong>{item.desire[lang] || item.desire[lang === "zh" ? "en" : "zh"]}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : ""}</small></article>)}</div>}
              </div>}
              {shown === "about" && <ProfilePanel lang={lang} profile={profile} onChange={(next) => setProfile(normalizeProfile(next))} name={goal.companionName} onNameChange={(value) => setGoal((current) => ({ ...current, companionName: value }))} />}
              {shown === "memory" && <div className="settings-section profile-panel">
                <p className="setting-hint">{lang === "zh" ? "这一页只属于当前愿望，切换愿望后会换成那个愿望自己的内容。" : "This page belongs to the current desire. Switch desires and it shows that one's own notes."}</p>
                <div className="profile-cards">
                  <div className="memory-for"><span className="wish-chip is-current">{lang === "zh" ? "当前愿望" : "Current desire"}</span><span>{goalTitle(goal, lang)}</span></div>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "我的背景与处境" : "My context"}</h3>
                    <label className="wish-field"><span className="profile-sub">{lang === "zh" ? "和这个愿望有关的经历、现状和顾虑" : "What has happened, where things stand, and what worries you"}</span><textarea maxLength={MAX_BACKGROUND} value={goal.background[lang]} onChange={(event) => setGoal((current) => ({ ...current, background: { ...current.background, [lang]: event.target.value } }))} placeholder={lang === "zh" ? "写得越具体，回复越贴合你的情况。" : "The more specific, the better the replies fit."}/></label>
                    <small className="profile-count">{goal.background[lang].length} / {MAX_BACKGROUND}</small>
                  </section>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "想换掉的念头" : "Thoughts to turn around"}</h3>
                    <p className="profile-sub">{lang === "zh" ? "反复冒出来、想换掉的旧念头。点「转念」会带去重写，写好新版本后，这一句就从这里拿掉。" : "Old thoughts that keep coming back. Tap Turn it to take one into Revision; once you accept the new version, it leaves this list."}</p>
                    {parseBeliefs(beliefDraft).length ? <ul className="thought-rows">{parseBeliefs(beliefDraft).map((item, index) => <li key={`${index}-${item}`}><span>{item}</span><button type="button" className="thought-turn" onClick={() => turnBelief(item)}>{lang === "zh" ? "转念" : "Turn it"}</button><button type="button" className="profile-remove" aria-label={lang === "zh" ? `删除：${item}` : `Delete: ${item}`} onClick={() => removeBeliefWithUndo(item)}><X size={16}/></button></li>)}</ul> : <p className="setting-empty">{lang === "zh" ? "还没有写下想换掉的念头。" : "Nothing written here yet."}</p>}
                    {beliefCount < MAX_BELIEFS && <div className="profile-topic-add"><input value={beliefInput} maxLength={200} onChange={(event) => setBeliefInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addBelief(); } }} placeholder={lang === "zh" ? "例如：他根本不在乎我" : "e.g. They don't really care"} aria-label={lang === "zh" ? "添加一个想换掉的念头" : "Add a thought to turn around"}/><button type="button" className="profile-topic-plus" disabled={!beliefInput.trim()} onClick={addBelief}><Plus size={15}/> {lang === "zh" ? "添加" : "Add"}</button></div>}
                    <small className={`profile-count${beliefCount > MAX_BELIEFS ? " over" : ""}`}>{beliefCount} / {MAX_BELIEFS}</small>
                  </section>
                </div>
              </div>}
              {shown === "library" && <div className="settings-section profile-panel library-section">
                <p className="setting-hint">{lang === "zh" ? "AlreaDough 从对话里记下的、以后还用得上的事。每个愿望各有一份，每次只取回和眼前话题有关的几条。" : "What AlreaDough keeps from your conversations. Each desire has its own set, and only the few that fit the moment are brought back."}</p>
                <div className="profile-cards">
                  <div className="memory-for"><span className="wish-chip is-current">{lang === "zh" ? "当前愿望" : "Current desire"}</span><span>{goalTitle(goal, lang)}</span></div>
                  {otherGoalMemoryCount > 0 && <div className="library-elsewhere"><p>{lang === "zh" ? `其他愿望里还有 ${otherGoalMemoryCount} 条记忆和场景，切换到那个愿望后会显示在这里。` : `${otherGoalMemoryCount} more memories and scenes belong to your other desires. Switch to one to see them here.`}</p><button type="button" className="profile-topic-plus" onClick={() => { setSettingsSection("wishes"); scrollSpaceToTop(); }}>{lang === "zh" ? "去切换" : "Switch"}</button></div>}
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "AlreaDough 对这个愿望的理解" : "What AlreaDough understands so far"}</h3>
                    <p className="library-summary">{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成简短摘要。" : "A short summary will form after conversations begin.")}</p>
                    <small className="profile-sub">{lang === "zh" ? "每次回复后自动更新，不会把全部历史重发一遍。" : "Updated after each reply, so the full history is never resent."}</small>
                  </section>
                  <section className="profile-card">
                    <div className="library-card-head"><h3>{lang === "zh" ? `记住的事 · ${currentMemoryItems.length}` : `Remembered · ${currentMemoryItems.length}`}</h3><button type="button" className="profile-topic-plus" onClick={() => openMemoryEditor()}><Plus size={15}/> {lang === "zh" ? "添加" : "Add"}</button></div>
                    {currentMemoryItems.length > 0 && <div className="wish-pills library-filter" role="group" aria-label={lang === "zh" ? "筛选记忆" : "Filter memories"}><button type="button" className={memoryFilter === "all" ? "selected" : ""} onClick={() => setMemoryFilter("all")}>{lang === "zh" ? "全部" : "All"} <small>{currentMemoryItems.length}</small></button>{memoryKinds.map((kind) => { const count = currentMemoryItems.filter((item) => item.kind === kind.id).length; return count ? <button type="button" key={kind.id} className={memoryFilter === kind.id ? "selected" : ""} onClick={() => setMemoryFilter(kind.id)}>{lang === "zh" ? kind.zh : kind.en} <small>{count}</small></button> : null; })}</div>}
                    {filteredMemoryItems.length ? <ul className="memory-rows">{filteredMemoryItems.map((item) => <li key={item.id} className={item.pinned ? "pinned" : ""}><div className="memory-row-head"><span className="wish-chip">{lang === "zh" ? memoryKinds.find((kind) => kind.id === item.kind)?.zh : memoryKinds.find((kind) => kind.id === item.kind)?.en}</span>{item.pinned && <span className="wish-chip is-current">{lang === "zh" ? "已置顶" : "Pinned"}</span>}<div className="memory-row-actions"><button type="button" onClick={() => toggleMemoryPin(item.id)} aria-pressed={item.pinned} aria-label={item.pinned ? (lang === "zh" ? "取消置顶" : "Unpin") : (lang === "zh" ? "置顶" : "Pin")}><PushPin size={16} weight={item.pinned ? "fill" : "regular"}/></button><button type="button" onClick={() => openMemoryEditor(item)} aria-label={lang === "zh" ? "编辑记忆" : "Edit memory"}><PencilSimple size={16}/></button><button type="button" className="memory-row-delete" onClick={() => deleteMemoryItem(item.id)} aria-label={lang === "zh" ? "删除记忆" : "Delete memory"}><Trash size={16}/></button></div></div><strong>{item.title}</strong><p>{item.detail}</p>{item.keywords.length > 0 && <footer>{item.keywords.map((keyword) => <small key={keyword}>{keyword}</small>)}</footer>}</li>)}</ul> : currentMemoryItems.length === 0 ? <div className="library-empty"><Brain size={22}/><p>{lang === "zh" ? "继续聊天，值得记住的事会慢慢出现在这里；也可以亲手写下第一条。" : "Keep talking and what is worth keeping will appear here, or write the first one yourself."}</p></div> : <p className="setting-empty">{lang === "zh" ? "这一类还没有记忆。" : "Nothing in this category yet."}</p>}
                  </section>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? `已接纳的新场景 · ${goal.acceptedSceneLedger[lang].length}` : `Accepted scenes · ${goal.acceptedSceneLedger[lang].length}`}</h3>
                    <p className="profile-sub">{lang === "zh" ? "在故事或重写里接纳的版本。AlreaDough 会把它们当作已经发生的事，保留最近 8 条。点开看全文。" : "Versions you accepted in Stories or Revision. AlreaDough treats them as already done and keeps the latest 8. Tap to read in full."}</p>
                    {goal.acceptedSceneLedger[lang].length ? <ul className="scene-rows">{goal.acceptedSceneLedger[lang].map((item, index) => <li key={`${index}-${item.slice(0, 24)}`}><button type="button" className={openScene === index ? "open" : ""} aria-expanded={openScene === index} onClick={() => setOpenScene(openScene === index ? null : index)}><span>{item}</span><CaretDown size={15}/></button></li>)}</ul> : <p className="setting-empty">{lang === "zh" ? "在故事或重写里接纳的场景会出现在这里。" : "Scenes you accept in Stories or Revision will appear here."}</p>}
                  </section>
                </div>
              </div>}
              {shown === "membership" && <MembershipPanel lang={lang} member={member} onRefresh={refreshMember} />}
              {shown === "pet" && <DesktopPetPanel lang={lang} />}
              {shown === "look" && <div className="settings-section profile-panel look-section">
                <p className="setting-hint">{lang === "zh" ? "日夜间模式和字号只改这台设备上的样子。" : "Day/night and text size only change how it looks on this device."}</p>
                <div className="profile-cards">
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "日夜间模式" : "Day and night"}</h3>
                    <div className="look-options" role="radiogroup" aria-label={lang === "zh" ? "日夜间模式" : "Day and night"}>
                      {([["light", Sun, "浅色", "Light"], ["dark", Moon, "深色", "Dark"]] as const).map(([option, Icon, zhLabel, enLabel]) => <button key={option} type="button" role="radio" aria-checked={(option === "dark") === dark} className={(option === "dark") === dark ? "selected" : ""} onClick={() => chooseTheme(option)}>
                        <Icon size={22} aria-hidden="true" />
                        <small>{lang === "zh" ? zhLabel : enLabel}</small>
                      </button>)}
                    </div>
                    <p className="profile-sub theme-note">{lang === "zh" ? "手机最顶上那一条的颜色由手机系统决定，只能跟随手机自己的深色模式：在手机设置里打开深色模式时，顶部才会和页面一起变暗；没打开时，顶部就是浅色。换了模式后如果顶部和页面颜色对不上，在后台把 AlreaDough 上划关掉，再重新打开就好。" : "The strip at the very top of your phone takes its colour from the phone itself, so it can only follow your phone's Dark Mode: it darkens with the page only when Dark Mode is on in your phone's settings, and stays light when it's off. If the top and the page don't match after you switch, swipe AlreaDough away in the app switcher and open it again."}</p>
                  </section>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "界面语言" : "Language"}</h3>
                    <div className="wish-pills" role="radiogroup" aria-label={lang === "zh" ? "界面语言" : "Language"}>
                      {([["zh", "简体中文"], ["en", "English"]] as const).map(([option, label]) => <button key={option} type="button" role="radio" aria-checked={lang === option} className={lang === option ? "selected" : ""} onClick={() => { if (lang !== option) switchLanguage(); }}>{label}</button>)}
                    </div>
                  </section>
                  <FontSizePanel lang={lang} />
                </div>
              </div>}
              {shown === "sync" && <div className="settings-section profile-panel data-section">
                <p className="setting-hint">{lang === "zh" ? "换设备、带走资料、重新开始，都在这里。" : "Switch devices, take your data with you, or start over."}</p>
                <div className="profile-cards">
                  <SyncPanel lang={lang} sessionId={sessionId} syncStatus={syncStatus} hasLocalData={goal.setupComplete} />
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "导出我的数据" : "Export my data"}</h3>
                    <p className="profile-sub">{lang === "zh" ? "下载一个压缩包：解压后双击里面的 index.html，就能在浏览器里查看、搜索你的愿望、对话、记忆和故事；原始数据也一起附上（JSON 格式）。私密照片和录音不在里面。" : "Download a .zip: unzip it and open index.html to read and search your desires, conversations, memories and stories in a browser. The raw data comes along as JSON. Private photos and audio are not included."}</p>
                    <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={exportMyData}><DownloadSimple size={16} /> {lang === "zh" ? "导出压缩包" : "Download .zip"}</button></div>
                  </section>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "重新走一遍开场" : "Run the opening again"}</h3>
                    <p className="profile-sub">{lang === "zh" ? "把开场的问题再填一遍。你填的内容会加进现在的账号，已有的愿望、记忆和对话都不会被删除。" : "Answer the opening questions again. What you write is added to this account; nothing you already have is deleted."}</p>
                    <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={() => setReplaying(true)}><ArrowCounterClockwise size={16} /> {lang === "zh" ? "开始" : "Start"}</button></div>
                  </section>
                  <section className="profile-card data-danger">
                    <h3>{lang === "zh" ? "清除全部数据" : "Clear everything"}</h3>
                    <p className="profile-sub">{lang === "zh" ? "云端和这台设备上的愿望、对话、记忆、故事、照片与音频都会删除，不能恢复。需要的话先导出一份。" : "Desires, conversations, memories, stories, photos and audio in the cloud and on this device are deleted and cannot be recovered. Export a copy first if you want one."}</p>
                    <div className="data-actions"><button type="button" className="data-danger-button" onClick={async () => { if (await askConfirm({ title: t.confirm, body: lang === "zh" ? "愿望、对话、记忆、故事和本机的照片与音频都会删除，不能恢复。" : "Desires, conversations, memories, stories, and this device's photos and audio will be deleted. This can't be undone.", confirmLabel: lang === "zh" ? "全部清除" : "Clear everything", cancelLabel: lang === "zh" ? "取消" : "Cancel" })) { void fetch("/api/space", { method: "DELETE", headers: { "x-already-session-id": sessionId } }); removeStored("already-private-state-v5"); removeStored("already-practice-checkins-v1"); removeStored("already-subliminal-v1"); removeStored("already-vision-project-v1"); indexedDB.deleteDatabase("already-private-audio-v1"); indexedDB.deleteDatabase("already-private-vision-v1"); removeStored("already-opening-v1"); setProfile(emptyProfile); setOtherGoals([]); setGoal({ ...defaultGoal }); setGoalArchive([]); setConversationArchive([]); setConversationId(""); setSpNameDraft(""); setBeliefDraft(""); setStoryLibrary([]); setMessages([]); setRevisions([]); setCheckIns([]); setBoard([]); setView("home"); setOnboardingStep(0); } }}><Trash size={16} /> {lang === "zh" ? "清除全部数据" : "Clear everything"}</button></div>
                  </section>
                </div>
              </div>}
              {shown === "help" && <div className="settings-section profile-panel help-section">
                <p className="setting-hint">{lang === "zh" ? "想反馈问题、举报内容，或查看规则说明，都在这里。" : "Send feedback, report content, or read how things work."}</p>
                <div className="profile-cards">
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "联系与举报" : "Contact & reports"}</h3>
                    <p className="profile-sub">{lang === "zh" ? "发现不当、违法或让你不舒服的内容，可以在这里举报。每条 AI 回复下面也有“举报”按钮。我们会尽快查看。" : "If you see anything inappropriate, unlawful, or upsetting, report it here. Every AI reply also has a Report button. We read these as soon as we can."}</p>
                    <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={() => setReportTarget({})}><Flag size={16} /> {lang === "zh" ? "举报内容或反馈问题" : "Report content or send feedback"}</button></div>
                    <SiteRecord lang={lang} />
                  </section>
                  <section className="profile-card">
                    <h3>{lang === "zh" ? "说明与条款" : "Notices & terms"}</h3>
                    <ul className="help-links">
                      {([
                        ["/pricing", Crown, lang === "zh" ? "会员与价格" : "Membership & pricing"],
                        ["/trust", ShieldCheck, t.trust],
                        ["/privacy", LockSimple, lang === "zh" ? "隐私说明" : "Privacy"],
                        ["/terms", FileText, lang === "zh" ? "测试版条款" : "Beta terms"],
                        ["/copyright", Copyright, lang === "zh" ? "素材与版权" : "Content & copyright"],
                      ] as const).map(([href, Icon, label]) => <li key={href}><a href={href}><span className="help-icon" aria-hidden="true"><Icon size={18} /></span><span>{label}</span><CaretRight size={16} aria-hidden="true" /></a></li>)}
                    </ul>
                  </section>
                </div>
              </div>}
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
