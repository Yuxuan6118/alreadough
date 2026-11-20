"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DoughHop from "./DoughHop";
import { ArrowLeft, Microphone, Pause, Play, SkipBack, SkipForward, Stop } from "@phosphor-icons/react";
import { startAmbience, type AmbienceHandle, type AmbienceKind } from "@/lib/ambience";
import { recordingToWav, toDataUri } from "@/lib/recording";
import { cacheKey, clearVoiceCache, readCached, writeCached } from "@/lib/voice-cache";
import { VOICE_LIMITS } from "@/lib/voice-limits";
import { readStored, writeStored } from "@/lib/safe-storage";
import "./dreamscape.css";
import { askConfirm } from "./ConfirmHost";
import AffirmationEditor from "./AffirmationEditor";

type Lang = "zh" | "en";
type Screen = "home" | "record" | "player";
type Mode = "night" | "affirm" | "story";
type Feeling = "settled" | "soft" | "chosen";

type Props = {
  lang: Lang;
  sessionId: string;
  desire: string;
  story: { title: string; paragraphs: string[] } | null;
  onCheckIn: (feeling: Feeling) => void;
  /** Ask the companion for a few lines; with `from`, pick them out of that text. May throw. */
  makeAffirmations: (from?: string) => Promise<string[]>;
  /** Her own affirmations for this desire; null until the first set is made. */
  affirmations: string[] | null;
  onAffirmationsChange: (lines: string[]) => void;
  /** New thoughts she accepted in Reframe: offered, never added on their own. */
  ownLines?: string[];
  /** Text she brought here from a conversation or Reframe, waiting to be turned into lines. */
  incoming?: string;
  onIncomingDone?: () => void;
  onOpenStudio: () => void;
};

const DOUGH = "/mascot/already-dough-fold-v3.png";
const GAP_MS = 1600;
const KEY_USE_MINE = "already-use-my-voice-v1";
const KEY_AMBIENCE = "already-dream-ambience-v1";
const KEY_AFFIRM = "already-dream-affirmations-v1";
const KEY_SKIPPED = "already-dream-skipped-v1";
const MAX_LINES = 12;

const DEFAULT_LINES: Record<Lang, string[]> = {
  zh: ["我不用着急，也不用证明什么。", "我知道，我想要的，已经在我的生活里了。", "我只是照着自己的节奏，做今天该做的事。", "我值得被好好对待，也已经被好好对待着。", "今晚我放心地睡去，明天已经在等我。"],
  en: ["I do not need to rush, and I have nothing to prove.", "I know that what I want is already in my life.", "I simply move at my own pace and do what today asks.", "I deserve to be treated well, and I already am.", "Tonight I fall asleep at ease, and tomorrow is already waiting."],
};

const SCRIPT: Record<Lang, string[]> = {
  zh: [
    "今天早上我醒得很自然，窗帘透进来一点淡淡的光。我先喝了一杯温水，然后慢慢地走到窗边。",
    "一切都很安静，我也很安静。我知道，我想要的，已经在我的生活里了。",
    "我不用着急，也不用证明什么。我只是照着自己的节奏，做今天该做的事：洗个澡，换上喜欢的衣服，给自己煮一碗热热的面。",
    "下午有一点阳光，我坐在桌前，把想写的东西一句一句写下来。晚上，我给朋友打了个电话，我们笑了很久。",
    "我对自己说：谢谢你，今天也过得很好。",
  ],
  en: [
    "This morning I woke up easily, and a soft light came through the curtains. I drank a glass of warm water and walked slowly to the window.",
    "Everything was quiet, and so was I. I know that what I want is already in my life.",
    "I do not need to rush, and I have nothing to prove. I simply move at my own pace and do what today asks: I take a shower, put on something I like, and make myself a warm bowl of noodles.",
    "In the afternoon there was a little sun. I sat at my desk and wrote down, one line at a time, what I wanted to write. In the evening I called a friend, and we laughed for a long time.",
    "I tell myself: thank you, today went well too.",
  ],
};

/** A half-second of silence. Playing it inside her tap unlocks the player on iPhone, so the voice may start later. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function errorText(code: string, zh: boolean) {
  const table: Record<string, [string, string]> = {
    VOICE_DAILY_LIMIT: ["今天的声音额度用完了，明天再来。", "You have used today's voice. Come back tomorrow."],
    TOO_MANY_RECORDINGS: ["今天录得够多了，明天再试。", "That's enough recordings for today. Try again tomorrow."],
    SAMPLE_TOO_SHORT: [`太短了，请读满 ${VOICE_LIMITS.minSampleSeconds} 秒以上。`, `Too short. Read for at least ${VOICE_LIMITS.minSampleSeconds} seconds.`],
    SAMPLE_TOO_LONG: ["太长了，请控制在 60 秒内。", "Too long. Keep it under 60 seconds."],
    AI_PAUSED: ["声音服务正在维护，请稍后再来。", "The voice is being maintained. Please come back shortly."],
    VOICE_NOT_CONFIGURED: ["声音服务还没有开通。", "The voice service is not switched on yet."],
  };
  const hit = table[code];
  return hit ? hit[zh ? 0 : 1] : zh ? "声音暂时没有成功，请再试一次。" : "That didn't work. Please try again.";
}

export default function Dreamscape({ lang, sessionId, desire, story, onCheckIn, makeAffirmations, affirmations, onAffirmationsChange, ownLines = [], incoming = "", onIncomingDone, onOpenStudio }: Props) {
  const zh = lang === "zh";
  const t = (a: string, b: string) => (zh ? a : b);
  const headers = useMemo(() => ({ "x-already-session-id": sessionId, "Content-Type": "application/json" }), [sessionId]);

  const [screen, setScreen] = useState<Screen>("home");
  const [voice, setVoice] = useState<{ loaded: boolean; has: boolean; createdAt: string | null }>({ loaded: false, has: false, createdAt: null });
  const [useMine, setUseMine] = useState(true);
  const [ambience, setAmbience] = useState<AmbienceKind>("off");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("night");
  const [items, setItems] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);

  const tokenRef = useRef(0);
  const pausedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<string[]>([]);
  const urlsRef = useRef<string[]>([]);
  const durationsRef = useRef<number[]>([]);
  const ambienceRef = useRef<AmbienceHandle | null>(null);
  const ambienceKindRef = useRef<AmbienceKind>("off");

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restoration of her settings */
  useEffect(() => {
    setUseMine(readStored(KEY_USE_MINE) !== "off");
    const saved = readStored(KEY_AMBIENCE);
    if (saved === "rain" || saved === "ocean" || saved === "fire" || saved === "brown" || saved === "off") { setAmbience(saved); ambienceKindRef.current = saved; }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // each screen starts at the top
  useEffect(() => {
    window.scrollTo?.(0, 0);
    document.querySelector(".app-stage")?.scrollTo?.(0, 0);
  }, [screen]);

  const loadVoice = useCallback(async () => {
    try {
      const response = await fetch("/api/voice", { headers });
      const data = await response.json() as { hasVoice?: boolean; createdAt?: string | null };
      setVoice({ loaded: true, has: Boolean(data.hasVoice), createdAt: data.createdAt || null });
    } catch {
      setVoice({ loaded: true, has: false, createdAt: null });
    }
  }, [headers]);
  /* eslint-disable react-hooks/set-state-in-effect -- fetch her voice status when the screen opens */
  useEffect(() => { void loadVoice(); }, [loadVoice]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const stopAll = useCallback((fade = 0.6) => {
    tokenRef.current += 1;
    audioRef.current?.pause();
    ambienceRef.current?.stop(fade);
    ambienceRef.current = null;
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    playlistRef.current = [];
    pausedRef.current = false;
  }, []);
  useEffect(() => () => stopAll(0.2), [stopAll]);

  const owner = voice.has && useMine ? `mine:${voice.createdAt}` : "default";

  const maxLength = zh ? 40 : 120;
  const clean = useCallback((raw: string[]) => raw.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length >= 2 && line.length <= maxLength), [maxLength]);
  const lines = useMemo(() => (affirmations || []).filter(Boolean), [affirmations]);

  // the very first time: a starting set she can change (the companion's lines, else plain ones)
  const seedingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => {
    if (affirmations !== null || seedingRef.current) return;
    seedingRef.current = true;
    const seed = async () => {
      let start: string[] = [];
      try {
        const cached = JSON.parse(readStored(`${KEY_AFFIRM}:${lang}:${desire.slice(0, 60)}`) || "null") as string[] | null;
        if (Array.isArray(cached)) start = clean(cached);
      } catch { /* make a fresh set */ }
      if (start.length < 3) { try { start = clean(await makeAffirmations()); } catch { start = []; } }
      if (start.length < 3) start = DEFAULT_LINES[lang];
      seedingRef.current = false;
      if (mountedRef.current) onAffirmationsChange(start.slice(0, 8));
    };
    void seed();
  }, [affirmations, clean, desire, lang, makeAffirmations, onAffirmationsChange]);

  // lines she may add: picks from what she brought here, AI ideas, new thoughts, lines she removed
  const [picked, setPicked] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>(() => { try { return JSON.parse(readStored(KEY_SKIPPED) || "[]") as string[]; } catch { return []; } });
  const [asking, setAsking] = useState(false);
  const suggestions = useMemo(() => {
    const seen = new Set(lines);
    return [...picked, ...ideas, ...clean(ownLines), ...removed].filter((line) => {
      if (!line || seen.has(line) || skipped.includes(line)) return false;
      seen.add(line);
      return true;
    }).slice(0, 8);
  }, [clean, ideas, lines, ownLines, picked, removed, skipped]);

  /* eslint-disable react-hooks/set-state-in-effect -- turn what she brought here into lines once */
  useEffect(() => {
    const text = incoming.trim();
    if (!text) return;
    onIncomingDone?.();
    if (text.length <= maxLength) { setPicked((current) => [text, ...current]); return; }
    setAsking(true);
    makeAffirmations(text)
      .then((found) => setPicked((current) => [...clean(found).slice(0, 4), ...current]))
      .catch(() => setMessage(t("这次没有挑出句子，可以自己写一句。", "Couldn't pick lines this time. You can write one yourself.")))
      .finally(() => setAsking(false));
  }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const changeLines = (next: string[]) => {
    const kept = next.map((line) => line.replace(/\s+/g, " ").trim().slice(0, maxLength));
    if (kept.filter(Boolean).length < lines.filter(Boolean).length) setRemoved((current) => [...lines.filter((line) => line && !kept.includes(line)), ...current].slice(0, 6));
    onAffirmationsChange(kept.filter(Boolean).slice(0, MAX_LINES));
  };
  const acceptLine = (line: string) => {
    if (lines.length >= MAX_LINES) return;
    onAffirmationsChange([...lines.filter(Boolean), line]);
    setPicked((current) => current.filter((item) => item !== line));
    setIdeas((current) => current.filter((item) => item !== line));
    setRemoved((current) => current.filter((item) => item !== line));
  };
  const skipLine = (line: string) => {
    const next = [line, ...skipped].slice(0, 60);
    setSkipped(next);
    writeStored(KEY_SKIPPED, JSON.stringify(next));
  };
  const askIdeas = async () => {
    setAsking(true);
    try {
      const fresh = clean(await makeAffirmations()).filter((line) => !lines.includes(line));
      setIdeas(fresh.slice(0, 5));
      if (!fresh.length) setMessage(t("这次没有想出新句子，再试一次。", "No new lines this time. Try again."));
    } catch { setMessage(t("现在想不出来，稍后再试。", "Couldn't think of any right now. Try again shortly.")); }
    finally { setAsking(false); }
  };

  const fetchLine = useCallback(async (text: string): Promise<Blob> => {
    const key = await cacheKey(owner, text);
    const cached = await readCached(key);
    if (cached) return cached;
    const response = await fetch("/api/voice/speak", { method: "POST", headers, body: JSON.stringify({ text, useMyVoice: useMine }) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "VOICE_FAILED");
    }
    const blob = await response.blob();
    await writeCached(key, blob);
    return blob;
  }, [headers, owner, useMine]);

  // one line in her voice, made once and kept, so only a changed line is made again
  const [preview, setPreview] = useState<{ line: string; state: "loading" | "playing" } | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewToken = useRef(0);
  const stopPreview = () => { previewToken.current += 1; previewRef.current?.pause(); setPreview(null); };
  const playPreview = async (line: string) => {
    if (preview?.line === line) { stopPreview(); return; }
    stopPreview();
    const token = previewToken.current;
    const player = previewRef.current || new Audio();
    previewRef.current = player;
    player.src = SILENCE;
    void player.play().catch(() => undefined);
    setPreview({ line, state: "loading" });
    try {
      const blob = await fetchLine(line);
      if (token !== previewToken.current) return;
      const url = URL.createObjectURL(blob);
      player.onended = () => { URL.revokeObjectURL(url); if (token === previewToken.current) setPreview(null); };
      player.src = url;
      await player.play();
      setPreview({ line, state: "playing" });
    } catch (error) {
      if (token !== previewToken.current) return;
      setPreview(null);
      setMessage(errorText(error instanceof Error ? error.message : "", zh));
    }
  };
  useEffect(() => () => { previewRef.current?.pause(); }, []);

  const playFrom = useCallback(async (start: number) => {
    const token = ++tokenRef.current;
    const list = playlistRef.current;
    const player = audioRef.current;
    if (!player) return;
    const holdWhilePaused = async () => { while (pausedRef.current && token === tokenRef.current) await sleep(150); };
    for (let i = start; i < list.length; i += 1) {
      if (token !== tokenRef.current) return;
      setCurrent(i);
      const before = durationsRef.current.slice(0, i).reduce((sum, value) => sum + value, 0);
      player.ontimeupdate = () => setElapsed(before + player.currentTime);
      await new Promise<void>((resolve) => {
        player.onended = () => resolve();
        player.onerror = () => resolve();
        player.src = list[i];
        player.currentTime = 0;
        void player.play().catch(() => resolve());
      });
      if (token !== tokenRef.current) return;
      await holdWhilePaused();
      let waited = 0;
      while (waited < GAP_MS && token === tokenRef.current) { await sleep(150); await holdWhilePaused(); waited += 150; }
    }
    if (token !== tokenRef.current) return;
    ambienceRef.current?.stop(3);
    ambienceRef.current = null;
    setPlaying(false);
    setFinished(true);
    onCheckIn("settled");
  }, [onCheckIn]);

  const begin = useCallback(async (next: Mode) => {
    stopAll(0.3);
    previewToken.current += 1;
    previewRef.current?.pause();
    setPreview(null);
    // unlock the player inside her tap (iPhone refuses audio that starts after a wait)
    const player = audioRef.current || new Audio();
    audioRef.current = player;
    player.src = SILENCE; // eslint-disable-line react-hooks/immutability -- the shared player is unlocked inside her tap, as iPhone requires
    void player.play().catch(() => undefined);
    setMessage("");
    setFinished(false);
    setMode(next);
    setScreen("player");
    setPlaying(false);
    setElapsed(0);
    setCurrent(0);
    try {
      let texts: string[];
      if (next === "story") {
        texts = (story?.paragraphs || []).flatMap((p) => p.split(/(?<=[。！？.!?])\s*/)).map((s) => s.trim()).filter(Boolean);
        // keep each request a sensible size by joining short sentences
        const joined: string[] = [];
        for (const sentence of texts) {
          const last = joined[joined.length - 1];
          if (last && last.length + sentence.length <= (zh ? 120 : 260)) joined[joined.length - 1] = `${last}${zh ? "" : " "}${sentence}`; else joined.push(sentence);
        }
        texts = joined.slice(0, 40);
      } else {
        const base = lines.filter(Boolean);
        texts = next === "night" ? [...base, ...base] : base;
      }
      if (!texts.length) { setMessage(next === "story" ? t("还没有剧本可以听，先去“剧本”里写一个。", "There is no story to listen to yet. Write one in Stories first.") : t("先写一句肯定语。", "Write an affirmation first.")); setScreen("home"); return; }
      setItems(texts);
      const unique = Array.from(new Set(texts));
      setPreparing({ done: 0, total: unique.length });
      const blobs = new Map<string, Blob>();
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < unique.length) {
          const text = unique[cursor++];
          blobs.set(text, await fetchLine(text));
          done += 1;
          setPreparing({ done, total: unique.length });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const urlFor = new Map<string, string>();
      for (const [text, blob] of blobs) urlFor.set(text, URL.createObjectURL(blob));
      urlsRef.current = Array.from(urlFor.values());
      playlistRef.current = texts.map((text) => urlFor.get(text) || "");
      durationsRef.current = await Promise.all(playlistRef.current.map((url) => new Promise<number>((resolve) => {
        const probe = new Audio();
        probe.preload = "metadata";
        probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 4);
        probe.onerror = () => resolve(4);
        probe.src = url;
      })));
      setTotal(durationsRef.current.reduce((sum, value) => sum + value, 0) + GAP_MS / 1000 * texts.length);
      setPreparing(null);
      if (next === "night") ambienceRef.current = startAmbience(ambienceKindRef.current, 0.6);
      setPlaying(true);
      void playFrom(0);
    } catch (error) {
      stopAll(0.2);
      setPreparing(null);
      setMessage(errorText(error instanceof Error ? error.message : "", zh));
      setScreen("home");
    }
  }, [fetchLine, lines, playFrom, stopAll, story, t, zh]);

  const togglePause = () => {
    if (finished) { void begin(mode); return; }
    const audio = audioRef.current;
    if (playing) { pausedRef.current = true; audio?.pause(); ambienceRef.current?.setVolume(0.15); setPlaying(false); }
    else { pausedRef.current = false; void audio?.play(); ambienceRef.current?.setVolume(0.6); setPlaying(true); }
  };
  const skip = (delta: number) => {
    const next = Math.max(0, Math.min(playlistRef.current.length - 1, current + delta));
    audioRef.current?.pause();
    pausedRef.current = false;
    setPlaying(true);
    ambienceRef.current?.setVolume(0.6);
    void playFrom(next);
  };
  const leavePlayer = () => { stopAll(0.8); setPlaying(false); setFinished(false); setPreparing(null); setScreen("home"); };
  const cycleAmbience = () => {
    const next: AmbienceKind = ambience === "rain" ? "ocean" : ambience === "ocean" ? "fire" : ambience === "fire" ? "brown" : ambience === "brown" ? "off" : "rain";
    setAmbience(next);
    ambienceKindRef.current = next;
    writeStored(KEY_AMBIENCE, next);
    if (ambienceRef.current) { ambienceRef.current.stop(0.6); ambienceRef.current = playing || mode === "night" ? startAmbience(next, 0.6) : null; }
  };
  const flipUseMine = () => { const next = !useMine; setUseMine(next); writeStored(KEY_USE_MINE, next ? "on" : "off"); };

  const removeVoice = async () => {
    if (!(await askConfirm({ title: t("删除你录下的声音？", "Delete your recorded voice?"), body: t("删除后会回到默认声音，之后可以重新录。", "You will go back to the default voice and can record again."), confirmLabel: t("删除", "Delete"), cancelLabel: t("取消", "Cancel") }))) return;
    try {
      const response = await fetch("/api/voice", { method: "DELETE", headers });
      if (!response.ok) throw new Error("DELETE_FAILED");
      clearVoiceCache();
      await loadVoice();
      setMessage(t("你的声音已删除。", "Your voice is deleted."));
    } catch {
      setMessage(t("没有删除成功，请稍后再试。", "Couldn't delete it. Please try again shortly."));
    }
  };

  if (screen === "record") {
    return <RecordScreen lang={lang} headers={headers} onBack={() => setScreen("home")} onDone={async () => { clearVoiceCache(); await loadVoice(); setUseMine(true); writeStored(KEY_USE_MINE, "on"); setMessage(t("你的声音好了。", "Your voice is ready.")); setScreen("home"); }} />;
  }

  if (screen === "player") {
    const line = (offset: number) => items[current + offset] || "";
    const ambienceLabel = ambience === "rain" ? t("雨声，轻", "Rain, soft") : ambience === "ocean" ? t("海浪，轻", "Waves, soft") : ambience === "fire" ? t("炉火，轻", "Fireplace, soft") : ambience === "brown" ? t("低沉的棕噪音", "Low brown noise") : t("不加背景声", "No background sound");
    return (
      <section className="dream dream-player">
        <header className="dream-player-head">
          <button type="button" className="dream-back" onClick={leavePlayer} aria-label={t("返回", "Back")}><ArrowLeft size={22} /></button>
          <h1>{mode === "story" ? (story?.title || t("我的剧本", "My story")) : mode === "night" ? t("睡前潜音", "Night soundscape") : t("我的肯定语", "My affirmations")}</h1>
          <span>{voice.has && useMine ? t("用你的声音", "In your voice") : t("默认声音", "Default voice")}</span>
        </header>
        <div className="dream-stage">
          <div className={`dream-orb small${playing ? " playing" : ""}`}>
            <i aria-hidden="true" />
            <Image src={DOUGH} alt="" width={1536} height={1024} sizes="160px" priority />
          </div>
          {preparing ? (
            <p className="dream-status" role="status"><DoughHop size="sm" className="dream-status-dough"/>{t("正在准备你的声音", "Getting your voice ready")}<small>{preparing.done} / {preparing.total}</small></p>
          ) : finished ? (
            <div className="dream-lines"><span className="now">{t("今晚就到这里。晚安。", "That's enough for tonight. Good night.")}</span></div>
          ) : (
            <div className="dream-lines" aria-live="polite">
              <span className="done">{line(-1)}</span>
              <span className="now">{line(0)}</span>
              <span className="next">{line(1)}</span>
            </div>
          )}
        </div>
        <div className="dream-progress"><i style={{ width: `${total ? Math.min(100, (elapsed / total) * 100) : 0}%` }} /></div>
        <div className="dream-times"><span>{clock(elapsed)}</span><span>{clock(total)}</span></div>
        <div className="dream-controls">
          <button type="button" onClick={() => skip(-1)} aria-label={t("上一句", "Previous line")} disabled={Boolean(preparing)}><SkipBack size={26} /></button>
          <button type="button" className="dream-main" onClick={togglePause} aria-label={finished ? t("再听一遍", "Listen again") : playing ? t("暂停", "Pause") : t("播放", "Play")} disabled={Boolean(preparing)}>{playing ? <Pause size={30} weight="fill" /> : <Play size={30} weight="fill" />}</button>
          <button type="button" onClick={() => skip(1)} aria-label={t("下一句", "Next line")} disabled={Boolean(preparing)}><SkipForward size={26} /></button>
        </div>
        <button type="button" className="dream-bg-sound" onClick={cycleAmbience}>{ambienceLabel}</button>
      </section>
    );
  }
  return (
    <section className="dream dream-home">
      <header>
        <h1>{t("潜音", "Dreamscape")}</h1>
        <p>{t("今晚听自己的声音。", "Tonight, listen to your own voice.")}</p>
      </header>
      <button type="button" className="dream-orb dream-orb-button" onClick={() => void begin("night")} aria-label={t("开始睡前潜音", "Start the night soundscape")}>
        <i aria-hidden="true" />
        <Image src={DOUGH} alt="" width={1536} height={1024} sizes="240px" priority />
      </button>
      <button type="button" className="dream-start" onClick={() => void begin("night")}><Play size={20} weight="fill" />{t("开始睡前潜音", "Start the night soundscape")}</button>
      {message && <p className="dream-message" role="status">{message}</p>}
      <div className="affirm-head">
        <h2>{t("我的肯定语", "My affirmations")}</h2>
        <button type="button" className="affirm-play-all" onClick={() => void begin("affirm")} disabled={!lines.filter(Boolean).length} aria-label={t("听一遍我的肯定语", "Hear my affirmations once")}><Play size={16} weight="fill" />{t("听一遍", "Play")}</button>
      </div>
      {affirmations === null
        ? <p className="affirm-seeding" role="status"><DoughHop size="sm" /></p>
        : <AffirmationEditor lang={lang} lines={lines} onChange={changeLines} suggestions={suggestions} onAccept={acceptLine} onDismiss={skipLine} onAskIdeas={() => void askIdeas()} asking={asking} preview={preview} onPreview={(line) => void playPreview(line)} maxLines={MAX_LINES} maxLength={maxLength} />}
      <ul className="dream-list">
        <li>
          {voice.has
            ? <><span>{t("用我的声音", "Use my voice")}</span><button type="button" className={`dream-switch${useMine ? " on" : ""}`} role="switch" aria-checked={useMine} aria-label={t("用我的声音", "Use my voice")} onClick={flipUseMine}><i /></button></>
            : <button type="button" className="dream-row accent" onClick={() => setScreen("record")}><span>{t("录下我的声音", "Record my voice")}</span><small>{t("约 45 秒", "About 45 seconds")}</small></button>}
        </li>
        <li><button type="button" className="dream-row" onClick={() => void begin("story")} disabled={!story}><span>{t("我的剧本", "My story")}</span><small>{story ? t("读给我听", "Read to me") : t("还没有剧本", "No story yet")}</small></button></li>
      </ul>
      <div className="dream-links">
        {voice.has && <button type="button" className="dream-record-link" onClick={() => setScreen("record")}><Microphone size={16} />{t("重新录我的声音", "Record my voice again")}</button>}
        {voice.has && <button type="button" className="dream-record-link muted" onClick={() => void removeVoice()}>{t("删除我的声音", "Delete my voice")}</button>}
        <button type="button" className="dream-record-link muted" onClick={onOpenStudio}>{t("高级：潜音工作台", "Advanced: studio")}</button>
      </div>
    </section>
  );
}

type RecordProps = { lang: Lang; headers: Record<string, string>; onBack: () => void; onDone: () => Promise<void> };

function RecordScreen({ lang, headers, onBack, onDone }: RecordProps) {
  const zh = lang === "zh";
  const t = (a: string, b: string) => (zh ? a : b);
  const lines = SCRIPT[lang];
  const [phase, setPhase] = useState<"idle" | "recording" | "review" | "sending">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [recorded, setRecorded] = useState<{ wav: Uint8Array; seconds: number; url: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const finishRecording = async () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || "audio/webm" });
    try {
      const { wav, seconds: length } = await recordingToWav(blob);
      if (length < VOICE_LIMITS.minSampleSeconds) { setError(errorText("SAMPLE_TOO_SHORT", zh)); setPhase("idle"); setSeconds(0); return; }
      const url = URL.createObjectURL(new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }));
      setRecorded({ wav, seconds: length, url });
      setPhase("review");
    } catch {
      setError(t("这段录音读不出来，请再录一次。", "That recording couldn't be read. Please record again."));
      setPhase("idle");
    }
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => { void finishRecording(); };
      recorder.start();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => {
          if (value + 1 >= VOICE_LIMITS.maxSampleSeconds - 3 && recorder.state === "recording") recorder.stop();
          return value + 1;
        });
      }, 1000);
    } catch {
      setError(t("没有拿到麦克风。请在浏览器设置里允许使用麦克风。", "Couldn't reach the microphone. Please allow microphone access in your browser settings."));
    }
  };
  const stop = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };

  const send = async () => {
    if (!recorded) return;
    setPhase("sending");
    setError("");
    try {
      const response = await fetch("/api/voice", { method: "POST", headers, body: JSON.stringify({ consent: true, audio: toDataUri(recorded.wav) }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "VOICE_FAILED");
      URL.revokeObjectURL(recorded.url);
      await onDone();
    } catch (failure) {
      setError(errorText(failure instanceof Error ? failure.message : "", zh));
      setPhase("review");
    }
  };

  if (phase === "review" || phase === "sending") {
    return (
      <section className="dream dream-record">
        <header className="dream-player-head"><button type="button" className="dream-back" onClick={onBack} aria-label={t("返回", "Back")}><ArrowLeft size={22} /></button><h1>{t("听一下，再决定", "Listen, then decide")}</h1></header>
        <div className="dream-review">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- her own voice sample, played back to her; there is nothing to caption */}
          {recorded && <audio controls src={recorded.url} aria-label={t("你刚录的声音", "Your recording")} />}
          <p>{t(`这段录音约 ${Math.round(recorded?.seconds || 0)} 秒。`, `This recording is about ${Math.round(recorded?.seconds || 0)} seconds.`)}</p>
          <p className="dream-consent">{t("我同意将这段录音发送给语音服务商，用于生成自定义声音。我可以在声音设置中删除该声音。", "I agree to send this recording to a voice provider to create my custom voice. I can delete the voice in its settings.")}</p>
          {error && <p className="dream-message" role="alert">{error}</p>}
        </div>
        <div className="dream-recorder">
          <button type="button" className="dream-start" onClick={() => void send()} disabled={phase === "sending"}>{phase === "sending" ? <span className="dough-loading"><DoughHop size="xs"/>{t("正在生成，请稍等", "Creating your voice")}</span> : t("同意并生成我的声音", "Agree and create my voice")}</button>
          <button type="button" className="dream-record-link" onClick={() => { setRecorded(null); setPhase("idle"); setSeconds(0); }} disabled={phase === "sending"}>{t("重新读一遍", "Read it again")}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="dream dream-record">
      <header>
        <div className="dream-player-head"><button type="button" className="dream-back" onClick={onBack} aria-label={t("返回", "Back")}><ArrowLeft size={22} /></button><h1>{t("读一遍给自己", "Read it to yourself")}</h1></div>
        <p>{t("约 45 秒。找个安静的地方，用平时对自己说话的语气读，可以上下滑动看全文。", "About 45 seconds. Find a quiet place and read in the voice you use with yourself. Scroll to see all of it.")}</p>
      </header>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable text must be focusable so it can be scrolled with the keyboard */}
      <article className="dream-article" tabIndex={0} aria-label={t("要读的稿子，可以上下滑动", "The text to read, you can scroll it")}>
        {lines.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </article>
      <div className="dream-recorder">
        <button type="button" className="dream-record-button" onClick={phase === "recording" ? stop : () => void start()} aria-label={phase === "recording" ? t("停止录音", "Stop recording") : t("开始录音", "Start recording")}>{phase === "recording" ? <Stop size={28} weight="fill" /> : <Microphone size={30} weight="fill" />}</button>
        <strong>{clock(seconds)}</strong>
        {error && <p className="dream-message" role="alert">{error}</p>}
        <p>{t("声音只属于你，随时可以在这里删除。", "The voice is only yours, and you can delete it here anytime.")}</p>
      </div>
    </section>
  );
}
