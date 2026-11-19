"use client";

import { useState } from "react";
import { removeStored, writeStored } from "@/lib/safe-storage";
import { isShareableSyncCode, normalizeSyncCode } from "@/lib/sync-code";
import { Check, CloudCheck, CloudSlash, Copy, Eye, EyeSlash } from "@phosphor-icons/react";
import { askConfirm } from "./ConfirmHost";

type Lang = "zh" | "en";
type SyncStatus = "loading" | "saved" | "saving" | "offline";

const text = {
  zh: {
    title: "我的同步码",
    intro: "同步码可用来访问你的空间。请妥善保管，仅在自己的设备上使用。",
    show: "显示我的同步码",
    hide: "隐藏",
    copy: "复制",
    copied: "已复制",
    notReady: "这台设备还没有生成同步码，请稍后再试。",
    notSynced: "这台设备目前还没同步到云端。换设备之前，请先等上面显示「已同步」。",
    other: "已经在另一台设备上有资料？输入那台设备的同步码：",
    placeholder: "粘贴同步码",
    go: "同步到这台设备",
    checking: "正在核对…",
    badFormat: "这不像一个同步码，请完整复制后再粘贴。",
    same: "这就是这台设备自己的同步码。",
    notFound: "没有找到这个同步码对应的资料，这台设备上的内容没有改动。请确认那台设备的「同步与数据」里显示「已同步」。",
    network: "现在连不上云端，这台设备上的内容没有改动，请稍后再试。",
    confirmReplace: "这会用那份资料替换这台设备上现有的愿望、对话和记忆。照片和音频文件只存在各自的设备上，不会同步。确定吗？",
    confirmEmpty: "这台设备会改用那份资料。确定吗？",
    cardTitle: "跨设备同步",
    statusSaved: "已同步",
    statusSaving: "同步中",
    statusOffline: "本机副本",
    syncedCopy: "愿望、记忆、对话、剧本和练习记录都已存到云端，改动会自动同步。",
    offlineCopy: "现在用的是这台设备上的副本，连上网后会自动继续同步。",
    otherTitle: "换成另一台设备的资料",
    otherCopy: "在那台设备上复制它的同步码，粘贴到这里。这台设备现有的内容会被替换。",
    goShort: "同步",
  },
  en: {
    title: "My sync code",
    intro: "Keep your sync code private. Use it only on your own devices to access your space.",
    show: "Show my sync code",
    hide: "Hide",
    copy: "Copy",
    copied: "Copied",
    notReady: "This device has no sync code yet. Please try again shortly.",
    notSynced: "This device has not synced to the cloud yet. Before switching devices, wait until it shows Synced above.",
    other: "Already have a space on another device? Enter that device's sync code:",
    placeholder: "Paste the sync code",
    go: "Sync to this device",
    checking: "Checking…",
    badFormat: "That does not look like a sync code. Please copy it in full and paste it again.",
    same: "That is this device's own sync code.",
    notFound: "No space was found for that code, and nothing on this device was changed. Make sure the other device shows Synced under Sync & data.",
    network: "Cannot reach the cloud right now. Nothing on this device was changed. Please try again shortly.",
    confirmReplace: "This replaces the desires, conversations and memories on this device with that space. Photos and audio files live only on their own device and are not synced. Continue?",
    confirmEmpty: "This device will switch to that space. Continue?",
    cardTitle: "Cross-device sync",
    statusSaved: "Synced",
    statusSaving: "Syncing",
    statusOffline: "On this device",
    syncedCopy: "Your desires, memory, conversations, stories and practice history are in the cloud. Changes sync automatically.",
    offlineCopy: "Using the copy on this device. Sync resumes automatically once you are back online.",
    otherTitle: "Use another device's space",
    otherCopy: "Copy the sync code on that device and paste it here. What is on this device will be replaced.",
    goShort: "Sync",
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
      if (!(await askConfirm({ title: lang === "zh" ? "换成那份资料？" : "Switch to that space?", body: hasLocalData ? t.confirmReplace : t.confirmEmpty, confirmLabel: lang === "zh" ? "确定替换" : "Replace", cancelLabel: lang === "zh" ? "取消" : "Cancel" }))) { setMessage(""); return; }
      // Point this device at the other space, drop the local copy so the cloud copy loads cleanly, and restart.
      writeStored("already-session-id", code);
      removeStored("already-private-state-v5");
      removeStored("already-sync-base-v1");
      removeStored("already-practice-checkins-v1");
      window.location.assign("/");
    } catch {
      setMessage(t.network);
    } finally {
      setBusy(false);
    }
  };

  if (enterOnly) return <div className="sync-code-card sync-enter-only">
    <label className="sync-other">
      <span>{t.other}</span>
      <input value={input} onChange={(event) => { setInput(event.target.value); setMessage(""); }} placeholder={t.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    </label>
    <button type="button" className="outline-button" onClick={adopt} disabled={busy || !input.trim()}>{busy ? t.checking : t.go}</button>
    {message && <small className="sync-message" role="status">{message}</small>}
  </div>;

  const synced = syncStatus === "saved";
  const statusLabel = synced ? t.statusSaved : syncStatus === "offline" ? t.statusOffline : t.statusSaving;
  return <section className="profile-card sync-card">
    <div className="sync-card-top">
      <h3>{t.cardTitle}</h3>
      <span className={`wish-chip${synced ? " is-current" : ""}`}>{synced ? <CloudCheck size={14} weight="bold" /> : <CloudSlash size={14} weight="bold" />} {statusLabel}</span>
    </div>
    <p className="profile-sub">{synced ? t.syncedCopy : t.offlineCopy}</p>

    <div className="sync-block">
      <strong>{t.title}</strong>
      <small>{t.intro}</small>
      {!synced && <small className="sync-warning">{t.notSynced}</small>}
      {ready ? (shown ? <>
        <code className="sync-code">{sessionId}</code>
        <div className="sync-code-row">
          <button type="button" className="profile-topic-plus" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t.copied : t.copy}</button>
          <button type="button" className="wish-delete" onClick={() => setShown(false)}><EyeSlash size={15} /> {t.hide}</button>
        </div>
      </> : <div className="sync-code-row"><button type="button" className="profile-topic-plus" onClick={() => setShown(true)}><Eye size={15} /> {t.show}</button></div>) : <small>{t.notReady}</small>}
    </div>

    <div className="sync-block">
      <strong>{t.otherTitle}</strong>
      <small>{t.otherCopy}</small>
      <div className="profile-topic-add">
        <input aria-label={t.placeholder} value={input} onChange={(event) => { setInput(event.target.value); setMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter" && input.trim() && !busy) { event.preventDefault(); void adopt(); } }} placeholder={t.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="button" className="profile-topic-plus" onClick={adopt} disabled={busy || !input.trim()}>{busy ? t.checking : t.goShort}</button>
      </div>
      {message && <small className="sync-message" role="status">{message}</small>}
    </div>
  </section>;
}
