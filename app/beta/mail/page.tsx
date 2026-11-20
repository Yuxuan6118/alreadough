"use client";

import { useCallback, useEffect, useState } from "react";
import { readStored, writeStored } from "@/lib/safe-storage";
import FounderNav from "../FounderNav";
import "../beta.css";

type Send = { audience: string; subject: string; recipients: number; delivered: number; createdAt: number };
type Letter = { id: string; subject: string; body: string; createdAt: number };
type Stats = { ready: boolean; total: number; subscribed: number; sends: Send[]; letters: Letter[] };
type Result = { recipients: number; delivered: number; failure: string | null; posted?: boolean };

const FOUNDER_KEY_STORAGE = "already-founder-key";
const TEST_EMAIL_STORAGE = "already-founder-test-email";
const box = { maxWidth: 1180, margin: "20px auto", padding: 26, border: "1px solid #dfcfc0", borderRadius: 24, background: "#fffaf5" } as const;
const field = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 14px", border: "1px solid #dfcfc0", borderRadius: 14, background: "#fff", font: "inherit", color: "inherit" } as const;
const button = { border: "1px solid #ac6e6b", borderRadius: 999, padding: "12px 20px", color: "#fff", background: "#73504a", font: "inherit", cursor: "pointer" } as const;

export default function FounderMailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("Hello World");
  const [body, setBody] = useState("Hello World");
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toEmail, setToEmail] = useState(true);
  const [toInbox, setToInbox] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the founder key from storage on mount */
  useEffect(() => {
    setToken(readStored(FOUNDER_KEY_STORAGE) || "");
    setTestEmail(readStored(TEST_EMAIL_STORAGE) || "");
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

  async function send(audience: "test" | "all") {
    if (!stats || busy) return;
    if (audience === "all") {
      const parts = [toEmail ? `给 ${stats.subscribed} 位订阅用户发邮件` : "", toInbox ? "放进所有人的站内信" : ""].filter(Boolean).join("，并");
      if (!window.confirm(`${parts}？邮件发出后无法撤回。`)) return;
    }
    setBusy(true);
    setNotice("");
    if (audience === "test") writeStored(TEST_EMAIL_STORAGE, testEmail.trim());
    try {
      const response = await fetch("/api/beta/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audience, subject, body, testEmail, confirmCount: stats.subscribed, email: toEmail, inbox: toInbox }),
      });
      const data = await response.json().catch(() => ({})) as Partial<Result> & { error?: string };
      if (!response.ok) setNotice(data.error === "COUNT_MISMATCH" ? "订阅人数刚刚变了，页面已刷新，请再确认一次。" : `没有发出：${data.error || response.status}`);
      else if (data.failure) setNotice(`发出 ${data.delivered}/${data.recipients} 封后中断：${data.failure}`);
      else setNotice([audience === "test" || toEmail ? `邮件已发出 ${data.delivered} 封` : "", data.posted ? "已放进站内信" : ""].filter(Boolean).join("，") + "。");
    } catch { setNotice("网络中断，没有确认是否发出。"); }
    setBusy(false);
    load();
  }

  async function removeLetter(item: Letter) {
    if (!window.confirm(`从站内信撤下《${item.subject || item.body.slice(0, 20)}》？已经读过的人也看不到了。`)) return;
    await fetch(`/api/beta/mail?letter=${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    load();
  }

  return <main className="beta-dashboard">
    <header><div><p>ALREADOUGH · FOUNDER</p><h1>给用户写信</h1><span>从 hello@alreadough.com 发出，每封信底部都有退订链接。</span></div><FounderNav current="mail" /></header>
    {token === null ? <p>正在验证访问权限…</p> : !token || error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error || "请先打开一次带密钥的测试驾驶舱。"}</p></section> : !stats ? <p>正在读取…</p> : <>
      {!stats.ready && <section className="beta-error"><p>发信还没配置好：网站后台缺少 RESEND_API_KEY。</p></section>}
      <section className="beta-grid">
        <article><small>可以收信</small><strong>{stats.subscribed}</strong><span>登录过并且没有退订</span></article>
        <article><small>已退订</small><strong>{stats.total - stats.subscribed}</strong><span>不会再收到群发</span></article>
        <article><small>发过的信</small><strong>{stats.sends.length}</strong><span>最近 20 次</span></article>
      </section>
      <section style={box}>
        <label><small>标题（可以不写）</small><input style={field} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
        <label style={{ display: "block", marginTop: 18 }}><small>正文（可以不写）</small><textarea style={{ ...field, minHeight: 220, resize: "vertical" }} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 18 }}>
          <label style={{ flex: "1 1 260px" }}><small>测试收件地址</small><input style={field} type="email" value={testEmail} placeholder="先发给自己看看" onChange={(e) => setTestEmail(e.target.value)} /></label>
          <button style={button} disabled={busy || !stats.ready || !testEmail.trim() || (!subject.trim() && !body.trim())} onClick={() => send("test")}>{busy ? "发送中…" : "只发给这个地址"}</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 22, paddingTop: 18, borderTop: "1px solid #eadccf" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={toEmail} onChange={(e) => setToEmail(e.target.checked)} />发邮件（{stats.subscribed} 人）</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={toInbox} onChange={(e) => setToInbox(e.target.checked)} />放进站内信（所有打开 App 的人）</label>
          <button style={{ ...button, background: "transparent", color: "#73504a" }} disabled={busy || (!subject.trim() && !body.trim()) || (!toEmail && !toInbox) || (toEmail && (!stats.ready || stats.subscribed === 0))} onClick={() => send("all")}>发给全部人</button>
        </div>
        {notice && <p style={{ marginTop: 16 }}>{notice}</p>}
      </section>
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
