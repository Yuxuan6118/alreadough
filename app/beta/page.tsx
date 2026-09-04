"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./beta.css";

type Slice = { label: string; count: number };
type Snapshot = {
  days: 1 | 7 | 30; enabled: boolean; totalUsers: number; activeUsers: number; activeSeconds: number;
  requests: number; tokens: number; failures: number; feedbackCount: number; helpfulRate: number | null;
  ratingCount: number; averageChange: number | null; understoodAverage: number | null;
  returnIntentAverage: number | null; topFeature: string | null;
  breakdown: { categories: Slice[]; coaches: Slice[]; languages: Slice[] };
  globalLimits: { requests: number; tokens: number };
};

const labels: Record<string, string> = { relationship: "关系", wealth: "金钱", self: "自我", lifestyle: "生活方式", other: "其他", release: "释放型", assumption: "假设型", subconscious: "潜意识型", zh: "中文", en: "英文", chat: "AI 对话", story: "故事", revision: "重写", audio: "声音练习", vision: "愿景板", unsure: "还不确定" };
const timeLabel = (seconds: number) => seconds < 3600 ? `${Math.round(seconds / 60)} 分钟` : `${(seconds / 3600).toFixed(1)} 小时`;

export default function FounderBetaPage() {
  const [days, setDays] = useState<1 | 7 | 30>(1);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => fetch(`/api/beta/admin?days=${days}`, { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Founder access is not configured for this account."); return response.json() as Promise<Snapshot>; }).then((snapshot) => { setData(snapshot); setError(""); }).catch((reason) => setError(reason.message)), [days]);
  useEffect(() => { void load(); }, [load]);
  const toggle = async () => {
    if (!data) return;
    const response = await fetch("/api/beta/admin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !data.enabled }) });
    if (response.ok) void load();
  };
  const breakdown = (title: string, items: Slice[]) => <article className="beta-breakdown"><small>{title}</small>{items.length ? <div>{items.map((item) => <span key={item.label}><b>{labels[item.label] || item.label}</b><i>{item.count}</i></span>)}</div> : <p>样本达到 3 次后显示</p>}</article>;
  return <main className="beta-dashboard"><header><div><p>ALREADOUGH · FOUNDER ONLY</p><h1>测试驾驶舱</h1><span>公开版用户看不到此页面。这里只显示匿名汇总，不读取用户愿望、聊天、照片或录音。</span></div><Link href="/">返回 AlreaDough</Link></header>{error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error}</p><small>请使用配置为创始人的同一个邮箱登录。</small><Link href="/signin-with-chatgpt?return_to=/beta">用创始人账号登录</Link></section> : !data ? <p>正在读取匿名数据…</p> : <><section className="beta-toolbar"><div className="range-tabs" aria-label="统计范围">{([1, 7, 30] as const).map((value) => <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value} 天</button>)}</div><button className="refresh" onClick={load}>刷新数据</button></section><section className="beta-switch"><div><small>AI SERVICE</small><strong>{data.enabled ? "正在运行" : "已暂停"}</strong></div><button className={data.enabled ? "on" : ""} onClick={toggle}>{data.enabled ? "紧急暂停" : "恢复服务"}</button></section><section className="beta-grid"><article><small>{days} 天活跃用户</small><strong>{data.activeUsers}</strong><span>累计注册 {data.totalUsers}</span></article><article><small>{days} 天有效使用时长</small><strong>{timeLabel(data.activeSeconds)}</strong><span>仅统计页面可见时间</span></article><article><small>{days} 天 AI 请求</small><strong>{data.requests}</strong><span>每日全站上限 {data.globalLimits.requests}</span></article><article><small>{days} 天 Tokens</small><strong>{data.tokens.toLocaleString()}</strong><span>每日全站上限 {data.globalLimits.tokens.toLocaleString()}</span></article><article><small>单条回复懂我率</small><strong>{data.helpfulRate == null ? "—" : `${data.helpfulRate}%`}</strong><span>{data.feedbackCount} 次评价</span></article><article><small>稳定感变化</small><strong>{data.averageChange == null ? "—" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange}`}</strong><span>{data.ratingCount} 份有效问卷</span></article><article><small>被理解程度</small><strong>{data.understoodAverage == null ? "—" : `${data.understoodAverage}/5`}</strong><span>不否定愿望</span></article><article><small>再次打开意愿</small><strong>{data.returnIntentAverage == null ? "—" : `${data.returnIntentAverage}/5`}</strong><span>下次动摇时</span></article><article><small>失败请求</small><strong>{data.failures}</strong><span>{days} 天范围</span></article></section><section className="beta-breakdown-grid">{breakdown("愿望类别", data.breakdown.categories)}{breakdown("Coach 使用", data.breakdown.coaches)}{breakdown("语言", data.breakdown.languages)}<article className="beta-breakdown"><small>最有帮助的功能</small><strong>{data.topFeature ? labels[data.topFeature] || data.topFeature : "—"}</strong><p>来自 10 分钟问卷</p></article></section><footer>为避免从小样本反推个人，分类统计少于 3 次时不会显示。没有个人排行榜，也没有原始内容查看入口。</footer></>}</main>;
}
