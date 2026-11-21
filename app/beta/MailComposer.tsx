"use client";

import { useEffect, useState } from "react";
import { readStored, writeStored } from "@/lib/safe-storage";

type Result = { recipients: number; delivered: number; failure: string | null; posted?: boolean };

const TEST_EMAIL_STORAGE = "already-founder-test-email";
const box = { maxWidth: 1180, margin: "20px auto", padding: 26, border: "1px solid #dfcfc0", borderRadius: 24, background: "#fffaf5" } as const;
const field = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 14px", border: "1px solid #dfcfc0", borderRadius: 14, background: "#fff", font: "inherit", color: "inherit" } as const;
const button = { border: "1px solid #ac6e6b", borderRadius: 999, padding: "12px 20px", color: "#fff", background: "#73504a", font: "inherit", cursor: "pointer" } as const;

/** The writing box: test send to one address, or send to everyone by email and/or the in-app inbox. Used on the mail page and in the cockpit. */
export default function MailComposer({ token, ready, subscribed, onSent }: { token: string; ready: boolean; subscribed: number; onSent: () => void }) {
  const [subject, setSubject] = useState("Hello World");
  const [body, setBody] = useState("Hello World");
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toEmail, setToEmail] = useState(true);
  const [toInbox, setToInbox] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the saved test address on mount */
  useEffect(() => { setTestEmail(readStored(TEST_EMAIL_STORAGE) || ""); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function send(audience: "test" | "all") {
    if (busy) return;
    if (audience === "all") {
      const parts = [toEmail ? `给 ${subscribed} 位订阅用户发邮件` : "", toInbox ? "放进所有人的站内信" : ""].filter(Boolean).join("，并");
      if (!window.confirm(`${parts}？邮件发出后无法撤回。`)) return;
    }
    setBusy(true);
    setNotice("");
    if (audience === "test") writeStored(TEST_EMAIL_STORAGE, testEmail.trim());
    try {
      const response = await fetch("/api/beta/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audience, subject, body, testEmail, confirmCount: subscribed, email: toEmail, inbox: toInbox }),
      });
      const data = await response.json().catch(() => ({})) as Partial<Result> & { error?: string };
      if (!response.ok) setNotice(data.error === "COUNT_MISMATCH" ? "订阅人数刚刚变了，页面已刷新，请再确认一次。" : `没有发出：${data.error || response.status}`);
      else if (data.failure) setNotice(`发出 ${data.delivered}/${data.recipients} 封后中断：${data.failure}`);
      else setNotice([audience === "test" || toEmail ? `邮件已发出 ${data.delivered} 封` : "", data.posted ? "已放进站内信" : ""].filter(Boolean).join("，") + "。");
    } catch { setNotice("网络中断，没有确认是否发出。"); }
    setBusy(false);
    onSent();
  }

  return <>
    {!ready && <section className="beta-error"><p>发信还没配置好：网站后台缺少 RESEND_API_KEY。</p></section>}
    <section style={box} id="mail-composer">
      <label><small>标题（可以不写）</small><input style={field} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></label>
      <label style={{ display: "block", marginTop: 18 }}><small>正文（可以不写）</small><textarea style={{ ...field, minHeight: 220, resize: "vertical" }} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 18 }}>
        <label style={{ flex: "1 1 260px" }}><small>测试收件地址</small><input style={field} type="email" value={testEmail} placeholder="先发给自己看看" onChange={(e) => setTestEmail(e.target.value)} /></label>
        <button style={button} disabled={busy || !ready || !testEmail.trim() || (!subject.trim() && !body.trim())} onClick={() => send("test")}>{busy ? "发送中…" : "只发给这个地址"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 22, paddingTop: 18, borderTop: "1px solid #eadccf" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={toEmail} onChange={(e) => setToEmail(e.target.checked)} />发邮件（{subscribed} 人）</label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={toInbox} onChange={(e) => setToInbox(e.target.checked)} />放进站内信（所有打开 App 的人）</label>
        <button style={{ ...button, background: "transparent", color: "#73504a" }} disabled={busy || (!subject.trim() && !body.trim()) || (!toEmail && !toInbox) || (toEmail && (!ready || subscribed === 0))} onClick={() => send("all")}>发给全部人</button>
      </div>
      {notice && <p style={{ marginTop: 16 }}>{notice}</p>}
    </section>
  </>;
}
