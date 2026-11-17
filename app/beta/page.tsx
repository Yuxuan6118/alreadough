"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { readStored, removeStored, writeStored } from "@/lib/safe-storage";
import "./beta.css";

type Snapshot = { day: string; enabled: boolean; totalUsers: number; activeToday: number; requestsToday: number; tokensToday: number; failedToday: number; feedbackCount: number; helpfulRate: number | null; ratingCount: number; averageChange: number | null; understoodAverage: number | null; returnIntentAverage: number | null; topFeature: string | null; globalLimits: { requests: number; tokens: number } };

const FOUNDER_KEY_STORAGE = "already-founder-key";
// A real key is plain ASCII. Chinese text here means the example placeholder was typed in literally.
const validKey = (value: string) => /^[\x21-\x7E]{6,200}$/.test(value);
const BAD_KEY = "访问凭据格式有误。";

export default function FounderBetaPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the founder key from URL/storage on mount */
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("key")?.trim();
      if (fromUrl) {
        window.history.replaceState(null, "", window.location.pathname);
        if (!validKey(fromUrl)) { removeStored(FOUNDER_KEY_STORAGE); setError(BAD_KEY); setToken(""); return; }
        writeStored(FOUNDER_KEY_STORAGE, fromUrl);
        setToken(fromUrl);
        return;
      }
    } catch { /* no URL / storage */ }
    const saved = readStored(FOUNDER_KEY_STORAGE) || "";
    if (saved && !validKey(saved)) { removeStored(FOUNDER_KEY_STORAGE); setError(BAD_KEY); setToken(""); return; }
    setToken(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const load = useCallback(() => {
    if (!token) return;
    fetch("/api/beta/admin", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error("无法验证访问权限。"); return response.json() as Promise<Snapshot>; })
      .then((snapshot) => { setData(snapshot); setError(""); })
      .catch((reason) => setError(reason.message));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const exportConversations = async () => {
    if (!token) return;
    const response = await fetch("/api/beta/admin?export=conversations", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `alreadough-conversations-${new Date().toISOString().slice(0, 10)}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggle = async () => {
    if (!data || !token) return;
    const response = await fetch("/api/beta/admin", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled: !data.enabled }) });
    if (response.ok) setData(await response.json() as Snapshot);
  };

  return <main className="beta-dashboard"><header><div><p>ALREADOUGH · FOUNDER BETA</p><h1>测试驾驶舱</h1>{data && <span>汇总数字只显示匿名效果与成本；聊天记录在单独的页面查看。</span>}</div><Link href="/">返回 AlreaDough</Link></header>{token === null ? <p>正在验证访问权限…</p> : !token || error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error || "缺少访问密钥。"}</p><small>此页面限授权访问。</small></section> : !data ? <p>正在读取匿名数据…</p> : <><section className="beta-switch"><div><small>AI SERVICE</small><strong>{data.enabled ? "正在运行" : "已暂停"}</strong></div><button className={data.enabled ? "on" : ""} onClick={toggle}>{data.enabled ? "紧急暂停" : "恢复服务"}</button></section><section className="beta-grid"><article><small>今日活跃用户</small><strong>{data.activeToday}</strong><span>累计 {data.totalUsers}</span></article><article><small>今日 AI 请求</small><strong>{data.requestsToday}</strong><span>上限 {data.globalLimits.requests}</span></article><article><small>今日 Tokens</small><strong>{data.tokensToday.toLocaleString()}</strong><span>上限 {data.globalLimits.tokens.toLocaleString()}</span></article><article><small>单条回复懂我率</small><strong>{data.helpfulRate == null ? "—" : `${data.helpfulRate}%`}</strong><span>{data.feedbackCount} 次评价</span></article><article><small>10 分钟后稳定感变化</small><strong>{data.averageChange == null ? "—" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange}`}</strong><span>{data.ratingCount} 份问卷</span></article><article><small>被理解程度</small><strong>{data.understoodAverage == null ? "—" : `${data.understoodAverage}/5`}</strong><span>不否定愿望</span></article><article><small>再次打开意愿</small><strong>{data.returnIntentAverage == null ? "—" : `${data.returnIntentAverage}/5`}</strong><span>下次动摇时</span></article><article><small>最有帮助的功能</small><strong>{data.topFeature || "—"}</strong><span>10 分钟问卷</span></article><article><small>今日失败请求</small><strong>{data.failedToday}</strong><span>{data.day}</span></article></section><footer>这个汇总面板不显示昵称、愿望、聊天原文、照片或音频。<a href="/beta/chats" style={{ marginLeft: 12, textDecoration: "underline" }}>查看对话记录</a><button onClick={exportConversations} style={{ marginLeft: 12 }}>导出内测对话样本 (JSONL)</button></footer></>}</main>;
}
