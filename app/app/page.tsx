"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Moon,
  Plus,
  Sun,
  Trash,
  Waveform,
  ArrowsClockwise,
  CaretDown,
  List,
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
  ImageSquare,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import SubliminalStudio, { PracticeCheckIn, practiceStreak, todayKey } from "../components/SubliminalStudio";
import Dreamscape from "../components/Dreamscape";
import VisionCanvasStudio from "../components/VisionCanvasStudio";
import DoughPet from "../components/DoughPet";
import { AiNote, BreakReminder, ReportButton, ReportDialog, SiteRecord } from "../components/Compliance";
import MembershipPanel, { memberPlanLabel, UsageBanner, UsageMeter, useMemberStatus } from "../components/MembershipPanel";
import DesktopPetPanel from "../components/DesktopPetPanel";
import { deleteLocalCover } from "@/lib/cover-store";
import GuidedOnboarding from "../components/GuidedOnboarding";
import ProfilePanel from "../components/ProfilePanel";
import WishList, { type WishItem } from "../components/WishList";
import ConfirmHost, { askConfirm, showUndo } from "../components/ConfirmHost";
import SpaceNav from "../components/SpaceNav";
import SpacePage from "../components/SpacePage";
import { AboutIcon, DoughIcon, HelpIcon, LibraryIcon, LookIcon, MembershipIcon, PetIcon, SyncIcon, ThoughtsIcon, WishesIcon, WriteLineIcon } from "../components/SpaceIcons";
import LettersPanel, { type AppLetter } from "../components/LettersPanel";
import StoryCoverPicker from "../components/StoryCoverPicker";
import { STORY_CATEGORIES, STORY_CATEGORY_LABELS, type StoryCategory } from "@/lib/story-prompt";
import { validateSpName } from "@/lib/name-policy";
import { answersToSeeds, MAX_STORY_SETTING, sharedMemories, splitLines, type GoalSeed, type MemorySeed, type OnboardingAnswers } from "@/lib/onboarding-flow";
import { readStored, writeStored, removeStored } from "@/lib/safe-storage";
import { formatGreeting, pickGreeting } from "@/lib/greetings";
import { pickQuote, type Quote } from "@/lib/quotes";
import { buildExportZip, exportFileName } from "@/lib/export-archive";
import { getDeviceSessionId } from "@/lib/device-session";
import { mergeSpaces } from "@/lib/space-merge";
import DoughHop from "../components/DoughHop";
import { CompanionIcon, DreamscapeIcon, PersonaIcon, ReviseIcon, StoriesIcon, VisionIcon } from "../components/NavIcons";
import PersonaStudio from "../components/PersonaStudio";

import { ContextSection, LibrarySection } from "./MemorySections";
import { DataSection, HelpSection, LookSection } from "./SpaceSections";
import { StoryLibrary, StoryQuotaNote, StoryReader } from "./StoryViews";
import { AppRail, SwipeSidebar } from "./AppNav";
import { useBetaSurveyTimer } from "./useBetaSurveyTimer";
import { useChatScroll } from "./useChatScroll";
import { useSwipeDrawer } from "./useSwipeDrawer";
import { type SpaceSection, type View, type Lang, type Message, type Conversation, type BoardItem, type Revision, type MemoryKind, type MemoryItem, type MemoryDraft, type GoalProfile, type Profile, emptyProfile, normalizeProfile, type Story, type StoryCover, type StoryDraft, NO_STORY_GOAL, relationKindOf, storyKindOfGoal, type AIResponse, type SearchImage, type BetaStatus, splitThought, emptyStoryDraft, emptyMemoryDraft, emptyStory, defaultGoal, MAX_BELIEFS, MAX_GOALS, SYNC_BASE_KEY, SPACE_OWNER_KEY, discardDeviceSpace, isDiscardingSpace, clearDeviceSpace, MAX_STORIES, MAX_STORY_PARAGRAPHS, storyTitleFrom, normalizeStory, intensityLabels, normalizeGoal, MAX_MEMORIES, nextLocalId, memoryKinds, sameBelief, parseBeliefs, seedJourneySummary, normalizeMessages, conversationTitle, SurveyScale, wishCategories, goalTitle, coachModes, ui, withHerName } from "./model";

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const explicitLanguage = useRef<Lang | null>(null);
  const [view, setView] = useState<View>("home");
  // Theme: "system" follows the phone's light/dark setting (the only way the phone's own top strip matches the page).
  const [themePref, setThemePref] = useState<"system" | "light" | "dark">("system");
  const [systemDark, setSystemDark] = useState(false);
  const dark = themePref === "system" ? systemDark : themePref === "dark";
  const [hydrated, setHydrated] = useState(false);
  const [beliefDraft, setBeliefDraft] = useState("");
  const [beliefInput, setBeliefInput] = useState("");
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyLibrary, setStoryLibrary] = useState<Story[]>([]);
  const [storyReading, setStoryReading] = useState(false);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [storyEditingId, setStoryEditingId] = useState<string | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>(emptyStoryDraft);
  /** The kind options under "类型" in the story editor. */
  const [storyKindOpen, setStoryKindOpen] = useState(false);
  /** Story whose ⋯ menu is open on its library card. */
  /** Story whose cover is being changed. */
  const [coverPickerId, setCoverPickerId] = useState<string | null>(null);
  /** Stories whose photo lookup is running or failed this visit, so the lookup never loops. */
  const coverLookups = useRef(new Set<string>());
  const coverLookupRunning = useRef(false);
  const [coverLookupTick, setCoverLookupTick] = useState(0);
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
  // 来信: letters from the founder. Which ones were read is remembered on this device only.
  const [letters, setLetters] = useState<AppLetter[]>([]);
  const [readLetters, setReadLetters] = useState<Set<string>>(() => new Set());
  const [lettersUnreadOnOpen, setLettersUnreadOnOpen] = useState<Set<string>>(() => new Set());
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of device storage and the letters list on mount */
  useEffect(() => {
    try { setReadLetters(new Set(JSON.parse(readStored("already-letters-read-v1") || "[]") as string[])); } catch { /* fresh device */ }
    fetch("/api/letters").then((response) => response.ok ? response.json() as Promise<{ letters?: AppLetter[] }> : null).then((data: { letters?: AppLetter[] } | null) => { if (data?.letters) setLetters(data.letters); }).catch(() => undefined);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Phones and iPads (touch, no hover) get the dough as its own page in My space; computers have the floating pet.
  const [touchDevice, setTouchDevice] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const sync = () => setTouchDevice(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const unreadLetters = letters.filter((letter) => !readLetters.has(letter.id));
  const [lettersOpen, setLettersOpen] = useState(false);
  const openLetters = () => {
    setLettersOpen(true);
    setLettersUnreadOnOpen(new Set(unreadLetters.map((letter) => letter.id)));
    const next = new Set([...readLetters, ...letters.map((letter) => letter.id)]);
    setReadLetters(next);
    writeStored("already-letters-read-v1", JSON.stringify([...next].slice(-200)));
  };
  const [memoryEditorOpen, setMemoryEditorOpen] = useState(false);
  const [memoryEditingId, setMemoryEditingId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saved" | "saving" | "offline">("loading");
  const [cloudReady, setCloudReady] = useState(false);
  // Version of the cloud copy this device last loaded or saved. Saves are sent on top of it, so a stale device can't overwrite newer work.
  const cloudRevisionRef = useRef<number | null>(null);
  /** Which space (account) the cloud copy and the agreed copy belong to, as the short tag /api/space returns. */
  const spaceOwnerRef = useRef<string | null>(null);
  const restoreSpaceRef = useRef<((data: Record<string, unknown>) => void) | null>(null);
  // The copy this device last agreed with the cloud, and what it holds now. A newer cloud copy is merged
  // against these three ways (see lib/space-merge), so work done here is never dropped by another device's save.
  const syncBaseRef = useRef<Record<string, unknown> | null>(null);
  const latestSpaceRef = useRef<Record<string, unknown> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [plusSection, setPlusSection] = useState<"goal" | "coach" | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const { sidebarOpen, moveSidebar, attachShell } = useSwipeDrawer();
  const [aiError, setAiError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [oldScene, setOldScene] = useState("");
  const [rewritingBelief, setRewritingBelief] = useState("");
  const [newScene, setNewScene] = useState("");
  // Reframe: her own (possibly edited) wording of the new thought.
  const [thoughtDraft, setThoughtDraft] = useState("");
  const [retiringOld, setRetiringOld] = useState(false);
  /** A new thought taken into Dreamscape; when empty, Dreamscape shows the latest accepted scene. */
  const [focusThought, setFocusThought] = useState("");
  /** A chat reply she took to 潜音; it is offered there as lines to add. */
  const [dreamIncoming, setDreamIncoming] = useState("");
  /** The generated story already saved as a card, so one click can't save it twice. */
  /** Story whose script the AI is writing right now. */
  const [scriptingId, setScriptingId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [boardMode, setBoardMode] = useState<"licensed" | "mine">("licensed");
  const [reframeSection, setReframeSection] = useState<"turn" | "beliefs">("turn");
  const [checkIns, setCheckIns] = useState<PracticeCheckIn[]>([]);
  const [imageQuery, setImageQuery] = useState("");
  const [imageResults, setImageResults] = useState<SearchImage[]>([]);
  const [imageSearching, setImageSearching] = useState(false);
  const [imageSearchError, setImageSearchError] = useState("");
  const [savedPulse, setSavedPulse] = useState(false);
  const [goalSavedPulse, setGoalSavedPulse] = useState(false);
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [reportTarget, setReportTarget] = useState<{ excerpt?: string } | null>(null);
  const [declined, setDeclined] = useState(false);
  // the reply only matters for its side effect (the server notes the device); nothing on screen reads it
  const [, setBetaStatus] = useState<BetaStatus | null>(null);
  // membership and usage: one fetch shared by the meter by the chat box, the out-of-usage notice, and My space
  const { member, refresh: refreshMember, gate: memberGate, setGate: setMemberGate } = useMemberStatus();
  // This week's AI scripts. Null when membership is off or she is not signed in (then nothing is counted).
  const storyQuota = member?.enabled && member.authenticated ? member.membership?.story ?? null : null;
  const storyUnlimited = !!storyQuota && storyQuota.limit >= 1000;
  const storiesLeft = storyQuota && !storyUnlimited ? Math.max(0, storyQuota.limit - storyQuota.used) : null;
  const storyQuotaOut = storiesLeft === 0;
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyBefore, setSurveyBefore] = useState(0);
  const [surveyNow, setSurveyNow] = useState(0);
  const [surveyUnderstood, setSurveyUnderstood] = useState(0);
  const [surveyReturn, setSurveyReturn] = useState(0);
  const [surveyFeature, setSurveyFeature] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const lastLogIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const box = chatInputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 220)}px`;
  }, [chatInput, view, hydrated]);

  const { showJump, scrollChatToBottom } = useChatScroll({ active: view === "home", conversationId, messages, isTyping });

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
      if (Array.isArray(data.storyLibrary)) setStoryLibrary((data.storyLibrary as Story[]).slice(0, MAX_STORIES).map(normalizeStory));
      if (Array.isArray(data.goalArchive)) setGoalArchive((data.goalArchive as GoalProfile[]).slice(0, 20));
      if (Array.isArray(data.otherGoals)) {
        // a merge of two devices can list the current desire among the others too: keep each desire once
        const currentId = (data.goal as { id?: string } | undefined)?.id;
        const seen = new Set<string>(currentId ? [currentId] : []);
        setOtherGoals((data.otherGoals as Partial<GoalProfile>[]).filter((item) => item?.setupComplete && item.desire && item.beliefs && item.id && !seen.has(item.id) && Boolean(seen.add(item.id))).map(normalizeGoal).slice(0, MAX_GOALS));
      }
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
      const base = JSON.parse(readStored(SYNC_BASE_KEY) || "null") as { owner?: string; space?: Record<string, unknown> } | null;
      if (base?.owner && base.space) { syncBaseRef.current = base.space; spaceOwnerRef.current = base.owner; }
    } catch { /* no agreed copy yet: the first merge keeps everything from both sides */ }
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
        .then(async (response) => ({ response, data: await response.json() as { space?: Record<string, unknown> | null; revision?: number; owner?: string } }))
        .then(({ response, data }) => {
          // The agreed copy only counts when it was agreed with this same space (same account); otherwise the first merge keeps everything from both sides.
          // Another account signed in on this device: what the device holds is the previous person's. Clear it and start again from this account's space.
          const previousOwner = readStored(SPACE_OWNER_KEY);
          if (response.ok && data.owner) writeStored(SPACE_OWNER_KEY, data.owner);
          if (response.ok && data.owner && previousOwner && previousOwner !== data.owner) { discardDeviceSpace(); window.location.reload(); return; }
          if (response.ok && spaceOwnerRef.current !== data.owner) syncBaseRef.current = null;
          if (response.ok) { spaceOwnerRef.current = data.owner ?? null; cloudRevisionRef.current = data.space ? data.revision ?? 0 : 0; }
          if (response.ok && data.space) applyCloudSpace(data.space, data.revision ?? 0);
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

  useBetaSurveyTimer(hydrated, () => setSurveyOpen(true));

  /** Take in a cloud copy: merge it with this device's work against the last agreed copy, then show the result. */
  const applyCloudSpace = (cloud: Record<string, unknown>, revision: number) => {
    const local = latestSpaceRef.current;
    const merged = local ? mergeSpaces(syncBaseRef.current, local, cloud) : cloud;
    cloudRevisionRef.current = revision;
    syncBaseRef.current = cloud;
    writeStored(SYNC_BASE_KEY, JSON.stringify({ owner: spaceOwnerRef.current, revision, space: cloud }));
    restoreSpaceRef.current?.(merged);
  };

  /** Load the newest cloud copy when another device saved after this one (on returning to the app, or when a save was refused as stale). */
  const pullCloudSpace = (force = false) => {
    if (!sessionId || sessionId === "local-beta") return;
    fetch("/api/space", { cache: "no-store", headers: { "x-already-session-id": sessionId } })
      .then((response) => response.ok ? response.json() as Promise<{ space?: Record<string, unknown> | null; revision?: number }> : null)
      .then((data) => {
        if (!data?.space || typeof data.revision !== "number") return;
        if (!force && cloudRevisionRef.current !== null && data.revision <= cloudRevisionRef.current) return;
        applyCloudSpace(data.space, data.revision);
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
    if (!hydrated || isDiscardingSpace()) return;
    const space = { lang, goal, goalArchive: goalArchive.slice(0, 20), otherGoals: otherGoals.slice(0, MAX_GOALS), conversationId, conversationArchive: conversationArchive.slice(0, 30), messages: messages.slice(-80), revisions: revisions.slice(0, 20), board, storyLibrary, checkIns, profile };
    writeStored("already-private-state-v5", JSON.stringify(space));
    latestSpaceRef.current = JSON.parse(JSON.stringify(space));
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    if (!cloudReady) return;
    if (syncBaseRef.current && JSON.stringify(syncBaseRef.current) === JSON.stringify(space)) return; // nothing new to save
    const timeout = window.setTimeout(() => {
      if (isDiscardingSpace()) return;
      setSyncStatus("saving");
      const baseRevision = cloudRevisionRef.current;
      fetch("/api/space", { method: "PUT", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId }, body: JSON.stringify(baseRevision === null ? { space } : { space, baseRevision }) })
        .then(async (response) => {
          if (response.status === 409) { pullCloudSpace(true); return; }
          const data = await response.json().catch(() => ({})) as { revision?: number };
          if (response.ok && typeof data.revision === "number") {
            cloudRevisionRef.current = data.revision;
            syncBaseRef.current = JSON.parse(JSON.stringify(space));
            writeStored(SYNC_BASE_KEY, JSON.stringify({ owner: spaceOwnerRef.current, revision: data.revision, space }));
          }
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
  // A story without a photo gets one licensed photo found from its own words: one lookup at a time, once per story per visit.
  useEffect(() => {
    if (!hydrated || view !== "story" || coverLookupRunning.current) return;
    const story = storyLibrary.find((item) => item.cover === undefined && !coverLookups.current.has(item.id));
    if (!story) return;
    const storyLang: Lang = story.text[lang].length ? lang : lang === "zh" ? "en" : "zh";
    const place = ["我的生活", "MY LIFE"].includes(story.city[storyLang]) ? "" : story.city[storyLang];
    // a reply saved from chat opens on the old scene and ends on the new one, so look for the ending
    const ending = story.anchor[storyLang] || story.subtitle[storyLang] || story.text[storyLang].at(-1) || "";
    const query = [place, ending, story.title[storyLang]].filter(Boolean).join(" ").slice(0, 110);
    coverLookups.current.add(story.id);
    coverLookupRunning.current = true;
    fetch(`/api/images?q=${encodeURIComponent(query)}`)
      .then((response) => response.ok ? response.json() as Promise<{ results?: SearchImage[] }> : Promise.reject(new Error("search failed")))
      .then((data) => {
        const photo = data.results?.[0];
        // no photo found: leave it, and look again on a later visit
        if (photo) setStoryLibrary((items) => items.map((item) => item.id === story.id && item.cover === undefined ? { ...item, cover: { image: photo.image, credit: photo.credit, source: photo.source } } : item));
        if (photo?.downloadLocation) fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadLocation: photo.downloadLocation }) }).catch(() => null);
      })
      .catch(() => null) // try again on the next visit
      .finally(() => { coverLookupRunning.current = false; setCoverLookupTick((tick) => tick + 1); });
  }, [hydrated, view, storyLibrary, lang, coverLookupTick]);

  const currentStory = storyLibrary[Math.min(storyIndex, Math.max(0, storyLibrary.length - 1))] || emptyStory;
  const spNameError = spNameDraft.trim() ? validateSpName(spNameDraft, lang) : "";
  const beliefCount = parseBeliefs(beliefDraft).length;
  const currentMemoryItems = goal.memoryItems[lang] || [];
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
    const refresh = fetch("/api/region", { cache: "no-store" }).then((response) => response.json() as Promise<{ country?: string | null }>).then((data: { country?: string | null }) => {
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
  // TA sits in the sidebar and rail only; the phone's bottom bar keeps its five.
  const sideNav = [...primaryNav, { id: "persona" as View, label: "TA", icon: PersonaIcon }];

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
    storySetting: { ...base.storySetting, [lang]: seed.storySetting || "" },
    ...(seed.relationKind ? { relationKind: seed.relationKind } : {}),
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
        relationKind: current.relationKind || seed.relationKind || undefined,
        storySetting: current.storySetting[lang] || !seed.storySetting ? current.storySetting : { ...current.storySetting, [lang]: seed.storySetting },
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
    setMemoryDraft(item ? { kind: item.kind, title: withHerName(item.title, goal.companionName), detail: withHerName(item.detail, goal.companionName), keywords: item.keywords.map((keyword) => withHerName(keyword, goal.companionName)).join(", ") } : emptyMemoryDraft);
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

  const callCompanion = async (mode: "chat" | "revision" | "story" | "affirm", userInput: string, signal?: AbortSignal, recentOverride?: Message[], storyCategory?: StoryCategory, desireGoal?: GoalProfile, rephrase?: string) => {
    // a script speaks for its own desire; everything else for the current one
    const g = desireGoal || goal;
    const response = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-already-session-id": sessionId },
      signal,
      body: JSON.stringify({
        mode,
        lang,
        userInput,
        sessionId,
        ...(storyCategory ? { storyCategory } : {}),
        ...(rephrase ? { rephrase: rephrase.slice(0, 600) } : {}),
        goal: {
          wishCategory: g.wishCategory,
          coachMode: g.coachMode,
          companionName: g.companionName,
          spName: g.spName,
          spPronunciation: g.spPronunciation,
          desire: g.desire[lang],
          beliefs: g.beliefs[lang],
          journeySummary: g.journeySummary[lang],
          tone: g.tone[lang],
          status: g.status,
          canon: g.canon[lang],
          responsePreferences: g.responsePreferences[lang],
          acceptedSceneLedger: g.acceptedSceneLedger[lang],
          memoryItems: g.memoryItems[lang],
          background: g.background[lang],
          storySetting: g.storySetting[lang],
          relationKind: relationKindOf(g),
          profile: { home: profile.country, about: profile.about, situation: profile.situation, people: profile.people.map((person) => ({ name: person.name, relation: person.relation })), neverInclude: profile.neverInclude },
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
    if (data.journeySummary && mode !== "story") {
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
    if (mode !== "affirm") lastLogIdRef.current = typeof (data as { logId?: unknown }).logId === "string" ? (data as { logId: string }).logId : undefined;
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
    if (storyLibrary.length >= MAX_STORIES) { setView("story"); return; }
    const paragraphs = message.text.split(/\n+/).map((item) => item.trim()).filter(Boolean).slice(0, MAX_STORY_PARAGRAPHS);
    // the reply is kept as written in both languages, so the title goes in both too
    const title = storyTitleFrom(paragraphs[0] || "", lang);
    const created: Story = {
      id: crypto.randomUUID(),
      title: { zh: title, en: title },
      city: { zh: "我的生活", en: "MY LIFE" }, subtitle: { zh: "", en: "" },
      text: { zh: paragraphs, en: paragraphs },
      anchor: { zh: "", en: "" }, tone: ["nyc", "snow", "seoul"][storyLibrary.length % 3] as Story["tone"],
      createdAt: new Date().toISOString(),
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

  /** Turn the old thought; with `rephrase`, keep the same outcome and only say the last new thought another way. */
  const makeRevision = async (rephrase?: string) => {
    if (!oldScene.trim() || isTyping) return;
    setIsTyping(true); setAiError("");
    try {
      const reply = await callCompanion("revision", oldScene.trim(), undefined, undefined, undefined, undefined, rephrase?.trim() || undefined);
      setNewScene(reply);
      setThoughtDraft(splitThought(reply).thought);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
    } finally { setIsTyping(false); }
  };

  /** The desire a script belongs to: its own, else the first desire of the same kind, else the current one. Null for "no desire". */
  const storyGoalFor = (story: Pick<Story, "goalId" | "category">): GoalProfile | null => {
    if (story.goalId === NO_STORY_GOAL) return null;
    const all = [goal, ...otherGoals];
    return all.find((item) => item.id === story.goalId)
      || (story.category ? all.find((item) => item.setupComplete && storyKindOfGoal(item) === story.category) : undefined)
      || goal;
  };
  /** A desire with only her own background left: used for a script that belongs to no desire. */
  const neutralGoal = (): GoalProfile => ({ ...goal, spName: "", desire: { zh: "", en: "" }, background: { zh: "", en: "" }, storySetting: { zh: "", en: "" }, acceptedSceneLedger: { zh: [], en: [] } });
  const updateStorySetting = (id: string, value: string) => {
    if (id === goal.id) setGoal((current) => ({ ...current, storySetting: { ...current.storySetting, [lang]: value } }));
    else setOtherGoals((items) => items.map((item) => item.id === id ? { ...item, storySetting: { ...item.storySetting, [lang]: value } } : item));
  };

  /** Her keywords for a story: the scene notes she wrote, or the story text when there are none. */
  const storyNotes = (story: Story) => story.seed?.[lang] ?? story.text[lang].join("\n\n");

  /** Expands her keywords into a full fulfilled-state script and makes it the story's text. */
  const writeScript = async (story: Story) => {
    if (scriptingId) return;
    const zh = lang === "zh";
    if (storyQuotaOut) { setAiError(zh ? "这周的剧本额度用完了，周一恢复。" : "This week's scripts are used up; they come back on Monday."); return; }
    if (story.scripted) {
      const left = storiesLeft === null ? "" : zh ? `（本周还剩 ${storiesLeft} 篇）` : ` (${storiesLeft} left this week)`;
      const confirmed = await askConfirm({
        title: zh ? "确定要重写吗？" : "Write it again?",
        body: zh ? `重新写会额外用掉本周 1 篇剧本额度${left}。新版本会直接替换现在这篇，旧的版本不会保存，也找不回来。` : `Writing it again uses 1 more of this week's scripts${left}. The new version replaces this one, and the current version is not saved.`,
        confirmLabel: zh ? "重新写" : "Write again",
        cancelLabel: zh ? "取消" : "Cancel",
      });
      if (!confirmed) return;
    }
    setScriptingId(story.id); setAiError("");
    const notes = storyNotes(story);
    const place = ["我的生活", "MY LIFE"].includes(story.city[lang]) ? "" : story.city[lang];
    const fields: Array<[string, string]> = zh
      ? [["标题", story.title[lang]], ["地点", place], ["氛围", story.subtitle[lang]], ["场景要点", notes], ["锚定句", story.anchor[lang]]]
      : [["Title", story.title[lang]], ["Place", place], ["Mood", story.subtitle[lang]], ["Scene notes", notes], ["Anchor line", story.anchor[lang]]];
    const prompt = `${zh ? "把下面这些关键词扩写成我的完成态剧本。" : "Expand these keywords into my fulfilled-state script."}\n${fields.filter(([, value]) => value.trim()).map(([label, value]) => `${label}${zh ? "：" : ": "}${value.trim()}`).join("\n")}`;
    try {
      const desire = storyGoalFor(story);
      const script = await callCompanion("story", prompt, undefined, undefined, story.category || (desire ? storyKindOfGoal(desire) : "other"), desire || neutralGoal());
      let paragraphs = script.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      // the model sometimes returns one long block: break it into paragraphs of about three sentences
      if (paragraphs.length === 1 && paragraphs[0].length > 300) {
        const sentences = paragraphs[0].match(/[^。！？!?]+[。！？!?”"]*|[^。！？!?]+$/g) || paragraphs;
        paragraphs = [];
        for (let i = 0; i < sentences.length; i += 3) paragraphs.push(sentences.slice(i, i + 3).join("").trim());
      }
      paragraphs = paragraphs.filter(Boolean).slice(0, MAX_STORY_PARAGRAPHS);
      if (!paragraphs.length) throw new Error(zh ? "AI 这次没有写出内容，请再试一次。" : "The AI returned nothing this time. Please try again.");
      setStoryLibrary((items) => items.map((item) => item.id === story.id ? { ...item, seed: { zh: item.seed?.zh ?? "", en: item.seed?.en ?? "", [lang]: notes }, text: { ...item.text, [lang]: paragraphs }, scripted: true } : item));
      // the script is a scene she has accepted, so the companion treats it as already done
      const compact = paragraphs.join("\n").slice(0, 900);
      const addScene = (item: GoalProfile) => ({ ...item, acceptedSceneLedger: { ...item.acceptedSceneLedger, [lang]: [compact, ...item.acceptedSceneLedger[lang]].slice(0, 8) } });
      if (desire && desire.id !== goal.id) setOtherGoals((items) => items.map((item) => item.id === desire.id ? addScene(item) : item));
      else if (desire) setGoal(addScene);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
      setAiConnected(false); setAiError(message);
    } finally { setScriptingId(null); }
  };

  const removeBeliefWithUndo = (text: string) => {
    const before = parseBeliefs(beliefDraft);
    setReframeSection("turn");
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
    const chosen = thoughtDraft.trim();
    if (!newScene || !chosen || retiringOld) return;
    if (rewritingBelief && oldScene.trim() === rewritingBelief.trim()) removeBelief(rewritingBelief);
    setRewritingBelief("");
    // The short reading belongs to the first suggestion only; keep it when she took that one as written.
    const { thought, reading } = splitThought(newScene);
    const revised = chosen === thought && reading ? `${chosen}\n${reading}` : chosen;
    // A new thought is kept with the other new thoughts (and reaches the AI as recentRevisions); it is not a scene, so it stays out of the accepted-scene ledger.
    setRevisions((items) => [{ id: nextLocalId(), old: oldScene, revised, date: new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US") }, ...items]);
    // The old thought fades out, then only the new one is left.
    setRetiringOld(true); setSavedPulse(true);
    window.setTimeout(() => { setOldScene(""); setNewScene(""); setThoughtDraft(""); setRetiringOld(false); }, 900);
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
    setBoard((items) => [{ id: nextLocalId(), title: item.title, source: item.source, image: item.image }, ...items]);
    if (item.downloadLocation) fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadLocation: item.downloadLocation }) }).catch(() => null);
  };

  const saveAffirmations = useCallback((lines: string[]) => {
    setGoal((current) => ({ ...current, affirmations: { zh: current.affirmations?.zh ?? [], en: current.affirmations?.en ?? [], [lang]: lines } }));
  }, [lang]);

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

  const setStoryCover = (id: string, cover: StoryCover | null) => {
    // an uploaded photo it replaces is only on this device; free that space
    const old = storyLibrary.find((story) => story.id === id)?.cover?.image;
    if (old !== cover?.image) void deleteLocalCover(old);
    setStoryLibrary((items) => items.map((story) => story.id === id ? { ...story, cover } : story));
  };

  /** Unsplash asks to be told when one of its photos is used. */
  const reportPhotoUse = (downloadLocation?: string) => {
    if (downloadLocation) fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadLocation }) }).catch(() => null);
  };

  const openStoryEditor = (story?: Story) => {
    if (story) {
      setStoryEditingId(story.id);
      const desire = storyGoalFor(story);
      setStoryDraft({ title: story.title[lang], city: story.city[lang], subtitle: story.subtitle[lang], scene: storyNotes(story), anchor: story.anchor[lang], category: story.category || (desire ? storyKindOfGoal(desire) : "other"), goalId: desire?.id || NO_STORY_GOAL });
    } else {
      setStoryEditingId(null);
      setStoryDraft({ ...emptyStoryDraft, goalId: goal.id, category: storyKindOfGoal(goal) });
    }
    setStoryKindOpen(false);
    setStoryEditorOpen(true);
  };

  const saveStory = (andWrite = false) => {
    if (!storyDraft.title.trim() || !storyDraft.scene.trim() || !storyDraft.category) return;
    const category = storyDraft.category;
    const notes = storyDraft.scene.trim();
    const paragraphs = notes.split(/\n+/).map((item) => item.trim()).filter(Boolean).slice(0, MAX_STORY_PARAGRAPHS);
    let saved: Story | null = null;
    let savedIndex = -1;
    if (storyEditingId) {
      const index = storyLibrary.findIndex((story) => story.id === storyEditingId);
      const story = storyLibrary[index];
      if (story) {
        saved = {
          ...story,
          title: { ...story.title, [lang]: storyDraft.title.trim() },
          city: { ...story.city, [lang]: storyDraft.city.trim() || (lang === "zh" ? "我的生活" : "MY LIFE") },
          subtitle: { ...story.subtitle, [lang]: storyDraft.subtitle.trim() },
          anchor: { ...story.anchor, [lang]: storyDraft.anchor.trim() },
          seed: { zh: story.seed?.zh ?? "", en: story.seed?.en ?? "", [lang]: notes },
          category,
          goalId: storyDraft.goalId || goal.id,
          // a script stays until it is written again; her own text follows her edits
          text: story.scripted ? story.text : { ...story.text, [lang]: paragraphs },
          sample: false,
        };
        savedIndex = index;
        setStoryLibrary((items) => items.map((item) => item.id === storyEditingId ? saved as Story : item));
      }
    } else if (storyLibrary.length < MAX_STORIES) {
      const fallback = lang === "zh" ? "我的新剧本" : "My New Story";
      saved = {
        id: crypto.randomUUID(),
        title: { zh: lang === "zh" ? storyDraft.title.trim() : fallback, en: lang === "en" ? storyDraft.title.trim() : fallback },
        city: { zh: lang === "zh" ? (storyDraft.city.trim() || "我的生活") : "MY LIFE", en: lang === "en" ? (storyDraft.city.trim() || "MY LIFE") : "MY LIFE" },
        subtitle: { zh: lang === "zh" ? storyDraft.subtitle.trim() : "", en: lang === "en" ? storyDraft.subtitle.trim() : "" },
        text: { zh: lang === "zh" ? paragraphs : [fallback], en: lang === "en" ? paragraphs : [fallback] },
        anchor: { zh: lang === "zh" ? storyDraft.anchor.trim() : "", en: lang === "en" ? storyDraft.anchor.trim() : "" },
        seed: { zh: lang === "zh" ? notes : "", en: lang === "en" ? notes : "" },
        category,
        goalId: storyDraft.goalId || goal.id,
        tone: ["nyc", "snow", "seoul"][storyLibrary.length % 3] as Story["tone"],
        createdAt: new Date().toISOString(),
      };
      savedIndex = storyLibrary.length;
      setStoryLibrary((items) => [...items, saved as Story]);
    }
    setStoryEditorOpen(false);
    setStoryDraft(emptyStoryDraft);
    if (saved && savedIndex >= 0) {
      setStoryIndex(savedIndex);
      if (andWrite) { setStoryReading(true); window.scrollTo({ top: 0 }); void writeScript(saved); }
    }
  };

  const deleteStory = async (id: string) => {
    const confirmed = await askConfirm({ title: lang === "zh" ? "删除这个剧本？" : "Delete this story?", body: lang === "zh" ? "只会删除保存在这台设备上的版本，删除后不能恢复。" : "This removes only the copy saved on this device and can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" });
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
    setView("home");
  };

  const cancelAddGoal = () => {
    const [previous, ...rest] = otherGoals;
    if (!previous) return;
    setOtherGoals(rest);
    showGoal(previous);
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

  const sortedGoals = [goal, ...otherGoals].filter((item, index, all) => item.setupComplete && all.findIndex((entry) => entry.id === item.id) === index).sort((a, b) => b.intensity - a.intensity);

  // Every conversation, the open one included: she can always jump straight back to any of them.
  const openConversationEntry: Conversation | null = messages.length ? { id: conversationId, title: conversationTitle(messages, lang), createdAt: conversationArchive.find((item) => item.id === conversationId)?.createdAt || new Date().toISOString(), messages, goalId: goal.id } : null;
  const allConversations = openConversationEntry ? [openConversationEntry, ...conversationArchive.filter((item) => item.id !== conversationId)] : conversationArchive;
  const pickConversation = (conversation: Conversation) => {
    if (conversation.id === conversationId && messages.length) { setHistoryOpen(false); setView("home"); return; }
    openConversation(conversation);
  };
  const deleteConversation = (id: string) => {
    setConversationArchive((items) => items.filter((item) => item.id !== id));
    if (id === conversationId) { setConversationId(crypto.randomUUID()); setMessages([]); setChatInput(""); setAiError(""); }
  };

  const goalMenuItems = (<>{sortedGoals.map((item) => <button type="button" className={item.id === goal.id ? "selected" : ""} key={item.id} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); if (item.id !== goal.id) switchGoal(item.id); }}><span><strong>{goalTitle(item, lang)}</strong><small>{lang === "zh" ? wishCategories.find((entry) => entry.id === item.wishCategory)?.zh : wishCategories.find((entry) => entry.id === item.wishCategory)?.en} · {intensityLabels[lang][item.intensity - 1]}</small></span>{item.id === goal.id && <Check size={17} weight="bold"/>}</button>)}<button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); addGoal(); }}><span><strong>{lang === "zh" ? "添加愿望" : "Add a desire"}</strong></span><Plus size={17}/></button></>);
  const coachMenuItems = (<>{coachModes.map((coach) => <button type="button" className={goal.coachMode === coach.id ? "selected" : ""} key={coach.id} onClick={(event) => { setGoal((current) => ({ ...current, coachMode: coach.id })); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span><strong>{lang === "zh" ? coach.zh : coach.en}</strong><small>{lang === "zh" ? coach.zhDescription : coach.enDescription}</small></span>{goal.coachMode === coach.id && <Check size={17} weight="bold"/>}</button>)}</>);

  if (!hydrated) {
    return <main className="app-shell onboarding-shell" data-theme={dark ? "dark" : "light"} data-lang={lang}><div className="onboarding-loading" role="status" aria-label={lang === "zh" ? "正在打开 AlreaDough" : "Opening AlreaDough"}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></div></main>;
  }

  if (!acknowledged) {
    return <main className="app-shell acknowledge-shell" lang={lang === "zh" ? "zh-CN" : "en"} data-theme={dark ? "dark" : "light"} data-lang={lang}>
      <div className="app-grain" aria-hidden="true" />
      <section className="acknowledge-card">
        <span className="brand"><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" /></span><strong>Alrea<span className="brand-dough">Dough</span></strong></span>
        {declined ? <><p className="eyebrow">YOUR CHOICE</p><h1>{lang === "zh" ? "你尚未进入 AlreaDough" : "You have not entered AlreaDough"}</h1><p>{lang === "zh" ? "这台设备没有保存同意记录。你可以关闭页面，或返回重新查看。" : "No consent record was saved on this device. You may close this page or go back to review."}</p><button className="outline-button" onClick={() => setDeclined(false)}>{lang === "zh" ? "返回" : "Go back"}</button></> : <>
          <p className="eyebrow">BEFORE YOU ENTER</p>
          <h1>{lang === "zh" ? "先确认这是一段你愿意进入的体验。" : "Confirm that this is an experience you choose to enter."}</h1>
          <div className="acknowledge-links"><a href={lang === "zh" ? "/terms" : "/terms#english"} target="_blank" rel="noreferrer">{lang === "zh" ? "测试版条款" : "Beta terms"}</a><a href={lang === "zh" ? "/privacy" : "/privacy#english"} target="_blank" rel="noreferrer">{lang === "zh" ? "隐私说明" : "Privacy Notice"}</a><a href={lang === "zh" ? "/trust" : "/en/trust"} target="_blank" rel="noreferrer">{lang === "zh" ? "AI 与安全" : "AI & safety"}</a><a href={lang === "zh" ? "/copyright" : "/copyright#english"} target="_blank" rel="noreferrer">{lang === "zh" ? "素材与版权" : "Content & copyright"}</a></div>
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
        onCancel={replaying ? () => setReplaying(false) : adding ? cancelAddGoal : undefined}
        onComplete={replaying ? finishReplay : adding ? finishExtraWish : finishGuidedOpening}
      />
    </main>;
  }

  /** One way into My space: from the list (phone) or straight to a section. On a wide screen the first section is already open. */
  /** "Clear everything": after she confirms, the cloud space and everything this device keeps are deleted. */
  const clearEverything = async () => {
    if (!(await askConfirm({ title: t.confirm, body: lang === "zh" ? "愿望、对话、记忆、剧本和本机的照片与音频都会删除，不能恢复。" : "Desires, conversations, memories, stories, and this device's photos and audio will be deleted. This can't be undone.", confirmLabel: lang === "zh" ? "全部清除" : "Clear everything", cancelLabel: lang === "zh" ? "取消" : "Cancel" }))) return;
    void fetch("/api/space", { method: "DELETE", headers: { "x-already-session-id": sessionId } });
    clearDeviceSpace();
    syncBaseRef.current = null;
    setProfile(emptyProfile); setOtherGoals([]); setGoal({ ...defaultGoal }); setGoalArchive([]); setConversationArchive([]); setConversationId("");
    setSpNameDraft(""); setBeliefDraft(""); setStoryLibrary([]); setMessages([]); setRevisions([]); setCheckIns([]); setBoard([]); setView("home");
  };

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
    <SwipeSidebar lang={lang} view={view} items={sideNav} navLabel={t.ariaNav} unreadCount={unreadLetters.length} companionName={goal.companionName} conversations={allConversations} onLetters={openLetters} onNewConversation={beginNewConversation} onNavigate={navigate} onOpenSpace={() => openSpace()} conversationId={conversationId} open={sidebarOpen} dark={dark} onPickConversation={pickConversation} onClose={() => moveSidebar(false)} />
    <main ref={attachShell} className={`app-shell${sidebarOpen ? " drawer-open" : ""}`} data-theme={dark ? "dark" : "light"} data-lang={lang}><ConfirmHost />
      <div className="app-grain" aria-hidden="true" />
      <AppRail lang={lang} view={view} items={sideNav} navLabel={t.ariaNav} unreadCount={unreadLetters.length} companionName={goal.companionName} conversations={allConversations} onLetters={openLetters} onNewConversation={beginNewConversation} onNavigate={navigate} onOpenSpace={() => openSpace()} onOpenHistory={() => setHistoryOpen(true)} />

      <section className="app-stage">
      <header className="topbar">
        <button type="button" className="topbar-menu" onClick={() => moveSidebar(true)} aria-label={lang === "zh" ? "打开侧边栏" : "Open the sidebar"}><List size={22}/></button>
        <button className="brand" onClick={openLetters} aria-label={unreadLetters.length ? (lang === "zh" ? "有新来信" : "New letter") : (lang === "zh" ? "来信" : "Letters")}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" />{unreadLetters.length > 0 && <i className="brand-dot" />}</span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
        <div className="top-actions" aria-hidden="true" />
      </header>

      {lettersOpen && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLettersOpen(false); }}><aside className="history-drawer letters-drawer" aria-label={lang === "zh" ? "来信" : "Letters"}><header><div><p className="eyebrow">{lang === "zh" ? "来信" : "LETTERS"}</p><h2>{lang === "zh" ? "AlreaDough 写给你的信" : "Letters from AlreaDough"}</h2></div><button onClick={() => setLettersOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><LettersPanel lang={lang} letters={letters} unread={lettersUnreadOnOpen} /></aside></div>}
      {historyOpen && <div className="history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><aside className="history-drawer"><header><div><p className="eyebrow">{lang === "zh" ? "对话记录" : "CONVERSATION HISTORY"}</p><h2>{lang === "zh" ? "回到之前的片段" : "Return to an earlier moment"}</h2></div><button onClick={() => setHistoryOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><button className="history-new" onClick={beginNewConversation}><Plus size={17}/>{lang === "zh" ? "开始新对话" : "Start a new conversation"}</button><div className="history-list">{allConversations.length ? allConversations.map((conversation) => <article key={conversation.id} className={conversation.id === conversationId ? "is-open" : ""}><button onClick={() => pickConversation(conversation)} aria-current={conversation.id === conversationId ? "true" : undefined}><strong>{conversation.title}</strong><small>{conversation.id === conversationId ? (lang === "zh" ? "正在聊" : "Open now") : new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button><button aria-label={lang === "zh" ? "删除对话" : "Delete conversation"} onClick={async () => { if (await askConfirm({ title: lang === "zh" ? "删除这段对话？" : "Delete this conversation?", body: lang === "zh" ? "删除后不能恢复。" : "This can't be undone.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" })) deleteConversation(conversation.id); }}><Trash size={16}/></button></article>) : <p>{lang === "zh" ? "还没有对话。" : "Your first completed conversation will appear here."}</p>}</div></aside></div>}

      {view === "home" && <section className={`home-ai-view ${sessionMessages.length ? "has-conversation" : "is-empty"}`}>
        {sessionMessages.length === 0 && <div className="home-ai-welcome">
          <p className="eyebrow" suppressHydrationWarning>{dateLabel}</p>
          <h1 style={greeting ? undefined : { visibility: "hidden" }}>{formatGreeting(greeting ?? { zh: "欢迎回来", en: "Welcome back", ask: false }, lang, goal.companionName)}</h1>
          <p style={quote ? undefined : { visibility: "hidden" }}>{quote ? (lang === "zh" ? quote.zh.map((part, index) => <span key={index}>{index > 0 && <br />}{part}</span>) : quote.en) : t.hero}</p>
        </div>}
        <div className="home-ai-thread">
          {sessionMessages.map((message, index) => <div className={`message-group ${message.role}`} key={message.id}><div className={`message ${message.role}`}>{message.text}</div><div className="message-actions">
            <button onClick={() => navigator.clipboard.writeText(message.text)} aria-label={lang === "zh" ? "复制" : "Copy"}><Copy size={15}/><span>{lang === "zh" ? "复制" : "Copy"}</span></button>
            {message.role === "user" ? <><button onClick={() => editUserMessage(index)}><NotePencil size={15}/><span>{lang === "zh" ? "编辑并重发" : "Edit and resend"}</span></button><button onClick={() => { setOldScene(message.text); setNewScene(""); setRewritingBelief(""); setReframeSection("turn"); setView("revision"); }}><ArrowsClockwise size={15}/><span>{lang === "zh" ? "带去转念" : "Reframe this"}</span></button></> : <><button onClick={() => regenerateReply(index)}><ArrowClockwise size={15}/><span>{lang === "zh" ? "重新回答" : "Regenerate"}</span></button><button onClick={() => saveReplyAsStory(message)}><BookmarkSimple size={15}/><span>{message.saved ? (lang === "zh" ? "已保存" : "Saved") : (lang === "zh" ? "存为剧本" : "Save as story")}</span></button><button onClick={() => { setFocusThought(""); setGoal((current) => ({ ...current, acceptedSceneLedger: { ...current.acceptedSceneLedger, [lang]: [message.text.slice(0, 500), ...current.acceptedSceneLedger[lang]].slice(0, 8) } })); setDreamIncoming(message.text.slice(0, 600)); setStudioOpen(false); setView("subliminal"); }}><Waveform size={15}/><span>{lang === "zh" ? "带入潜音" : "Take to Dreamscape"}</span></button><button className={message.feedback === "helpful" ? "selected" : ""} onClick={() => feedbackReply(message, "helpful")}><ThumbsUp size={15}/><span>{lang === "zh" ? "懂我" : "Helpful"}</span></button><button className={message.feedback === "missed" ? "selected" : ""} onClick={() => feedbackReply(message, "missed")}><ThumbsDown size={15}/><span>{lang === "zh" ? "不适合" : "Not for me"}</span></button><ReportButton lang={lang} onClick={() => setReportTarget({ excerpt: message.text })}/></>}
          </div></div>)}
          {isTyping && <div className="message ai typing" role="status" aria-label={lang === "zh" ? "正在回复" : "Replying"}><DoughHop size="xs"/></div>}
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
        makeAffirmations={async (from?: string) => {
          const reply = await callCompanion("affirm", from?.trim() || "-", undefined, []);
          return (reply || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        }}
        affirmations={goal.affirmations?.[lang] ?? null}
        onAffirmationsChange={saveAffirmations}
        ownLines={revisions.map((item) => splitThought(item.revised).thought).filter((line, index, all) => line && all.indexOf(line) === index)}
        incoming={dreamIncoming || focusThought}
        onIncomingDone={() => setDreamIncoming("")}
        onOpenStudio={() => setStudioOpen(true)}
      />}
      {view === "subliminal" && studioOpen && <>
        <SubliminalStudio lang={lang} desire={goal.desire[lang]} focusText={focusThought} focusKind="thought" checkIns={checkIns} onCheckIn={recordCheckIn} onBack={() => setStudioOpen(false)} sessionId={sessionId}/>
      </>}

      {memoryEditorOpen && <div className="memory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMemoryEditorOpen(false); }}><section className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-editor-title"><header><div><p className="eyebrow">{lang === "zh" ? "由你决定保留什么" : "YOU CHOOSE WHAT STAYS"}</p><h2 id="memory-editor-title">{memoryEditingId ? (lang === "zh" ? "编辑这条记忆" : "Edit this memory") : (lang === "zh" ? "添加一条记忆" : "Add a memory")}</h2></div><button onClick={() => setMemoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header><label><span>{lang === "zh" ? "类型" : "TYPE"}</span><select value={memoryDraft.kind} onChange={(event) => setMemoryDraft((current) => ({ ...current, kind: event.target.value as MemoryKind }))}>{memoryKinds.map((kind) => <option key={kind.id} value={kind.id}>{lang === "zh" ? kind.zh : kind.en}</option>)}</select></label><label><span>{lang === "zh" ? "标题" : "TITLE"}</span><input maxLength={80} value={memoryDraft.title} onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))} placeholder={lang === "zh" ? "例如：我喜欢先被理解" : "For example: Meet the feeling first"}/></label><label><span>{lang === "zh" ? "具体内容" : "DETAIL"}</span><textarea maxLength={600} value={memoryDraft.detail} onChange={(event) => setMemoryDraft((current) => ({ ...current, detail: event.target.value }))} placeholder={lang === "zh" ? "写下以后对话中仍然有用的语境。" : "Write the context that will still matter later."}/></label><label><span>{lang === "zh" ? "检索词" : "KEYWORDS"}</span><input value={memoryDraft.keywords} onChange={(event) => setMemoryDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder={lang === "zh" ? "用逗号分隔，最多 5 个" : "Comma-separated, up to 5"}/></label><footer><button className="outline-button" onClick={() => setMemoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button className="primary" disabled={!memoryDraft.title.trim() || !memoryDraft.detail.trim()} onClick={saveMemoryItem}>{lang === "zh" ? "保存到记忆库" : "Save to memory"}</button></footer></section></div>}

      {view === "story" && !storyReading && <StoryLibrary
        lang={lang}
        stories={storyLibrary}
        onOpen={(index) => { setStoryIndex(index); setStoryReading(true); window.scrollTo({ top: 0 }); }}
        onEdit={(story) => openStoryEditor(story)}
        onChangeCover={setCoverPickerId}
        onDelete={deleteStory}
      />}

      {view === "story" && storyReading && <StoryReader
        lang={lang}
        story={currentStory}
        stories={storyLibrary}
        index={storyIndex}
        writing={scriptingId === currentStory.id}
        busy={Boolean(scriptingId)}
        storiesLeft={storiesLeft}
        quotaOut={storyQuotaOut}
        aiError={aiError}
        aiErrorTitle={t.aiSetup}
        onBack={() => setStoryReading(false)}
        onEdit={() => openStoryEditor(currentStory)}
        onChangeCover={() => setCoverPickerId(currentStory.id)}
        onWrite={() => writeScript(currentStory)}
        onGo={(index) => { setStoryIndex(index); setAiError(""); window.scrollTo({ top: 0 }); }}
        onUpgrade={Capacitor.isNativePlatform() ? undefined : () => { setStoryReading(false); openSpace("membership"); }}
      />}

      {coverPickerId && (() => {
        const story = storyLibrary.find((item) => item.id === coverPickerId);
        if (!story) return null;
        return <StoryCoverPicker
          lang={lang}
          title={story.title[lang]}
          initialQuery={[story.title[lang], ["我的生活", "MY LIFE"].includes(story.city[lang]) ? "" : story.city[lang]].filter(Boolean).join(" ")}
          board={board.filter((item): item is BoardItem & { image: string } => Boolean(item.image)).map((item) => ({ image: item.image, title: item.title, source: item.source }))}
          hasCover={Boolean(story.cover?.image)}
          onPick={(cover, downloadLocation) => { setStoryCover(story.id, cover); reportPhotoUse(downloadLocation); setCoverPickerId(null); }}
          onRemove={() => { setStoryCover(story.id, null); setCoverPickerId(null); }}
          onClose={() => setCoverPickerId(null)}
        />;
      })()}

      {view === "revision" && <SpacePage
        className="reframe-space"
        title={lang === "zh" ? "转念" : "Reframe"}
        active={reframeSection}
        onSelect={(id) => setReframeSection(id as "turn" | "beliefs")}
        groups={[
          { title: lang === "zh" ? "练习" : "Practice", rows: [{ id: "turn", icon: WriteLineIcon, label: t.revisionTitle, value: revisions.length ? String(revisions.length) : undefined }] },
          { title: lang === "zh" ? "素材" : "To work on", rows: [{ id: "beliefs", icon: ThoughtsIcon, label: lang === "zh" ? "想换掉的念头" : "Thoughts to turn around", value: String(beliefCount) }] },
        ]}
      >
        {reframeSection === "turn" && <div className="profile-cards">
          <section className="profile-card">
            <h3>{t.oldLabel}</h3>
            <label className="wish-field"><textarea className={retiringOld ? "retiring" : ""} value={oldScene} onChange={(e) => setOldScene(e.target.value)} placeholder={t.oldPlaceholder} readOnly={retiringOld} aria-label={t.oldLabel} /></label>
            <div className="space-card-actions"><button type="button" className="wish-primary" onClick={() => makeRevision()} disabled={isTyping}>{isTyping ? <span className="dough-loading"><DoughHop size="xs"/>{t.turning}</span> : t.makeRevision}</button></div>
          </section>
          {aiError && <div className="ai-notice"><strong>{t.aiSetup}</strong><span>{aiError}</span></div>}
          {newScene && (() => {
            const { thought, reading } = splitThought(newScene);
            return <section className={`profile-card new-thought-card${retiringOld ? " accepting" : ""}`}>
              <div><span className="wish-chip is-current">{t.chosen}</span></div>
              <label className="wish-field"><textarea id="thought-draft" className="thought-draft" rows={2} value={thoughtDraft} onChange={(e) => setThoughtDraft(e.target.value)} readOnly={retiringOld || isTyping} aria-label={t.editThought} /></label>
              <small className="profile-sub">{t.editThought}</small>
              {reading && thoughtDraft.trim() === thought && <p className="new-thought-reading">{reading}</p>}
              <div className="space-card-actions">
                <button type="button" className="wish-primary" onClick={acceptRevision} disabled={!thoughtDraft.trim() || retiringOld || isTyping}>{savedPulse ? t.accepted : t.acceptStory}</button>
                {/* eslint-disable-next-line react-hooks/refs -- makeRevision only reads refs when clicked, not while rendering */}
                <button type="button" className="space-outline" onClick={() => makeRevision(thoughtDraft || thought)} disabled={isTyping || retiringOld}>{isTyping ? <span className="dough-loading"><DoughHop size="xs"/>{t.turning}</span> : t.rephrase}</button>
              </div>
            </section>;
          })()}
          {revisions.length > 0 && <section className="profile-card">
            <h3>{t.history} · {revisions.length}</h3>
            <ul className="space-rows">{revisions.slice(0, 8).map((item, index) => <li key={item.id} className={index === 0 && savedPulse ? "just-accepted" : undefined}>
              <small>{item.date}</small>
              <p>{splitThought(item.revised).thought}</p>
              <div className="space-row-actions"><button type="button" className="space-outline" onClick={() => { setFocusThought(splitThought(item.revised).thought); setStudioOpen(false); setView("subliminal"); }}><Waveform size={15}/>{t.toDreamscape}</button><button type="button" className="wish-delete" aria-label={lang === "zh" ? "删除这条新念头" : "Delete this new thought"} onClick={async () => { if (await askConfirm({ title: lang === "zh" ? "删除这条新念头？" : "Delete this new thought?", body: splitThought(item.revised).thought.slice(0, 120), confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" })) setRevisions((items) => items.filter((entry) => entry.id !== item.id)); }}><Trash size={15}/>{lang === "zh" ? "删除" : "Delete"}</button></div>
            </li>)}</ul>
          </section>}
        </div>}
        {reframeSection === "beliefs" && <div className="profile-cards">
          <section className="profile-card">
            {parseBeliefs(beliefDraft).length ? <ul className="thought-rows">{parseBeliefs(beliefDraft).map((item, index) => <li key={`${index}-${item}`}><span>{item}</span><button type="button" className="thought-turn" onClick={() => { turnBelief(item); setReframeSection("turn"); }}>{lang === "zh" ? "转念" : "Reframe"}</button><button type="button" className="profile-remove" aria-label={lang === "zh" ? `删除：${item}` : `Delete: ${item}`} onClick={() => removeBeliefWithUndo(item)}><X size={16}/></button></li>)}</ul> : <p className="setting-empty">{lang === "zh" ? "还没有写下想换掉的念头。" : "Nothing written here yet."}</p>}
            {beliefCount < MAX_BELIEFS && <div className="profile-topic-add"><input value={beliefInput} maxLength={200} onChange={(event) => setBeliefInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addBelief(); } }} placeholder={lang === "zh" ? "例如：他根本不在乎我" : "e.g. They don't really care"} aria-label={lang === "zh" ? "添加一个想换掉的念头" : "Add a thought to turn around"}/><button type="button" className="profile-topic-plus" disabled={!beliefInput.trim()} onClick={addBelief}><Plus size={15}/> {lang === "zh" ? "添加" : "Add"}</button></div>}
            <small className={`profile-count${beliefCount > MAX_BELIEFS ? " over" : ""}`}>{beliefCount} / {MAX_BELIEFS}</small>
          </section>
        </div>}
      </SpacePage>}

      {view === "persona" && <PersonaStudio lang={lang} sessionId={sessionId} herName={goal.companionName} onOpenMembership={Capacitor.isNativePlatform() ? undefined : () => openSpace("membership")} />}

      {view === "board" && <SpacePage
        className="vision-space"
        title={lang === "zh" ? "愿景" : "Vision"}
        active={boardMode}
        onSelect={(id) => setBoardMode(id as "licensed" | "mine")}
        groups={[
          { title: lang === "zh" ? "找画面" : "Find pictures", rows: [
            { id: "licensed", icon: MagnifyingGlass, label: lang === "zh" ? "寻梦灵感" : "Discover Dreamscapes" },
            { id: "mine", icon: ImageSquare, label: lang === "zh" ? "我的愿景板" : "My vision board" },
          ] },
        ]}
      >
        {boardMode === "licensed" && <div className="profile-cards">
          <section className="profile-card">
            <div className="space-search"><input value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) searchRealImages(); }} placeholder={t.searchPlaceholder} aria-label={t.realPhotos}/><button type="button" className="wish-primary" onClick={() => searchRealImages()} disabled={imageSearching}>{imageSearching ? <span className="dough-loading"><DoughHop size="xs"/>{t.searching}</span> : t.search}</button></div>
            <div className="wish-pills">{suggestions.map((term) => <button type="button" key={term} onClick={() => searchRealImages(term)}>{term}</button>)}</div>
            {imageSearchError && <p className="search-error">{imageSearchError}</p>}
          </section>
          {imageResults.length > 0 && <div className="search-results">{imageResults.map((item) => { const saved = board.some((entry) => entry.source === item.source); return <article key={item.source}><img src={item.image} alt={item.title}/><div><strong>{item.title}</strong><small>{item.credit} · {item.license}</small><button type="button" className={saved ? "saved" : ""} onClick={() => collectSearchImage(item)} disabled={saved}>{saved ? (lang === "zh" ? "已收进我的愿景" : "Saved") : t.collect}</button></div></article>; })}</div>}
        </div>}
        {boardMode === "mine" && <VisionCanvasStudio lang={lang} saved={board} onRemoveSaved={(id) => setBoard((items) => items.filter((entry) => entry.id !== id))}/>}
      </SpacePage>}

      {view === "settings" && (() => {
        const shown: SpaceSection = settingsSection ?? "wishes";
        const zhText = lang === "zh";
        const titles: Record<SpaceSection, string> = { wishes: zhText ? "我的愿望" : "My desires", about: zhText ? "关于我" : "About me", library: zhText ? "记忆库" : "Memory library", memory: zhText ? "背景与念头" : "Background and thoughts", dough: zhText ? "小 Dough" : "Little Dough", membership: zhText ? "会员与用量" : "Membership and usage", pet: zhText ? "下载桌宠" : "Desktop pet", look: zhText ? "外观与语言" : "Look and language", sync: zhText ? "同步与数据" : "Sync and data", help: zhText ? "帮助与条款" : "Help and terms" };
        return <section className="full-view settings-view space">
          <div className={`space-layout${settingsSection ? " has-detail" : ""}`}>
            <SpaceNav
              title={zhText ? "我的空间" : "My space"}
              active={settingsSection}
              onSelect={(id) => { setSettingsSection(id as SpaceSection); scrollSpaceToTop(); }}
              groups={[
                { title: zhText ? "我" : "Me", rows: [
                  { id: "wishes", icon: WishesIcon, label: titles.wishes, value: String(sortedGoals.length) },
                  { id: "about", icon: AboutIcon, label: titles.about },
                ] },
                { title: zhText ? "记忆" : "Memory", rows: [
                  { id: "library", icon: LibraryIcon, label: titles.library, value: String(currentMemoryItems.length) },
                  { id: "memory", icon: ThoughtsIcon, label: titles.memory },
                ] },
                { title: zhText ? "应用" : "App", rows: [
                  ...(touchDevice ? [{ id: "dough", icon: DoughIcon, label: titles.dough, value: checkedToday ? (zhText ? "今天已打卡" : "Checked in") : undefined }] : []),
                  // The iPhone app must not link to web checkout (App Store rules).
                  ...(Capacitor.isNativePlatform() ? [] : [{ id: "membership", icon: MembershipIcon, label: titles.membership, value: memberPlanLabel(member, lang) }]),
                  // a desktop pet is for computers; the phone app already has the dough on its home screen
                  ...(Capacitor.isNativePlatform() ? [] : [{ id: "pet", icon: PetIcon, label: titles.pet }]),
                  { id: "look", icon: LookIcon, label: titles.look, value: dark ? (zhText ? "深色" : "Dark") : (zhText ? "浅色" : "Light") },
                  { id: "sync", icon: SyncIcon, label: titles.sync },
                  { id: "help", icon: HelpIcon, label: titles.help },
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
              {shown === "memory" && <ContextSection lang={lang} goal={goal} setGoal={setGoal} beliefs={parseBeliefs(beliefDraft)} beliefCount={beliefCount} beliefInput={beliefInput} onBeliefInput={setBeliefInput} onAddBelief={addBelief} onTurnBelief={turnBelief} onRemoveBelief={removeBeliefWithUndo} />}
              {shown === "library" && <LibrarySection lang={lang} goal={goal} currentMemoryItems={currentMemoryItems} onEditMemory={openMemoryEditor} onTogglePin={toggleMemoryPin} onDeleteMemory={deleteMemoryItem} />}
              {shown === "membership" && <MembershipPanel lang={lang} member={member} onRefresh={refreshMember} />}
              {shown === "pet" && <DesktopPetPanel lang={lang} />}
              {shown === "look" && <LookSection lang={lang} dark={dark} onTheme={chooseTheme} onSwitchLanguage={switchLanguage} />}
              {shown === "sync" && <DataSection lang={lang} syncStatus={syncStatus} onExport={exportMyData} onReplay={() => setReplaying(true)} onClearEverything={clearEverything} />}
              {shown === "dough" && <div className="settings-section dough-space"><DoughPet inline lang={lang} checked={checkedToday} streak={streak} onCheckIn={() => recordCheckIn("chosen")}/></div>}
              {shown === "help" && <HelpSection lang={lang} trustLabel={t.trust} onReport={() => setReportTarget({})} />}
            </div>
          </div>
        </section>;
      })()}

      </section>

      {surveyOpen && <div className="survey-backdrop" role="presentation"><section className="beta-survey" role="dialog" aria-modal="true" aria-labelledby="beta-survey-title"><header><div><p className="eyebrow">10-MINUTE CHECK-IN</p><h2 id="beta-survey-title">{lang === "zh" ? "刚刚这十分钟，对你有帮助吗？" : "Did these ten minutes help?"}</h2></div><button type="button" onClick={dismissSurvey} aria-label={lang === "zh" ? "稍后再说" : "Ask me later"}>×</button></header><div className="survey-scroll"><fieldset><legend>{lang === "zh" ? "1. “我的愿望已经属于我”这件事，稳定感有多少？" : "1. How steady does “my desire is already mine” feel?"}</legend><div className="survey-pair"><label><span>{lang === "zh" ? "刚打开时" : "When I opened"}</span><SurveyScale value={surveyBefore} onChange={setSurveyBefore} lang={lang}/></label><label><span>{lang === "zh" ? "现在" : "Right now"}</span><SurveyScale value={surveyNow} onChange={setSurveyNow} lang={lang}/></label></div></fieldset><fieldset><legend>{lang === "zh" ? "2. AlreaDough 有没有在不否定愿望的情况下，真正理解你？" : "2. Did AlreaDough understand you without denying your desire?"}</legend><SurveyScale value={surveyUnderstood} onChange={setSurveyUnderstood} lang={lang}/></fieldset><fieldset><legend>{lang === "zh" ? "3. 下次动摇时，你有多愿意再次打开 AlreaDough？" : "3. How likely are you to open AlreaDough the next time doubt appears?"}</legend><SurveyScale value={surveyReturn} onChange={setSurveyReturn} lang={lang}/></fieldset><fieldset><legend>{lang === "zh" ? "4. 今天最帮到你的部分是什么？" : "4. What helped you most today?"}</legend><div className="survey-features">{[
        ["chat", lang === "zh" ? "AI 对话" : "AI chat"], ["story", lang === "zh" ? "剧本" : "Scripts"], ["revision", lang === "zh" ? "转念" : "Reframe"], ["audio", lang === "zh" ? "声音练习" : "Audio"], ["vision", lang === "zh" ? "愿景板" : "Vision board"], ["unsure", lang === "zh" ? "还不确定" : "Not sure yet"],
      ].map(([id, label]) => <button type="button" key={id} className={surveyFeature === id ? "selected" : ""} onClick={() => setSurveyFeature(id)}>{label}</button>)}</div></fieldset></div><footer><small>{lang === "zh" ? "只记录匿名选项，不保存你的愿望或聊天内容。" : "Only anonymous choices are recorded—never your desire or chat content."}</small><div><button type="button" className="survey-later" onClick={dismissSurvey}>{lang === "zh" ? "稍后再说" : "Later"}</button><button type="button" className="primary" disabled={!surveyBefore || !surveyNow || !surveyUnderstood || !surveyReturn || !surveyFeature} onClick={submitSurvey}>{lang === "zh" ? "提交，继续练习" : "Submit and continue"}</button></div></footer></section></div>}

      {storyEditorOpen && <div className="story-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStoryEditorOpen(false); }}>
        <form className="story-editor-modal" onSubmit={(event) => { event.preventDefault(); saveStory(true); }}>
          <header><div><p className="eyebrow">{storyEditingId ? (lang === "zh" ? "编辑剧本" : "EDIT SCRIPT") : (lang === "zh" ? "新的已实现时刻" : "A NEW FULFILLED MOMENT")}</p><h2>{storyEditingId ? (lang === "zh" ? "把这个剧本写成你的版本" : "Make this story yours") : (lang === "zh" ? "它已经发生在哪里？" : "Where has it already happened?")}</h2></div><button type="button" onClick={() => setStoryEditorOpen(false)} aria-label={lang === "zh" ? "关闭" : "Close"}>×</button></header>
          {(() => {
            const kindOf = (id: string) => { const item = [goal, ...otherGoals].find((entry) => entry.id === id); return item ? storyKindOfGoal(item) : "other"; };
            const pick = (id: string) => setStoryDraft((draft) => ({ ...draft, goalId: id, category: draft.categoryTouched ? draft.category : kindOf(id) }));
            return <fieldset className="story-category-picker">
              <legend><span>{lang === "zh" ? "这个剧本属于哪个愿望" : "Which desire is this script for"}</span></legend>
              <div>{sortedGoals.map((item) => <button type="button" key={item.id} className={storyDraft.goalId === item.id ? "active" : ""} aria-pressed={storyDraft.goalId === item.id} onClick={() => pick(item.id)}>{goalTitle(item, lang)}</button>)}<button type="button" className={storyDraft.goalId === NO_STORY_GOAL ? "active" : ""} aria-pressed={storyDraft.goalId === NO_STORY_GOAL} onClick={() => pick(NO_STORY_GOAL)}>{lang === "zh" ? "不属于任何愿望" : "No desire"}</button></div>
              <div className="story-kind-line"><span>{lang === "zh" ? "类型：" : "Kind: "}{storyDraft.category ? STORY_CATEGORY_LABELS[storyDraft.category][lang] : ""}</span><button type="button" aria-expanded={storyKindOpen} onClick={() => setStoryKindOpen((open) => !open)}>{storyKindOpen ? (lang === "zh" ? "收起" : "Done") : (lang === "zh" ? "改" : "Change")}</button></div>
              {storyKindOpen && <div className="story-kind-options">{STORY_CATEGORIES.map((id) => <button type="button" key={id} className={storyDraft.category === id ? "active" : ""} aria-pressed={storyDraft.category === id} onClick={() => setStoryDraft((draft) => ({ ...draft, category: id, categoryTouched: true }))}>{STORY_CATEGORY_LABELS[id][lang]}</button>)}</div>}
            </fieldset>;
          })()}
          <div className="story-editor-grid">
            <label><span>{lang === "zh" ? "剧本标题" : "SCRIPT TITLE"}</span><input value={storyDraft.title} onChange={(event) => setStoryDraft((draft) => ({ ...draft, title: event.target.value }))} maxLength={42} placeholder={lang === "zh" ? "例如：愿望实现后的普通一天" : "For example: An ordinary day after it came true"}/></label>
            <label><span>{lang === "zh" ? "地点" : "PLACE"}</span><input value={storyDraft.city} onChange={(event) => setStoryDraft((draft) => ({ ...draft, city: event.target.value }))} maxLength={32} placeholder={lang === "zh" ? "家里、校园、办公室、旅途中" : "Home, campus, work, or on a trip"}/></label>
          </div>
          <label><span>{lang === "zh" ? "一句氛围" : "MOOD IN ONE LINE"}</span><input value={storyDraft.subtitle} onChange={(event) => setStoryDraft((draft) => ({ ...draft, subtitle: event.target.value }))} maxLength={80} placeholder={lang === "zh" ? "这个时刻最真实的感受" : "How this moment feels"}/></label>
          <label><span>{lang === "zh" ? "场景要点" : "SCENE NOTES"}</span><textarea value={storyDraft.scene} onChange={(event) => setStoryDraft((draft) => ({ ...draft, scene: event.target.value }))} placeholder={lang === "zh" ? "几个关键词或几句话就够。AI 会把它写成有真实地点、气味、声音和对话的完整剧本。" : "A few keywords or lines are enough. The AI writes them into a full script with a real place, smells, sounds, and dialogue."}/></label>{(() => { const desire = [goal, ...otherGoals].find((item) => item.id === storyDraft.goalId); if (!desire) return null; return <details className="story-setting"{...(desire.storySetting[lang] ? { open: true } : {})}><summary>{lang === "zh" ? "人物与生活设定（这个愿望的所有剧本共用）" : "People and life (shared by every script for this desire)"}</summary><textarea maxLength={MAX_STORY_SETTING} value={desire.storySetting[lang]} onChange={(event) => updateStorySetting(desire.id, event.target.value)} placeholder={lang === "zh" ? "TA 是什么样的人：家境、职业、穿着、说话方式、小习惯。你们的生活：生活水平、品味、常去的地方。剧本里不想出现的：比如不要写他穿运动品牌。" : "Who they are: background, work, how they dress and talk, little habits. Your life together: how you live, your taste, places you go. What to leave out of scripts: for example, no sportswear on him."}/></details>; })()}
          <label><span>{lang === "zh" ? "锚定句" : "ANCHOR LINE"}</span><input value={storyDraft.anchor} onChange={(event) => setStoryDraft((draft) => ({ ...draft, anchor: event.target.value }))} maxLength={100} placeholder={lang === "zh" ? "例如：拥有它已经是我熟悉的日常。" : "For example: Having it is already part of my everyday life."}/></label>
          {storiesLeft !== null && <StoryQuotaNote lang={lang} left={storiesLeft} onUpgrade={Capacitor.isNativePlatform() ? undefined : () => { setStoryEditorOpen(false); setStoryReading(false); openSpace("membership"); }}/>}
          <footer><small>{lang === "zh" ? `${storyLibrary.length} / ${MAX_STORIES} 个剧本` : `${storyLibrary.length} / ${MAX_STORIES} stories`}</small><div><button type="button" className="outline-button" onClick={() => setStoryEditorOpen(false)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="outline-button" disabled={!storyDraft.title.trim() || !storyDraft.scene.trim() || !storyDraft.category} onClick={() => saveStory(false)}>{lang === "zh" ? "只保存" : "Save only"}</button><button type="submit" className="primary" disabled={!storyDraft.title.trim() || !storyDraft.scene.trim() || !storyDraft.category || Boolean(scriptingId) || storyQuotaOut}>{storyEditingId && storyLibrary.find((item) => item.id === storyEditingId)?.scripted ? (lang === "zh" ? "保存并重写剧本" : "Save and rewrite") : (lang === "zh" ? "保存并写成剧本" : "Save and write script")}</button></div></footer>
        </form>
      </div>}

      {view === "home" && <DoughPet lang={lang} checked={checkedToday} streak={streak} onCheckIn={() => recordCheckIn("chosen")}/>}

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
