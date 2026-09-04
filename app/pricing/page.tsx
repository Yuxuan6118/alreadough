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
  const plan = useMemo(() => plans.find((item) => item.id === selected) || plans[1], [selected]);
  const amount = annual ? Math.round(plan.monthly[lang] * 10 * 100) / 100 : plan.monthly[lang];
  const currency = lang === "zh" ? "¥" : "$";
  return <main className="pricing-page">
    <nav><Link href="/">Alrea<span>Dough</span></Link><button onClick={() => setLang((value) => value === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button></nav>
    <header><p>{lang === "zh" ? "未来会员计划" : "Future membership plans"}</p><h1>{lang === "zh" ? "让陪伴跟着愿望一起醒发" : "Let support rise with your desire"}</h1><span>{lang === "zh" ? "公开测试期间免费。以下为未来价格预览，不会扣款，也不会收集银行卡。" : "The public beta is free. These are future-price previews only, with no charge or card collection."}</span><div className="billing-switch"><button className={!annual ? "active" : ""} onClick={() => setAnnual(false)}>{lang === "zh" ? "按月预览" : "Monthly preview"}</button><button className={annual ? "active" : ""} onClick={() => setAnnual(true)}>{lang === "zh" ? "按年预览" : "Yearly preview"}</button></div></header>
    <section className="pricing-plans">{plans.map((item) => <button key={item.id} className={`${selected === item.id ? "selected" : ""} ${item.id === "deep" ? "recommended" : ""}`} onClick={() => setSelected(item.id)}>{item.id === "deep" && <small>{lang === "zh" ? "最适合深度练习" : "Best for deep practice"}</small>}<h2>{lang === "zh" ? item.zh : item.en}</h2><p>{lang === "zh" ? item.zhCopy : item.enCopy}</p><strong>{currency}{annual ? Math.round(item.monthly[lang] * 10 * 100) / 100 : item.monthly[lang]}<i>/{annual ? (lang === "zh" ? "年" : "year") : (lang === "zh" ? "月" : "month")}</i></strong><ul>{item.features[lang].map((feature) => <li key={feature}><Check weight="bold"/>{feature}</li>)}</ul></button>)}</section>
    <section className="checkout-preview"><div><Sparkle/><h2>{lang === "zh" ? `你正在预览「${plan.zh}」` : `You are previewing ${plan.en}`}</h2><p>{lang === "zh" ? "测试期内所有测试者使用同一套免费额度。正式收费前会再次展示价格、额度、续费、取消和退款信息。" : "All beta testers currently receive the same free allowance. Price, usage, renewal, cancellation, and refund details will be shown again before paid launch."}</p></div><aside><dl><div><dt>{lang === "zh" ? "套餐" : "Plan"}</dt><dd>{lang === "zh" ? plan.zh : plan.en}</dd></div><div><dt>{lang === "zh" ? "周期" : "Billing"}</dt><dd>{annual ? (lang === "zh" ? "每年" : "Yearly") : (lang === "zh" ? "每月" : "Monthly")}</dd></div><div><dt>{lang === "zh" ? "未来价格预览" : "Future price preview"}</dt><dd>{currency}{amount}</dd></div><div><dt>{lang === "zh" ? "今天应付" : "Due today"}</dt><dd>{currency}0</dd></div></dl><Link className="continue-beta" href="/">{lang === "zh" ? "继续免费测试" : "Continue free beta"}</Link><small><LockKey/>{lang === "zh" ? "当前没有支付入口，不收集邮箱或银行卡。" : "Payments are not enabled. No email or card details are collected here."}</small></aside></section>
  </main>;
}
