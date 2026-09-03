"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "@phosphor-icons/react";

export type PracticeCheckIn = {
  date: string;
  feeling: "settled" | "soft" | "chosen";
};

type Lang = "zh" | "en";
type DeliveryMode = "clear" | "soft" | "subliminal";
type Ambience = "rain" | "brown" | "ocean" | "library";
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
    title: "我被坚定选择",
    affirmations: [
      "我自然地被爱、被选择、被珍惜。",
      "我们的关系稳定、浪漫，并且充满宠爱。",
      "丰盛和爱已经是我最熟悉的日常。",
    ],
    mode: "soft",
    ambience: "rain",
    duration: 5,
    durationMode: "timer",
    completionMinutes: 5,
  },
  en: {
    title: "I Am Fully Chosen",
    affirmations: [
      "I am naturally loved, chosen, and cherished.",
      "Our relationship is secure, romantic, and deeply devoted.",
      "Love and abundance are my most familiar everyday experience.",
    ],
    mode: "soft",
    ambience: "rain",
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

type Props = {
  lang: Lang;
  desire: string;
  checkIns: PracticeCheckIn[];
  onCheckIn: (feeling: PracticeCheckIn["feeling"]) => void;
};

export default function SubliminalStudio({ lang, desire, checkIns, onCheckIn }: Props) {
  const copy = lang === "zh" ? {
    eyebrow: "DREAMSCAPE · 入梦声场",
    heading: "听见你已经拥有的生活",
    intro: "把完成态写进自己的声音空间。肯定语、录音和练习记录默认留在这台设备上。",
    tutorial: "制作教程",
    current: "我的愿境音声",
    edit: "编辑我的Sub",
    done: "完成今日练习",
    pause: "暂停",
    play: "开始练习",
    streak: "连续练习",
    days: "天",
    thisWeek: "本周打卡",
    title: "Sub名称",
    affirmations: "我的肯定语",
    add: "＋ 添加一句",
    save: "保存我的Sub",
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
    useSound: "加入声场",
    selectedSound: "正在使用",
    previewSound: "试听",
    stopPreview: "停止试听",
    noSounds: "暂时没有找到，换一个更简单的关键词试试。",
    searchedTogether: "已同时搜索",
    privacy: "隐私与聆听",
    privacyCopy: "此版本在设备上完成播放与混音，不把录音发送给AI。请保持舒适音量；Sub是个性化想象与肯定语练习，不提供医疗服务或特定结果保证。",
    checkTitle: "今天的练习已经完成",
    checkCopy: "哪一种感受最接近此刻？",
    feelings: [["settled", "安定下来了"], ["soft", "柔软了一点"], ["chosen", "被选择很真实"]] as const,
    tutorialTitle: "如何制作属于你的Sub",
    tutorialSteps: ["写下你愿意每天听见的完成态肯定语。", "选择清晰、轻声或覆盖式播放，并挑选背景声音。", "可以录下自己的声音；没有录音时使用设备自带语音。", "练习结束后可以记录感受；也可以随时点击桌面面团完成今日打卡。"],
    close: "明白了",
    recordingError: "无法使用麦克风，请在浏览器设置中允许录音。",
    playbackError: "这段录音的格式无法在当前浏览器播放，请重新录制，或上传 MP3、M4A、WAV 音频。",
    mixer: "我的多轨制作台",
    mixerCopy: "像轻量剪辑软件一样组合人声、音乐和环境声。所有音频只在当前设备处理。",
    voiceTrack: "肯定语 · 人声轨",
    voiceTrackCopy: "录制自己的声音，或上传已有的肯定语音频",
    musicTrack: "氛围 · 音乐轨",
    musicTrackCopy: "上传你有权使用的音乐、白噪音或环境音",
    ambienceTrack: "内置 · 环境声轨",
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
  } : {
    eyebrow: "DREAMSCAPE · PRIVATE AUDIO PRACTICE",
    heading: "Hear the life you already have",
    intro: "Turn your fulfilled state into a private sound space. Affirmations, recordings, and practice history stay on this device by default.",
    tutorial: "How it works",
    current: "MY DESIRE SOUNDSCAPE",
    edit: "Edit my Sub",
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
    searchedTogether: "Searched together",
    privacy: "PRIVACY & LISTENING",
    privacyCopy: "This version mixes and plays on your device and does not send your recording to AI. Keep the volume comfortable. Sub Studio is a personalized imagination and affirmation practice, not medical care or a guarantee of a particular result.",
    checkTitle: "Today’s practice is complete",
    checkCopy: "What feels closest right now?",
    feelings: [["settled", "I feel settled"], ["soft", "I feel softer"], ["chosen", "Being chosen feels real"]] as const,
    tutorialTitle: "How to make your own Sub",
    tutorialSteps: ["Write fulfilled-state affirmations you want to hear every day.", "Choose clear, soft, or masked delivery and a soundscape.", "Record your own voice, or let your device read the lines.", "Record a feeling after practice, or tap the desktop dough anytime for today’s check-in."],
    close: "Got it",
    recordingError: "The microphone is unavailable. Allow recording in your browser settings.",
    playbackError: "This recording format cannot play in your browser. Record again or upload an MP3, M4A, or WAV file.",
    mixer: "My Multitrack Studio",
    mixerCopy: "Combine voice, music, and ambience in a lightweight mobile editor. Audio is processed on this device.",
    voiceTrack: "Affirmations · Voice Track",
    voiceTrackCopy: "Record your own voice or upload an affirmation track",
    musicTrack: "Atmosphere · Music Track",
    musicTrackCopy: "Add music, white noise, or ambience you are allowed to use",
    ambienceTrack: "Built-in · Ambience Track",
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
  };

  const [profile, setProfile] = useState<SavedSub>(defaults[lang]);
  const [editing, setEditing] = useState(false);
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
  const [backgroundPlay, setBackgroundPlay] = useState(true);
  const [soundQuery, setSoundQuery] = useState(lang === "zh" ? "下雨" : "rain");
  const [soundResults, setSoundResults] = useState<AudioResult[]>([]);
  const [soundSearching, setSoundSearching] = useState(false);
  const [soundSearched, setSoundSearched] = useState(false);
  const [soundSearchMeta, setSoundSearchMeta] = useState<{ original: string; translated: string } | null>(null);
  const [librarySound, setLibrarySound] = useState<AudioResult | null>(null);
  const [previewingSoundId, setPreviewingSoundId] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceFileRef = useRef<HTMLInputElement | null>(null);
  const musicFileRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ambienceSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const speechIndexRef = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("already-subliminal-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as SavedSub;
        if (parsed.title && Array.isArray(parsed.affirmations)) {
          // Restore the private, device-local practice after the component mounts.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile(parsed);
          setLibrarySound(parsed.librarySound || null);
          setSecondsLeft(parsed.duration * 60);
          setDurationHours(Math.floor(parsed.duration / 60));
          setDurationMinutes(parsed.duration % 60);
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
    window.speechSynthesis?.cancel();
    recordedAudioRef.current?.pause();
    musicAudioRef.current?.pause();
    libraryAudioRef.current?.pause();
    previewAudioRef.current?.pause();
    ambienceSourceRef.current?.stop();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  }, [voiceUrl]);

  useEffect(() => () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
  }, [musicUrl]);

  const streak = useMemo(() => practiceStreak(checkIns), [checkIns]);
  const week = useMemo(() => {
    const result: Array<{ key: string; label: string; complete: boolean }> = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = todayKey(date);
      result.push({ key, label: new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { weekday: "narrow" }).format(date), complete: checkIns.some((item) => item.date === key) });
    }
    return result;
  }, [checkIns, lang]);

  const saveProfile = () => {
    const customDuration = Math.max(1, Math.min(720, durationHours * 60 + durationMinutes));
    const cleaned = { ...profile, duration: customDuration, title: profile.title.trim() || defaults[lang].title, affirmations: profile.affirmations.map((item) => item.trim()).filter(Boolean) };
    setProfile(cleaned);
    localStorage.setItem("already-subliminal-v1", JSON.stringify(cleaned));
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
    const context = new AudioContext();
    await context.resume();
    const length = context.sampleRate * 3;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      data[index] = profile.ambience === "brown" ? brown * 3.5 : white;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = profile.ambience === "ocean" ? "lowpass" : "bandpass";
    filter.frequency.value = profile.ambience === "rain" ? 1500 : profile.ambience === "ocean" ? 420 : 720;
    filter.Q.value = profile.ambience === "rain" ? 0.45 : 0.8;
    const base = profile.ambience === "brown" ? 0.12 : 0.08;
    gain.gain.value = base * (ambienceVolume / 100);
    source.connect(filter).connect(gain).connect(context.destination);
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

  const speakNext = () => {
    if (!playingRef.current || !profile.affirmations.length) return;
    const text = profile.affirmations[speechIndexRef.current % profile.affirmations.length];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "zh" ? "zh-CN" : "en-US";
    utterance.rate = (profile.mode === "clear" ? 0.9 : profile.mode === "soft" ? 0.72 : 1.15) * playbackSpeed;
    const modeGain = profile.mode === "clear" ? 1 : profile.mode === "soft" ? 0.58 : 0.16;
    utterance.volume = Math.min(1, (voiceVolume / 100) * modeGain);
    utterance.onend = () => {
      speechIndexRef.current += 1;
      if (playingRef.current) window.setTimeout(speakNext, profile.mode === "clear" ? 650 : profile.mode === "soft" ? 1150 : 120);
    };
    window.speechSynthesis.speak(utterance);
  };

  const stopPractice = (completed = false) => {
    playingRef.current = false;
    setIsPlaying(false);
    window.speechSynthesis.cancel();
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
    const remaining = secondsLeft <= 0 ? profile.duration * 60 : secondsLeft;
    setSecondsLeft(remaining);
    playingRef.current = true;
    setIsPlaying(true);
    setAudioError("");
    await startAmbience();
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
      speakNext();
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
      window.speechSynthesis.cancel();
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
    setSoundSearchMeta(null);
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingSoundId("");
    try {
      const response = await fetch(`/api/audio?q=${encodeURIComponent(soundQuery.trim())}&locale=${lang}&v=environment-only-v3&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as { results?: AudioResult[]; queries?: { original?: string; translated?: string } };
      setSoundResults(data.results || []);
      if (data.queries?.original && data.queries?.translated) {
        setSoundSearchMeta({ original: data.queries.original, translated: data.queries.translated });
      }
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

  const removeTrack = (kind: "voice" | "music") => {
    if (kind === "voice") {
      recordedAudioRef.current?.pause();
      setVoiceUrl(""); setVoiceName("");
    } else {
      musicAudioRef.current?.pause();
      setMusicUrl(""); setMusicName("");
    }
    void deleteAudioTrack(kind);
  };

  return <section className="full-view subliminal-view">
    <div className="studio-heading">
      <div className="view-heading"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.heading}</h1><p>{copy.intro}</p></div>
      <button className="tutorial-button" onClick={() => setTutorialOpen(true)}>ⓘ {copy.tutorial}</button>
    </div>

    <div className="dreamscape-workspace">
      <div className="sub-player-card">
        <div className="sub-player-identity"><div className="sub-orbit"><span>ALREADY</span><i/></div><div><p>{copy.current}</p><h2>{profile.title}</h2></div></div>
        <div className="sub-player-time"><strong>{(profile.durationMode || "timer") === "continuous" ? timeLabel(elapsedSeconds) : timeLabel(secondsLeft)}</strong></div>
        <div className="sub-wave" aria-hidden="true">{Array.from({ length: 35 }, (_, index) => <i key={index}/>)}</div>
        <div className="mini-timeline"><span>{copy.timeline}</span><i className="voice">VOICE · {profile.mode.toUpperCase()}</i><i className="music">MUSIC</i><i className="ambience">{librarySound ? librarySound.title : profile.ambience.toUpperCase()}</i></div>
        <div className="player-actions"><button className="sub-play" onClick={startPractice}>{isPlaying ? "Ⅱ" : "▶"}<span>{isPlaying ? copy.pause : copy.play}</span></button><button className="sub-edit" onClick={() => setEditing((current) => !current)}>{copy.edit} ↗</button></div>
      </div>
      <aside className="session-summary">
        <p className="eyebrow">SESSION</p><h3>{lang === "zh" ? "今天怎么听" : "How you are listening"}</h3>
        <dl><div><dt>{copy.mode}</dt><dd>{profile.mode === "clear" ? copy.deliveryClear : profile.mode === "soft" ? copy.deliverySoft : copy.deliveryMasked}</dd></div><div><dt>{copy.duration}</dt><dd>{(profile.durationMode || "timer") === "continuous" ? copy.continuous : `${profile.duration} min`}</dd></div><div><dt>{copy.ambience}</dt><dd>{librarySound?.title || profile.ambience}</dd></div></dl>
        <button className="outline-button" onClick={() => setEditing(true)}>{lang === "zh" ? "打开声音工作台" : "Open sound studio"}</button>
      </aside>
    </div>

    {editing && <div className="sub-editor">
      <div className="sub-editor-core">
        <label className="sub-title-field">{copy.title}<input value={profile.title} onChange={(event) => setProfile((current) => ({ ...current, title: event.target.value }))}/></label>
        <fieldset className="affirmation-editor"><legend>{copy.affirmations}</legend>{profile.affirmations.map((item, index) => <div className="affirmation-row" key={`affirmation-${index}`}><textarea value={item} onChange={(event) => setProfile((current) => ({ ...current, affirmations: current.affirmations.map((line, lineIndex) => lineIndex === index ? event.target.value : line) }))}/><button type="button" onClick={() => setProfile((current) => ({ ...current, affirmations: current.affirmations.filter((_, lineIndex) => lineIndex !== index) }))} aria-label={lang === "zh" ? `删除第 ${index + 1} 句` : `Remove line ${index + 1}`}><X weight="bold"/></button></div>)}<button type="button" className="add-line" onClick={() => setProfile((current) => ({ ...current, affirmations: [...current.affirmations, ""] }))}>{copy.add}</button></fieldset>
      </div>
      <fieldset className="delivery-cards"><legend>{copy.mode}</legend>{(["clear", "soft", "subliminal"] as const).map((mode) => { const label = mode === "clear" ? copy.deliveryClear : mode === "soft" ? copy.deliverySoft : copy.deliveryMasked; const description = mode === "clear" ? copy.deliveryClearCopy : mode === "soft" ? copy.deliverySoftCopy : copy.deliveryMaskedCopy; return <button className={profile.mode === mode ? "selected" : ""} key={mode} onClick={() => setProfile((current) => ({ ...current, mode }))}><strong>{label}</strong><small>{description}</small><i>{mode === "clear" ? "100%" : mode === "soft" ? "58%" : "16%"}</i></button>; })}</fieldset>
      <section className="duration-studio"><div><p className="eyebrow">PLAYBACK</p><h3>{copy.duration}</h3></div><div className="duration-mode-tabs"><button className={(profile.durationMode || "timer") === "timer" ? "selected" : ""} onClick={() => setProfile((current) => ({ ...current, durationMode: "timer" }))}>{copy.timer}</button><button className={profile.durationMode === "continuous" ? "selected" : ""} onClick={() => setProfile((current) => ({ ...current, durationMode: "continuous" }))}>{copy.continuous}</button></div><div className="duration-inputs"><label><input aria-label={copy.hours} type="number" min="0" max="12" value={durationHours} onChange={(event) => setDurationHours(Math.max(0, Math.min(12, Number(event.target.value))))}/><span>{copy.hours}</span></label><label><input aria-label={copy.minutes} type="number" min="0" max="59" value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(0, Math.min(59, Number(event.target.value))))}/><span>{copy.minutes}</span></label></div>{profile.durationMode === "continuous" && <label className="completion-goal"><span>{copy.completionGoal}</span><input aria-label={copy.completionGoal} type="number" min="1" max="180" value={profile.completionMinutes || 5} onChange={(event) => setProfile((current) => ({ ...current, completionMinutes: Math.max(1, Math.min(180, Number(event.target.value))) }))}/><b>{copy.minutes}</b><small>{copy.completionHint}</small></label>}<label className="background-play"><input aria-label={copy.backgroundPlay} type="checkbox" checked={backgroundPlay} onChange={(event) => setBackgroundPlay(event.target.checked)}/><span><strong>{copy.backgroundPlay}</strong><small>{copy.backgroundPlayHint}</small></span></label></section>
      <div className="mixer-heading"><p className="eyebrow">SUB MIXER</p><h3>{copy.mixer}</h3><small>{copy.mixerCopy}</small></div>
      <p className="audio-upload-help">{copy.audioFormats}</p>
      <div className="track-stack">
        <section className="audio-track voice-track">
          <div className="track-index">01</div><div className="track-main"><strong>{copy.voiceTrack}</strong><small aria-live="polite">{voiceName || copy.voiceTrackCopy}</small>{voiceUrl && <span className="audio-ready">✓ {copy.audioReady}</span>}<div className="track-actions"><button type="button" className={recording ? "recording" : ""} onClick={toggleRecording}>{recording ? "■" : "●"} {recording ? copy.stopRecord : copy.record}</button><button type="button" onClick={() => voiceFileRef.current?.click()}>{voiceUrl ? copy.replaceAudio : copy.uploadAudio}</button><input ref={voiceFileRef} className="audio-file-input" type="file" accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.webm,.flac" onChange={uploadTrack("voice")}/>{voiceUrl && <button type="button" onClick={() => removeTrack("voice")}>{copy.removeAudio}</button>}</div><label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={voiceVolume} onChange={(event) => setVoiceVolume(Number(event.target.value))}/><b>{voiceVolume}%</b></label></div>
        </section>
        <section className="audio-track music-track">
          <div className="track-index">02</div><div className="track-main"><strong>{copy.musicTrack}</strong><small aria-live="polite">{musicName || copy.musicTrackCopy}</small>{musicUrl && <span className="audio-ready">✓ {copy.audioReady}</span>}<div className="track-actions"><button type="button" onClick={() => musicFileRef.current?.click()}>{musicUrl ? copy.replaceAudio : copy.uploadAudio}</button><input ref={musicFileRef} className="audio-file-input" type="file" accept="audio/*,.mp3,.m4a,.mp4,.wav,.aac,.aif,.aiff,.caf,.ogg,.oga,.webm,.flac" onChange={uploadTrack("music")}/>{musicUrl && <button type="button" onClick={() => removeTrack("music")}>{copy.removeAudio}</button>}</div><label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))}/><b>{musicVolume}%</b></label></div>
        </section>
        <section className="audio-track ambience-track">
          <div className="track-index">03</div><div className="track-main"><strong>{copy.soundLibrary}</strong><small>{librarySound ? `${librarySound.title} · ${librarySound.creator} · ${librarySound.license}` : copy.ambienceTrack}</small><div className="sound-search"><input value={soundQuery} onChange={(event) => setSoundQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchSounds(); }} placeholder={copy.soundSearch}/><button type="button" onClick={searchSounds} disabled={soundSearching}>{soundSearching ? copy.searching : copy.search}</button></div>{soundSearchMeta && soundSearchMeta.original !== soundSearchMeta.translated && <small className="sound-query-meta">{copy.searchedTogether}: <b>{soundSearchMeta.original}</b><i>＋</i><b>{soundSearchMeta.translated}</b></small>}{soundResults.length > 0 && <div className="sound-results">{soundResults.slice(0, 9).map((sound) => <article className={librarySound?.id === sound.id ? "selected" : ""} key={sound.id}><div className="sound-card-main"><button className="sound-preview" type="button" aria-label={`${previewingSoundId === sound.id ? copy.stopPreview : copy.previewSound}: ${sound.title}`} onClick={() => void previewSound(sound)}>{previewingSoundId === sound.id ? <Pause weight="fill"/> : <Play weight="fill"/>}</button><div className="sound-card-copy"><strong title={sound.title}>{sound.title}</strong><small title={`${sound.creator} · ${sound.license}`}>{sound.creator} · {sound.license}</small></div></div><button className="sound-choose" type="button" onClick={() => void chooseLibrarySound(sound)}>{librarySound?.id === sound.id ? `✓ ${copy.selectedSound}` : copy.useSound}</button></article>)}</div>}{soundSearched && !soundSearching && soundResults.length === 0 && <small className="sound-empty">{copy.noSounds}</small>}<label className="track-slider"><span>{copy.volume}</span><input type="range" min="0" max="100" value={ambienceVolume} onChange={(event) => { const next = Number(event.target.value); setAmbienceVolume(next); if (libraryAudioRef.current) libraryAudioRef.current.volume = next / 100; if (previewAudioRef.current) previewAudioRef.current.volume = Math.max(0.2, next / 100); }}/><b>{ambienceVolume}%</b></label></div>
        </section>
      </div>
      <div className="mix-options"><label>{copy.speed}<input type="range" min="0.1" max="10" step="0.1" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}/><b>{playbackSpeed.toFixed(1)}×</b></label><label className="loop-check"><input type="checkbox" checked={loopAudio} onChange={(event) => setLoopAudio(event.target.checked)}/>{copy.loop}</label></div>
      {audioError && <p className="audio-error">{audioError}</p>}
      <p className="desire-reference">{desire}</p>
      <button className="primary" onClick={saveProfile}>{savedPulse ? copy.saved : copy.save}</button>
    </div>}

    <section className="practice-progress practice-progress-separated"><div><span>✦</span><strong>{streak}</strong><small>{copy.streak} · {copy.days}</small></div><div className="week-checks"><p>{copy.thisWeek}</p><div>{week.map((day) => <span className={day.complete ? "complete" : ""} key={day.key}><i>{day.complete ? "✓" : ""}</i>{day.label}</span>)}</div></div></section>

    {checkInOpen && <div className="modal-backdrop"><div className="checkin-modal"><span>✦</span><h2>{copy.checkTitle}</h2><p>{copy.checkCopy}</p>{copy.feelings.map(([value, label]) => <button key={value} onClick={() => { onCheckIn(value); setCheckInOpen(false); setSecondsLeft(profile.duration * 60); }}>{label}</button>)}</div></div>}
    {tutorialOpen && <div className="modal-backdrop"><div className="tutorial-modal"><p className="eyebrow">DREAMSCAPE</p><h2>{copy.tutorialTitle}</h2><ol>{copy.tutorialSteps.map((step) => <li key={step}>{step}</li>)}</ol><button className="primary" onClick={() => setTutorialOpen(false)}>{copy.close}</button></div></div>}
  </section>;
}
