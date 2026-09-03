"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  House,
  ImagesSquare,
  Moon,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Sparkle,
  Sun,
  Trash,
  Waveform,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import SubliminalStudio, { PracticeCheckIn, practiceStreak, todayKey } from "./components/SubliminalStudio";
import VisionCanvasStudio from "./components/VisionCanvasStudio";
import DoughPet from "./components/DoughPet";
import { validateSpName } from "@/lib/name-policy";

type View = "home" | "subliminal" | "story" | "revision" | "board" | "settings";
type Lang = "zh" | "en";
type Message = { role: "ai" | "user"; text: string };
type BoardItem = { id: number; title: string; source: string; image?: string };
type Revision = { id: number; old: string; revised: string; date: string };
type GoalStatus = "active" | "embodiment" | "fulfilled" | "paused";
type GoalProfile = {
  id: string;
  setupComplete: boolean;
  status: GoalStatus;
  companionName: string;
  spName: string;
  spPronunciation: string;
  desire: Record<Lang, string>;
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
  companionName: "",
  spName: "",
  spPronunciation: "",
  desire: { zh: "", en: "" },
  beliefs: { zh: [], en: [] },
  tone: {
    zh: "温柔、坚定、细腻。先接住我此刻具体的念头，再陪我回到选择的版本。",
    en: "Warm, steady, and emotionally precise. Meet the exact thought first, then return with me to the version I chose.",
  },
  journeySummary: { zh: "", en: "" },
  canon: { zh: [], en: [] },
  responsePreferences: {
    zh: ["不重复固定模板", "不主动争论愿望是否可能", "回应后给出一个可进入的具体场景"],
    en: ["Do not repeat a fixed template", "Do not initiate a feasibility debate", "Offer one concrete scene after responding"],
  },
  acceptedSceneLedger: { zh: [], en: [] },
  createdAt: "",
};

const ui = {
  zh: {
    day: "第 1 天", greeting: "欢迎回来", hero: <>你无须说服任何人。<br />回到你已经选择的故事里。</>, wish: "我的愿望", happened: "已经发生", start: "开始对话",
    newStory: "你的新故事", moment: "今天想进入哪个时刻？", enter: "进入故事", returnBelief: "快速回到信念", need: "此刻，你需要什么？", talk: "和陪伴者说说话", quiet: "让怀疑停止扩音", rewrite: "重写这一刻", accept: "接纳你选择的新版本",
    companion: "BELIEF COMPANION · 海外测试版", here: "我在这里", companionCopy: "把旧故事交出来。AI 会结合你的当前愿望、限制性信念和最近旅程，陪你回到选择的版本。", chatPlaceholder: "写下此刻冒出的念头……",
    previous: "← 上一个", next: "下一个故事 →", revisionTitle: "让这一刻按你的方式发生", revisionCopy: "旧版本只需出现一次。接纳后，我们只保留你的新故事。", oldLabel: "刚刚什么让你离开了新故事？", oldPlaceholder: "例如：他很久没有回复，我开始觉得他不在意我……", makeRevision: "✶ 为我重写这一刻", chosen: "你选择的新版本", accepted: "已经接纳 ✓", acceptStory: "接纳为我的新故事", history: "已接纳",
    boardTitle: "收藏你正在走进的生活", boardCopy: "从授权真实摄影中寻觅灵感，或用自己的照片编织专属愿景板。不会使用 AI 生成图片。", realPhotos: "寻梦灵感", photoCopy: "在可商用授权的真实摄影中，寻找属于你的生活画面", searchPlaceholder: "例如：冬日旅行、理想的新家", searching: "寻觅中", search: "开始寻梦", collect: "＋ 收进我的愿景", manual: "或者添加你已经喜欢的素材", nameScene: "为这个画面命名", pasteLink: "粘贴任意网站的来源链接或图片直链", addLink: "添加链接", local: "从本机添加", source: "查看来源 ↗",
    private: "PRIVATE SPACE · GLOBAL BETA", space: "我的已完成空间", privateCopy: "当前测试版的愿望卡、旅程摘要、聊天和 Revision 保存在这台设备上；发送消息时，只把当前练习所需的有限上下文交给 AI。", coreWish: "当前唯一愿望", tone: "陪伴语气", toneCopy: "温柔、坚定，不分析可能性，不用旧故事反驳新选择。", region: "测试版本", regionCopy: "面向 OpenAI 支持地区的海外中文与英文用户。", clear: "清除本机练习记录", confirm: "要清除这台设备上保存的所有练习吗？", nav: ["陪伴", "故事", "重写", "愿景", "入梦声场"], ariaSettings: "打开私人设定", ariaNav: "主导航", send: "发送", activeGoal: "ACTIVE GOAL", beliefs: "限制性信念地图", memory: "AI 旅程摘要", saveGoal: "保存当前愿望卡", savedGoal: "愿望卡已保存", generating: "AI 正在进入这个场景……", generateStory: "✶ 为这一刻生成专属故事", aiReady: "LIVE AI", aiSetup: "AI 待配置", trust: "AI 与安全说明",
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
  const [spNameDraft, setSpNameDraft] = useState(defaultGoal.spName);
  const [sessionId, setSessionId] = useState("local-beta");
  const [messages, setMessages] = useState<Message[]>([]);
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

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restoration from device storage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("already-private-state-v5");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.lang === "zh" || data.lang === "en") setLang(data.lang);
        if (data.goal?.setupComplete && data.goal?.desire && data.goal?.beliefs) {
          const restoredGoal: GoalProfile = {
            ...defaultGoal,
            ...data.goal,
            spPronunciation: data.goal.spPronunciation || "",
            canon: data.goal.canon || defaultGoal.canon,
            responsePreferences: data.goal.responsePreferences || defaultGoal.responsePreferences,
            acceptedSceneLedger: data.goal.acceptedSceneLedger || defaultGoal.acceptedSceneLedger,
          };
          setGoal(restoredGoal);
          setSpNameDraft(restoredGoal.spName);
          setBeliefDraft((restoredGoal.beliefs[data.lang === "en" ? "en" : "zh"] || []).join("\n"));
        }
        if (Array.isArray(data.storyLibrary)) setStoryLibrary(data.storyLibrary.slice(0, 6));
        if (Array.isArray(data.messages)) setMessages(data.messages.slice(-40));
        if (Array.isArray(data.revisions)) setRevisions(data.revisions.slice(0, 20));
        if (Array.isArray(data.board)) setBoard(data.board);
      }
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
    finally { setHydrated(true); }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("already-private-state-v5", JSON.stringify({ lang, goal, messages: messages.slice(-40), revisions: revisions.slice(0, 20), board, storyLibrary }));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [hydrated, lang, goal, messages, revisions, board, storyLibrary]);

  useEffect(() => {
    localStorage.setItem("already-practice-checkins-v1", JSON.stringify(checkIns));
  }, [checkIns]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), [lang]);
  const t = ui[lang];
  const currentStory = storyLibrary[Math.min(storyIndex, Math.max(0, storyLibrary.length - 1))] || emptyStory;
  const storyText = currentStory.text[lang];
  const spNameError = spNameDraft.trim() ? validateSpName(spNameDraft, lang) : "";
  const activeThoughts = goal.beliefs[lang];
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
    const beliefs = beliefDraft.split(/\n|，|,/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    const completed: GoalProfile = {
      ...goal,
      id: crypto.randomUUID(),
      setupComplete: true,
      companionName: name,
      spName: spNameDraft.trim(),
      desire: { ...goal.desire, [lang]: desire },
      beliefs: { ...goal.beliefs, [lang]: beliefs },
      canon: { ...goal.canon, [lang]: [desire] },
      createdAt: new Date().toISOString(),
    };
    setGoal(completed);
    setMessages([{ role: "ai", text: lang === "zh"
      ? `${name}，我记住了。从现在起，我们只围绕你选择的这个愿望继续。此刻，你最想先告诉我哪个念头？`
      : `${name}, I remember. From now on, we will stay with the one desire you chose. Which thought would you like to give me first?` }]);
    setOnboardingStep(0);
  };

  const callCompanion = async (mode: "chat" | "revision" | "story", userInput: string) => {
    const response = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        lang,
        userInput,
        sessionId,
        goal: {
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
        recentMessages: messages.slice(-10),
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
    setMessages((items) => [...items, { role: "user", text: userText }]);
    setChatInput(""); setIsTyping(true); setAiError("");
    try {
      const reply = await callCompanion("chat", userText);
      setMessages((items) => [...items, { role: "ai", text: reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
      setMessages((items) => [...items, {
        role: "ai",
        text: lang === "zh"
          ? `${goal.companionName || "你"}，AI 当前没有连接成功：${message}。你的这句话已经留在本机，请稍后再试。`
          : `${goal.companionName || "You"}, the AI could not connect: ${message}. Your message remains on this device. Please try again shortly.`,
      }]);
    } finally {
      setIsTyping(false);
    }
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
    if (spNameError) return;
    setGoal((current) => ({
      ...current,
      spName: spNameDraft.trim(),
      beliefs: { ...current.beliefs, [lang]: beliefDraft.split(/\n|，|,/).map((item) => item.trim()).filter(Boolean).slice(0, 8) },
      canon: { ...current.canon, [lang]: current.desire[lang].trim() ? [current.desire[lang].trim()] : [] },
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
        [lang]: beliefDraft.split(/\n|，|,/).map((item) => item.trim()).filter(Boolean).slice(0, 8),
      },
    }));
    setBeliefDraft(goal.beliefs[next].join("\n"));
    setLang(next);
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    if (nextView === "story") setStoryReading(false);
  };

  const onboardingCanContinue = [
    true,
    Boolean(goal.companionName.trim()),
    Boolean(goal.desire[lang].trim()),
    !spNameError,
    true,
    Boolean(goal.tone[lang].trim()),
    Boolean(goal.companionName.trim() && goal.desire[lang].trim()),
  ][onboardingStep];

  if (!hydrated) {
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"}><div className="onboarding-loading" aria-label={lang === "zh" ? "正在打开 Already" : "Opening Already"}><span className="brand-mark"><Sparkle weight="fill" /></span><strong>Already</strong></div></main>;
  }

  if (!goal.setupComplete) {
    const steps = lang === "zh"
      ? ["语言", "你的称呼", "唯一愿望", "重要的人", "动摇念头", "陪伴语气", "确认"]
      : ["Language", "Your name", "One desire", "Your person", "Doubts", "Companion tone", "Confirm"];
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"}>
      <div className="app-grain" aria-hidden="true" />
      <header className="onboarding-topbar"><span className="brand"><span className="brand-mark"><Sparkle weight="fill" /></span><strong>Already</strong></span><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button></header>
      <section className="onboarding-view">
        <div className="onboarding-progress" aria-label={lang === "zh" ? `第 ${onboardingStep + 1} 步，共 7 步` : `Step ${onboardingStep + 1} of 7`}><i style={{ width: `${((onboardingStep + 1) / 7) * 100}%` }}/></div>
        <p className="eyebrow">{steps[onboardingStep]}</p>
        {onboardingStep === 0 && <div className="onboarding-panel"><h1>Choose the language that feels like home.</h1><p>选择让你最容易进入状态的语言，之后随时可以切换。</p><div className="onboarding-choice"><button className={lang === "zh" ? "selected" : ""} onClick={() => setLang("zh")}><strong>简体中文</strong><small>中文陪伴与创作</small></button><button className={lang === "en" ? "selected" : ""} onClick={() => setLang("en")}><strong>English</strong><small>English companion and stories</small></button></div></div>}
        {onboardingStep === 1 && <div className="onboarding-panel"><h1>{lang === "zh" ? "我该怎么称呼你？" : "What should I call you?"}</h1><p>{lang === "zh" ? "这是只属于你的空间。昵称、名字或你喜欢的称呼都可以。" : "This is your space. Use your name, a nickname, or any name that feels like you."}</p><label><span>{lang === "zh" ? "你的称呼" : "YOUR NAME"}</span><input maxLength={24} value={goal.companionName} onChange={(event) => setGoal((current) => ({ ...current, companionName: event.target.value }))} placeholder={lang === "zh" ? "例如：安安" : "For example: Mia"}/></label></div>}
        {onboardingStep === 2 && <div className="onboarding-panel"><h1>{lang === "zh" ? "现在，只选择一个愿望。" : "For now, choose one desire."}</h1><p>{lang === "zh" ? "写下你真正想进入的完成态。它会成为聊天、故事、声音和愿景的共同核心。" : "Write the fulfilled state you truly want to enter. It becomes the shared center of chat, stories, sound, and vision."}</p><label><span>{lang === "zh" ? "它已经实现时，我的生活是" : "WHEN IT IS ALREADY MINE, MY LIFE IS"}</span><textarea value={goal.desire[lang]} onChange={(event) => setGoal((current) => ({ ...current, desire: { ...current.desire, [lang]: event.target.value } }))} placeholder={lang === "zh" ? "用你自己的话写下这个愿望……" : "Write this desire in your own words…"}/></label></div>}
        {onboardingStep === 3 && <div className="onboarding-panel"><h1>{lang === "zh" ? "这个愿望里，有一个重要的人吗？" : "Is there an important person in this desire?"}</h1><p>{lang === "zh" ? "如果没有，可以留空。填写后，AI 会始终使用你选定的称呼。" : "Leave this blank if there is not. If added, the AI will consistently use your chosen name."}</p><label><span>{lang === "zh" ? "你如何称呼 TA" : "WHAT YOU CALL THEM"}</span><input maxLength={24} value={spNameDraft} aria-invalid={Boolean(spNameError)} onChange={(event) => setSpNameDraft(event.target.value)} placeholder={lang === "zh" ? "姓名、昵称或亲密称呼" : "Name, nickname, or affectionate name"}/></label>{spNameError && <p className="field-error" role="alert">{spNameError}</p>}<label><span>{lang === "zh" ? "读音提示（可选）" : "PRONUNCIATION (OPTIONAL)"}</span><input maxLength={48} value={goal.spPronunciation} onChange={(event) => setGoal((current) => ({ ...current, spPronunciation: event.target.value }))} placeholder={lang === "zh" ? "例如：阿屿，读作 a-yu" : "For example: Aiko, EYE-ko"}/></label></div>}
        {onboardingStep === 4 && <div className="onboarding-panel"><h1>{lang === "zh" ? "什么念头最容易让你动摇？" : "Which thoughts shake your certainty?"}</h1><p>{lang === "zh" ? "每行写一个。以后首页会把它们变成可以直接开启对话的入口。" : "Write one per line. They will become direct conversation starters on your home screen."}</p><label><span>{lang === "zh" ? "限制性信念，最多 8 条" : "LIMITING BELIEFS, UP TO 8"}</span><textarea value={beliefDraft} onChange={(event) => setBeliefDraft(event.target.value)} placeholder={lang === "zh" ? "它太难了\n我怕自己无法坚持\n我总会被眼前的变化影响" : "It feels too difficult\nI am afraid I cannot persist\nThe present circumstances shake me"}/></label></div>}
        {onboardingStep === 5 && <div className="onboarding-panel"><h1>{lang === "zh" ? "你希望怎样被陪伴？" : "How do you want to be accompanied?"}</h1><p>{lang === "zh" ? "语气可以温柔、俏皮、简洁或像一个很懂你的朋友。之后随时能改。" : "The tone can be gentle, playful, concise, or like a friend who knows you deeply. You can change it anytime."}</p><label><span>{lang === "zh" ? "陪伴方式" : "COMPANION STYLE"}</span><textarea value={goal.tone[lang]} onChange={(event) => setGoal((current) => ({ ...current, tone: { ...current.tone, [lang]: event.target.value } }))}/></label></div>}
        {onboardingStep === 6 && <div className="onboarding-panel onboarding-confirm"><h1>{lang === "zh" ? `${goal.companionName}，你的空间准备好了。` : `${goal.companionName}, your space is ready.`}</h1><p>{lang === "zh" ? "Already 会围绕这一个愿望逐渐记住你的触发点、喜欢的回应方式和已经接纳的新故事。" : "Already will gradually remember your triggers, preferred responses, and accepted new stories around this one desire."}</p><blockquote>{goal.desire[lang]}</blockquote><dl><div><dt>{lang === "zh" ? "重要的人" : "YOUR PERSON"}</dt><dd>{spNameDraft.trim() || (lang === "zh" ? "未设置" : "Not set")}</dd></div><div><dt>{lang === "zh" ? "动摇念头" : "DOUBTS"}</dt><dd>{beliefDraft.split(/\n|，|,/).filter((item) => item.trim()).length || (lang === "zh" ? "稍后添加" : "Add later")}</dd></div></dl></div>}
        <footer className="onboarding-actions"><button className="outline-button" onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))} disabled={onboardingStep === 0}>{lang === "zh" ? "返回" : "Back"}</button><button className="primary" disabled={!onboardingCanContinue} onClick={() => onboardingStep === 6 ? finishOnboarding() : setOnboardingStep((step) => Math.min(6, step + 1))}>{onboardingStep === 6 ? (lang === "zh" ? "进入 Already" : "Enter Already") : (lang === "zh" ? "继续" : "Continue")}</button></footer>
      </section>
    </main>;
  }

  return (
    <main className="app-shell" data-theme={dark ? "dark" : "light"}>
      <div className="app-grain" aria-hidden="true" />
      <aside className="app-rail">
        <button className="brand" onClick={() => navigate("home")} aria-label="Already home"><span className="brand-mark"><Sparkle weight="fill" /></span><strong>Already</strong></button>
        <nav className="rail-nav" aria-label={t.ariaNav}>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="rail-footer">
          <span className={`ai-badge ${aiConnected ? "online" : aiConnected === false ? "setup" : ""}`}><i/>{aiConnected ? t.aiReady : t.aiSetup}</span>
          <button onClick={() => setDark((value) => !value)} aria-label={dark ? (lang === "zh" ? "切换浅色" : "Use light theme") : (lang === "zh" ? "切换深色" : "Use dark theme")}>{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? (lang === "zh" ? "浅色" : "Light") : (lang === "zh" ? "深色" : "Dark")}</span></button>
          <button onClick={switchLanguage}><span className="rail-language">{lang === "zh" ? "EN" : "中"}</span><span>{lang === "zh" ? "English" : "简体中文"}</span></button>
          <button onClick={() => setView("settings")} className={view === "settings" ? "active" : ""}><SlidersHorizontal size={18}/><span>{lang === "zh" ? "我的空间" : "My space"}</span></button>
        </div>
      </aside>

      <section className="app-stage">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")}><span className="brand-mark"><Sparkle weight="fill" /></span><strong>Already</strong></button>
        <div className="top-actions"><span className={`ai-badge ${aiConnected ? "online" : aiConnected === false ? "setup" : ""}`}><i/>{aiConnected ? t.aiReady : t.aiSetup}</span><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label={dark ? "Light" : "Dark"}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="language-toggle" onClick={switchLanguage} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}>{lang === "zh" ? "EN" : "中"}</button><button className="avatar" onClick={() => setView("settings")} aria-label={t.ariaSettings}>{goal.companionName.slice(0, 1) || "A"}</button></div>
      </header>

      {view === "home" && <section className="home-ai-view">
        <div className="home-ai-welcome">
          <p className="eyebrow" suppressHydrationWarning>{dateLabel}</p>
          <h1>{lang === "zh" ? `欢迎回来，${goal.companionName}` : `Welcome back, ${goal.companionName}`}</h1>
          <p>{t.hero}</p>
        </div>
        <div className="home-ai-thread">
          {messages.map((message, index) => <div className={`message ${message.role}`} key={`${index}-${message.text.slice(0, 8)}`}>{message.text}</div>)}
          {isTyping && <div className="message ai typing"><i/><i/><i/></div>}
        </div>
        {messages.length < 3 && activeThoughts.length > 0 && <div className="home-suggestions">{activeThoughts.slice(0, 4).map((thought) => <button key={thought} onClick={() => sendChat(thought)}>{thought}</button>)}</div>}
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        <div className="composer home-composer"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={onChatKey} placeholder={t.chatPlaceholder} aria-label={t.chatPlaceholder}/><button onClick={() => sendChat()} disabled={isTyping} aria-label={t.send}>↑</button></div>
        <p className="pet-checkin-hint">{checkedToday ? (lang === "zh" ? `今天已打卡，连续 ${streak} 天` : `Checked in today. ${streak}-day streak.`) : (lang === "zh" ? "点击右下角的面团完成今日打卡" : "Tap the dough in the corner to check in today.")}</p>
      </section>}

      {view === "subliminal" && <SubliminalStudio lang={lang} desire={goal.desire[lang]} checkIns={checkIns} onCheckIn={recordCheckIn}/>} 


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
        {storyLibrary.length === 0 && <div className="story-empty"><Plus size={28}/><h2>{lang === "zh" ? "从你的第一个场景开始" : "Begin with your first scene"}</h2><button className="primary" onClick={() => openStoryEditor()}>{lang === "zh" ? "创建故事" : "Create story"}</button></div>}
      </section>}

      {view === "story" && storyReading && <section className="full-view story-view">
        <div className={`story-cover ${currentStory.tone}`}><p>{currentStory.city[lang]}</p><h1>{currentStory.title[lang]}</h1><span>{currentStory.subtitle[lang]}</span></div>
        <article className="story-body">{storyText.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{currentStory.anchor[lang] && <blockquote>{currentStory.anchor[lang]}</blockquote>}</article>
        <div className="personal-story-action story-reader-actions"><button onClick={() => setStoryReading(false)}>{lang === "zh" ? "返回故事库" : "Back to stories"}</button><button onClick={() => openStoryEditor(currentStory)}><PencilSimple size={17}/>{lang === "zh" ? "编辑故事" : "Edit story"}</button><button className="primary" onClick={makeStory} disabled={storyGenerating}>{storyGenerating ? t.generating : t.generateStory}</button></div>
        {aiError && <div className="ai-notice story-ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {generatedStory && <article className="generated-story"><span>AI PERSONAL STORY</span>{generatedStory.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>}
        {storyLibrary.length > 1 && <div className="story-controls"><button onClick={() => { setStoryIndex((storyIndex - 1 + storyLibrary.length) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.previous}</button><button className="dark-button" onClick={() => { setStoryIndex((storyIndex + 1) % storyLibrary.length); setGeneratedStory(""); setAiError(""); }}>{t.next}</button></div>}
      </section>}

      {view === "revision" && <section className="full-view revision-view">
        <div className="view-heading"><p className="eyebrow">REVISION STUDIO</p><h1>{t.revisionTitle}</h1><p>{t.revisionCopy}</p></div>
        <label className="field-label">{t.oldLabel}</label>
        <textarea value={oldScene} onChange={(e) => setOldScene(e.target.value)} placeholder={t.oldPlaceholder} />
        <button className="primary" onClick={makeRevision} disabled={isTyping}>{isTyping ? t.generating : t.makeRevision}</button>
        {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
        {newScene && <div className="revised-card"><span>{t.chosen}</span><p>{newScene}</p><button onClick={acceptRevision}>{savedPulse ? t.accepted : t.acceptStory}</button></div>}
        {revisions.length > 0 && <div className="revision-history"><p className="eyebrow">{t.history}</p>{revisions.slice(0, 4).map((item) => <div key={item.id}><span>{item.date}</span><p>{item.revised}</p></div>)}</div>}
      </section>}

      {view === "board" && <section className="full-view board-view">
        <div className="view-heading"><p className="eyebrow">VISION BOARD</p><h1>{t.boardTitle}</h1><p>{t.boardCopy}</p></div>
        <div className="vision-mode-tabs"><button className={boardMode === "licensed" ? "active" : ""} onClick={() => setBoardMode("licensed")}>{lang === "zh" ? "寻梦灵感" : "Discover Dreamscapes"}</button><button className={boardMode === "mine" ? "active" : ""} onClick={() => setBoardMode("mine")}>{lang === "zh" ? "编织我的愿景" : "Weave My Vision"}</button></div>
        {boardMode === "licensed" ? <>
        <div className="studio-notice vision-license-notice"><strong>{lang === "zh" ? "授权素材说明" : "LICENSED MATERIALS"}</strong><p>{lang === "zh" ? "自动搜索只接入允许商业使用的素材库，并显示摄影师、原始来源和许可。图片版权仍属于原作者；收藏或排版不代表作者为本产品背书，请保留署名与来源信息。" : "Automatic search uses sources that permit commercial reuse and shows the creator, original page, and license. Copyright remains with each creator; collecting an image does not imply their endorsement. Keep credits and source details."}</p></div>
        <div className="real-search">
          <div className="search-title"><span>✦</span><div><strong>{t.realPhotos}</strong><small>{t.photoCopy}</small></div></div>
          <div className="search-bar"><input value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchRealImages(); }} placeholder={t.searchPlaceholder} aria-label={t.realPhotos}/><button onClick={() => searchRealImages()}>{imageSearching ? t.searching : t.search}</button></div>
          <div className="search-suggestions">{suggestions.map((term) => <button key={term} onClick={() => searchRealImages(term)}>{term}</button>)}</div>
          {imageSearchError && <p className="search-error">{imageSearchError}</p>}
        </div>
        {imageResults.length > 0 && <div className="search-results">{imageResults.map((item) => <article key={item.source}><img src={item.image} alt={item.title}/><div><strong>{item.title}</strong><small>{item.credit} · {item.license}</small><button onClick={() => collectSearchImage(item)}>{t.collect}</button></div></article>)}</div>}
        <div className="moodboard">{board.map((item, index) => <article className={`board-card card-${index % 4}`} key={item.id}>{item.image ? <img src={item.image} alt={item.title}/> : <div className="board-placeholder">✦</div>}<div><h3>{item.title}</h3>{/^https?:/.test(item.source) ? <a href={item.source} target="_blank" rel="noreferrer">{t.source}</a> : <span>{item.source}</span>}<button onClick={() => setBoard((items) => items.filter((entry) => entry.id !== item.id))} aria-label={`${lang === "zh" ? "删除" : "Delete "}${item.title}`}>×</button></div></article>)}</div>
        </> : <VisionCanvasStudio lang={lang}/>} 
      </section>}

      {view === "settings" && <section className="full-view settings-view">
        <div className="view-heading"><p className="eyebrow">{t.private}</p><h1>{lang === "zh" ? `${goal.companionName}的已完成空间` : `${goal.companionName}’s already-done space`}</h1><p>{t.privateCopy}</p></div>
        <div className="language-card"><div><span>{lang === "zh" ? "界面语言" : "LANGUAGE"}</span><strong>{lang === "zh" ? "简体中文" : "English"}</strong></div><button onClick={switchLanguage}>{lang === "zh" ? "Switch to English" : "切换到中文"}</button></div>
        <div className="goal-status"><label><span>{t.activeGoal}</span><select value={goal.status} onChange={(event) => setGoal((current) => ({ ...current, status: event.target.value as GoalStatus }))}><option value="active">{lang === "zh" ? "正在练习" : "Active"}</option><option value="embodiment">{lang === "zh" ? "稳定进入" : "Embodying"}</option><option value="fulfilled">{lang === "zh" ? "已经发生" : "Already happened"}</option><option value="paused">{lang === "zh" ? "暂时休息" : "Paused"}</option></select></label><small>{lang === "zh" ? "每次对话只加载这一张愿望卡" : "Only this desire card is loaded into each conversation"}</small></div>
        <div className="setting-card editable-card"><label>{lang === "zh" ? "AI 对你的称呼" : "WHAT YOUR AI CALLS YOU"}</label><input value={goal.companionName} onChange={(event) => setGoal((current) => ({ ...current, companionName: event.target.value }))}/></div>
        <div className="setting-card editable-card sp-name-card">
          <label>{lang === "zh" ? "你如何称呼 SP" : "WHAT YOU CALL YOUR SP"}</label>
          <input value={spNameDraft} maxLength={24} aria-invalid={Boolean(spNameError)} onChange={(event) => setSpNameDraft(event.target.value)} placeholder={lang === "zh" ? "例如：他、阿屿、我的爱人" : "For example: he, Alex, my love"}/>
          <label>{lang === "zh" ? "读音提示（可选）" : "PRONUNCIATION (OPTIONAL)"}</label><input value={goal.spPronunciation} maxLength={48} onChange={(event) => setGoal((current) => ({ ...current, spPronunciation: event.target.value }))} placeholder={lang === "zh" ? "例如：阿屿，读作 a-yu" : "For example: Aiko, EYE-ko"}/>
          <small>{lang === "zh" ? "这是私人称呼，会被用于 AI 对话和故事。普通姓名、昵称与亲密称呼都可以；系统只拦截明确违法伤害、仇恨侮辱、冒充官方身份、网址和联系方式。" : "This private name is used in AI chats and stories. Names, nicknames, and affectionate terms are welcome. Only clearly unlawful harm, targeted hate, official impersonation, URLs, and contact strings are blocked."}</small>
          {spNameError && <p className="field-error" role="alert">{spNameError}</p>}
        </div>
        <div className="setting-card editable-card"><label>{t.coreWish}</label><textarea value={goal.desire[lang]} onChange={(event) => setGoal((current) => ({ ...current, desire: { ...current.desire, [lang]: event.target.value } }))}/></div>
        <div className="setting-card editable-card"><label>{t.beliefs}</label><textarea value={beliefDraft} onChange={(event) => setBeliefDraft(event.target.value)} placeholder={lang === "zh" ? "每行写一个，最多 8 条" : "One per line, up to 8"}/><small>{lang === "zh" ? "保存后会成为首页快捷对话和 AI 长期记忆的一部分。" : "After saving, these become home conversation starters and part of the AI's long-term memory."}</small></div>
        <div className="setting-card editable-card"><label>{t.tone}</label><textarea value={goal.tone[lang]} onChange={(event) => setGoal((current) => ({ ...current, tone: { ...current.tone, [lang]: event.target.value } }))}/></div>
        <div className="setting-card memory-card"><span>{t.memory}</span><p>{goal.journeySummary[lang]}</p><small>{lang === "zh" ? "每次 AI 回复后自动压缩更新，不重复发送全部历史。" : "Compressed after each AI response, so the full history is never resent."}</small></div>
        <button className="primary" onClick={saveGoalSettings} disabled={Boolean(spNameError)}>{goalSavedPulse ? t.savedGoal : t.saveGoal}</button>
        <div className="setting-card"><span>{t.region}</span><p>{t.regionCopy}</p></div>
        <div className="legal-links"><a className="trust-link" href="/trust">{t.trust}</a><a className="trust-link" href="/privacy">{lang === "zh" ? "隐私说明" : "Privacy"}</a></div>
        <button className="outline-button" onClick={() => { if (window.confirm(t.confirm)) { localStorage.removeItem("already-private-state-v5"); localStorage.removeItem("already-practice-checkins-v1"); localStorage.removeItem("already-subliminal-v1"); setGoal(defaultGoal); setSpNameDraft(""); setBeliefDraft(""); setStoryLibrary([]); setStoryReading(false); setMessages([]); setRevisions([]); setCheckIns([]); setBoard([]); setView("home"); setOnboardingStep(0); } }}>{t.clear}</button>
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
