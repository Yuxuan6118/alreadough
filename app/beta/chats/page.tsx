"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readStored, removeStored } from "@/lib/safe-storage";
import "./chats.css";

type Message = { role: "user" | "ai"; text: string };
type Conversation = { id: string; title: string; createdAt: string; messages: Message[] };
type ChatUser = { label: string; updatedAt: string; messageCount: number; conversations: Conversation[] };
type Sample = { id: string; user: string; created_at: string; mode: string; coach_mode: string | null; context: Message[]; user_text: string; ai_reply: string; feedback: string | null };

type Profile = { user: string; first_seen_at: string; last_seen_at: string; visits: number; country: string | null; region: string | null; city: string | null; timezone: string | null; lang: string | null; device: string | null; os: string | null; browser: string | null; turns: number; active_days: number; helpful: number; missed: number; wish_category: string | null; coach_mode: string | null };

const FOUNDER_KEY_STORAGE = "already-founder-key";
const when = (iso: string) => (iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "");

export default function FounderChatsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"threads" | "samples" | "profiles">("threads");
  const [users, setUsers] = useState<ChatUser[] | null>(null);
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState("");
  const [openConversation, setOpenConversation] = useState(0);
  const [filter, setFilter] = useState<"all" | "helpful" | "missed">("all");
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the founder key from storage on mount */
  useEffect(() => {
    const saved = readStored(FOUNDER_KEY_STORAGE) || "";
    if (saved && !/^[\x21-\x7E]{6,200}$/.test(saved)) { removeStored(FOUNDER_KEY_STORAGE); setToken(""); return; } // placeholder text, not a real key
    setToken(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const load = useCallback(async (view: "chats" | "samples" | "profiles") => {
    if (!token) return;
    try {
      const response = await fetch(`/api/beta/admin?view=${view}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("访问密钥无效，请先回到测试驾驶舱用 /beta?key=你的密钥 打开一次。");
      const data = await response.json() as { users?: ChatUser[]; samples?: Sample[]; profiles?: Profile[] };
      setError("");
      if (view === "chats") { setUsers(data.users || []); setSelected((current) => current || data.users?.[0]?.label || ""); }
      else if (view === "profiles") setProfiles(data.profiles || []);
      else setSamples(data.samples || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "读取失败"); }
  }, [token]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch on tab change */
  useEffect(() => { if (tab === "threads" && users === null) void load("chats"); if (tab === "samples" && samples === null) void load("samples"); if (tab === "profiles" && profiles === null) void load("profiles"); }, [tab, users, samples, profiles, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const current = useMemo(() => users?.find((user) => user.label === selected), [users, selected]);
  const conversation = current?.conversations[Math.min(openConversation, (current?.conversations.length || 1) - 1)];
  const shownSamples = (samples || []).filter((sample) => filter === "all" || sample.feedback === filter);

  return <main className="chat-viewer">
    <header><div><p>ALREADOUGH · FOUNDER</p><h1>对话记录</h1><span>仅创始人可见。用户用 8 位编号区分，不显示昵称、愿望卡或原始设备 ID。</span></div><a href="/beta">返回驾驶舱</a></header>
    {token === null ? <p>正在验证访问权限…</p> : !token ? <section className="viewer-error"><h2>还没有访问密钥</h2><p>先用 /beta?key=你的密钥 打开一次测试驾驶舱，再回到这里。</p></section> : <>
      <nav className="viewer-tabs"><button className={tab === "threads" ? "active" : ""} onClick={() => setTab("threads")}>完整对话（按用户）</button><button className={tab === "samples" ? "active" : ""} onClick={() => setTab("samples")}>回复评价（👍/👎）</button><button className={tab === "profiles" ? "active" : ""} onClick={() => setTab("profiles")}>用户画像</button></nav>
      {error && <p className="viewer-error-line">{error}</p>}
      {tab === "threads" && (users === null ? <p>正在读取…</p> : !users.length ? <p>还没有同步的对话。</p> : <div className="viewer-split">
        <aside>{users.map((user) => <button key={user.label} className={user.label === selected ? "active" : ""} onClick={() => { setSelected(user.label); setOpenConversation(0); }}><strong>用户 {user.label}</strong><small>{user.messageCount} 条消息 · {user.conversations.length} 段对话</small><small>最后活跃 {when(user.updatedAt)}</small></button>)}</aside>
        <section>
          {current && <div className="viewer-conversations">{current.conversations.map((item, index) => <button key={`${item.id}-${index}`} className={index === openConversation ? "active" : ""} onClick={() => setOpenConversation(index)}>{item.title}{item.createdAt ? ` · ${when(item.createdAt)}` : ""}</button>)}</div>}
          <div className="viewer-thread">{conversation?.messages.map((message, index) => <div key={index} className={`bubble ${message.role}`}><small>{message.role === "user" ? "用户" : "AI"}</small><p>{message.text}</p></div>)}</div>
        </section>
      </div>)}
      {tab === "samples" && (samples === null ? <p>正在读取…</p> : <>
        <div className="viewer-filter">{(["all", "missed", "helpful"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "全部" : value === "missed" ? "👎 不适合" : "👍 懂我"}</button>)}<small>{shownSamples.length} 条</small></div>
        {!shownSamples.length ? <p>暂无。</p> : shownSamples.map((sample) => <article className="viewer-sample" key={sample.id}>
          <header><small>用户 {sample.user} · {sample.coach_mode || "—"} · {sample.mode} · {when(sample.created_at)}</small>{sample.feedback && <b className={sample.feedback}>{sample.feedback === "helpful" ? "👍" : "👎"}</b>}</header>
          <div className="bubble user"><small>用户</small><p>{sample.user_text}</p></div>
          <div className="bubble ai"><small>AI</small><p>{sample.ai_reply}</p></div>
        </article>)}
      </>)}
      {tab === "profiles" && (profiles === null ? <p>正在读取…</p> : !profiles.length ? <p>还没有记录。用户打开 App 后会开始出现。</p> : <>
        <div className="viewer-segments">{([["国家", (p: Profile) => p.country], ["设备", (p: Profile) => p.device], ["系统", (p: Profile) => p.os], ["浏览器", (p: Profile) => p.browser], ["语言", (p: Profile) => p.lang], ["愿望方向", (p: Profile) => p.wish_category], ["引导方式", (p: Profile) => p.coach_mode]] as Array<[string, (p: Profile) => string | null]>).map(([title, pick]) => {
          const counts = profiles.reduce<Record<string, number>>((acc, item) => { const key = pick(item) || "未知"; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
          return <div key={title}><strong>{title}</strong>{Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, count]) => <span key={key}>{key} · {count}</span>)}</div>;
        })}</div>
        <p className="viewer-note">共 {profiles.length} 台设备 · 回访 {profiles.filter((p) => p.active_days > 1).length} 台（聊天超过 1 天）· 聊过天 {profiles.filter((p) => p.turns > 0).length} 台。只记录大致地区，不记录 IP。</p>
        <div className="viewer-table"><table><thead><tr><th>用户</th><th>地区</th><th>设备</th><th>语言</th><th>首次</th><th>最近</th><th>打开次数</th><th>聊天天数</th><th>对话轮数</th><th>👍/👎</th><th>愿望方向</th><th>引导方式</th></tr></thead><tbody>{profiles.map((item) => <tr key={item.user}><td>{item.user}</td><td>{[item.country, item.region, item.city].filter(Boolean).join(" · ") || "—"}</td><td>{[item.device, item.os, item.browser].filter(Boolean).join(" / ") || "—"}</td><td>{item.lang || "—"}</td><td>{when(item.first_seen_at)}</td><td>{when(item.last_seen_at)}</td><td>{item.visits}</td><td>{item.active_days}</td><td>{item.turns}</td><td>{item.helpful}/{item.missed}</td><td>{item.wish_category || "—"}</td><td>{item.coach_mode || "—"}</td></tr>)}</tbody></table></div>
      </>)}
    </>}
  </main>;
}
