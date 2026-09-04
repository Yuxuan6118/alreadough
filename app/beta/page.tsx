"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./beta.css";

type Snapshot = { day: string; enabled: boolean; totalUsers: number; activeToday: number; requestsToday: number; tokensToday: number; failedToday: number; feedbackCount: number; helpfulRate: number | null; ratingCount: number; averageChange: number | null; understoodAverage: number | null; returnIntentAverage: number | null; topFeature: string | null; globalLimits: { requests: number; tokens: number } };

export default function FounderBetaPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const load = () => fetch("/api/beta/admin").then(async (response) => { if (!response.ok) throw new Error("Founder access is not configured for this account."); return response.json() as Promise<Snapshot>; }).then(setData).catch((reason) => setError(reason.message));
  useEffect(load, []);
  const toggle = async () => {
    if (!data) return;
    const response = await fetch("/api/beta/admin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !data.enabled }) });
    if (response.ok) setData(await response.json() as Snapshot);
  };
  return <main className="beta-dashboard"><header><div><p>ALREADY · FOUNDER BETA</p><h1>测试驾驶舱</h1><span>只看匿名效果与成本，不读取用户愿望或聊天内容。</span></div><Link href="/">返回 Already</Link></header>{error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error}</p><small>在托管环境中设置 BETA_FOUNDER_EMAIL 后，用同一个邮箱登录即可。</small></section> : !data ? <p>正在读取匿名数据…</p> : <><section className="beta-switch"><div><small>AI SERVICE</small><strong>{data.enabled ? "正在运行" : "已暂停"}</strong></div><button className={data.enabled ? "on" : ""} onClick={toggle}>{data.enabled ? "紧急暂停" : "恢复服务"}</button></section><section className="beta-grid"><article><small>今日活跃用户</small><strong>{data.activeToday}</strong><span>累计 {data.totalUsers}</span></article><article><small>今日 AI 请求</small><strong>{data.requestsToday}</strong><span>上限 {data.globalLimits.requests}</span></article><article><small>今日 Tokens</small><strong>{data.tokensToday.toLocaleString()}</strong><span>上限 {data.globalLimits.tokens.toLocaleString()}</span></article><article><small>单条回复懂我率</small><strong>{data.helpfulRate == null ? "—" : `${data.helpfulRate}%`}</strong><span>{data.feedbackCount} 次评价</span></article><article><small>10 分钟后稳定感变化</small><strong>{data.averageChange == null ? "—" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange}`}</strong><span>{data.ratingCount} 份问卷</span></article><article><small>被理解程度</small><strong>{data.understoodAverage == null ? "—" : `${data.understoodAverage}/5`}</strong><span>不否定愿望</span></article><article><small>再次打开意愿</small><strong>{data.returnIntentAverage == null ? "—" : `${data.returnIntentAverage}/5`}</strong><span>下次动摇时</span></article><article><small>最有帮助的功能</small><strong>{data.topFeature || "—"}</strong><span>10 分钟问卷</span></article><article><small>今日失败请求</small><strong>{data.failedToday}</strong><span>{data.day}</span></article></section><footer>这里不会显示用户昵称、愿望、人名、聊天原文、照片或音频。</footer></>}</main>;
}
