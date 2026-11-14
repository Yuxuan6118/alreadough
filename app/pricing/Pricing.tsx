"use client";

import { Check, CreditCard, LockKey, Sparkle, Wallet } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getDeviceSessionId, readDeviceSessionId } from "@/lib/device-session";
import SiteFooter from "../components/SiteFooter";
import "./pricing.css";

type Plan = "soft" | "deep" | "atelier";

// Feature differentiation here is by depth and breadth, never by a usage count —
// AlreaDough does not put a "times per day" cap on anyone, paid or not.
const plans = [
  { id: "soft" as const, zh: "轻揉", en: "Soft Start", monthly: { zh: 39, en: 5.99 }, zhCopy: "把一个愿望稳定地练进日常", enCopy: "A steady daily space for one desire", features: { zh: ["AI 陪伴对话、重写与故事", "基础愿景板", "声音练习工作台"], en: ["AI chat, Revision, and Stories", "Basic vision board", "Sound practice studio"] } },
  { id: "deep" as const, zh: "醒发", en: "Deep Practice", monthly: { zh: 88, en: 12.99 }, zhCopy: "给限制性信念更深的陪伴", enCopy: "Deeper support for persistent doubt", features: { zh: ["全部三种 Coach 方法与完整记忆", "多轨 Sub 导出", "高级愿景板"], en: ["All three Coach methods and full memory", "Multitrack Sub export", "Advanced vision board"] } },
  { id: "atelier" as const, zh: "丰盛工坊", en: "Dough Atelier", monthly: { zh: 168, en: 24.99 }, zhCopy: "高频使用与长篇沉浸创作", enCopy: "High-frequency use and immersive creation", features: { zh: ["长篇故事与优先生成速度", "工作室级 Sub 混音与愿景工具", "新功能优先体验"], en: ["Long-form stories and priority generation", "Studio-grade Sub mixing and vision tools", "Early access to new tools"] } },
];

export default function Pricing({ initialLang }: { initialLang: "zh" | "en" }) {
  const [lang, setLang] = useState(initialLang);
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<Plan>("deep");
  const [contact, setContact] = useState("");
  const [saved, setSaved] = useState(false);
  const [channel, setChannel] = useState<"reserve" | "stripe">("reserve");
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const plan = useMemo(() => plans.find((item) => item.id === selected) || plans[1], [selected]);
  const amount = annual ? Math.round(plan.monthly[lang] * 10 * 100) / 100 : plan.monthly[lang];
  const currency = lang === "zh" ? "¥" : "$";
  const deviceHeaders = (sessionId = readDeviceSessionId()): Record<string, string> => ({
    "Content-Type": "application/json",
    "x-already-session-id": sessionId,
  });
  const billing = annual ? "annual" : "monthly";

  useEffect(() => {
    // The iPhone app must not link out to a web checkout (App Store rules), so it only ever shows the reservation form.
    if (Capacitor.isNativePlatform()) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("paid")) setNotice("paid");
    fetch("/api/pay/status", { cache: "no-store", headers: deviceHeaders() })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { channel?: "reserve" | "stripe"; plan?: string | null; canManage?: boolean } | null) => {
        if (!data) return;
        if (data.channel === "stripe") setChannel("stripe");
        setActivePlan(data.plan || null);
        setCanManage(!!data.canManage);
      })
      .catch(() => {});
  }, []);

  const reserve = async () => {
    if (!contact.trim()) return;
    setNotice("");
    try {
      const response = await fetch("/api/pay/interest", { method: "POST", headers: deviceHeaders(getDeviceSessionId()), body: JSON.stringify({ plan: selected, billing, contact: contact.trim(), lang }) });
      if (!response.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setNotice("error");
    }
  };

  const goTo = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(path, { method: "POST", headers: deviceHeaders(), body: JSON.stringify(body) });
      const data = await response.json().catch(() => null) as { url?: string } | null;
      if (!response.ok || !data?.url) throw new Error("no url");
      window.location.assign(data.url);
    } catch {
      setNotice("error");
      setBusy(false);
    }
  };
  const checkout = (method: "card" | "wallet") => goTo("/api/pay/checkout", { plan: selected, billing, method, lang });
  const manage = () => goTo("/api/pay/portal", {});

  function switchLanguage() {
    const next = lang === "zh" ? "en" : "zh";
    const { search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `${next === "en" ? "/en/pricing" : "/pricing"}${search}${hash}`);
    setLang(next);
  }

  return <div lang={lang === "en" ? "en" : "zh-CN"}><main className="pricing-page">
    <nav><a href={lang === "en" ? "/en" : "/"}>Alrea<span>Dough</span></a><button type="button" lang={lang === "zh" ? "en" : "zh-CN"} onClick={switchLanguage}>{lang === "zh" ? "English" : "中文"}</button></nav>
    <header><p>{lang === "zh" ? "选择你的练习深度" : "Choose your practice depth"}</p><h1>{lang === "zh" ? "让陪伴跟着愿望一起醒发" : "Let support rise with your desire"}</h1><span>{lang === "zh" ? "以下是创始测试期的价格草案，今天不会扣款。" : "Founding-price preview. You will not be charged today."}</span><div className="billing-switch"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>{lang === "zh" ? "按月" : "Monthly"}</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>{lang === "zh" ? "按年，赠送两个月" : "Yearly, two months included"}</button></div></header>
    <section className="pricing-plans">{plans.map((item) => <button key={item.id} className={`${selected === item.id ? "selected" : ""} ${item.id === "deep" ? "recommended" : ""}`} onClick={() => setSelected(item.id)}>
      {item.id === "deep" && <small>{lang === "zh" ? "最适合深度练习" : "Best for deep practice"}</small>}
      <h2>{lang === "zh" ? item.zh : item.en}</h2><p>{lang === "zh" ? item.zhCopy : item.enCopy}</p>
      <strong>{currency}{annual ? Math.round(item.monthly[lang] * 10 * 100) / 100 : item.monthly[lang]}<i>/{annual ? (lang === "zh" ? "年" : "year") : (lang === "zh" ? "月" : "month")}</i></strong>
      <ul>{item.features[lang].map((feature) => <li key={feature}><Check weight="bold"/>{feature}</li>)}</ul>
    </button>)}</section>
    <section className="checkout-preview">
      {notice === "paid" && <p className="pay-notice" role="status">{lang === "zh" ? "付款成功，谢谢你。套餐会在几秒内生效，稍后回到应用就能看到。" : "Payment received, thank you. Your plan activates within seconds."}</p>}
      {activePlan && <p className="pay-notice" role="status">{lang === "zh" ? `你当前的套餐：${plans.find((item) => item.id === activePlan)?.zh || ""}` : `Your current plan: ${plans.find((item) => item.id === activePlan)?.en || ""}`}{canManage && <button className="pay-link" onClick={manage} disabled={busy}>{lang === "zh" ? "管理订阅 / 取消" : "Manage or cancel"}</button>}</p>}
      <div><Sparkle/><h2>{channel === "stripe" ? (lang === "zh" ? `选择「${plan.zh}」` : `Choose ${plan.en}`) : (lang === "zh" ? `预留「${plan.zh}」` : `Reserve ${plan.en}`)}</h2><p>{channel === "stripe" ? (lang === "zh" ? "付款页由 Stripe 提供，我们不会接触你的银行卡号。" : "Checkout is hosted by Stripe. We never see your card number.") : (lang === "zh" ? "正式收费前会再次显示价格、额度、续费与退款信息，由你确认后才会付款。" : "Before launch, you will review price, allowances, renewal, and refunds before any payment.")}</p></div>
      <aside><dl><div><dt>{lang === "zh" ? "套餐" : "Plan"}</dt><dd>{lang === "zh" ? plan.zh : plan.en}</dd></div><div><dt>{lang === "zh" ? "周期" : "Billing"}</dt><dd>{annual ? (lang === "zh" ? "每年" : "Yearly") : (lang === "zh" ? "每月" : "Monthly")}</dd></div><div><dt>{lang === "zh" ? "预计合计" : "Estimated total"}</dt><dd>{currency}{amount}</dd></div></dl>
        {channel === "stripe" ? <>
          <button onClick={() => checkout("card")} disabled={busy}>{lang === "zh" ? "银行卡订阅（Visa 等，自动续费）" : "Subscribe with card (auto-renews)"}</button>
          {lang === "zh" && <button onClick={() => checkout("wallet")} disabled={busy}>支付宝 / 微信支付（一次性，¥{amount}）</button>}
          <small><LockKey/>{lang === "zh" ? "银行卡按月或按年自动扣款，可随时在“管理订阅”里取消。支付宝和微信是一次性购买，到期前需要你再购买一次。" : "Cards renew automatically and can be canceled any time under Manage. Alipay and WeChat Pay are one-time purchases."}</small>
        </> : <>
          <fieldset className="pending-payment-methods">
            <legend>{lang === "zh" ? "付款方式" : "Payment methods"}</legend>
            <button type="button" disabled>
              <Wallet aria-hidden="true" />
              <strong>{lang === "zh" ? "支付宝" : "Alipay"}</strong>
              <span className="payment-review-status">{lang === "zh" ? "审核中" : "Under review"}</span>
            </button>
            <button type="button" disabled>
              <CreditCard aria-hidden="true" />
              <strong>{lang === "zh" ? "国际银行卡" : "International cards"}</strong>
              <span className="payment-review-status">{lang === "zh" ? "审核中" : "Under review"}</span>
            </button>
          </fieldset>
          <label><span>{lang === "zh" ? "接收开放通知的邮箱或微信号" : "Email or WeChat for the launch notice"}</span><input type="text" value={contact} onChange={(event) => { setContact(event.target.value); setSaved(false); }} placeholder={lang === "zh" ? "you@example.com 或 微信号" : "you@example.com"}/></label>
          <button onClick={reserve} disabled={!contact.trim()}>{saved ? (lang === "zh" ? "已为你保留" : "Reserved") : (lang === "zh" ? "保留创始价格" : "Reserve founding price")}</button>
          <small><LockKey/>{lang === "zh" ? "当前不收款，也不收集银行卡。我们只记录你想要的套餐和你留下的联系方式。" : "No payment is taken and no card details are collected. We only keep the plan you chose and the contact you leave."}</small>
        </>}
        {notice === "error" && <small role="alert">{lang === "zh" ? "没有成功，请稍后再试。" : "That did not work. Please try again shortly."}</small>}
      </aside>
    </section>
  </main><SiteFooter lang={lang} /></div>;
}
