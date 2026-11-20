"use client";

import { ChangeEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import DoughHop from "./DoughHop";
import { ArrowLeft, DownloadSimple, Pause, Play, Question, X } from "@phosphor-icons/react";
import { renderSubMix, type TrackEdit } from "@/lib/audio-mix";
import { readStored, writeStored } from "@/lib/safe-storage";
import { AMBIENCE_LEVEL, brownSource } from "@/lib/ambience";
import { askConfirm } from "./ConfirmHost";
import { lineAudio, loadLineVoice, type LineVoice } from "@/lib/line-voice";

/** A half-second of silence, played inside her tap so iPhone lets the voice start later. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export type PracticeCheckIn = {
  date: string;
  feeling: "settled" | "soft" | "chosen";
};

type Lang = "zh" | "en";
const SPEED_KEY = "already-sub-speed-v1";
const SPEED_MIN = 0.5;
const SPEED_MAX = 3;
type DeliveryMode = "clear" | "soft" | "subliminal";
type Ambience = "none" | "rain" | "brown" | "ocean" | "library";
type DurationMode = "timer" | "continuous";
type AudioResult = { id: string; title: string; audio: string; source: string; creator: string; license: string; licenseUrl: string; duration: number; provider: string };

type SavedSub = {
  title: string;
  affirmations: string[];
  mode: DeliveryMode;
  ambience: Ambience;
  duration: number;
  durationMode?: DurationMode;
  completionMinutes?: number;
  librarySound?: AudioResult;
};

const AUDIO_DB = "already-private-audio-v1";
const AUDIO_STORE = "tracks";

function openAudioDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(AUDIO_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeAudioTrack(key: "voice" | "music", blob: Blob, name: string) {
  const database = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(AUDIO_STORE, "readwrite");
    transaction.objectStore(AUDIO_STORE).put({ blob, name }, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readAudioTrack(key: "voice" | "music") {
  const database = await openAudioDb();
  const value = await new Promise<{ blob: Blob; name: string } | undefined>((resolve, reject) => {
    const request = database.transaction(AUDIO_STORE, "readonly").objectStore(AUDIO_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

async function deleteAudioTrack(key: "voice" | "music") {
  const database = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(AUDIO_STORE, "readwrite");
    transaction.objectStore(AUDIO_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const defaults: Record<Lang, SavedSub> = {
  zh: {
    title: "我的愿望已经实现",
    affirmations: [
      "我的愿望已经自然地成为现实。",
      "拥有它正在成为我熟悉的日常。",
      "我安心地生活在自己选择的新故事里。",
    ],
    mode: "soft",
    ambience: "none",
    duration: 5,
    durationMode: "timer",
    completionMinutes: 5,
  },
  en: {
    title: "My Desire Is Already Mine",
    affirmations: [
      "My desire has naturally become real.",
      "Having it is becoming familiar in my everyday life.",
      "I feel at ease living in the new story I chose.",
    ],
    mode: "soft",
    ambience: "none",
    duration: 5,
    durationMode: "timer",
    completionMinutes: 5,
  },
};

function timeLabel(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function replaceLegacyRomanticTemplate(profile: SavedSub) {
  const legacyTemplates: Record<Lang, Pick<SavedSub, "title" | "affirmations">> = {
    zh: { title: "我被坚定选择", affirmations: ["我自然地被爱、被选择、被珍惜。", "我们的关系稳定、浪漫，并且充满宠爱。", "丰盛和爱已经是我最熟悉的日常。"] },
    en: { title: "I Am Fully Chosen", affirmations: ["I am naturally loved, chosen, and cherished.", "Our relationship is secure, romantic, and deeply devoted.", "Love and abundance are my most familiar everyday experience."] },
  };
  const legacyLanguage = (Object.keys(legacyTemplates) as Lang[]).find((candidate) => {
    const legacy = legacyTemplates[candidate];
    return profile.title === legacy.title
      && profile.affirmations.length === legacy.affirmations.length
      && profile.affirmations.every((line, index) => line === legacy.affirmations[index]);
  });
  return legacyLanguage
    ? { ...profile, title: defaults[legacyLanguage].title, affirmations: [...defaults[legacyLanguage].affirmations] }
    : profile;
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function practiceStreak(checkIns: PracticeCheckIn[]) {
  const days = new Set(checkIns.map((item) => item.date));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const blankEdit: TrackEdit = { fadeIn: 1, fadeOut: 2 };

function WaveformStrip({ seed, active }: { seed: string; active: boolean }) {
  const bars = useMemo(() => Array.from({ length: 52 }, (_, index) => {
    const code = seed.charCodeAt(index % Math.max(1, seed.length)) || 17;
    return 18 + ((code * (index + 7)) % 68);
  }), [seed]);
  return <div className={`track-waveform ${active ? "active" : ""}`} aria-hidden="true">{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</div>;
}

type Props = {
  lang: Lang;
  desire: string;
  focusText?: string;
  /** Whether focusText is an accepted scene or a new thought brought from Reframe. */
  focusKind?: "scene" | "thought";
  checkIns: PracticeCheckIn[];
  onCheckIn: (feeling: PracticeCheckIn["feeling"]) => void;
  /** Back to the Dreamscape home; shown on the title's left edge. */
  onBack?: () => void;
  /** Signs the cloud-voice requests, the same voice 潜音 uses. */
  sessionId: string;
};

export default function SubliminalStudio({ lang, desire, focusText, focusKind = "scene", checkIns, onCheckIn, onBack, sessionId }: Props) {
  const copy = lang === "zh" ? {
    eyebrow: "潜音 · 私人声音练习",
    heading: "听见你已经拥有的生活",
    intro: "把完成态写进自己的声音空间。肯定语、录音和练习记录默认留在这台设备上。",
    tutorial: "制作教程",
    current: "我的愿境音声",
    done: "完成今日练习",
    pause: "暂停",
    play: "开始练习",
    streak: "连续练习",
    days: "天",
    thisWeek: "本周打卡",
    title: "练习名称",
    affirmations: "我的肯定语",
    add: "＋ 添加一句",
    save: "保存声音练习",
    saved: "已经保存到本机",
    voice: "声音",
    record: "录制自己的声音",
    stopRecord: "停止录音",
    recorded: "已录制自己的声音",
    systemVoice: "未录音时使用本机语音朗读",
    mode: "播放层次",
    ambience: "背景声音",
    duration: "练习时长",
    timer: "定时播放",
    continuous: "持续播放",
    hours: "小时",
    minutes: "分钟",
    completionGoal: "今日完成目标",
    completionHint: "持续播放达到这个时长后自动完成打卡，声音仍可继续。",
    backgroundPlay: "离开本页后继续播放",
    backgroundPlayHint: "网页版可在同一浏览器中继续；锁屏播放将在原生 App 中启用。",
    deliveryClear: "清晰",
    deliveryClearCopy: "人声清楚可辨，适合白天主动练习",
    deliverySoft: "轻语",
    deliverySoftCopy: "人声柔和、留有停顿，适合放松与睡前",
    deliveryMasked: "潜声",
    deliveryMaskedCopy: "低音量人声藏在环境声下，适合长时间循环",
    soundLibrary: "环境声素材库",
    soundSearch: "搜索雨声、海浪、壁炉、森林……",
    search: "搜索",
    searching: "正在寻找",
    useSound: "加入潜音",
    selectedSound: "正在使用",
    previewSound: "试听",
    stopPreview: "停止试听",
    noSounds: "暂时没有找到，换一个更简单的关键词试试。",
    privacy: "隐私与聆听",
    privacyCopy: "此版本在设备上完成播放与混音，不把录音发送给 AI。请保持舒适音量；潜意识音轨是个性化想象与肯定语练习，不提供医疗服务或特定结果保证。",
    checkTitle: "今天的练习已经完成",
    checkCopy: "哪一种感受最接近此刻？",
    feelings: [["settled", "安定下来了"], ["soft", "柔软了一点"], ["chosen", "愿望更真实了"]] as const,
    tutorialTitle: "如何制作属于你的声音练习",
    tutorialSteps: ["写下你愿意每天听见的完成态肯定语。", "选择清晰、轻声或覆盖式播放，并挑选背景声音。", "可以录下自己的声音；没有录音时使用设备自带语音。"],
    close: "明白了",
    recordingError: "无法使用麦克风，请在浏览器设置中允许录音。",
    voiceError: "声音暂时没有出来，请稍后再试。",
    playbackError: "这段录音的格式无法在当前浏览器播放，请重新录制，或上传 MP3、M4A、WAV 音频。",
    mixer: "我的多轨制作台",
    mixerCopy: "像轻量剪辑软件一样组合人声、音乐和环境声。所有音频只在当前设备处理。",
    voiceTrack: "肯定语 · 人声轨",
    voiceTrackCopy: "录制自己的声音，或上传已有的肯定语音频",
    musicTrack: "氛围 · 音乐轨",
    musicTrackCopy: "上传你有权使用的音乐、白噪音或环境音",
    uploadAudio: "上传音频",
    replaceAudio: "更换音频",
    removeAudio: "移除",
    audioReady: "音频已加入，可以点击上方开始练习试听。",
    audioFormats: "支持 MP3、M4A、WAV、AAC、OGG、WebM、FLAC，单个文件不超过 100 MB。",
    audioTooLarge: "音频文件超过 100 MB，请压缩后重新上传。",
    volume: "音量",
    speed: "语速 / 速度",
    loop: "循环铺满练习时长",
    rights: "我确认上传的音频由我创作、已经获得授权，或仅用于法律允许的私人用途。",
    rightsNeeded: "请先确认你拥有音频使用权，或仅将它用于法律允许的私人用途。",
    sessionOnly: "上传和录制的音频会加密式地留在这个浏览器的本机存储中，不上传服务器；清除网站数据会同时删除它们。",
    timeline: "时间线",
    trim: "声音渐变",
    fadeIn: "淡入",
    fadeOut: "淡出",
    seconds: "秒",
    exportMix: "导出专属 Sub",
    exporting: "正在混合音轨",
    exportReady: "已导出 WAV，可在手机中反复播放。",
    exportNeedsVoice: "请先录制或上传人声音轨。浏览器自带朗读无法被安全写入导出文件。",
    exportLimit: "网页端一次最多导出 10 分钟；更长练习可循环播放这个文件。",
    openStudio: "打开声音工作台",
    closeStudio: "关闭声音工作台",
    tabContent: "内容",
    tabSound: "声音",
    tabPlayback: "播放",
    tabExport: "导出",
    saveBarHint: "改动先保存，才会用在下一次练习里",
  } : {
    eyebrow: "DREAMSCAPE · PRIVATE AUDIO PRACTICE",
    heading: "Hear the life you already have",
    intro: "Turn your fulfilled state into a private sound space. Affirmations, recordings, and practice history stay on this device by default.",
    tutorial: "How it works",
    current: "MY DESIRE SOUNDSCAPE",
    done: "Complete today’s practice",
    pause: "Pause",
    play: "Begin practice",
    streak: "Practice streak",
    days: "days",
    thisWeek: "THIS WEEK",
    title: "Sub title",
    affirmations: "My affirmations",
    add: "+ Add a line",
    save: "Save my Sub",
    saved: "Saved on this device",
    voice: "Voice",
    record: "Record my own voice",
    stopRecord: "Stop recording",
    recorded: "Your voice is ready",
    systemVoice: "Uses your device voice when no recording is added",
    mode: "Delivery",
    ambience: "Soundscape",
    duration: "Practice length",
    timer: "Timer",
    continuous: "Continuous",
    hours: "hr",
    minutes: "min",
    completionGoal: "Daily completion goal",
    completionHint: "In continuous mode, check-in completes at this point while audio can keep playing.",
    backgroundPlay: "Keep playing away from this page",
    backgroundPlayHint: "Web playback continues in the same browser. Lock-screen playback will be enabled in the native app.",
    deliveryClear: "Clear",
    deliveryClearCopy: "Audible voice for active daytime practice",
    deliverySoft: "Whisper",
    deliverySoftCopy: "Gentler voice and pauses for winding down",
    deliveryMasked: "Masked",
    deliveryMaskedCopy: "Low voice beneath ambience for long loops",
    soundLibrary: "Ambient sound library",
    soundSearch: "Search rain, ocean, fireplace, forest...",
    search: "Search",
    searching: "Searching",
    useSound: "Add to mix",
    selectedSound: "In your mix",
    previewSound: "Preview",
    stopPreview: "Stop preview",
    noSounds: "No sounds found. Try a simpler search.",
    privacy: "PRIVACY & LISTENING",
    privacyCopy: "This version mixes and plays on your device and does not send your recording to AI. Keep the volume comfortable. Sub Studio is a personalized imagination and affirmation practice, not medical care or a guarantee of a particular result.",
    checkTitle: "Today’s practice is complete",
    checkCopy: "What feels closest right now?",
    feelings: [["settled", "I feel settled"], ["soft", "I feel softer"], ["chosen", "My desire feels more real"]] as const,
    tutorialTitle: "How to make your own Sub",
    tutorialSteps: ["Write fulfilled-state affirmations you want to hear every day.", "Choose clear, soft, or masked delivery and a soundscape.", "Record your own voice, or let your device read the lines."],
    close: "Got it",
    recordingError: "The microphone is unavailable. Allow recording in your browser settings.",
    voiceError: "The voice didn't come through. Please try again shortly.",
    playbackError: "This recording format cannot play in your browser. Record again or upload an MP3, M4A, or WAV file.",
    mixer: "My Multitrack Studio",
    mixerCopy: "Combine voice, music, and ambience in a lightweight mobile editor. Audio is processed on this device.",
    voiceTrack: "Affirmations · Voice Track",
    voiceTrackCopy: "Record your own voice or upload an affirmation track",
    musicTrack: "Atmosphere · Music Track",
    musicTrackCopy: "Add music, white noise, or ambience you are allowed to use",
    uploadAudio: "Upload audio",
    replaceAudio: "Replace audio",
    removeAudio: "Remove",
    audioReady: "Audio added. Use the player above to preview your practice.",
    audioFormats: "MP3, M4A, WAV, AAC, OGG, WebM, and FLAC are supported up to 100 MB.",
    audioTooLarge: "This audio file is larger than 100 MB. Compress it and try again.",
    volume: "Volume",
    speed: "Voice / playback speed",
    loop: "Loop to fill the practice",
    rights: "I confirm that I created this audio, have permission to use it, or will use it only as privately permitted by law.",
    rightsNeeded: "Confirm that you have the right to use this audio or will use it only as privately permitted by law.",
    sessionOnly: "Recorded and uploaded audio stays in this browser's on-device storage and is never uploaded. Clearing site data also removes it.",
    timeline: "TIMELINE",
    trim: "Sound fades",
    fadeIn: "Fade in",
    fadeOut: "Fade out",
    seconds: "sec",
    exportMix: "Export my Sub",
    exporting: "Rendering your tracks",
    exportReady: "WAV exported and ready to replay on your phone.",
    exportNeedsVoice: "Record or upload a voice track first. Browser text-to-speech cannot be safely captured in an export.",
    exportLimit: "Web exports are capped at 10 minutes. Loop the finished file for longer practices.",
    openStudio: "Open sound studio",
    closeStudio: "Close sound studio",
    tabContent: "Content",
    tabSound: "Sound",
    tabPlayback: "Playback",
    tabExport: "Export",
    saveBarHint: "Save to use your changes in the next practice",
  };

  const [profile, setProfile] = useState<SavedSub>(defaults[lang]);
  const [editing, setEditing] = useState(false);
  const [studioTab, setStudioTab] = useState<"content" | "sound" | "playback" | "export">("content");
  /** The summary rows open the studio on the tab they describe (by click, Enter or Space). */
  const openStudioTab = (tab: "content" | "sound" | "playback" | "export") => { setStudioTab(tab); setEditing(true); };
  const [savedPulse, setSavedPulse] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(defaults[lang].duration * 60);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicName, setMusicName] = useState("");
  const [voiceVolume, setVoiceVolume] = useState(25);
  const [musicVolume, setMusicVolume] = useState(75);
  const [ambienceVolume, setAmbienceVolume] = useState(28);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loopAudio, setLoopAudio] = useState(true);
  const [audioError, setAudioError] = useState("");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(defaults[lang].duration);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [spokenLine, setSpokenLine] = useState("");
  const [backgroundPlay, setBackgroundPlay] = useState(true);
  const [soundQuery, setSoundQuery] = useState(lang === "zh" ? "下雨" : "rain");
  const [soundResults, setSoundResults] = useState<AudioResult[]>([]);
  const [soundSearching, setSoundSearching] = useState(false);
  const [soundSearched, setSoundSearched] = useState(false);
  const [librarySound, setLibrarySound] = useState<AudioResult | null>(null);
  const [previewingSoundId, setPreviewingSoundId] = useState("");
  const [voiceEdit, setVoiceEdit] = useState<TrackEdit>({ ...blankEdit });
  const [musicEdit, setMusicEdit] = useState<TrackEdit>({ ...blankEdit, fadeIn: 3, fadeOut: 3 });
  const [ambienceEdit, setAmbienceEdit] = useState<TrackEdit>({ ...blankEdit, fadeIn: 4, fadeOut: 4 });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceFileRef = useRef<HTMLInputElement | null>(null);
  const musicFileRef = useRef<HTMLInputElement | null>(null);
  const consoleMusicRef = useRef<HTMLInputElement | null>(null);
  const soundSearchRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambienceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const lineAudioRef = useRef<HTMLAudioElement | null>(null);
  const lineVoiceRef = useRef<LineVoice | null>(null);
  const speechTokenRef = useRef(0);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const speechIndexRef = useRef(0);
  const liveRef = useRef({ speed: 1, voiceVolume: 25 });
  useEffect(() => { liveRef.current = { speed: playbackSpeed, voiceVolume }; }, [playbackSpeed, voiceVolume]);
  const brownGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    try {
      const saved = readStored("already-subliminal-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as SavedSub;
        if (parsed.title && Array.isArray(parsed.affirmations)) {
          const legacy = replaceLegacyRomanticTemplate(parsed);
          // rain and ocean used to be switched on for everyone without asking; now nothing plays until she picks a sound
          const restored = legacy.ambience === "rain" || legacy.ambience === "ocean" ? { ...legacy, ambience: "none" as const } : legacy;
          if (restored !== parsed) writeStored("already-subliminal-v1", JSON.stringify(restored));
          // Restore the private, device-local practice after the component mounts.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile(restored);
          setLibrarySound(restored.librarySound || null);
          setSecondsLeft(restored.duration * 60);
          setDurationHours(Math.floor(restored.duration / 60));
          setDurationMinutes(restored.duration % 60);
        }
      }
    } catch { /* start with the gentle default */ }
    Promise.all([readAudioTrack("voice"), readAudioTrack("music")]).then(([voice, music]) => {
      if (voice?.blob) {
        setVoiceUrl(URL.createObjectURL(voice.blob));
        setVoiceName(voice.name);
      }
      if (music?.blob) {
        setMusicUrl(URL.createObjectURL(music.blob));
        setMusicName(music.name);
      }
    }).catch(() => { /* IndexedDB may be unavailable in strict private browsing */ });
  }, []);

  useEffect(() => () => {
    speechTokenRef.current += 1; lineAudioRef.current?.pause();
    recordedAudioRef.current?.pause();
    musicAudioRef.current?.pause();
    libraryAudioRef.current?.pause();
    previewAudioRef.current?.pause();
    ambienceSourceRef.current?.stop();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const saved = Number(readStored(SPEED_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore her last speed once
    if (saved >= SPEED_MIN && saved <= SPEED_MAX) setPlaybackSpeed(saved);
  }, []);
  useEffect(() => {
    const modeGain = profile.mode === "clear" ? 1 : profile.mode === "soft" ? 0.58 : 0.16;
    if (recordedAudioRef.current) { recordedAudioRef.current.playbackRate = playbackSpeed; recordedAudioRef.current.volume = Math.min(1, (voiceVolume / 100) * modeGain); }
    if (musicAudioRef.current) musicAudioRef.current.volume = musicVolume / 100;
    if (libraryAudioRef.current) libraryAudioRef.current.volume = ambienceVolume / 100;
    if (brownGainRef.current) brownGainRef.current.gain.value = AMBIENCE_LEVEL.brown * (ambienceVolume / 100);
  }, [playbackSpeed, voiceVolume, musicVolume, ambienceVolume, profile.mode]);
  const changeSpeed = (value: number) => {
    const next = Math.round(Math.max(SPEED_MIN, Math.min(SPEED_MAX, value)) * 10) / 10;
    setPlaybackSpeed(next);
    writeStored(SPEED_KEY, String(next));
  };

  useEffect(() => () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  }, [voiceUrl]);

  useEffect(() => () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
  }, [musicUrl]);


  const saveProfile = () => {
    const customDuration = Math.max(1, Math.min(720, durationHours * 60 + durationMinutes));
    const cleaned = { ...profile, duration: customDuration, title: profile.title.trim() || defaults[lang].title, affirmations: profile.affirmations.map((item) => item.trim()).filter(Boolean) };
    setProfile(cleaned);
    writeStored("already-subliminal-v1", JSON.stringify(cleaned));
    setSecondsLeft(cleaned.duration * 60);
    setEditing(false);
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1600);
  };

  const startAmbience = async () => {
    const selectedSound = librarySound || profile.librarySound;
    if (selectedSound) {
      const audio = new Audio(selectedSound.audio);
      audio.loop = true;
      audio.volume = ambienceVolume / 100;
      libraryAudioRef.current = audio;
      await audio.play();
      return;
    }
    if (profile.ambience !== "brown") return;
    const context = new AudioContext();
    await context.resume();
    const { source, output } = brownSource(context);
    const gain = context.createGain();
    gain.gain.value = AMBIENCE_LEVEL.brown * (ambienceVolume / 100);
    output.connect(gain).connect(context.destination);
    brownGainRef.current = gain;
    source.start();
    audioContextRef.current = context;
    ambienceSourceRef.current = source;
  };

  const previewSound = async (sound: AudioResult) => {
    if (previewingSoundId === sound.id) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewingSoundId("");
      return;
    }
    previewAudioRef.current?.pause();
    const preview = new Audio(sound.audio);
    preview.volume = Math.max(0.2, Math.min(1, ambienceVolume / 100));
    preview.onended = () => setPreviewingSoundId("");
    preview.onerror = () => { setPreviewingSoundId(""); setAudioError(copy.playbackError); };
    previewAudioRef.current = preview;
    setPreviewingSoundId(sound.id);
    try { await preview.play(); }
    catch { setPreviewingSoundId(""); setAudioError(copy.playbackError); }
  };

  const chooseLibrarySound = async (sound: AudioResult) => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingSoundId("");
    setLibrarySound(sound);
    setProfile((current) => ({ ...current, ambience: "library", librarySound: sound }));
    if (!playingRef.current) return;
    libraryAudioRef.current?.pause();
    libraryAudioRef.current = null;
    try { ambienceSourceRef.current?.stop(); } catch { /* already stopped */ }
    ambienceSourceRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    const liveSound = new Audio(sound.audio);
    liveSound.loop = true;
    liveSound.volume = ambienceVolume / 100;
    libraryAudioRef.current = liveSound;
    try { await liveSound.play(); }
    catch { setAudioError(copy.playbackError); }
  };

  // the same cloud voice as 潜音 (her clone or reading when she chose one), never the browser's own speech engine
  const speakNext = async () => {
    if (!playingRef.current || !profile.affirmations.length || !lineVoiceRef.current) return;
    const token = speechTokenRef.current;
    const text = profile.affirmations[speechIndexRef.current % profile.affirmations.length];
    setSpokenLine(text);
    const player = lineAudioRef.current;
    if (!player) return;
    let url = "";
    try {
      url = URL.createObjectURL(await lineAudio(text, lineVoiceRef.current));
    } catch {
      if (token === speechTokenRef.current) { setAudioError(copy.voiceError); stopPractice(false); }
      return;
    }
    if (token !== speechTokenRef.current || !playingRef.current) { URL.revokeObjectURL(url); return; }
    const modeGain = profile.mode === "clear" ? 1 : profile.mode === "soft" ? 0.58 : 0.16;
    player.volume = Math.min(1, (liveRef.current.voiceVolume / 100) * modeGain);
    player.playbackRate = liveRef.current.speed;
    player.onended = () => {
      URL.revokeObjectURL(url);
      speechIndexRef.current += 1;
      if (playingRef.current && token === speechTokenRef.current) window.setTimeout(() => void speakNext(), profile.mode === "clear" ? 650 : profile.mode === "soft" ? 1150 : 120);
    };
    player.src = url;
    try { await player.play(); } catch { URL.revokeObjectURL(url); }
  };


  const stopPractice = (completed = false) => {
    playingRef.current = false;
    setIsPlaying(false);
    speechTokenRef.current += 1; lineAudioRef.current?.pause();
    recordedAudioRef.current?.pause();
    recordedAudioRef.current = null;
    musicAudioRef.current?.pause();
    musicAudioRef.current = null;
    libraryAudioRef.current?.pause();
    libraryAudioRef.current = null;
    try { ambienceSourceRef.current?.stop(); } catch { /* already stopped */ }
    ambienceSourceRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    if (completed && !checkIns.some((item) => item.date === todayKey())) {
      onCheckIn("chosen");
      setCheckInOpen(true);
    }
  };

  const startPractice = async () => {
    if (isPlaying) { stopPractice(false); return; }
    if (!profile.affirmations.length) { setEditing(true); return; }
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingSoundId("");
    // unlock the line player inside her tap (iPhone refuses audio that starts after a wait)
    const linePlayer = lineAudioRef.current || new Audio();
    lineAudioRef.current = linePlayer;
    linePlayer.src = SILENCE; // eslint-disable-line react-hooks/immutability -- the shared player is unlocked inside her tap, as iPhone requires
    void linePlayer.play().catch(() => undefined);
    const remaining = secondsLeft <= 0 ? profile.duration * 60 : secondsLeft;
    setSecondsLeft(remaining);
    playingRef.current = true;
    setIsPlaying(true);
    setAudioError("");
    try {
      await startAmbience();
    } catch {
      // AudioContext blocked, or a library track failed to load / autoplay.
      setAudioError(copy.playbackError);
      stopPractice(false);
      return;
    }
    if (voiceUrl) {
      const audio = new Audio(voiceUrl);
      audio.loop = loopAudio;
      const modeGain = profile.mode === "clear" ? 1 : profile.mode === "soft" ? 0.58 : 0.16;
      audio.volume = Math.min(1, (voiceVolume / 100) * modeGain);
      audio.playbackRate = playbackSpeed;
      recordedAudioRef.current = audio;
      try { await audio.play(); } catch {
        setAudioError(copy.playbackError);
        stopPractice(false);
        return;
      }
    } else {
      speechIndexRef.current = 0;
      speechTokenRef.current += 1;
      lineVoiceRef.current = lineVoiceRef.current || await loadLineVoice({ "x-already-session-id": sessionId, "Content-Type": "application/json" });
      void speakNext();
    }
    if (musicUrl) {
      const music = new Audio(musicUrl);
      music.loop = loopAudio;
      music.volume = musicVolume / 100;
      musicAudioRef.current = music;
      try { await music.play(); } catch {
        setAudioError(copy.playbackError);
        stopPractice(false);
      }
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    let completionTriggered = checkIns.some((item) => item.date === todayKey());
    const completePractice = () => {
      playingRef.current = false;
      setIsPlaying(false);
      speechTokenRef.current += 1; lineAudioRef.current?.pause();
      recordedAudioRef.current?.pause();
      recordedAudioRef.current = null;
      musicAudioRef.current?.pause();
      musicAudioRef.current = null;
      libraryAudioRef.current?.pause();
      libraryAudioRef.current = null;
      try { ambienceSourceRef.current?.stop(); } catch { /* already stopped */ }
      ambienceSourceRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      if (!completionTriggered) {
        completionTriggered = true;
        onCheckIn("chosen");
        setCheckInOpen(true);
      }
    };
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => {
        const next = value + 1;
        const completionSeconds = (profile.completionMinutes || 5) * 60;
        if ((profile.durationMode || "timer") === "continuous" && next >= completionSeconds && !completionTriggered) {
          completionTriggered = true;
          window.setTimeout(() => { onCheckIn("chosen"); setCheckInOpen(true); }, 0);
        }
        return next;
      });
      setSecondsLeft((current) => {
        const continuous = (profile.durationMode || "timer") === "continuous";
        if (continuous) return current;
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(completePractice, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, profile.durationMode, profile.completionMinutes, checkIns, onCheckIn]);

  const searchSounds = async () => {
    if (!soundQuery.trim()) return;
    setSoundSearching(true);
    setAudioError("");
    setSoundSearched(false);
    setSoundResults([]);
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingSoundId("");
    try {
      const response = await fetch(`/api/audio?q=${encodeURIComponent(soundQuery.trim())}&locale=${lang}&v=environment-only-v3&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { results?: AudioResult[] };
      setSoundResults(data.results || []);
    } catch { setSoundResults([]); }
    finally { setSoundSearching(false); setSoundSearched(true); }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (!chunks.length) { setAudioError(copy.recordingError); return; }
        const blobType = chunks[0]?.type || recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        const nextUrl = URL.createObjectURL(blob);
        setVoiceUrl(nextUrl);
        setVoiceName(lang === "zh" ? "我的录音" : "My recording");
        void storeAudioTrack("voice", blob, lang === "zh" ? "我的录音" : "My recording");
        setAudioError("");
      };
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      recorder.start();
      setRecording(true);
    } catch { window.alert(copy.recordingError); }
  };

  const uploadTrack = (kind: "voice" | "music") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { setAudioError(copy.audioTooLarge); return; }
    if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|mp4|wav|aac|aif|aiff|caf|ogg|oga|webm|flac)$/i.test(file.name)) { setAudioError(copy.playbackError); return; }
    const url = URL.createObjectURL(file);
    if (kind === "voice") {
      setVoiceUrl(url); setVoiceName(file.name);
    } else {
      setMusicUrl(url); setMusicName(file.name);
    }
    void storeAudioTrack(kind, file, file.name);
    setAudioError("");
  };

  const removeTrack = async (kind: "voice" | "music") => {
    if (!(await askConfirm({ title: lang === "zh" ? (kind === "voice" ? "删除这段人声音轨？" : "删除这段音乐音轨？") : (kind === "voice" ? "Delete the voice track?" : "Delete the music track?"), body: lang === "zh" ? "音频只存在这台设备上，删除后需要重新上传。" : "The audio lives only on this device; you would need to upload it again.", confirmLabel: lang === "zh" ? "删除" : "Delete", cancelLabel: lang === "zh" ? "取消" : "Cancel" }))) return;
    if (kind === "voice") {
      recordedAudioRef.current?.pause();
      setVoiceUrl(""); setVoiceName("");
    } else {
      musicAudioRef.current?.pause();
      setMusicUrl(""); setMusicName("");
    }
    void deleteAudioTrack(kind);
  };

  const editControl = (edit: TrackEdit, setEdit: (value: TrackEdit) => void) => <div className="track-fades">{([
    ["fadeIn", copy.fadeIn], ["fadeOut", copy.fadeOut],
  ] as const).map(([key, label]) => <label className="fade-control" key={key}><span>{label}</span><input aria-label={`${label}（${copy.seconds}）`} type="number" inputMode="decimal" min="0" max="60" step="0.5" value={edit[key]} onChange={(event) => setEdit({ ...edit, [key]: Math.max(0, Math.min(60, Number(event.target.value) || 0)) })}/><b>{copy.seconds}</b></label>)}</div>;

  const exportMix = async () => {
    if (!voiceUrl) { setAudioError(copy.exportNeedsVoice); return; }
    if (!rightsConfirmed) { setAudioError(copy.rightsNeeded); return; }
    setExporting(true); setAudioError(""); setExportMessage("");
    try {
      const modeGain = profile.mode === "clear" ? 1 : profile.mode === "soft" ? 0.58 : 0.16;
      const blob = await renderSubMix({
        durationSeconds: Math.min(profile.duration * 60, 600),
        voice: { url: voiceUrl, volume: (voiceVolume / 100) * modeGain, rate: playbackSpeed, loop: loopAudio, edit: voiceEdit },
        music: musicUrl ? { url: musicUrl, volume: musicVolume / 100, loop: loopAudio, edit: musicEdit } : undefined,
        ambience: librarySound ? { url: librarySound.audio, volume: ambienceVolume / 100, loop: true, edit: ambienceEdit } : undefined,
        generatedAmbience: !librarySound && profile.ambience === "brown" ? "brown" : undefined,
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${profile.title.trim().replace(/[^\p{L}\p{N}]+/gu, "-") || "alreadough-sub"}.wav`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      setExportMessage(copy.exportReady);
    } catch { setAudioError(copy.playbackError); }
    finally { setExporting(false); }
  };

  const modeName = profile.mode === "clear" ? copy.deliveryClear : profile.mode === "soft" ? copy.deliverySoft : copy.deliveryMasked;
  const ambienceName = librarySound?.title || (lang === "zh"
    ? ({ none: "不加环境声", rain: "雨声", ocean: "海浪", brown: "棕噪音", library: "不加环境声" } as const)[profile.ambience]
    : ({ none: "No ambience", rain: "Rain", ocean: "Waves", brown: "Brown noise", library: "No ambience" } as const)[profile.ambience]);
  const soundCard = (sound: AudioResult) => <article className={librarySound?.id === sound.id ? "selected" : ""} key={sound.id}><div className="sound-card-main"><button className="sound-preview" type="button" aria-label={`${previewingSoundId === sound.id ? copy.stopPreview : copy.previewSound}: ${sound.title}`} onClick={() => void previewSound(sound)}>{previewingSoundId === sound.id ? <Pause weight="fill"/> : <Play weight="fill"/>}</button><div className="sound-card-copy"><strong title={sound.title}>{sound.title}</strong><small>{sound.creator} · {sound.license}</small></div></div><button className="sound-choose" type="button" onClick={() => void chooseLibrarySound(sound)}>{librarySound?.id === sound.id ? `✓ ${copy.selectedSound}` : copy.useSound}</button></article>;
  // open the studio on the ambience search and put her cursor in it
  const openAmbienceSearch = () => {
    setStudioTab("sound");
    setEditing(true);
    window.setTimeout(() => {
      soundSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      soundSearchRef.current?.focus({ preventScroll: true });
    }, 80);
  };
  const continuousMode = (profile.durationMode || "timer") === "continuous";
  const totalSeconds = Math.max(1, profile.duration * 60);
  const dialProgress = continuousMode ? Math.min(100, (elapsedSeconds / Math.max(60, (profile.completionMinutes || 5) * 60)) * 100) : Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100);
  const nowLine = voiceUrl ? voiceName : spokenLine;
  const clearAmbience = () => {
    libraryAudioRef.current?.pause();
    libraryAudioRef.current = null;
    setLibrarySound(null);
    setProfile((current) => ({ ...current, ambience: "none", librarySound: undefined }));
  };
  return <section className="full-view subliminal-view">
    <div className="studio-topbar">
      {onBack ? <button type="button" className="studio-text-button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>{lang === "zh" ? "潜音" : "Dreamscape"}</button> : <span/>}
      <button type="button" className="studio-text-button" onClick={() => setTutorialOpen(true)}><Question size={17} aria-hidden="true"/>{copy.tutorial}</button>
    </div>
    <div className="studio-heading">
      <div className="view-heading"><h1>{copy.heading}</h1></div>
    </div>

    {focusText && <div className="dreamscape-focus"><span>{focusKind === "thought" ? (lang === "zh" ? "从转念带来的新念头" : "New thought from Reframe") : (lang === "zh" ? "你带过来的一段话" : "What you brought here")}</span><p>{focusText}</p></div>}

    <div className="dreamscape-workspace">
      <div className={`sub-player-card${isPlaying ? " is-playing" : ""}`}>
        <section className="sub-console-now">
          {isPlaying
            ? <p className={`sub-now-line${nowLine ? " live" : ""}`} aria-live="polite">{nowLine}</p>
            : <div className="sub-quotes">{(lang === "zh" ? [
                ["假定愿望已经实现，活在那份感受里。", "内维尔·戈达德"],
                ["潜意识不和你争辩，它接受你意识所认定的一切。", "约瑟夫·墨菲《潜意识的力量》"],
              ] : [
                ["Assume the feeling of your wish fulfilled.", "Neville Goddard"],
                ["Your subconscious mind does not argue with you. It accepts what your conscious mind decrees.", "Joseph Murphy, The Power of Your Subconscious Mind"],
              ]).map(([quote, by]) => <figure key={by}><blockquote>{quote}</blockquote><figcaption>{by}</figcaption></figure>)}</div>}
          <div className="sub-transport">
            <button type="button" className="sub-play-button" onClick={startPractice} aria-label={isPlaying ? copy.pause : copy.play}>{isPlaying ? <Pause size={26} weight="fill"/> : <Play size={26} weight="fill"/>}</button>
            <div className="sub-progress"><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dialProgress)} aria-label={lang === "zh" ? "练习进度" : "Practice progress"}><i style={{ width: `${dialProgress}%` }}/></div><span>{continuousMode ? timeLabel(elapsedSeconds) : `${timeLabel(totalSeconds - secondsLeft)} / ${timeLabel(totalSeconds)}`}</span></div>
          </div>
        </section>
        <section className="sub-console-mix" aria-label={lang === "zh" ? "边听边调" : "Adjust while listening"}>
          <label className="sub-fader"><span>{lang === "zh" ? "倍速" : "Speed"}</span><input type="range" min={SPEED_MIN} max={SPEED_MAX} step="0.1" value={playbackSpeed} onChange={(event) => changeSpeed(Number(event.target.value))} style={{ "--fill": `${((playbackSpeed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%` } as CSSProperties}/><b>{playbackSpeed.toFixed(1)}×</b></label>
          <div className="sub-speed-presets" role="group" aria-label={lang === "zh" ? "常用倍速" : "Common speeds"}>{[0.5, 1, 1.5, 2, 3].map((value) => <button type="button" key={value} className={playbackSpeed === value ? "on" : ""} onClick={() => changeSpeed(value)}>{value}×</button>)}</div>
          {([
            ["voice", lang === "zh" ? "人声" : "Voice", voiceVolume, setVoiceVolume, true],
            ["music", lang === "zh" ? "音乐" : "Music", musicVolume, setMusicVolume, Boolean(musicUrl)],
            ["ambience", lang === "zh" ? "背景" : "Ambience", ambienceVolume, setAmbienceVolume, Boolean(librarySound) || profile.ambience === "brown"],
          ] as const).map(([key, label, value, setValue, ready]) => ready
            ? <label className="sub-fader" key={key}><span>{label}</span><input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} style={{ "--fill": `${value}%` } as CSSProperties}/><b>{value}</b></label>
            : <div className="sub-fader empty" key={key}><span>{label}</span><button type="button" onClick={() => key === "music" ? consoleMusicRef.current?.click() : openAmbienceSearch()}>{key === "music" ? (lang === "zh" ? "加一段音乐" : "Add music") : (lang === "zh" ? "加背景声音" : "Add a sound")}</button></div>)}
          <input ref={consoleMusicRef} className="audio-file-input" type="file" hidden accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.webm,.flac" onChange={uploadTrack("music")}/>
        </section>
      </div>
      <aside className="session-summary">
        <h3>{lang === "zh" ? "今天怎么听" : "How you are listening"}</h3>
        <dl><div role="button" tabIndex={0} onClick={() => openStudioTab("sound")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStudioTab("sound"); } }}><dt>{copy.mode}</dt><dd>{modeName}</dd></div><div role="button" tabIndex={0} onClick={() => openStudioTab("playback")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStudioTab("playback"); } }}><dt>{copy.duration}</dt><dd>{(profile.durationMode || "timer") === "continuous" ? copy.continuous : lang === "zh" ? `${profile.duration} 分钟` : `${profile.duration} min`}</dd></div><div role="button" tabIndex={0} onClick={() => openStudioTab("sound")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStudioTab("sound"); } }}><dt>{copy.ambience}</dt><dd>{ambienceName}</dd></div></dl>
        <button className={`outline-button studio-toggle ${editing ? "is-open" : ""}`} aria-expanded={editing} onClick={() => setEditing((current) => !current)}>{editing && <X size={16} weight="bold"/>}{editing ? copy.closeStudio : copy.openStudio}</button>
      </aside>
    </div>

    {editing && <div className="sub-editor studio-panel">
      <div className="studio-tabs" role="tablist" aria-label={copy.openStudio}>{([["content", copy.tabContent], ["sound", copy.tabSound], ["playback", copy.tabPlayback], ["export", copy.tabExport]] as const).map(([id, label]) => <button type="button" role="tab" aria-selected={studioTab === id} className={studioTab === id ? "active" : ""} key={id} onClick={() => setStudioTab(id)}>{label}</button>)}</div>
      {studioTab === "content" && <div className="studio-pane">
      <div className="sub-editor-core">
        <label className="sub-title-field">{copy.title}<input value={profile.title} onChange={(event) => setProfile((current) => ({ ...current, title: event.target.value }))}/></label>
        <fieldset className="affirmation-editor"><legend>{copy.affirmations}</legend>{profile.affirmations.map((item, index) => <div className="affirmation-row" key={`affirmation-${index}`}><textarea value={item} onChange={(event) => setProfile((current) => ({ ...current, affirmations: current.affirmations.map((line, lineIndex) => lineIndex === index ? event.target.value : line) }))}/><button type="button" onClick={() => setProfile((current) => ({ ...current, affirmations: current.affirmations.filter((_, lineIndex) => lineIndex !== index) }))} aria-label={lang === "zh" ? `删除第 ${index + 1} 句` : `Remove line ${index + 1}`}><X weight="bold"/></button></div>)}<button type="button" className="add-line" onClick={() => setProfile((current) => ({ ...current, affirmations: [...current.affirmations, ""] }))}>{copy.add}</button></fieldset>
      </div>
        <p className="desire-reference"><span>{lang === "zh" ? "当前愿望" : "Active desire"}</span><strong>{desire}</strong></p>
      </div>}
      {studioTab === "sound" && <div className="studio-pane">
      <fieldset className="delivery-cards"><legend>{copy.mode}</legend>{(["clear", "soft", "subliminal"] as const).map((mode) => { const label = mode === "clear" ? copy.deliveryClear : mode === "soft" ? copy.deliverySoft : copy.deliveryMasked; const description = mode === "clear" ? copy.deliveryClearCopy : mode === "soft" ? copy.deliverySoftCopy : copy.deliveryMaskedCopy; return <button className={profile.mode === mode ? "selected" : ""} key={mode} onClick={() => setProfile((current) => ({ ...current, mode }))}><strong>{label}</strong><small>{description}</small><i>{mode === "clear" ? "100%" : mode === "soft" ? "58%" : "16%"}</i></button>; })}</fieldset>
      <div className="mixer-heading"><h3>{copy.mixer}</h3></div>
      <div className="track-stack">
        <section className="audio-track voice-track">
          <div className="track-index">01</div><div className="track-main"><div className="track-copy"><strong>{copy.voiceTrack}</strong>{voiceName && <small aria-live="polite">{voiceName}</small>}</div><div className="track-actions"><button type="button" className={recording ? "recording" : ""} onClick={toggleRecording}>{recording ? "■" : "●"} {recording ? copy.stopRecord : copy.record}</button><button type="button" onClick={() => voiceFileRef.current?.click()}>{voiceUrl ? copy.replaceAudio : copy.uploadAudio}</button><input ref={voiceFileRef} className="audio-file-input" type="file" accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.webm,.flac" onChange={uploadTrack("voice")}/>{voiceUrl && <button type="button" onClick={() => removeTrack("voice")}>{copy.removeAudio}</button>}</div><WaveformStrip seed={voiceName || "voice"} active={Boolean(voiceUrl)}/><label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={voiceVolume} onChange={(event) => setVoiceVolume(Number(event.target.value))}/><b>{voiceVolume}%</b></label>{editControl(voiceEdit, setVoiceEdit)}</div>
        </section>
        <section className="audio-track music-track">
          <div className="track-index">02</div><div className="track-main"><div className="track-copy"><strong>{copy.musicTrack}</strong>{musicName && <small aria-live="polite">{musicName}</small>}</div><div className="track-actions"><button type="button" onClick={() => musicFileRef.current?.click()}>{musicUrl ? copy.replaceAudio : copy.uploadAudio}</button><input ref={musicFileRef} className="audio-file-input" type="file" accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.webm,.flac" onChange={uploadTrack("music")}/>{musicUrl && <button type="button" onClick={() => removeTrack("music")}>{copy.removeAudio}</button>}</div><WaveformStrip seed={musicName || "music"} active={Boolean(musicUrl)}/><label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))}/><b>{musicVolume}%</b></label>{editControl(musicEdit, setMusicEdit)}</div>
        </section>
        <section className="audio-track ambience-track">
          <div className="track-index">03</div><div className="track-main"><div className="track-copy"><strong>{copy.soundLibrary}</strong>{librarySound && <span className="sound-chosen">{librarySound.title}<button type="button" className="sound-clear" onClick={clearAmbience}>{lang === "zh" ? "不用了" : "Remove"}</button></span>}</div><div className="sound-search"><input ref={soundSearchRef} value={soundQuery} onChange={(event) => setSoundQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchSounds(); }} placeholder={copy.soundSearch}/><button type="button" onClick={searchSounds} disabled={soundSearching}>{soundSearching ? <span className="dough-loading"><DoughHop size="xs"/>{copy.searching}</span> : copy.search}</button></div>{soundResults.length > 0 && <div className="sound-results">{soundResults.slice(0, 9).map(soundCard)}</div>}{soundSearched && !soundSearching && soundResults.length === 0 && <small className="sound-empty">{copy.noSounds}</small>}<label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={ambienceVolume} onChange={(event) => { const next = Number(event.target.value); setAmbienceVolume(next); if (libraryAudioRef.current) libraryAudioRef.current.volume = next / 100; if (previewAudioRef.current) previewAudioRef.current.volume = Math.max(0.2, next / 100); }}/><b>{ambienceVolume}%</b></label>{editControl(ambienceEdit, setAmbienceEdit)}</div>
        </section>
      </div>
      </div>}
      {studioTab === "playback" && <div className="studio-pane">
      <section className="duration-studio"><div><h3>{copy.duration}</h3></div><div className="duration-mode-tabs"><button className={(profile.durationMode || "timer") === "timer" ? "selected" : ""} onClick={() => setProfile((current) => ({ ...current, durationMode: "timer" }))}>{copy.timer}</button><button className={profile.durationMode === "continuous" ? "selected" : ""} onClick={() => setProfile((current) => ({ ...current, durationMode: "continuous" }))}>{copy.continuous}</button></div><div className="duration-inputs"><label><input aria-label={copy.hours} type="number" min="0" max="12" value={durationHours} onChange={(event) => setDurationHours(Math.max(0, Math.min(12, Number(event.target.value))))}/><span>{copy.hours}</span></label><label><input aria-label={copy.minutes} type="number" min="0" max="59" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(0, Math.min(59, Number(event.target.value))))}/><span>{copy.minutes}</span></label></div>{profile.durationMode === "continuous" && <label className="completion-goal"><span>{copy.completionGoal}</span><input aria-label={copy.completionGoal} type="number" min="1" max="180" value={profile.completionMinutes || 5} onChange={(event) => setProfile((current) => ({ ...current, completionMinutes: Math.max(1, Math.min(180, Number(event.target.value))) }))}/><b>{copy.minutes}</b></label>}<label className="background-play"><input aria-label={copy.backgroundPlay} type="checkbox" checked={backgroundPlay} onChange={(event) => setBackgroundPlay(event.target.checked)}/><span><strong>{copy.backgroundPlay}</strong></span></label></section>
        <div className="mix-options"><label className="loop-check"><input type="checkbox" checked={loopAudio} onChange={(event) => setLoopAudio(event.target.checked)}/><span className="toggle-control" aria-hidden="true"><i/></span><span>{copy.loop}</span></label></div>
      </div>}
      {studioTab === "export" && <div className="studio-pane">
      <section className="mix-export"><label className="audio-rights"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)}/><span>{copy.rights}</span></label><button className="primary" type="button" onClick={exportMix} disabled={exporting || !voiceUrl}><DownloadSimple size={18}/>{exporting ? <span className="dough-loading"><DoughHop size="xs"/>{copy.exporting}</span> : copy.exportMix}</button>{exportMessage && <p aria-live="polite">{exportMessage}</p>}</section>
      </div>}
      {audioError && <p className="audio-error">{audioError}</p>}
      <div className="studio-savebar"><button className="primary" onClick={saveProfile}>{savedPulse ? copy.saved : copy.save}</button></div>
    </div>}


    {checkInOpen && <div className="modal-backdrop"><div className="checkin-modal"><h2>{copy.checkTitle}</h2><p>{copy.checkCopy}</p>{copy.feelings.map(([value, label]) => <button key={value} onClick={() => { onCheckIn(value); setCheckInOpen(false); setSecondsLeft(profile.duration * 60); }}>{label}</button>)}</div></div>}
    {tutorialOpen && <div className="modal-backdrop"><div className="tutorial-modal"><p className="eyebrow">{lang === "zh" ? "潜音" : "DREAMSCAPE"}</p><h2>{copy.tutorialTitle}</h2><ol>{copy.tutorialSteps.map((step) => <li key={step}>{step}</li>)}</ol><button className="primary" onClick={() => setTutorialOpen(false)}>{copy.close}</button></div></div>}
  </section>;
}
