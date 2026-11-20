"use client";

import { CloudCheck, CloudSlash } from "@phosphor-icons/react";

type Lang = "zh" | "en";
type SyncStatus = "loading" | "saved" | "saving" | "offline";

// The space follows the signed-in account: signing in with the same account on another device brings it there.
const text = {
  zh: {
    cardTitle: "跨设备同步",
    statusSaved: "已同步",
    statusSaving: "同步中",
    statusOffline: "本机副本",
    syncedCopy: "愿望、记忆、对话、剧本和练习记录都已存到云端，改动会自动同步。",
    offlineCopy: "现在用的是这台设备上的副本，连上网后会自动继续同步。",
  },
  en: {
    cardTitle: "Cross-device sync",
    statusSaved: "Synced",
    statusSaving: "Syncing",
    statusOffline: "On this device",
    syncedCopy: "Your desires, memory, conversations, stories and practice history are in the cloud. Changes sync automatically.",
    offlineCopy: "Using the copy on this device. Sync resumes automatically once you are back online.",
  },
} as const;

export default function SyncPanel({ lang, syncStatus }: { lang: Lang; syncStatus: SyncStatus }) {
  const t = text[lang];
  const synced = syncStatus === "saved";
  const statusLabel = synced ? t.statusSaved : syncStatus === "offline" ? t.statusOffline : t.statusSaving;
  return <section className="profile-card sync-card">
    <div className="sync-card-top">
      <h3>{t.cardTitle}</h3>
      <span className={`wish-chip${synced ? " is-current" : ""}`}>{synced ? <CloudCheck size={14} weight="bold" /> : <CloudSlash size={14} weight="bold" />} {statusLabel}</span>
    </div>
    <p className="profile-sub">{synced ? t.syncedCopy : t.offlineCopy}</p>
  </section>;
}
