"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { readStored, removeStored, writeStored } from "@/lib/safe-storage";
import type { FounderOverview } from "@/lib/founder-overview";
import FounderNav from "./FounderNav";
import MailComposer from "./MailComposer";
import "./beta.css";

type Snapshot = { day: string; enabled: boolean; totalUsers: number; activeToday: number; requestsToday: number; tokensToday: number; failedToday: number; feedbackCount: number; helpfulRate: number | null; ratingCount: number; averageChange: number | null; understoodAverage: number | null; returnIntentAverage: number | null; topFeature: string | null; globalLimits: { requests: number; tokens: number } };

const FOUNDER_KEY_STORAGE = "already-founder-key";
// A real key is plain ASCII. Chinese text here means the example placeholder was typed in literally.
const validKey = (value: string) => /^[\x21-\x7E]{6,200}$/.test(value);
const BAD_KEY = "访问凭据格式有误。";

export default function FounderBetaPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [overview, setOverview] = useState<FounderOverview | null>(null);
  const [loadedAt, setLoadedAt] = useState("");
  const [mailState, setMailState] = useState<{ ready: boolean; subscribed: number } | null>(null);
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
    fetch("/api/beta/admin", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("无法验证访问权限。"); return response.json() as Promise<Snapshot>; })
      .then((snapshot) => { setData(snapshot); setError(""); })
      .catch((reason) => setError(reason.message));
    fetch("/api/beta/admin?view=overview", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<FounderOverview> : null)
      .then((next) => { if (next) setOverview(next); setLoadedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })); })
      .catch(() => undefined);
    // the writing box needs to know whether mail is set up and how many people a mass mailing reaches
    fetch("/api/beta/mail", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ ready: boolean; subscribed: number }> : null)
      .then((next) => { if (next) setMailState({ ready: next.ready, subscribed: next.subscribed }); })
      .catch(() => undefined);
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

  return <main className="beta-dashboard">
    <header><div><p>ALREADOUGH · FOUNDER BETA</p><h1>测试驾驶舱</h1>{data && <span>汇总数字只显示匿名效果与成本；聊天记录在单独的页面查看。</span>}</div>
      <FounderNav current="cockpit" badges={{ chats: overview?.reportsNew }}>{token ? <button onClick={load}>刷新{loadedAt ? ` · ${loadedAt}` : ""}</button> : null}</FounderNav></header>
    {token === null ? <p>正在验证访问权限…</p> : !token || error ? <section className="beta-error"><h2>还没有创始人访问权限</h2><p>{error || "缺少访问密钥。"}</p><small>此页面限授权访问。</small></section> : !data ? <p>正在读取匿名数据…</p> : <>
      <section className="beta-switch"><div><small>AI SERVICE</small><strong>{data.enabled ? "正在运行" : "已暂停"}</strong></div><button className={data.enabled ? "on" : ""} onClick={toggle}>{data.enabled ? "紧急暂停" : "恢复服务"}</button></section>
      <h2 className="beta-section">今天</h2>
      <section className="beta-grid"><article><small>今日活跃用户</small><strong>{data.activeToday}</strong><span>累计 {data.totalUsers}</span></article><article><small>今日 AI 请求</small><strong>{data.requestsToday}</strong><span>上限 {data.globalLimits.requests}</span></article><article><small>今日 Tokens</small><strong>{data.tokensToday.toLocaleString()}</strong><span>上限 {data.globalLimits.tokens.toLocaleString()}</span></article><article><small>单条回复懂我率</small><strong>{data.helpfulRate == null ? "—" : `${data.helpfulRate}%`}</strong><span>{data.feedbackCount} 次评价</span></article><article><small>10 分钟后稳定感变化</small><strong>{data.averageChange == null ? "—" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange}`}</strong><span>{data.ratingCount} 份问卷</span></article><article><small>被理解程度</small><strong>{data.understoodAverage == null ? "—" : `${data.understoodAverage}/5`}</strong><span>不否定愿望</span></article><article><small>再次打开意愿</small><strong>{data.returnIntentAverage == null ? "—" : `${data.returnIntentAverage}/5`}</strong><span>下次动摇时</span></article><article><small>最有帮助的功能</small><strong>{data.topFeature || "—"}</strong><span>10 分钟问卷</span></article><article><small>今日失败请求</small><strong>{data.failedToday}</strong><span>{data.day}</span></article></section>
      {overview ? <Overview data={overview} composer={token && mailState ? <MailComposer token={token} ready={mailState.ready} subscribed={mailState.subscribed} onSent={load} /> : null} /> : <p className="beta-note">正在读取会员、功能和趋势…</p>}
      <footer>这个汇总面板不显示昵称、愿望、聊天原文、照片或音频。<a href="/beta/chats" style={{ marginLeft: 12, textDecoration: "underline" }}>查看对话记录</a><button onClick={exportConversations} style={{ marginLeft: 12 }}>导出内测对话样本 (JSONL)</button></footer>
    </>}
  </main>;
}

const FEATURE_LABELS: Record<string, string> = { chat: "陪伴对话", revision: "转念改写", story: "剧本故事", affirm: "睡前肯定语", persona: "TA 对话", persona_import: "TA 资料导入", persona_screenshots: "TA 截图识别", onboarding: "首次引导回复" };
const TOOL_LABELS: Record<string, string> = { image_search: "愿景板图片搜索", sound_search: "环境声搜索", subliminal_record: "潜意识录音（录完一段）", subliminal_upload: "潜意识上传音频", subliminal_play: "潜意识开始播放", subliminal_export: "潜意识导出混音" };
const TOOL_ORDER = ["image_search", "subliminal_record", "subliminal_play", "subliminal_upload", "subliminal_export", "sound_search"];
const PLAN_LABELS: Record<string, string> = { deep: "Celadon", atelier: "Porcelain", screenshots: "截图识别 1 次" };
const yuan = (fen: number) => `¥${(fen / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
const short = (ms: number) => new Date(ms).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const pct = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : "—";

type TrendField = "active" | "newUsers" | "requests" | "tokens" | "failed";

function Bars({ title, rows, field, accent }: { title: string; rows: FounderOverview["trend"]; field: TrendField; accent?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row[field]));
  const total = rows.reduce((sum, row) => sum + row[field], 0);
  return <article className="beta-chart"><div className="beta-chart-head"><small>{title}</small><span>14 天合计 {total.toLocaleString()}</span></div>
    <div className="beta-bars">{rows.map((row) => <i key={row.day} className={accent ? "accent" : ""} style={{ height: `${Math.max(row[field] ? 6 : 2, row[field] / max * 100)}%` }} title={`${row.day}：${row[field].toLocaleString()}`}>{row[field] ? <em>{row[field]}</em> : null}</i>)}</div>
    <div className="beta-axis"><span>{rows[0]?.day.slice(5)}</span><span>今天</span></div></article>;
}

function List({ title, rows }: { title: string; rows: Array<{ label: string; n: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return <article><small>{title}</small><ul className="beta-list">{rows.length ? rows.map((row) => <li key={row.label}><span>{row.label}</span><i><s style={{ width: pct(row.n, total) }} /></i><b>{row.n}</b></li>) : <li><span>还没有数据</span></li>}</ul></article>;
}

function Overview({ data, composer }: { data: FounderOverview; composer: ReactNode }) {
  const { members, revenue, voice, content, audience, mail } = data;
  const featureCalls = data.features.reduce((sum, row) => sum + row.calls, 0);
  return <>
    <h2 className="beta-section">近 14 天</h2>
    <section className="beta-charts"><Bars title="活跃用户（用过 AI）" rows={data.trend} field="active" /><Bars title="新访客" rows={data.trend} field="newUsers" accent /><Bars title="AI 请求" rows={data.trend} field="requests" /><Bars title="失败请求" rows={data.trend} field="failed" accent /></section>

    <h2 className="beta-section">会员与收入</h2>
    <section className="beta-grid"><article><small>付费会员（有效中）</small><strong>{members.paidActive}</strong><span>Deep {members.deep} · Atelier {members.atelier}</span></article><article><small>累计收入（已付款）</small><strong>{yuan(revenue.paidFen)}</strong><span>{revenue.paidOrders} 单 · {revenue.buyers} 位付款人</span></article><article><small>近 7 天收入</small><strong>{yuan(revenue.paidFen7)}</strong><span>{revenue.paidOrders7} 单 · 下单未付 {revenue.pending7}</span></article><article><small>注册账号</small><strong>{members.accounts}</strong><span>近 7 天新增 {members.newAccounts7}</span></article><article><small>试用中</small><strong>{members.trial}</strong><span>注册→付费 {pct(revenue.buyers, members.accounts)}</span></article><article><small>邀请码兑换</small><strong>{members.referrals}</strong><span>近 7 天 {members.referrals7} · 预约意向 {members.interest}</span></article></section>
    <section className="beta-table"><small>最近订单</small>{revenue.recent.length ? <div className="beta-scroll"><table><thead><tr><th>下单时间</th><th>方案</th><th>金额</th><th>状态</th><th>付款时间</th><th>流水尾号</th></tr></thead><tbody>{revenue.recent.map((row, index) => <tr key={`${row.createdAtMs}-${index}`} className={row.status === "paid" ? "paid" : ""}><td>{short(row.createdAtMs)}</td><td>{PLAN_LABELS[row.plan] || row.plan}</td><td>{yuan(row.amountFen)}</td><td>{row.status === "paid" ? "已付款" : row.status === "pending" ? "未付款" : row.status}</td><td>{row.paidAtMs ? short(row.paidAtMs) : "—"}</td><td>{row.tradeNo || "—"}</td></tr>)}</tbody></table></div> : <p>还没有订单。</p>}<span>金额按人民币标价记；Waffo 卡付实际以美元结算。</span></section>

    <h2 className="beta-section">功能使用 · 近 7 天</h2>
    <section className="beta-table"><small>每个 AI 功能</small>{data.features.length ? <div className="beta-scroll"><table><thead><tr><th>功能</th><th>调用</th><th>占比</th><th>使用人数</th><th>Tokens</th><th>平均耗时</th><th>无结果</th></tr></thead><tbody>{data.features.map((row) => <tr key={row.feature}><td>{FEATURE_LABELS[row.feature] || row.feature}</td><td>{row.calls}</td><td>{pct(row.calls, featureCalls)}</td><td>{row.users}</td><td>{(row.tokens || 0).toLocaleString()}</td><td>{row.latency ? `${(row.latency / 1000).toFixed(1)} 秒` : "—"}</td><td>{row.failed}</td></tr>)}</tbody></table></div> : <p>近 7 天还没有 AI 调用。</p>}<span>TA 对话、睡前肯定语、首次引导从这次升级起单独计数，之前的调用算在「陪伴对话」里。</span></section>
    <section className="beta-table"><small>图片搜索与潜意识工具</small><div className="beta-scroll"><table><thead><tr><th>功能</th><th>近 7 天次数</th><th>近 7 天人数</th><th>今天</th><th>累计次数</th><th>累计人数</th></tr></thead><tbody>{TOOL_ORDER.concat(data.tools.map((row) => row.feature).filter((name) => !TOOL_ORDER.includes(name))).map((name) => { const row = data.tools.find((item) => item.feature === name); return <tr key={name} className={row?.uses ? "paid" : ""}><td>{TOOL_LABELS[name] || name}</td><td>{row?.uses || 0}</td><td>{row?.users || 0}</td><td>{row?.today || 0}</td><td>{row?.usesAll || 0}</td><td>{row?.usersAll || 0}</td></tr>; })}</tbody></table></div><span>从这次升级起开始计数。录音和音频只留在用户自己的设备上，这里只记次数。</span></section>
    <section className="beta-grid"><article><small>克隆声音</small><strong>{voice.cloned}</strong><span>近 7 天新录 {voice.cloned7} · 录制尝试 {voice.enrolls7}</span></article><article><small>用自己的声音朗读 · 7 天</small><strong>{voice.speaks7}</strong><span>{voice.users7} 人 · {voice.chars7.toLocaleString()} 字</span></article><article><small>今日朗读字数</small><strong>{voice.charsToday.toLocaleString()}</strong><span>全站合计</span></article></section>

    <h2 className="beta-section">用户留下的内容</h2>
    <section className="beta-grid"><article><small>云端同步空间</small><strong>{content.total}</strong><span>近 7 天有更新 {content.active7} · 愿望 {content.goals}</span></article><article><small>愿景板</small><strong>{content.boardItems}</strong><span>{content.withBoard} 人在用（{pct(content.withBoard, content.total)}）</span></article><article><small>剧本库</small><strong>{content.stories}</strong><span>{content.withStories} 人存了剧本（{pct(content.withStories, content.total)}）</span></article><article><small>练习打卡</small><strong>{content.checkIns}</strong><span>{content.withCheckIns} 人打过卡（{pct(content.withCheckIns, content.total)}）</span></article><article><small>转念记录</small><strong>{content.revisions}</strong><span>{content.withRevisions} 人改写过（{pct(content.withRevisions, content.total)}）</span></article><article><small>聊过天的空间</small><strong>{content.withChats}</strong><span>占同步用户 {pct(content.withChats, content.total)}</span></article></section>

    <h2 className="beta-section">邮件与来信</h2>
    <section className="beta-grid"><article><small>邮件订阅</small><strong>{mail.subscribed}</strong><span>共 {mail.contacts} 个邮箱 · {mail.linked} 个已绑定账号</span></article><a className="beta-card-link" href="/beta/mail"><small>上一封群发邮件</small><strong className="beta-small-strong">{mail.last ? mail.last.subject : "—"}</strong><span>{mail.last ? `${short(mail.last.createdAt)} · 送达 ${mail.last.delivered}/${mail.last.recipients}` : "还没有发过"}</span><em>查看发信记录 →</em></a><a className="beta-card-link" href="/beta/mail"><small>站内来信</small><strong>{mail.letters}</strong><span>{mail.lastLetter ? `最新：${mail.lastLetter.subject || "（无标题）"} · ${short(mail.lastLetter.createdAt)}` : "还没有发过站内信"}</span><em>管理来信 →</em></a></section>
    {composer}
    <section className="beta-charts"><div className="beta-table"><small>最近发信</small>{mail.sends.length ? <div className="beta-scroll"><table><thead><tr><th>时间</th><th>类型</th><th>标题</th><th>送达</th></tr></thead><tbody>{mail.sends.map((row, index) => <tr key={`${row.createdAt}-${index}`} className={row.audience === "all" ? "paid" : ""}><td>{short(row.createdAt)}</td><td>{row.audience === "all" ? "群发" : "测试"}</td><td>{row.subject}</td><td>{row.delivered}/{row.recipients}</td></tr>)}</tbody></table></div> : <p>还没有发过信。</p>}</div><div className="beta-table"><small>站内来信</small>{mail.letterList.length ? <div className="beta-scroll"><table><thead><tr><th>时间</th><th>标题</th></tr></thead><tbody>{mail.letterList.map((row, index) => <tr key={`${row.createdAt}-${index}`} className="paid"><td>{short(row.createdAt)}</td><td>{row.subject || "（无标题）"}</td></tr>)}</tbody></table></div> : <p>还没有站内来信。</p>}</div></section>

    <h2 className="beta-section">页面崩溃 · 近 7 天 {data.crashes.last7}</h2>
    <section className="beta-table"><small>最近的崩溃</small>{data.crashes.recent.length ? <div className="beta-scroll"><table><thead><tr><th>时间</th><th>错误</th><th>页面</th><th>设备</th></tr></thead><tbody>{data.crashes.recent.map((row) => <tr key={`${row.createdAt}-${row.message}`}><td>{short(row.createdAt)}</td><td>{row.message}</td><td>{row.path || "—"}</td><td>{[row.device, row.os, row.browser].filter(Boolean).join(" · ")}</td></tr>)}</tbody></table></div> : <p className="beta-note">还没有收到崩溃报告。</p>}</section>

    <h2 className="beta-section">用户从哪里来</h2>
    <section className="beta-grid"><article><small>近 7 天访客</small><strong>{audience.visitors7}</strong><span>其中新访客 {audience.new7}</span></article><List title="国家 / 地区" rows={audience.countries} /><List title="设备" rows={audience.devices} /><List title="语言" rows={audience.langs} /></section>
  </>;
}
