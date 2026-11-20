"use client";

import { ArrowRight, Check, LockKey } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import DoughHop from "../components/DoughHop";
import { getDeviceSessionId } from "@/lib/device-session";
import { MEMBER_PLANS, type MemberStatus } from "@/lib/member-client";
import SiteFooter from "../components/SiteFooter";
import "./pricing.css";

const plans = MEMBER_PLANS;

export default function Pricing({ initialLang }: { initialLang: "zh" | "en" }) {
  const [lang, setLang] = useState(initialLang);
  const [selected, setSelected] = useState<(typeof plans)[number]>(plans[1]);
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [member, setMember] = useState<MemberStatus | null>(null);
  const zh = lang === "zh";

  useEffect(() => {
    void fetch("/api/member/status", { cache: "no-store" })
      .then(async (response) => { if (response.ok) setMember(await response.json() as MemberStatus); })
      .catch(() => undefined);
  }, []);

  async function reserve() {
    if (!contact.trim() || status === "busy" || status === "saved") return;
    setStatus("busy");
    try {
      const response = await fetch("/api/pay/interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-already-session-id": getDeviceSessionId(),
        },
        body: JSON.stringify({ plan: selected.id, billing: "monthly", contact: contact.trim(), lang }),
      });
      setStatus(response.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  function switchLanguage() {
    const next = zh ? "en" : "zh";
    const { search, hash } = window.location;
    window.history.replaceState(window.history.state, "", `${next === "en" ? "/en/pricing" : "/pricing"}${search}${hash}`);
    setLang(next);
  }

  return (
    <div lang={zh ? "zh-CN" : "en"}>
      <main className="pricing-page">
        <nav>
          <a href={zh ? "/" : "/en"}>Alrea<span>Dough</span></a>
          <button type="button" lang={zh ? "en" : "zh-CN"} onClick={switchLanguage}>{zh ? "English" : "中文"}</button>
        </nav>
        <header>
          <h1>{zh ? "会员与价格" : "Membership and pricing"}</h1>
          <span>{member?.enabled ? (zh ? "按用量使用。一次购买 30 天，到期不会自动扣款。" : "Usage-based allowances. Each purchase lasts 30 days and never renews on its own.") : (zh ? "新会员方案预览。试用和付款尚未开放。" : "Preview of the new membership plans. Trials and payments are not open yet.")}</span>
        </header>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- the plan cards below are a keyboard-operable radio group */}
        <section className="pricing-plans" role="radiogroup" aria-label={zh ? "会员方案" : "Membership plans"}>
          {plans.map((plan) => {
            const isSelected = selected.id === plan.id;
            return (
              <article
                key={plan.id}
                className={isSelected ? "selected" : undefined}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- radio card: Enter and Space are handled in onKeyDown
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={() => { setSelected(plan); setStatus("idle"); }}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(plan); setStatus("idle"); } }}
              >
                <h2>{plan.name[lang]}</h2>
                <strong>{plan.price ? <>¥{plan.price}<i> / {member?.enabled ? (zh ? "30 天" : "30 days") : (zh ? "月" : "month")}</i></> : (zh ? "免费" : "Free")}</strong>
                <ul>
                  <li><Check weight="bold" />{zh ? `每 5 小时约 ${plan.session} 次普通聊天的用量` : `About ${plan.session} standard chat turns per 5 hours`}</li>
                  <li><Check weight="bold" />{zh ? `每周约 ${plan.week} 次普通聊天的用量` : `About ${plan.week} standard chat turns per week`}</li>
                  <li><Check weight="bold" />{zh ? `${plan.id === "atelier" ? "剧本几乎不限（每周 70 篇）" : `每周 ${plan.stories} 篇 AI 剧本`}` : `${plan.id === "atelier" ? "Scripts almost unlimited (70 a week)" : `${plan.stories} AI scripts a week`}`}</li>
                  {plan.id === "atelier" && <li><Check weight="bold" />{zh ? "新用户注册后免费体验 7 天" : "Free for your first 7 days after signing up"}</li>}
                  {plan.id === "atelier" && <li><Check weight="bold" />{zh ? "醒发用量的 3 倍以上" : "More than three times the Deep Practice allowance"}</li>}
                </ul>
              </article>
            );
          })}
        </section>
        {member?.enabled ? <section className="pricing-action">
          {selected.price > 0
            ? <a className="pricing-cta" href={`${zh ? "/checkout" : "/en/checkout"}?plan=${selected.id}`}>{zh ? `购买${selected.name.zh}` : `Get ${selected.name.en}`}<ArrowRight size={16} weight="bold" /></a>
            : <a className="pricing-cta" href="/app">{zh ? "免费开始" : "Start free"}<ArrowRight size={16} weight="bold" /></a>}
          <p>{selected.price > 0
            ? (zh ? "支付宝或银行卡付款，下一步选择。" : "Pay with Alipay or card on the next step.")
            : (zh ? "不用付款，登录后就能用。" : "No payment needed. Sign in and start.")}</p>
          {member.authenticated && member.membership && <p className="pricing-current">{zh ? "你现在是" : "You are on "}{plans.find((p) => p.id === member.membership?.plan)?.name[lang]}{member.membership.periodEndMs ? (zh ? `，有效期到 ${new Date(member.membership.periodEndMs).toLocaleDateString("zh-CN")}` : ` until ${new Date(member.membership.periodEndMs).toLocaleDateString("en-US")}`) : ""}{zh ? "。" : "."}</p>}
        </section> : <section className="checkout-preview">
          <div>
            <h2>{zh ? `等「${selected.name.zh}」开放时通知我` : `Notify me when ${selected.name.en} opens`}</h2>
            <p>{zh ? "聊天次数是估算，长对话和生成内容会消耗更多用量。会员开放后，计划提供额外用量包。" : "Turn counts are estimates. Longer chats and generation tasks use more of the allowance. Extra usage packs are planned."}</p>
          </div>
          <aside>
            <label>
              <span>{zh ? "邮箱或微信号" : "Email or WeChat ID"}</span>
              <input type="text" maxLength={120} value={contact} disabled={status === "busy"} onChange={(event) => { setContact(event.target.value); setStatus("idle"); }} />
            </label>
            <button type="button" onClick={reserve} disabled={!contact.trim() || status === "busy" || status === "saved"}>
              {status === "busy" ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "正在保存…" : "Saving…"}</span> : status === "saved" ? (zh ? "已登记" : "Saved") : (zh ? "通知我" : "Notify me")}
            </button>
            {status === "error" && <p role="alert">{zh ? "没有保存成功，请稍后重试。" : "Could not save. Please try again."}</p>}
            <small><LockKey />{zh ? "登记不扣款。" : "No payment is required."} <a href={zh ? "/privacy" : "/privacy#english"}>{zh ? "隐私说明" : "Privacy Notice"}</a></small>
          </aside>
        </section>}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
