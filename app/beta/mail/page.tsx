"use client";

import { useCallback, useEffect, useState } from "react";
import { readStored } from "@/lib/safe-storage";
import FounderNav from "../FounderNav";
import MailComposer from "../MailComposer";
import "../beta.css";

type Send = { audience: string; subject: string; recipients: number; delivered: number; createdAt: number };
type Letter = { id: string; subject: string; body: string; createdAt: number };
type Stats = { ready: boolean; total: number; subscribed: number; sends: Send[]; letters: Letter[] };

const FOUNDER_KEY_STORAGE = "already-founder-key";
const box = { maxWidth: 1180, margin: "20px auto", padding: 26, border: "1px solid #dfcfc0", borderRadius: 24, background: "#fffaf5" } as const;
const button = { border: "1px solid #ac6e6b", borderRadius: 999, padding: "12px 20px", color: "#fff", background: "#73504a", font: "inherit", cursor: "pointer" } as const;

export default function FounderMailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the founder key from storage on mount */
  useEffect(() => {
    setToken(readStored(FOUNDER_KEY_STORAGE) || "");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const load = useCallback(() => {
    if (!token) return;
    fetch("/api/beta/mail", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error("无法验证访问权限。"); return response.json() as Promise<Stats>; })
      .then((data) => { setStats(data); setError(""); })
      .catch((reason) => setError(reason.message));
  }, [token]);
  useEffect(load, [load]);

  async function removeLetter(item: Letter) {
    if (!window.confirm(`从站内信撤下《${item.subject || item.body.slice(0, 20)}》？已经读过的人也看不到了。`)) return;
    await fetch(`/api/beta/mail?letter=${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    load();
  }

  return <main className="beta-dashboard">
    <header><div><p>ALREADOUGH · FOUNDER</p><h1>给用户写信</h1><span>从 hello@alreadough.com 发出，每封信底部都有退订链接。</span></div><FounderNav current="mail" /></header>
    {token === null ? <p>正在验证访问权限…</p> : !token || error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error || "请先打开一次带密钥的测试驾驶舱。"}</p></section> : !stats ? <p>正在读取…</p> : <>
      <section className="beta-grid">
        <article><small>可以收信</small><strong>{stats.subscribed}</strong><span>登录过并且没有退订</span></article>
        <article><small>已退订</small><strong>{stats.total - stats.subscribed}</strong><span>不会再收到群发</span></article>
        <article><small>发过的信</small><strong>{stats.sends.length}</strong><span>最近 20 次</span></article>
      </section>
      <MailComposer token={token} ready={stats.ready} subscribed={stats.subscribed} onSent={load} />
      {stats.letters.length > 0 && <section style={box}>
        <small>站内信</small>
        {stats.letters.map((item) => <p key={item.id} style={{ margin: "12px 0 0", display: "flex", gap: 12, alignItems: "center" }}><span style={{ flex: 1 }}>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })} · {item.subject || item.body.slice(0, 40)}</span><button style={{ ...button, padding: "6px 14px", background: "transparent", color: "#73504a" }} onClick={() => removeLetter(item)}>撤下</button></p>)}
      </section>}
      {stats.sends.length > 0 && <section style={box}>
        <small>发信记录</small>
        {stats.sends.map((item) => <p key={item.createdAt} style={{ margin: "12px 0 0" }}>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })} · {item.audience === "all" ? "全体" : "测试"} · {item.subject} · {item.delivered}/{item.recipients}</p>)}
      </section>}
    </>}
  </main>;
}
