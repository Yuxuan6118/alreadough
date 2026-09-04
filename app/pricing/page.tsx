"use client";

import Link from "next/link";
import { Check, LockKey, Sparkle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import "./pricing.css";

type Plan = "soft" | "deep" | "atelier";

const plans = [
  { id: "soft" as const, zh: "轻揉", en: "Soft Start", monthly: { zh: 39, en: 5.99 }, zhCopy: "把一个愿望稳定地练进日常", enCopy: "A steady daily space for one desire", features: { zh: ["每日 10 次 AI 对话", "故事、重写与基础愿景板", "1 个声音练习"], en: ["10 AI conversations daily", "Stories, Revision, and vision board", "1 saved sound practice"] } },
  { id: "deep" as const, zh: "醒发", en: "Deep Practice", monthly: { zh: 88, en: 12.99 }, zhCopy: "给限制性信念更深的陪伴", enCopy: "Deeper support for persistent doubt", features: { zh: ["每日 40 次 AI 对话", "全部 Coach 与完整记忆", "多轨 Sub 导出和高级愿景板"], en: ["40 AI conversations daily", "Every Coach and full memory", "Multitrack Sub export and advanced boards"] } },
  { id: "atelier" as const, zh: "丰盛工坊", en: "Dough Atelier", monthly: { zh: 168, en: 24.99 }, zhCopy: "高频使用与长篇沉浸创作", enCopy: "High-frequency use and immersive creation", features: { zh: ["更高对话与创作额度", "长篇故事和优先生成", "新功能优先体验"], en: ["Higher conversation and creation limits", "Long-form stories and priority generation", "Early access to new tools"] } },
];

export default function PricingPage() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState<Plan>("deep");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const plan = useMemo(() => plans.find((item) => item.id === selected) || plans[1], [selected]);
  const amount = annual ? Math.round(plan.monthly[lang] * 10 * 100) / 100 : plan.monthly[lang];
  const currency = lang === "zh" ? "¥" : "$";

  const reserve = () => {
    if (!email.trim()) return;
    localStorage.setItem("alreadough-pricing-interest-v1", JSON.stringify({ email: email.trim(), plan: selected, annual, savedAt: new Date().toISOString() }));
    setSaved(true);
  };

  return <main className="pricing-page">
    <nav><Link href="/">Alrea<span>Dough</span></Link><button onClick={() => setLang((value) => value === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button></nav>
    <header><p>{lang === "zh" ? "选择你的练习深度" : "Choose your practice depth"}</p><h1>{lang === "zh" ? "让陪伴跟着愿望一起醒发" : "Let support rise with your desire"}</h1><span>{lang === "zh" ? "以下是创始测试期的价格草案，今天不会扣款。" : "Founding-price preview. You will not be charged today."}</span><div className="billing-switch"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>{lang === "zh" ? "按月" : "Monthly"}</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>{lang === "zh" ? "按年，赠送两个月" : "Yearly, two months included"}</button></div></header>
    <section className="pricing-plans">{plans.map((item) => <button key={item.id} className={`${selected === item.id ? "selected" : ""} ${item.id === "deep" ? "recommended" : ""}`} onClick={() => setSelected(item.id)}>
      {item.id === "deep" && <small>{lang === "zh" ? "最适合深度练习" : "Best for deep practice"}</small>}
      <h2>{lang === "zh" ? item.zh : item.en}</h2><p>{lang === "zh" ? item.zhCopy : item.enCopy}</p>
      <strong>{currency}{annual ? Math.round(item.monthly[lang] * 10 * 100) / 100 : item.monthly[lang]}<i>/{annual ? (lang === "zh" ? "年" : "year") : (lang === "zh" ? "月" : "month")}</i></strong>
      <ul>{item.features[lang].map((feature) => <li key={feature}><Check weight="bold"/>{feature}</li>)}</ul>
    </button>)}</section>
    <section className="checkout-preview">
      <div><Sparkle/><h2>{lang === "zh" ? `预留「${plan.zh}」` : `Reserve ${plan.en}`}</h2><p>{lang === "zh" ? "正式收费前会再次显示价格、额度、续费与退款信息，由你确认后才会付款。" : "Before launch, you will review price, allowances, renewal, and refunds before any payment."}</p></div>
      <aside><dl><div><dt>{lang === "zh" ? "套餐" : "Plan"}</dt><dd>{lang === "zh" ? plan.zh : plan.en}</dd></div><div><dt>{lang === "zh" ? "周期" : "Billing"}</dt><dd>{annual ? (lang === "zh" ? "每年" : "Yearly") : (lang === "zh" ? "每月" : "Monthly")}</dd></div><div><dt>{lang === "zh" ? "预计合计" : "Estimated total"}</dt><dd>{currency}{amount}</dd></div></dl><label><span>{lang === "zh" ? "接收开放通知的邮箱" : "Email for launch notice"}</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setSaved(false); }} placeholder="you@example.com"/></label><button onClick={reserve} disabled={!email.trim()}>{saved ? (lang === "zh" ? "已为你保留" : "Reserved") : (lang === "zh" ? "保留创始价格" : "Reserve founding price")}</button><small><LockKey/>{lang === "zh" ? "当前不收集银行卡。网页正式版将使用 Stripe，iPhone App 将使用 Apple 内购。" : "No card details are collected. Web checkout will use Stripe and iPhone purchases will use Apple."}</small></aside>
    </section>
  </main>;
}
