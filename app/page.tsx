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
  Check,
  ArrowClockwise,
  BookmarkSimple,
  ChatCircleDots,
  CloudCheck,
  CloudSlash,
  Copy,
  FloppyDisk,
  NotePencil,
  StopCircle,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import SubliminalStudio, { PracticeCheckIn, practiceStreak, todayKey } from "./components/SubliminalStudio";
import VisionCanvasStudio from "./components/VisionCanvasStudio";
import DoughPet from "./components/DoughPet";
import { AlreaDoughBrand, DoughGlyph } from "./components/DoughGlyph";
import { validateSpName } from "@/lib/name-policy";

type View = "home" | "subliminal" | "story" | "revision" | "board" | "memory" | "settings";
type Lang = "zh" | "en";
type Message = { id: string; role: "ai" | "user"; text: string; feedback?: "helpful" | "missed"; saved?: boolean };
type Conversation = { id: string; title: string; createdAt: string; messages: Message[] };
type BoardItem = { id: number; title: string; source: string; image?: string };
type Revision = { id: number; old: string; revised: string; date: string };
type GoalStatus = "active" | "embodiment" | "fulfilled" | "paused";
type WishCategory = "relationship" | "wealth" | "self" | "lifestyle" | "other";
type CompanionStyle = "gentle" | "anchor" | "friend" | "direct" | "custom" | "";
type CoachMode = "release" | "assumption" | "subconscious";
type GoalProfile = {
  id: string;
  setupComplete: boolean;
  status: GoalStatus;
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
  createdAt: string;
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
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
  error?: string;
  message?: string;
};
type SearchImage = { title: string; image: string; source: string; credit: string; license: string; provider: string; downloadLocation?: string };

const emptyStoryDraft: StoryDraft = { title: "", city: "", subtitle: "", scene: "", anchor: "" };
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
  wishCategory: "relationship",
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
  createdAt: "",
};

const MAX_BELIEFS = 12;
const MAX_BACKGROUND = 4000;

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

const wishCategories: Array<{ id: WishCategory; zh: string; en: string; zhDescription: string; enDescription: string }> = [
  { id: "relationship", zh: "关系与特定对象", en: "Relationship & SP", zhDescription: "爱情、友情、家庭或一位特定的人", enDescription: "Love, friendship, family, or a specific person" },
  { id: "wealth", zh: "金钱与事业", en: "Money & Career", zhDescription: "收入、工作、项目或机会", enDescription: "Income, work, projects, or opportunities" },
  { id: "self", zh: "自我与状态", en: "Self & Being", zhDescription: "自我概念、身体感受或个人成长", enDescription: "Self-concept, how you feel, or personal growth" },
  { id: "lifestyle", zh: "生活与体验", en: "Life & Experiences", zhDescription: "居住、旅行、物品或生活方式", enDescription: "Home, travel, possessions, or lifestyle" },
  { id: "other", zh: "其他愿望", en: "Something Else", zhDescription: "用你自己的方式定义它", enDescription: "Define it in your own words" },
];

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
    previous: "← 上一个", next: "下一个故事 →", revisionTitle: "让这一刻按你的方式发生", revisionCopy: "旧版本只需出现一次。接纳后，我们只保留你的新故事。", oldLabel: "刚刚什么让你离开了新故事？", oldPlaceholder: "例如：他很久没有回复，我开始觉得他不在意我……", makeRevision: "✶ 为我重写这一刻", chosen: "你选择的新版本", accepted: "已经接纳 ✓", acceptStory: "接纳为我的新故事", history: "已接纳",
    boardTitle: "收藏你正在走进的生活", boardCopy: "从授权真实摄影中寻觅灵感，或用自己的照片编织专属愿景板。不会使用 AI 生成图片。", realPhotos: "寻梦灵感", photoCopy: "在可商用授权的真实摄影中，寻找属于你的生活画面", searchPlaceholder: "例如：冬日旅行、理想的新家", searching: "寻觅中", search: "开始寻梦", collect: "＋ 收进我的愿景", manual: "或者添加你已经喜欢的素材", nameScene: "为这个画面命名", pasteLink: "粘贴任意网站的来源链接或图片直链", addLink: "添加链接", local: "从本机添加", source: "查看来源 ↗",
    private: "我的空间", space: "我的已完成空间", privateCopy: "愿望、记忆、对话与练习会在登录设备间同步；私密照片和音频仍只留在本机。", coreWish: "当前唯一愿望", tone: "陪伴语气", toneCopy: "温柔、坚定，不分析可能性，不用旧故事反驳新选择。", region: "使用范围", regionCopy: "面向 OpenAI 支持地区的海外中文与英文用户。", clear: "清除我的练习数据", confirm: "要清除云端与这台设备上保存的所有练习吗？", nav: ["陪伴", "故事", "重写", "愿景", "入梦声场"], ariaSettings: "打开私人设定", ariaNav: "主导航", send: "发送", activeGoal: "当前愿望", beliefs: "限制性信念地图", memory: "AI 旅程摘要", saveGoal: "保存更改", savedGoal: "更改已保存", generating: "AI 正在进入这个场景……", generateStory: "✶ 为这一刻生成专属故事", aiReady: "AI 已连接", aiSetup: "AI 待配置", trust: "AI 与安全说明",
  },
  en: {
    day: "DAY 1", greeting: "Welcome back", hero: <>You do not need to convince anyone.<br />Return to the story you have already chosen.</>, wish: "MY DESIRE", happened: "ALREADY MINE", start: "Begin today’s practice",
    newStory: "YOUR NEW STORY", moment: "Which moment will you enter today?", enter: "Enter the story", returnBelief: "RETURN TO KNOWING", need: "What do you need right now?", talk: "Talk with your companion", quiet: "Turn down the volume of doubt", rewrite: "Revise this moment", accept: "Choose the version that belongs to you",
    companion: "BELIEF COMPANION · GLOBAL BETA", here: "I’m here", companionCopy: "Give me the old story. Your AI uses your active desire, belief map, and recent journey to bring you back to the version you chose.", chatPlaceholder: "Write the thought that just appeared…",
    previous: "← Previous", next: "Next story →", revisionTitle: "Let this moment happen your way", revisionCopy: "The old version only needs to appear once. After revision, we keep your new story.", oldLabel: "What just pulled you away from your new story?", oldPlaceholder: "For example: He took a long time to reply, and I started feeling unimportant…", makeRevision: "✶ Revise this moment for me", chosen: "THE VERSION YOU CHOOSE", accepted: "Accepted ✓", acceptStory: "Accept as my new story", history: "ACCEPTED",
    boardTitle: "Collect the life you are entering", boardCopy: "Discover inspiration in licensed real photography, or weave a personal vision board from your own photos. No AI-generated imagery.", realPhotos: "Discover Dreamscapes", photoCopy: "Find the life you imagine through commercially licensed real photography", searchPlaceholder: "e.g. couple in Hokkaido snow", searching: "Dreaming", search: "Discover", collect: "+ Keep in my vision", manual: "or add something you already love", nameScene: "Name this scene", pasteLink: "Paste any source link or direct image URL", addLink: "Add link", local: "Upload", source: "View source ↗",
    private: "PRIVATE SPACE · GLOBAL BETA", space: "My already-done space", privateCopy: "Your desire card, journey summary, chats, and revisions stay on this device in this beta. Only the limited context needed for a response is sent to the AI.", coreWish: "ONE ACTIVE DESIRE", tone: "COMPANION TONE", toneCopy: "Gentle and certain. It does not debate possibility or use the old story against your new choice.", region: "BETA REGION", regionCopy: "Created for Chinese- and English-speaking users in OpenAI-supported regions.", clear: "Clear practice data on this device", confirm: "Clear all practice data saved on this device?", nav: ["Companion", "Stories", "Revise", "Vision", "Dreamscape"], ariaSettings: "Open private settings", ariaNav: "Main navigation", send: "Send", activeGoal: "ACTIVE GOAL", beliefs: "LIMITING-BELIEF MAP", memory: "AI JOURNEY SUMMARY", saveGoal: "Save active desire card", savedGoal: "Desire card saved", generating: "Your AI is entering this scene…", generateStory: "✶ Create my personal story", aiReady: "LIVE AI", aiSetup: "AI SETUP NEEDED", trust: "AI & Safety Notice",
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
  const [spNameDraft, setSpNameDraft] = useState(defaultGoal.spName);
  const [sessionId, setSessionId] = useState("local-beta");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [conversationArchive, setConversationArchive] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"profile" | "companion" | "memory" | "data">("profile");
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "saving" | "offline">("loading");
  const [cloudReady, setCloudReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [oldScene, setOldScene] = useState("");
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
  const [savedPulse, setSavedPulse] = useState(false);
  const [goalSavedPulse, setGoalSavedPulse] = useState(false);
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [declined, setDeclined] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

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
          background: savedGoal.background || defaultGoal.background,
          spPronunciation: savedGoal.spPronunciation || "",
          canon: savedGoal.canon || defaultGoal.canon,
          responsePreferences: savedGoal.responsePreferences || defaultGoal.responsePreferences,
          acceptedSceneLedger: savedGoal.acceptedSceneLedger || defaultGoal.acceptedSceneLedger,
        } as GoalProfile;
        setGoal(restoredGoal);
        setSpNameDraft(restoredGoal.spName);
        setBeliefDraft((restoredGoal.beliefs[restoredLang] || []).join("\n"));
      }
      if (Array.isArray(data.storyLibrary)) setStoryLibrary((data.storyLibrary as Story[]).slice(0, 6));
      if (Array.isArray(data.goalArchive)) setGoalArchive((data.goalArchive as GoalProfile[]).slice(0, 20));
      if (Array.isArray(data.messages)) setMessages(normalizeMessages(data.messages));
      if (typeof data.conversationId === "string") setConversationId(data.conversationId);
      if (Array.isArray(data.conversationArchive)) setConversationArchive((data.conversationArchive as Conversation[]).slice(0, 30).map((item) => ({ ...item, messages: normalizeMessages(item.messages) })));
      if (Array.isArray(data.revisions)) setRevisions((data.revisions as Revision[]).slice(0, 20));
      if (Array.isArray(data.board)) setBoard(data.board as BoardItem[]);
      if (Array.isArray(data.checkIns)) setCheckIns(data.checkIns as PracticeCheckIn[]);
    };
    try {
      const saved = localStorage.getItem("already-private-state-v5");
      if (saved) restore(JSON.parse(saved));
      const savedCheckIns = localStorage.getItem("already-practice-checkins-v1");
      if (savedCheckIns) setCheckIns(JSON.parse(savedCheckIns));
      const storedSession = localStorage.getItem("already-session-id");
      if (storedSession) setSessionId(storedSession);
      else {
        const created = crypto.randomUUID();
        localStorage.setItem("already-session-id", created);
        setSessionId(created);
      }
    } catch { /* the private space can always start fresh */ }
    finally {
      setAcknowledged(localStorage.getItem("already-acknowledged-v1") === "yes");
      setHydrated(true);
      fetch("/api/space", { cache: "no-store" })
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

  useEffect(() => {
    if (!hydrated) return;
    const space = { lang, goal, goalArchive: goalArchive.slice(0, 20), conversationId, conversationArchive: conversationArchive.slice(0, 30), messages: messages.slice(-80), revisions: revisions.slice(0, 20), board, storyLibrary, checkIns };
    localStorage.setItem("already-private-state-v5", JSON.stringify(space));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    if (!cloudReady) return;
    const timeout = window.setTimeout(() => {
      setSyncStatus("saving");
      fetch("/api/space", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space }) })
        .then((response) => setSyncStatus(response.ok ? "saved" : "offline"))
        .catch(() => setSyncStatus("offline"));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [hydrated, cloudReady, lang, goal, goalArchive, conversationId, conversationArchive, messages, revisions, board, storyLibrary, checkIns]);

  useEffect(() => {
    localStorage.setItem("already-practice-checkins-v1", JSON.stringify(checkIns));
  }, [checkIns]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), [lang]);
  const t = ui[lang];
  const currentStory = storyLibrary[Math.min(storyIndex, Math.max(0, storyLibrary.length - 1))] || emptyStory;
  const storyText = currentStory.text[lang];
  const spNameError = spNameDraft.trim() ? validateSpName(spNameDraft, lang) : "";
  const beliefCount = parseBeliefs(beliefDraft).length;
  const activeThoughts = goal.beliefs[lang];
  const sessionMessages = messages;
  const streak = useMemo(() => practiceStreak(checkIns), [checkIns]);
  const checkedToday = checkIns.some((item) => item.date === todayKey());
  const suggestions = lang === "zh" ? ["冬日旅行", "理想的新家", "浪漫约会", "丰盛日常"] : ["Winter trip", "Dream home", "Romantic date", "Abundant everyday life"];
  const primaryNav = [
    { id: "home" as View, label: t.nav[0], icon: House },
    { id: "story" as View, label: t.nav[1], icon: BookOpenText },
    { id: "revision" as View, label: t.nav[2], icon: ArrowsClockwise },
    { id: "board" as View, label: t.nav[3], icon: ImagesSquare },
    { id: "subliminal" as View, label: t.nav[4], icon: Waveform },
  ];

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

  const callCompanion = async (mode: "chat" | "revision" | "story", userInput: string, signal?: AbortSignal, recentOverride?: Message[]) => {
    const response = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        },
        recentMessages: recentOverride || (mode === "chat" ? sessionMessages.slice(-10) : messages.slice(-10)),
        recentRevisions: revisions.slice(0, 4).map((item) => item.revised),
      }),
    });
    const data = await response.json() as AIResponse;
    if (!response.ok || !data.reply) throw new Error(data.message || data.error || "AI_REQUEST_FAILED");
    setAiConnected(data.model !== "desire-preserving-safety-route" ? true : aiConnected);
    if (data.journeySummary) {
      setGoal((current) => ({
        ...current,
        journeySummary: { ...current.journeySummary, [lang]: data.journeySummary || current.journeySummary[lang] },
      }));
    }
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
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "ai", text: reply }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "ai",
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
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "ai", text: reply }]);
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

  const onChatKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) sendChat();
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

  const acceptRevision = () => {
    if (!newScene) return;
    setRevisions((items) => [{ id: Date.now(), old: oldScene, revised: newScene, date: new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") }, ...items]);
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
    setImageQuery(query); setImageSearching(true); setImageSearchError("");
    try {
      const response = await fetch(`/api/images?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("search failed");
      const data = await response.json() as { results?: SearchImage[] };
      const results = data.results || [];
      setImageResults(results);
      if (!results.length) setImageSearchError(lang === "zh" ? "这组关键词暂时没有找到合适的真实照片，换一个更宽泛的描述试试。" : "No suitable real photos appeared for that phrase. Try a broader description.");
    } catch {
      setImageSearchError(lang === "zh" ? "授权照片搜索暂时没有连接成功，请稍后再试，或使用“用我的照片制作”。" : "Licensed-photo search could not connect. Try again later or use Create from My Photos.");
    } finally { setImageSearching(false); }
  };

  const collectSearchImage = (item: SearchImage) => {
    setBoard((items) => [{ id: Date.now(), title: item.title, source: item.source, image: item.image }, ...items]);
    if (item.downloadLocation) fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadLocation: item.downloadLocation }) }).catch(() => null);
  };

  const recordCheckIn = (feeling: PracticeCheckIn["feeling"]) => {
    const date = todayKey();
    setCheckIns((items) => [{ date, feeling }, ...items.filter((item) => item.date !== date)]);
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
      setConversationArchive((items) => [{ id: conversationId || crypto.randomUUID(), title: conversationTitle(messages, lang), createdAt: new Date().toISOString(), messages }, ...items.filter((item) => item.id !== conversation.id && item.id !== conversationId)].slice(0, 30));
    } else {
      setConversationArchive((items) => items.filter((item) => item.id !== conversation.id));
    }
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    setHistoryOpen(false);
    setView("home");
  };

  const onboardingCanContinue = [
    Boolean(goal.companionName.trim()),
    Boolean(goal.desire[lang].trim()),
    Boolean(goal.companionStyle && (goal.companionStyle !== "custom" || goal.tone[lang].trim())),
  ][onboardingStep];

  if (!hydrated) {
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}><div className="onboarding-loading brand" aria-label={lang === "zh" ? "正在打开 AlreaDough" : "Opening AlreaDough"}><AlreaDoughBrand /></div></main>;
  }

  if (!acknowledged) {
    return <main className="app-shell acknowledge-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <section className="acknowledge-card">
        <span className="brand"><AlreaDoughBrand /></span>
        {declined ? <><p className="eyebrow">YOUR CHOICE</p><h1>{lang === "zh" ? "你尚未进入 AlreaDough" : "You have not entered AlreaDough"}</h1><p>{lang === "zh" ? "这台设备没有保存同意记录。你可以关闭页面，或返回重新查看。" : "No consent record was saved on this device. You may close this page or go back to review."}</p><button className="outline-button" onClick={() => setDeclined(false)}>{lang === "zh" ? "返回" : "Go back"}</button></> : <>
          <p className="eyebrow">BEFORE YOU ENTER</p>
          <h1>{lang === "zh" ? "先确认这是一段你愿意进入的体验。" : "Confirm that this is an experience you choose to enter."}</h1>
          <p>{lang === "zh" ? "继续即表示你已阅读并同意测试版条款、隐私说明、AI 与安全说明及素材与版权规则。完整文本会一直保留在“我的空间”。" : "By continuing, you confirm that you have read and accept the beta terms, privacy notice, AI and safety notice, and content and copyright rules. They remain available in My Space."}</p>
          <div className="acknowledge-links"><a href="/terms" target="_blank">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a href="/privacy" target="_blank">{lang === "zh" ? "隐私说明" : "Privacy"}</a><a href="/trust" target="_blank">{lang === "zh" ? "AI 与安全" : "AI & safety"}</a><a href="/copyright" target="_blank">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
          <label className="acknowledge-check"><input type="checkbox" id="acknowledge-choice"/><span>{lang === "zh" ? "我已阅读并同意以上说明。" : "I have read and agree to the notices above."}</span></label>
          <div className="acknowledge-actions"><button className="outline-button" onClick={() => setDeclined(true)}>{lang === "zh" ? "不同意并退出" : "Decline and exit"}</button><button className="primary" onClick={() => { const input = document.querySelector<HTMLInputElement>("#acknowledge-choice"); if (!input?.checked) { input?.focus(); return; } localStorage.setItem("already-acknowledged-v1", "yes"); setAcknowledged(true); }}>{lang === "zh" ? "同意并进入" : "Agree and enter"}</button></div>
        </>}
      </section>
    </main>;
  }

  if (!goal.setupComplete) {
    const steps = lang === "zh"
      ? ["认识你", "一个愿望", "陪伴方式"]
      : ["Meet you", "One desire", "Companion style"];
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <header className="onboarding-topbar"><span className="brand"><AlreaDoughBrand /></span><div className="top-actions"><button className="language-toggle" onClick={switchLanguage}>{lang === "zh" ? "EN" : "中"}</button><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></div></header>
      <section className="onboarding-view">
        <div className="onboarding-progress" aria-label={lang === "zh" ? `第 ${onboardingStep + 1} 步，共 3 步` : `Step ${onboardingStep + 1} of 3`}><i style={{ width: `${((onboardingStep + 1) / 3) * 100}%` }}/></div>
        <p className="eyebrow">{steps[onboardingStep]}</p>
        {onboardingStep === 0 && <div className="onboarding-panel"><h1>{lang === "zh" ? "我该怎么称呼你？" : "What should I call you?"}</h1><p>{lang === "zh" ? "先用一个你喜欢的称呼开始。语言和更多资料之后都可以随时修改。" : "Begin with a name that feels like you. Language and other details can change anytime."}</p><label><span>{lang === "zh" ? "你的称呼" : "YOUR NAME"}</span><input maxLength={24} value={goal.companionName} onChange={(event) => setGoal((current) => ({ ...current, companionName: event.target.value }))} placeholder={lang === "zh" ? "例如：安安" : "For example: Mia"}/></label></div>}
        {onboardingStep === 1 && <div className="onboarding-panel"><h1>{lang === "zh" ? "现在，只选择一个愿望。" : "For now, choose one desire."}</h1><p>{lang === "zh" ? "选一个生活方向，再写下它已经实现时，你正在过怎样的生活。" : "Choose one area of life, then describe the life you are living when it is fulfilled."}</p><div className="option-card-grid category-grid">{wishCategories.map((category) => <button key={category.id} className={goal.wishCategory === category.id ? "selected" : ""} onClick={() => setGoal((current) => ({ ...current, wishCategory: category.id }))}><strong>{lang === "zh" ? category.zh : category.en}</strong><small>{lang === "zh" ? category.zhDescription : category.enDescription}</small></button>)}</div><label><span>{lang === "zh" ? "它已经实现时，我的生活是" : "WHEN IT IS ALREADY MINE, MY LIFE IS"}</span><textarea value={goal.desire[lang]} onChange={(event) => setGoal((current) => ({ ...current, desire: { ...current.desire, [lang]: event.target.value } }))} placeholder={lang === "zh" ? "用你自己的话写下这个愿望……" : "Write this desire in your own words…"}/></label></div>}
        {onboardingStep === 2 && <div className="onboarding-panel onboarding-confirm"><h1>{lang === "zh" ? "你希望怎样被陪伴？" : "How do you want to be accompanied?"}</h1><p>{lang === "zh" ? "先选最接近你的方式。背景、触发点和更多偏好可以进入后在“我的空间”补充。" : "Choose the closest style. Add context, triggers, and more preferences later in My Space."}</p><div className="option-card-grid companion-style-grid">{companionStyles.map((style) => <button key={style.id} className={goal.companionStyle === style.id ? "selected" : ""} onClick={() => chooseCompanionStyle(style.id)}><strong>{lang === "zh" ? style.zh : style.en}</strong><small>{lang === "zh" ? style.zhDescription : style.enDescription}</small></button>)}</div>{goal.companionStyle === "custom" && <label><span>{lang === "zh" ? "我的专属陪伴方式" : "MY CUSTOM COMPANION STYLE"}</span><textarea value={goal.tone[lang]} onChange={(event) => setGoal((current) => ({ ...current, tone: { ...current.tone, [lang]: event.target.value } }))}/></label>}</div>}
        <footer className="onboarding-actions"><button className="outline-button" onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))} disabled={onboardingStep === 0}>{lang === "zh" ? "返回" : "Back"}</button><button className="primary dough-action" disabled={!onboardingCanContinue} onClick={() => onboardingStep === 2 ? finishOnboarding() : setOnboardingStep((step) => Math.min(2, step + 1))}>{onboardingStep === 2 ? (lang === "zh" ? "进入 AlreaDough" : "Enter AlreaDough") : (lang === "zh" ? "继续" : "Continue")}</button></footer>
      </section>
    </main>;
  }

  return (
    <main className="app-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <aside className="app-rail">
        <button className="brand" onClick={() => navigate("home")} aria-label="AlreaDough home"><AlreaDoughBrand /></button>
        <button className="rail-new-chat dough-action" onClick={beginNewConversation}><Plus size={18}/><span>{lang === "zh" ? "新对话" : "New conversation"}</span></button>
        <button className="rail-history" onClick={() => setHistoryOpen(true)}><ChatCircleDots size={18}/><span>{lang === "zh" ? "对话记录" : "Conversation history"}</span><small>{conversationArchive.length}</small></button>
        <nav className="rail-nav" aria-label={t.ariaNav}>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="rail-footer">
          <span className={`ai-badge ${aiConnected ? "online" : aiConnected === false ? "setup" : ""}`}><i/>{aiConnected ? t.aiReady : t.aiSetup}</span>
          <button onClick={() => setView("memory")} className={view === "memory" ? "active" : ""}><Brain size={18}/><span>{lang === "zh" ? "记忆库" : "Memory"}</span></button>
          <button onClick={() => setDark((value) => !value)} aria-label={dark ? (lang === "zh" ? "切换浅色" : "Use light theme") : (lang === "zh" ? "切换深色" : "Use dark theme")}>{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark")}</span></button>
          <button onClick={switchLanguage}><span className="rail-language">{lang === "zh" ? "EN" : "中"}</span><span>{lang === "zh" ? "English" : "简体中文"}</span></button>
          <button onClick={() => setView("settings")} className={view === "settings" ? "active" : ""}><SlidersHorizontal size={18}/><span>{lang === "zh" ? "我的空间" : "My space"}</span></button>
        </div>
      </aside>

      <section className="app-stage">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")}><AlreaDoughBrand /></button>
        <div className="top-actions"><span className={`sync-badge ${syncStatus}`}>{syncStatus === "saved" ? <CloudCheck size={15}/> : <CloudSlash size={15}/>}<span>{syncStatus === "saved" ? (lang === "zh" ? "已同步" : "Synced") : syncStatus === "saving" || syncStatus === "loading" ? (lang === "zh" ? "同步中" : "Syncing") : (lang === "zh" ? "本机模式" : "On device")}</span></span><button className="mobile-memory-button" onClick={() => setView("memory")} aria-label={lang === "zh" ? "打开记忆库" : "Open memory"}><Brain size={18}/></button><button className="mobile-memory-button" onClick={() => setHistoryOpen(true)} aria-label={lang === "zh" ? "打开对话记录" : "Open conversation history"}><ChatCircleDots size={18}/></button><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="language-toggle" onClick={switchLanguage} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>{lang === "zh" ? "EN" : "中"}</button><button className="avatar" onClick={() => setView("settings")} aria-label={t.ariaSettings}>{goal.companionName.slice(0, 1) || "A"}</button></div>
      </header>

      {historyOpen && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><aside className="history-drawer"><header><div><p className="eyebrow">{lang === "zh" ? "对话记录" : "CONVERSATION HISTORY"}</p><h2>{lang === "zh" ? "回到之前的片段" : "Return to an earlier moment"}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><button className="history-new" onClick={beginNewConversation}><Plus size={17}/>{lang === "zh" ? "开始新对话" : "Start a new conversation"}</button><div className="history-list">{conversationArchive.length ? conversationArchive.map((conversation) => <article key={conversation.id}><button onClick={() => openConversation(conversation)}><strong>{conversation.title}</strong><small>{new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button><button aria-label={lang === "zh" ? "删除对话" : "Delete conversation"} onClick={() => setConversationArchive((items) => items.filter((item) => item.id !== conversation.id))}><Trash size={16}/></button></article>) : <p>{lang === "zh" ? "完成第一段对话后，它会安全地出现在这里。" : "Your first completed conversation will appear here."}</p>}</div></aside></div>}

      {view === "home" && <section className={`home-ai-view ${sessionMessages.length ? "has-conversation" : "is-empty"}`}>
        {sessionMessages.length === 0 && <div className="home-ai-welcome">
          <p className="eyebrow" suppressHydrationWarning>{dateLabel}</p>
          <h1>{lang === "zh" ? `欢迎回来，${goal.companionName}` : `Welcome back, ${goal.companionName}`}</h1>
          <p>{t.hero}</p>
        </div>}
        <div className="home-ai-thread">
          {sessionMessages.map((message, index) => <div className={`message-group ${message.role}`} key={message.id}>{message.role === "ai" && <DoughGlyph state={message.feedback === "helpful" ? "happy" : "companion"}/>}<div className={`message ${message.role}`}>{message.text}</div><div className="message-actions">
            <button onClick={() => navigator.clipboard.writeText(message.text)} aria-label={lang === "zh" ? "复制" : "Copy"}><Copy size={15}/><span>{lang === "zh" ? "复制" : "Copy"}</span></button>
            {message.role === "user" ? <button onClick={() => editUserMessage(index)}><NotePencil size={15}/><span>{lang === "zh" ? "编辑并重发" : "Edit and resend"}</span></button> : <><button onClick={() => regenerateReply(index)}><ArrowClockwise size={15}/><span>{lang === "zh" ? "重新回答" : "Regenerate"}</span></button><button className={message.saved ? "pocket-action saved" : "pocket-action"} onClick={() => saveReplyAsStory(message)}><BookmarkSimple size={15}/><span>{message.saved ? (lang === "zh" ? "Dough 已收好" : "Kept by Dough") : (lang === "zh" ? "收进口袋" : "Keep in pocket")}</span></button><button onClick={() => { setOldScene(message.text); setView("revision"); }}><ArrowsClockwise size={15}/><span>{lang === "zh" ? "带入重写" : "Take to revision"}</span></button><button onClick={() => { setGoal((current) => ({ ...current, acceptedSceneLedger: { ...current.acceptedSceneLedger, [lang]: [message.text.slice(0, 500), ...current.acceptedSceneLedger[lang]].slice(0, 8) } })); setView("subliminal"); }}><Waveform size={15}/><span>{lang === "zh" ? "带入声场" : "Take to Dreamscape"}</span></button><button className={message.feedback === "helpful" ? "selected" : ""} onClick={() => setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: item.feedback === "helpful" ? undefined : "helpful" } : item))}><ThumbsUp size={15}/><span>{lang === "zh" ? "懂我" : "Helpful"}</span></button><button className={message.feedback === "missed" ? "selected" : ""} onClick={() => setMessages((items) => items.map((item) => item.id === message.id ? { ...item, feedback: item.feedback === "missed" ? undefined : "missed" } : item))}><ThumbsDown size={15}/><span>{lang === "zh" ? "不适合" : "Not for me"}</span></button></>}
          </div></div>)}
          {isTyping && <div className="dough-thinking"><DoughGlyph state="thinking"/><span><i/><i/><i/></span></div>}
        </div>
        {sessionMessages.length < 3 && <div className="home-suggestions">{(activeThoughts.length ? activeThoughts : (lang === "zh" ? ["我又开始看眼前的迹象了", "带我进入一个已经实现的画面", "我想把今天发生的事重写", "此刻我只想被理解"] : ["I am checking the circumstances again", "Take me into a fulfilled scene", "I want to revise what happened today", "I just want to feel understood"])).slice(0, 4).map((thought) => <button key={thought} onClick={() => sendChat(thought)}>{thought}</button>)}</div>}
        {aiError && <div className="ai-notice dough-notice"><DoughGlyph state="error"/><div><strong>{t.aiSetup}</strong><span>{aiError}</span></div></div>}
        <div className={`composer home-composer ${sessionMessages.length ? "is-active" : "is-empty"}`}><div className="composer-main"><input ref={chatInputRef} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={onChatKey} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder}/><details className="coach-model-menu"><summary aria-label={lang === "zh" ? "切换引导模型" : "Switch guidance model"}><span>{lang === "zh" ? coachModes.find((coach) => coach.id === goal.coachMode)?.zh : coachModes.find((coach) => coach.id === goal.coachMode)?.en}</span><CaretDown size={15}/></summary><div className="coach-model-popover"><header><strong>{lang === "zh" ? "选择引导方式" : "Choose a guide"}</strong><small>{lang === "zh" ? "每条消息都可以随时切换" : "Switch for any message"}</small></header>{coachModes.map((coach) => <button type="button" className={goal.coachMode === coach.id ? "selected" : ""} key={coach.id} onClick={(event) => { setGoal((current) => ({ ...current, coachMode: coach.id })); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span><strong>{lang === "zh" ? coach.zh : coach.en}</strong><small>{lang === "zh" ? coach.zhDescription : coach.enDescription}</small></span>{goal.coachMode === coach.id && <Check size={17} weight="bold"/>}</button>)}</div></details></div><button className="dough-action" onClick={() => isTyping ? requestControllerRef.current?.abort() : sendChat()} aria-label={isTyping ? (lang === "zh" ? "停止生成" : "Stop generating") : t.send}>{isTyping ? <StopCircle size={20}/> : "↑"}</button></div>
        {sessionMessages.length > 0 && <p className="pet-checkin-hint">{checkedToday ? (lang === "zh" ? `今天已打卡，连续 ${streak} 天` : `Checked in today. ${streak}-day streak.`) : (lang === "zh" ? "点击右下角的面团完成今日打卡" : "Tap the dough in the corner to check in today.")}</p>}
      </section>}

      {view === "subliminal" && <SubliminalStudio lang={lang} desire={goal.desire[lang]} focusText={goal.acceptedSceneLedger[lang][0]} checkIns={checkIns} onCheckIn={recordCheckIn}/>}

      {view === "memory" && <section className="full-view memory-view">
        <div className="view-heading-row"><div className="view-heading"><p className="eyebrow">{lang === "zh" ? "Dough 的口袋" : "DOUGH’S POCKET"}</p><h1>{lang === "zh" ? "它替你收好的记忆" : "What AlreaDough keeps for you"}</h1><p>{lang === "zh" ? "围绕当前唯一愿望形成的透明记忆库。你可以清楚看见 AlreaDough 正在携带哪些上下文。" : "A transparent memory library built around your one active desire. See exactly what AlreaDough carries."}</p></div><DoughGlyph state="memory" size="page"/></div>
        <div className="memory-overview"><article><span>{lang === "zh" ? "当前愿望" : "ACTIVE DESIRE"}</span><p>{goal.desire[lang]}</p></article><article><span>{lang === "zh" ? "愿望焦点" : "DESIRE FOCUS"}</span><p>{goal.spName || (lang === "zh" ? "未设置" : "Not set")}</p></article></div>
        <div className="memory-library-grid">
          <article><header><strong>{lang === "zh" ? "信念触发点" : "BELIEF TRIGGERS"}</strong><small>{goal.beliefs[lang].length}</small></header>{goal.beliefs[lang].length ? <ul>{goal.beliefs[lang].map((item) => <li key={item}>{item}</li>)}</ul> : <p>{lang === "zh" ? "还没有记录" : "Nothing recorded yet"}</p>}</article>
          <article><header><strong>{lang === "zh" ? "回应偏好" : "RESPONSE PREFERENCES"}</strong><small>{goal.responsePreferences[lang].length}</small></header><ul>{goal.responsePreferences[lang].map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article><header><strong>{lang === "zh" ? "已接纳的新场景" : "ACCEPTED SCENES"}</strong><small>{goal.acceptedSceneLedger[lang].length}</small></header>{goal.acceptedSceneLedger[lang].length ? <ul>{goal.acceptedSceneLedger[lang].map((item) => <li key={item}>{item}</li>)}</ul> : <p>{lang === "zh" ? "在故事或重写中接纳的场景会出现在这里。" : "Scenes accepted from Stories or Revision will appear here."}</p>}</article>
          <article className="journey-memory"><header><strong>{lang === "zh" ? "旅程摘要" : "JOURNEY SUMMARY"}</strong><small>{lang === "zh" ? "自动压缩" : "AUTO-COMPRESSED"}</small></header><p>{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成一段简短摘要。" : "A short summary will form here after conversations begin.")}</p></article>
        </div>
        <div className="memory-actions"><button className="outline-button" onClick={() => setView("settings")}>{lang === "zh" ? "编辑愿望与偏好" : "Edit desire and preferences"}</button><button className="primary" onClick={() => setView("home")}>{lang === "zh" ? "回到对话" : "Back to chat"}</button></div>
      </section>}


      {view === "story" && !storyReading && <section className="full-view story-library-view">
        <div className="view-heading-row"><div className="view-heading"><p className="eyebrow">{lang === "zh" ? "你的故事库" : "YOUR STORY LIBRARY"}</p><h1>{lang === "zh" ? "写下已经发生的生活" : "Write the life already lived"}</h1><p>{lang === "zh" ? "每个故事都是一个可以反复进入、随时编辑的完成态场景。" : "Each story is a fulfilled scene you can revisit and edit at any time."}</p></div><DoughGlyph state="story" size="page"/></div>
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
        <article className="story-body">{storyText.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{currentStory.anchor[lang] && <blockquote>{currentStory.anchor[lang]}</blockquote>}</article>
        <div className="personal-story-action story-reader-actions"><button onClick={() => setStoryReading(false)}>{lang === "zh" ? "返回故事库" : "Back to stories"}</button><button onClick={() => openStoryEditor(currentStory)}><PencilSimple size={17}/>{lang === "zh" ? "编辑故事" : "Edit story"}</button><button className="primary" onClick={makeStory} disabled={storyGenerating}>{storyGenerating ? t.generating : t.generateStory}</button></div>
        {aiError && <div className="ai-notice story-ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {generatedStory && <article className="generated-story"><span>AI PERSONAL STORY</span>{generatedStory.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<button className={`outline-button pocket-action ${savedPulse ? "saved" : ""}`} onClick={acceptGeneratedStory}>{savedPulse ? (lang === "zh" ? "Dough 已替你收好 ✓" : "Kept safely by Dough ✓") : (lang === "zh" ? "收进 Dough 的口袋" : "Keep in Dough’s pocket")}</button></article>}
        {storyLibrary.length > 1 && <div className="story-controls"><button onClick={() => { setStoryIndex((storyIndex - 1 + storyLibrary.length) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.previous}</button><button className="dark-button" onClick={() => { setStoryIndex((storyIndex + 1) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.next}</button></div>}
      </section>}

      {view === "revision" && <section className="full-view revision-view">
        <div className="view-heading-row"><div className="view-heading"><p className="eyebrow">{lang === "zh" ? "重写这一刻" : "REVISION STUDIO"}</p><h1>{t.revisionTitle}</h1><p>{t.revisionCopy}</p></div><DoughGlyph state="revision" size="page"/></div>
        <label className="field-label">{t.oldLabel}</label>
        <textarea value={oldScene} onChange={(e) => setOldScene(e.target.value)} placeholder={t.oldPlaceholder} />
        <button className="primary dough-action" onClick={makeRevision} disabled={isTyping}>{isTyping ? t.generating : t.makeRevision}</button>
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {newScene && <div className="revised-card"><span>{t.chosen}</span><p>{newScene}</p><button className={`pocket-action ${savedPulse ? "saved" : ""}`} onClick={acceptRevision}>{savedPulse ? (lang === "zh" ? "Dough 已替你收好" : "Kept by Dough") : t.acceptStory}</button></div>}
        {revisions.length > 0 && <div className="revision-history"><p className="eyebrow">{t.history}</p>{revisions.slice(0, 4).map((item) => <div key={item.id}><span>{item.date}</span><p>{item.revised}</p></div>)}</div>}
      </section>}

      {view === "board" && <section className="full-view board-view">
        <div className="view-heading-row"><div className="view-heading"><p className="eyebrow">{lang === "zh" ? "我的愿景" : "VISION BOARD"}</p><h1>{t.boardTitle}</h1><p>{t.boardCopy}</p></div><DoughGlyph state="vision" size="page"/></div>
        <div className="vision-mode-tabs"><button className={boardMode === "licensed" ? "active" : ""} onClick={() => setBoardMode("licensed")}>{lang === "zh" ? "寻梦灵感" : "Discover Dreamscapes"}</button><button className={boardMode === "mine" ? "active" : ""} onClick={() => setBoardMode("mine")}>{lang === "zh" ? "编织我的愿景" : "Weave My Vision"}</button></div>
        {boardMode === "licensed" ? <>
        <div className="real-search">
          <div className="search-title"><span>✦</span><div><strong>{t.realPhotos}</strong><small>{t.photoCopy}</small></div></div>
          <div className="search-bar"><input value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchRealImages(); }} placeholder={t.searchPlaceholder} aria-label={t.realPhotos}/><button onClick={() => searchRealImages()}>{imageSearching ? t.searching : t.search}</button></div>
          <div className="search-suggestions">{suggestions.map((term) => <button key={term} onClick={() => searchRealImages(term)}>{term}</button>)}</div>
          {imageSearchError && <p className="search-error">{imageSearchError}</p>}
        </div>
        {imageResults.length > 0 && <div className="search-results">{imageResults.map((item) => <article key={item.source}><img src={item.image} alt={item.title}/><div><strong>{item.title}</strong><small>{item.credit} · {item.license}</small><button className="pocket-action" onClick={() => collectSearchImage(item)}>{t.collect}</button></div></article>)}</div>}
        <div className="moodboard">{board.map((item, index) => <article className={`board-card card-${index % 4}`} key={item.id}>{item.image ? <img src={item.image} alt={item.title}/> : <div className="board-placeholder">✦</div>}<div><h3>{item.title}</h3>{/^https?:/.test(item.source) ? <a href={item.source} target="_blank" rel="noreferrer">{t.source}</a> : <span>{item.source}</span>}<button onClick={() => setBoard((items) => items.filter((entry) => entry.id !== item.id))} aria-label={`${lang === "zh" ? "删除" : "Delete "}${item.title}`}>×</button></div></article>)}</div>
        </> : <VisionCanvasStudio lang={lang}/>} 
      </section>}

      {view === "settings" && <section className="full-view settings-view">
        <div className="view-heading"><p className="eyebrow">{t.private}</p><h1>{lang === "zh" ? `${goal.companionName}的已完成空间` : `${goal.companionName}’s already-done space`}</h1><p>{t.privateCopy}</p></div>
        <nav className="settings-tabs" aria-label={lang === "zh" ? "空间设置分类" : "Space settings sections"}>{([
          ["profile", lang === "zh" ? "我与愿望" : "Profile & desire"], ["companion", lang === "zh" ? "AI 陪伴者" : "AI companion"], ["memory", lang === "zh" ? "记忆与旅程" : "Memory & journey"], ["data", lang === "zh" ? "数据与安全" : "Data & safety"],
        ] as const).map(([id, label]) => <button key={id} className={settingsSection === id ? "active" : ""} onClick={() => setSettingsSection(id)}>{label}</button>)}</nav>

        {settingsSection === "profile" && <div className="settings-section">
          <div className="goal-status"><label><span>{t.activeGoal}</span><select value={goal.status} onChange={(event) => setGoal((current) => ({ ...current, status: event.target.value as GoalStatus }))}><option value="active">{lang === "zh" ? "正在练习" : "Active"}</option><option value="embodiment">{lang === "zh" ? "稳定进入" : "Embodying"}</option><option value="fulfilled">{lang === "zh" ? "已经发生" : "Already happened"}</option><option value="paused">{lang === "zh" ? "暂时休息" : "Paused"}</option></select></label><small>{lang === "zh" ? "每次对话只加载这一张愿望卡" : "Only this desire card is loaded into each conversation"}</small></div>
          <div className="setting-card editable-card"><label>{lang === "zh" ? "我喜欢的称呼" : "WHAT ALREADOUGH CALLS ME"}</label><input value={goal.companionName} onChange={(event) => setGoal((current) => ({ ...current, companionName: event.target.value }))}/></div>
          <div className="setting-card editable-card"><label>{lang === "zh" ? "愿望方向" : "DESIRE CATEGORY"}</label><div className="option-card-grid category-grid">{wishCategories.map((category) => <button key={category.id} className={goal.wishCategory === category.id ? "selected" : ""} onClick={() => setGoal((current) => ({ ...current, wishCategory: category.id }))}><strong>{lang === "zh" ? category.zh : category.en}</strong><small>{lang === "zh" ? category.zhDescription : category.enDescription}</small></button>)}</div></div>
          <div className="setting-card editable-card sp-name-card"><label>{goal.wishCategory === "relationship" ? (lang === "zh" ? "显化对象" : "MANIFESTATION PERSON") : (lang === "zh" ? "愿望焦点" : "DESIRE FOCUS")}</label><input value={spNameDraft} maxLength={24} aria-invalid={Boolean(spNameError)} onChange={(event) => setSpNameDraft(event.target.value)}/>{spNameError && <p className="field-error" role="alert">{spNameError}</p>}</div>
          <div className="setting-card editable-card"><label>{t.coreWish}</label><textarea value={goal.desire[lang]} onChange={(event) => setGoal((current) => ({ ...current, desire: { ...current.desire, [lang]: event.target.value } }))}/></div>
        </div>}

        {settingsSection === "companion" && <div className="settings-section">
          <div className="setting-card editable-card"><label>{t.tone}</label><div className="option-card-grid companion-style-grid">{companionStyles.map((style) => <button key={style.id} className={goal.companionStyle === style.id ? "selected" : ""} onClick={() => chooseCompanionStyle(style.id)}><strong>{lang === "zh" ? style.zh : style.en}</strong><small>{lang === "zh" ? style.zhDescription : style.enDescription}</small></button>)}</div>{goal.companionStyle === "custom" && <textarea value={goal.tone[lang]} onChange={(event) => setGoal((current) => ({ ...current, tone: { ...current.tone, [lang]: event.target.value } }))}/>}</div>
          <div className="setting-card editable-card"><label>{lang === "zh" ? "引导方式" : "GUIDANCE METHOD"}</label><div className="option-card-grid coach-settings-grid">{coachModes.map((coach) => <button key={coach.id} className={goal.coachMode === coach.id ? "selected" : ""} onClick={() => setGoal((current) => ({ ...current, coachMode: coach.id }))}><strong>{lang === "zh" ? coach.zh : coach.en}</strong><small>{lang === "zh" ? coach.zhDescription : coach.enDescription}</small></button>)}</div></div>
        </div>}

        {settingsSection === "memory" && <div className="settings-section">
          <div className="setting-card editable-card"><label>{lang === "zh" ? "我的背景与处境" : "MY CONTEXT"}</label><textarea maxLength={MAX_BACKGROUND} value={goal.background[lang]} onChange={(event) => setGoal((current) => ({ ...current, background: { ...current.background, [lang]: event.target.value } }))}/><div className="field-counter"><span>{goal.background[lang].length} / {MAX_BACKGROUND}</span></div></div>
          <div className="setting-card editable-card"><label>{lang === "zh" ? "信念触发点" : "BELIEF TRIGGERS"}</label><textarea aria-invalid={beliefCount > MAX_BELIEFS} value={beliefDraft} onChange={(event) => setBeliefDraft(event.target.value)} placeholder={lang === "zh" ? `每行写一个，最多 ${MAX_BELIEFS} 条` : `One per line, up to ${MAX_BELIEFS}`}/><div className={`field-counter ${beliefCount > MAX_BELIEFS ? "over" : ""}`}><span>{beliefCount} / {MAX_BELIEFS}</span></div></div>
          <div className="setting-card memory-card"><span>{t.memory}</span><p>{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成简短摘要。" : "A short summary will form after conversations begin.")}</p><small>{lang === "zh" ? "每次回复后自动压缩更新，不重复发送全部历史。" : "Compressed after each response, so the full history is never resent."}</small></div>
          <button className="outline-button" onClick={() => setView("memory")}>{lang === "zh" ? "打开完整记忆库" : "Open full memory library"}</button>
        </div>}

        {settingsSection === "data" && <div className="settings-section">
          <div className="language-card"><div><span>{lang === "zh" ? "界面语言" : "LANGUAGE"}</span><strong>{lang === "zh" ? "简体中文" : "English"}</strong></div><button onClick={switchLanguage}>{lang === "zh" ? "Switch to English" : "切换到中文"}</button></div>
          <div className="setting-card sync-card"><span>{lang === "zh" ? "跨设备同步" : "CROSS-DEVICE SYNC"}</span><p>{syncStatus === "saved" ? (lang === "zh" ? "愿望、记忆、对话、故事和练习记录已安全同步。" : "Your desire, memory, conversations, stories, and practice history are synced.") : (lang === "zh" ? "当前使用本机副本；恢复连接后会自动继续同步。" : "Using the on-device copy. Sync resumes automatically when available.")}</p></div>
          <div className="setting-card goal-lifecycle-card"><span>{lang === "zh" ? "愿望生命周期" : "DESIRE LIFECYCLE"}</span><p>{lang === "zh" ? "愿望完成后，把它留在历程中，再开启一个新的单一愿望空间。" : "When this desire is complete, keep it in your journey and open a fresh one-desire space."}</p><button className="outline-button" onClick={archiveAndBeginAgain}>{lang === "zh" ? "完成并归档，开启新愿望" : "Complete, archive, and begin again"}</button></div>
          {goalArchive.length > 0 && <div className="setting-card archive-card"><span>{lang === "zh" ? `已经发生的愿望 · ${goalArchive.length}` : `FULFILLED DESIRES · ${goalArchive.length}`}</span>{goalArchive.slice(0, 5).map((item) => <article key={item.id}><strong>{item.desire[lang] || item.desire[lang === "zh" ? "en" : "zh"]}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") : ""}</small></article>)}</div>}
          <div className="setting-card data-control-card"><span>{lang === "zh" ? "我的数据" : "MY DATA"}</span><p>{lang === "zh" ? "下载愿望卡、故事、对话、重写与打卡记录。私密照片和音频文件不会写入导出文件。" : "Download desire cards, stories, conversations, revisions, and check-ins. Private photo and audio files are excluded."}</p><button className="outline-button" onClick={exportMyData}>{lang === "zh" ? "导出我的数据" : "Export my data"}</button></div>
          <div className="legal-links"><a className="trust-link" href="/trust">{t.trust}</a><a className="trust-link" href="/privacy">{lang === "zh" ? "隐私说明" : "Privacy"}</a><a className="trust-link" href="/terms">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a className="trust-link" href="/copyright">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
          <button className="outline-button danger-button" onClick={() => { if (window.confirm(t.confirm)) { void fetch("/api/space", { method: "DELETE" }); localStorage.removeItem("already-private-state-v5"); localStorage.removeItem("already-practice-checkins-v1"); localStorage.removeItem("already-subliminal-v1"); localStorage.removeItem("already-vision-project-v1"); indexedDB.deleteDatabase("already-private-audio-v1"); indexedDB.deleteDatabase("already-private-vision-v1"); setGoal({ ...defaultGoal }); setGoalArchive([]); setConversationArchive([]); setConversationId(""); setSpNameDraft(""); setBeliefDraft(""); setStoryLibrary([]); setMessages([]); setRevisions([]); setCheckIns([]); setBoard([]); setView("home"); setOnboardingStep(0); } }}>{t.clear}</button>
        </div>}
        {settingsSection !== "data" && <div className="settings-savebar"><span>{syncStatus === "saved" ? <CloudCheck size={18}/> : <FloppyDisk size={18}/>} {syncStatus === "saved" ? (lang === "zh" ? "会自动同步" : "Auto-sync is on") : (lang === "zh" ? "本机副本已保留" : "On-device copy retained")}</span><button className="primary" onClick={saveGoalSettings} disabled={Boolean(spNameError) || beliefCount > MAX_BELIEFS || !goal.companionStyle}>{goalSavedPulse ? t.savedGoal : t.saveGoal}</button></div>}
      </section>}

      </section>

      {storyEditorOpen && <div className="story-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStoryEditorOpen(false); }}>
        <form className="story-editor-modal" onSubmit={(event) => { event.preventDefault(); saveStory(); }}>
          <header><div><p className="eyebrow">{storyEditingId ? (lang === "zh" ? "编辑故事" : "EDIT STORY") : (lang === "zh" ? "新的已实现时刻" : "A NEW FULFILLED MOMENT")}</p><h2>{storyEditingId ? (lang === "zh" ? "把这个故事写成你的版本" : "Make this story yours") : (lang === "zh" ? "它已经发生在哪里？" : "Where has it already happened?")}</h2></div><button type="button" onClick={() => setStoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header>
          <div className="story-editor-grid">
            <label><span>{lang === "zh" ? "故事标题" : "STORY TITLE"}</span><input value={storyDraft.title} onChange={(event) => setStoryDraft((draft) => ({ ...draft, title: event.target.value }))} maxLength={42} placeholder={lang === "zh" ? "例如：我们在东京醒来的早晨" : "For example: Our morning in Tokyo"}/></label>
            <label><span>{lang === "zh" ? "地点" : "PLACE"}</span><input value={storyDraft.city} onChange={(event) => setStoryDraft((draft) => ({ ...draft, city: event.target.value }))} maxLength={32} placeholder={lang === "zh" ? "东京、家里、纽约" : "Tokyo, home, New York"}/></label>
          </div>
          <label><span>{lang === "zh" ? "一句氛围" : "MOOD IN ONE LINE"}</span><input value={storyDraft.subtitle} onChange={(event) => setStoryDraft((draft) => ({ ...draft, subtitle: event.target.value }))} maxLength={80} placeholder={lang === "zh" ? "这个时刻最真实的感受" : "How this moment feels"}/></label>
          <label><span>{lang === "zh" ? "故事场景" : "THE SCENE"}</span><textarea value={storyDraft.scene} onChange={(event) => setStoryDraft((draft) => ({ ...draft, scene: event.target.value }))} placeholder={lang === "zh" ? "用已经发生的语气，写下你看见、听见和感受到的细节。分段书写会更好读。" : "Write what you see, hear, and feel as something already lived. Use paragraphs for an easier read."}/></label>
          <label><span>{lang === "zh" ? "锚定句" : "ANCHOR LINE"}</span><input value={storyDraft.anchor} onChange={(event) => setStoryDraft((draft) => ({ ...draft, anchor: event.target.value }))} maxLength={100} placeholder={lang === "zh" ? "例如：被爱已经是我最熟悉的日常。" : "For example: Being loved is my most familiar reality."}/></label>
          <footer><small>{lang === "zh" ? `${storyLibrary.length} / 6 个故事` : `${storyLibrary.length} / 6 stories`}</small><div><button type="button" className="outline-button" onClick={() => setStoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="submit" className="primary" disabled={!storyDraft.title.trim() || !storyDraft.scene.trim()}>{lang === "zh" ? "保存故事" : "Save story"}</button></div></footer>
        </form>
      </div>}

      <DoughPet lang={lang} checked={checkedToday} streak={streak} onCheckIn={() => recordCheckIn("chosen")}/>

      <nav className="bottom-nav" aria-label={t.ariaNav}>
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return <button key={item.id} className={active ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={21} weight={active ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
    </main>
  );
}
