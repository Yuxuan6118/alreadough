"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { readStored, writeStored } from "@/lib/safe-storage";
import "./beta.css";

type Snapshot = { day: string; enabled: boolean; totalUsers: number; activeToday: number; requestsToday: number; tokensToday: number; failedToday: number; feedbackCount: number; helpfulRate: number | null; ratingCount: number; averageChange: number | null; understoodAverage: number | null; returnIntentAverage: number | null; topFeature: string | null; globalLimits: { requests: number; tokens: number } };

const FOUNDER_KEY_STORAGE = "already-founder-key";

export default function FounderBetaPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("key")?.trim();
      if (fromUrl) {
        writeStored(FOUNDER_KEY_STORAGE, fromUrl);
        window.history.replaceState(null, "", window.location.pathname);
        setToken(fromUrl);
        return;
      }
    } catch { /* no URL / storage */ }
    setToken(readStored(FOUNDER_KEY_STORAGE) || "");
  }, []);

  const load = useCallback(() => {
    if (!token) return;
    fetch("/api/beta/admin", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error("这个访问密钥无效，或服务器还没有设置 BETA_FOUNDER_SECRET。"); return response.json() as Promise<Snapshot>; })
      .then((snapshot) => { setData(snapshot); setError(""); })
      .catch((reason) => setError(reason.message));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (!data || !token) return;
    const response = await fetch("/api/beta/admin", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ enabled: !data.enabled }) });
    if (response.ok) setData(await response.json() as Snapshot);
  };

  return <main className="beta-dashboard"><header><div><p>ALREADOUGH · FOUNDER BETA</p><h1>测试驾驶舱</h1><span>只看匿名效果与成本，不读取用户愿望或聊天内容。</span></div><Link href="/">返回 AlreaDough</Link></header>{token === null ? <p>正在验证访问权限…</p> : !token || error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error || "缺少访问密钥。"}</p><small>在 Cloudflare 里设置 BETA_FOUNDER_SECRET，然后访问 /beta?key=你的密钥 打开一次即可（密钥会保存在这台设备上）。</small></section> : !data ? <p>正在读取匿名数据…</p> : <><section className="beta-switch"><div><small>AI SERVICE</small><strong>{data.enabled ? "正在运行" : "已暂停"}</strong></div><button className={data.enabled ? "on" : ""} onClick={toggle}>{data.enabled ? "紧急暂停" : "恢复服务"}</button></section><section className="beta-grid"><article><small>今日活跃用户</small><strong>{data.activeToday}</strong><span>累计 {data.totalUsers}</span></article><article><small>今日 AI 请求</small><strong>{data.requestsToday}</strong><span>上限 {data.globalLimits.requests}</span></article><article><small>今日 Tokens</small><strong>{data.tokensToday.toLocaleString()}</strong><span>上限 {data.globalLimits.tokens.toLocaleString()}</span></article><article><small>单条回复懂我率</small><strong>{data.helpfulRate == null ? "—" : `${data.helpfulRate}%`}</strong><span>{data.feedbackCount} 次评价</span></article><article><small>10 分钟后稳定感变化</small><strong>{data.averageChange == null ? "—" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange}`}</strong><span>{data.ratingCount} 份问卷</span></article><article><small>被理解程度</small><strong>{data.understoodAverage == null ? "—" : `${data.understoodAverage}/5`}</strong><span>不否定愿望</span></article><article><small>再次打开意愿</small><strong>{data.returnIntentAverage == null ? "—" : `${data.returnIntentAverage}/5`}</strong><span>下次动摇时</span></article><article><small>最有帮助的功能</small><strong>{data.topFeature || "—"}</strong><span>10 分钟问卷</span></article><article><small>今日失败请求</small><strong>{data.failedToday}</strong><span>{data.day}</span></article></section><footer>这里不会显示用户昵称、愿望、人名、聊天原文、照片或音频。</footer></>}</main>;
}
