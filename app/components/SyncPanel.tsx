"use client";

import { useState } from "react";
import { removeStored, writeStored } from "@/lib/safe-storage";
import { isShareableSyncCode, normalizeSyncCode } from "@/lib/sync-code";

type Lang = "zh" | "en";
type SyncStatus = "loading" | "saved" | "saving" | "offline";

const text = {
  zh: {
    title: "用同步码换设备",
    intro: "同步码就是打开你这份资料的钥匙。谁拿到谁就能看到你的愿望和对话，请只发给你自己，不要发到群里或任何公开的地方。",
    show: "显示我的同步码",
    hide: "隐藏",
    copy: "复制",
    copied: "已复制",
    notReady: "这台设备还没有生成同步码，请稍后再试。",
    notSynced: "这台设备目前还没同步到云端。换设备之前，请先等设置页底部显示“会自动同步”。",
    other: "已经在另一台设备上有资料？输入那台设备的同步码：",
    placeholder: "粘贴同步码",
    go: "同步到这台设备",
    checking: "正在核对…",
    badFormat: "这不像一个同步码，请完整复制后再粘贴。",
    same: "这就是这台设备自己的同步码。",
    notFound: "没有找到这个同步码对应的资料，这台设备上的内容没有改动。请确认那台设备已经显示“会自动同步”。",
    network: "现在连不上云端，这台设备上的内容没有改动，请稍后再试。",
    confirmReplace: "这会用那份资料替换这台设备上现有的愿望、对话和记忆。照片和音频文件只存在各自的设备上，不会同步。确定吗？",
    confirmEmpty: "这台设备会改用那份资料。确定吗？",
  },
  en: {
    title: "Move between devices with a sync code",
    intro: "The sync code is the key to your space. Anyone who has it can read your desires and conversations, so send it only to yourself and never post it in a group or anywhere public.",
    show: "Show my sync code",
    hide: "Hide",
    copy: "Copy",
    copied: "Copied",
    notReady: "This device has no sync code yet. Please try again shortly.",
    notSynced: "This device has not synced to the cloud yet. Before switching devices, wait until the bar at the bottom says auto-sync is on.",
    other: "Already have a space on another device? Enter that device's sync code:",
    placeholder: "Paste the sync code",
    go: "Sync to this device",
    checking: "Checking…",
    badFormat: "That does not look like a sync code. Please copy it in full and paste it again.",
    same: "That is this device's own sync code.",
    notFound: "No space was found for that code, and nothing on this device was changed. Make sure the other device shows that auto-sync is on.",
    network: "Cannot reach the cloud right now. Nothing on this device was changed. Please try again shortly.",
    confirmReplace: "This replaces the desires, conversations and memories on this device with that space. Photos and audio files live only on their own device and are not synced. Continue?",
    confirmEmpty: "This device will switch to that space. Continue?",
  },
} as const;

export default function SyncPanel({ lang, sessionId, syncStatus, hasLocalData, enterOnly = false }: { lang: Lang; sessionId: string; syncStatus: SyncStatus; hasLocalData: boolean; enterOnly?: boolean }) {
  const t = text[lang];
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = isShareableSyncCode(sessionId);

  const copy = async () => {
    try { await navigator.clipboard.writeText(sessionId); }
    catch {
      const box = document.createElement("textarea");
      box.value = sessionId;
      document.body.appendChild(box);
      box.select();
      try { document.execCommand("copy"); } catch { /* the code is on screen, she can copy it by hand */ }
      box.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const adopt = async () => {
    const code = normalizeSyncCode(input);
    if (!code) { setMessage(t.badFormat); return; }
    if (code === sessionId) { setMessage(t.same); return; }
    setBusy(true);
    setMessage(t.checking);
    try {
      const response = await fetch("/api/space", { cache: "no-store", headers: { "x-already-session-id": code } });
      const data = await response.json().catch(() => ({})) as { space?: unknown };
      if (!response.ok) { setMessage(t.network); return; }
      if (!data.space) { setMessage(t.notFound); return; }
      if (!window.confirm(hasLocalData ? t.confirmReplace : t.confirmEmpty)) { setMessage(""); return; }
      // Point this device at the other space, drop the local copy so the cloud copy loads cleanly, and restart.
      writeStored("already-session-id", code);
      removeStored("already-private-state-v5");
      removeStored("already-practice-checkins-v1");
      window.location.assign("/");
    } catch {
      setMessage(t.network);
    } finally {
      setBusy(false);
    }
  };

  return <div className={enterOnly ? "sync-code-card sync-enter-only" : "setting-card sync-code-card"}>
    {!enterOnly && <><span>{t.title}</span>
    <p>{t.intro}</p>
    {syncStatus !== "saved" && <small className="sync-warning">{t.notSynced}</small>}
    {ready ? <div className="sync-code-row">
      {shown ? <>
        <code className="sync-code">{sessionId}</code>
        <button type="button" className="outline-button" onClick={copy}>{copied ? t.copied : t.copy}</button>
        <button type="button" className="outline-button" onClick={() => setShown(false)}>{t.hide}</button>
      </> : <button type="button" className="outline-button" onClick={() => setShown(true)}>{t.show}</button>}
    </div> : <small>{t.notReady}</small>}</>}
    <label className="sync-other">
      <span>{t.other}</span>
      <input value={input} onChange={(event) => { setInput(event.target.value); setMessage(""); }} placeholder={t.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    </label>
    <button type="button" className="outline-button" onClick={adopt} disabled={busy || !input.trim()}>{busy ? t.checking : t.go}</button>
    {message && <small className="sync-message" role="status">{message}</small>}
  </div>;
}
