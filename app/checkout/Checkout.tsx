"use client";

import { ArrowLeft, CreditCard, Wallet } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import DoughHop from "../components/DoughHop";
import { MEMBER_PLANS, memberErrorText, memberPost, submitCheckoutForm, type MemberStatus } from "@/lib/member-client";
import SiteFooter from "../components/SiteFooter";
import "./checkout.css";

type Lang = "zh" | "en";
type PaidPlan = "deep" | "atelier";
type Method = "alipay" | "card";

/** Card checkout (Waffo) is charged in USD; keep in step with WAFFO_PRICE_CENTS in lib/waffo.ts. */
const CARD_PRICE: Record<PaidPlan, string> = { deep: "US$6.49", atelier: "US$22.99" };
const PAID_PLANS = MEMBER_PLANS.filter((plan) => plan.price > 0) as unknown as { id: PaidPlan; name: Record<Lang, string>; price: number; session: number; week: number; stories: number }[];

/**
 * The one place where a purchase happens. The pricing page and the in-app membership panel both link here
 * with ?plan=; payment providers send the buyer back here with ?paid=.
 */
export default function Checkout({ initialLang }: { initialLang: Lang }) {
  const lang = initialLang;
  const zh = lang === "zh";
  const [plan, setPlan] = useState<PaidPlan>("deep");
  const [method, setMethod] = useState<Method>("alipay");
  const [paid, setPaid] = useState(false);
  const [member, setMember] = useState<MemberStatus | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch("/api/member/status", { cache: "no-store" });
    if (response.ok) setMember(await response.json() as MemberStatus);
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the plan and the "back from paying" flag come from the URL, which only exists in the browser */
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") === "atelier") setPlan("atelier");
    const back = params.get("paid");
    void refresh().catch(() => undefined);
    if (!back) return;
    // The provider's notice can land a few seconds after the buyer does.
    setPaid(true);
    const timers = [3000, 8000, 20000].map((ms) => window.setTimeout(() => void refresh().catch(() => undefined), ms));
    return () => timers.forEach(clearTimeout);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Fall back to whichever method is actually open.
  useEffect(() => {
    if (!member) return;
    /* eslint-disable react-hooks/set-state-in-effect -- which methods are open is only known once the status has loaded */
    if (method === "alipay" && !member.checkoutAvailable && member.cardCheckoutAvailable) setMethod("card");
    if (method === "card" && !member.cardCheckoutAvailable && member.checkoutAvailable) setMethod("alipay");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [member, method]);


  async function act(path: string, body: Record<string, string> = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await memberPost<{ action?: string; fields?: Record<string, string>; url?: string }>(path, body);
      if (path.endsWith("/otp")) { setCodeSent(true); return; }
      if (path.endsWith("/checkout")) {
        if (data.url) { window.location.href = data.url; return; }
        if (data.action && data.fields) { submitCheckoutForm(data.action, data.fields); return; }
      }
      if (path.endsWith("/verify")) { setCode(""); setCodeSent(false); }
      if (path.endsWith("/referral")) { setReferral(""); setShowReferral(false); setNotice(zh ? "已加上 30 天丰盛工坊。" : "30 days of Dough Atelier added."); }
      await refresh();
    } catch (failure) {
      setError(memberErrorText(failure instanceof Error ? failure.message : "", lang));
    } finally { setBusy(false); }
  }

  const selected = PAID_PLANS.find((item) => item.id === plan)!;
  const membership = member?.membership;
  const open = !!member?.enabled && (member.checkoutAvailable || !!member.cardCheckoutAvailable);
  const renewing = !!membership?.periodEndMs && membership.plan === plan && !membership.referral;
  const date = (ms: number) => new Date(ms).toLocaleDateString(zh ? "zh-CN" : "en-US");
  const pricing = zh ? "/pricing" : "/en/pricing";

  return (
    <div lang={zh ? "zh-CN" : "en"} className="checkout-shell">
      <main className="checkout-page">
        <nav>
          <a className="checkout-brand" href={zh ? "/" : "/en"}>Alrea<span>Dough</span></a>
        </nav>

        <section className="checkout-body">
          <a className="checkout-back" href={pricing} onClick={(event) => {
            // Came from the app or the pricing page: go back there instead of always to pricing.
            if (!paid && document.referrer.startsWith(window.location.origin) && window.history.length > 1) { event.preventDefault(); window.history.back(); }
          }}><ArrowLeft size={14} />{zh ? "返回" : "Back"}</a>

          {paid ? <>
            <h1>{zh ? "付款完成" : "Payment received"}</h1>
            <p className="checkout-lead">{membership && membership.plan !== "soft"
              ? (zh ? `当前方案：${PAID_PLANS.find((p) => p.id === membership.plan)?.name.zh ?? ""}${membership.periodEndMs ? `，有效期到 ${date(membership.periodEndMs)}` : ""}。` : `You are on ${PAID_PLANS.find((p) => p.id === membership.plan)?.name.en ?? ""}${membership.periodEndMs ? ` until ${date(membership.periodEndMs)}` : ""}.`)
              : (zh ? "会员会在几秒内生效，这个页面会自动刷新。" : "Your membership updates within a few seconds. This page refreshes on its own.")}</p>
            <a className="checkout-primary" href="/app">{zh ? "回到 AlreaDough" : "Back to AlreaDough"}</a>
          </> : <>
            <h1>{selected.name[lang]}<span>{zh ? " 30 天" : " · 30 days"}</span></h1>
            <p className="checkout-lead">{zh ? `每 5 小时约 ${selected.session} 次，每周约 ${selected.week} 次；${selected.id === "atelier" ? "剧本几乎不限（每周 70 篇）" : `每周 ${selected.stories} 篇 AI 剧本`}。` : `About ${selected.session} replies per 5 hours and ${selected.week} per week; ${selected.id === "atelier" ? "scripts almost unlimited (70 a week)" : `${selected.stories} AI scripts a week`}.`}<br />{zh ? "一次购买 30 天，到期不会自动扣款。" : "One payment for 30 days. It never renews on its own."}</p>


            {!member ? <p className="checkout-quiet dough-loading" role="status"><DoughHop size="sm"/>{zh ? "正在读取账户…" : "Loading your account…"}</p>
            : !open ? <p className="checkout-quiet">{zh ? "购买入口暂未开放。" : "Purchases are not open yet."}</p>
            : !member.authenticated ? (
              <div className="checkout-signin">
                <h2>{zh ? "先用邮箱登录" : "Sign in with email first"}</h2>
                <p>{zh ? "会员会记在你的账户上，换设备也能用。" : "Your membership stays with your account on every device."}</p>
                <label htmlFor="checkout-email">{zh ? "邮箱" : "Email"}</label>
                <input id="checkout-email" type="email" autoComplete="email" value={email} disabled={codeSent} onChange={(event) => setEmail(event.target.value)} />
                {codeSent && <>
                  <label htmlFor="checkout-code">{zh ? "邮件里的验证码" : "Code from the email"}</label>
                  <input id="checkout-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                </>}
                <button type="button" className="checkout-primary" disabled={busy || !email.trim() || (codeSent && code.length < 6)}
                  onClick={() => void act(codeSent ? "/api/member/auth/verify" : "/api/member/auth/otp", codeSent ? { email, code } : { email })}>
                  {busy ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "请稍候…" : "Please wait…"}</span> : codeSent ? (zh ? "登录" : "Sign in") : (zh ? "发送验证码" : "Send code")}
                </button>
                {codeSent && <button type="button" className="checkout-link" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); }}>{zh ? "换个邮箱" : "Use another email"}</button>}
              </div>
            ) : <>
              <fieldset className="checkout-options">
                <legend>{zh ? "支付方式" : "Payment method"}</legend>
                {member.checkoutAvailable && (
                  <label className={method === "alipay" ? "is-selected" : undefined}>
                    <input type="radio" name="method" checked={method === "alipay"} onChange={() => setMethod("alipay")} />
                    <Wallet size={20} className="option-icon" />
                    <span className="option-text"><strong>{zh ? "支付宝" : "Alipay"}</strong><small>{zh ? "用支付宝扫二维码" : "Scan the QR code with Alipay"}</small></span>
                    <span className="option-price">¥{selected.price}</span>
                  </label>
                )}
                {member.cardCheckoutAvailable && (
                  <label className={method === "card" ? "is-selected" : undefined}>
                    <input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} />
                    <CreditCard size={20} className="option-icon" />
                    <span className="option-text"><strong>{zh ? "银行卡" : "Card"}</strong><small>Visa / Mastercard / Apple Pay / Google Pay</small></span>
                    <span className="option-price">{CARD_PRICE[plan]}</span>
                  </label>
                )}
              </fieldset>

              <button type="button" className="checkout-primary" disabled={busy}
                onClick={() => void act(method === "card" ? "/api/pay/waffo/checkout" : "/api/pay/zpay/checkout", method === "card" ? { plan, lang } : { plan })}>
                {busy ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "正在跳转…" : "Opening…"}</span> : method === "card" ? (zh ? "使用银行卡付款" : "Pay by card") : (zh ? "使用支付宝付款" : "Pay with Alipay")}
              </button>
              <p className="checkout-note">
                {renewing && membership?.periodEndMs ? (zh ? `会在现有有效期（到 ${date(membership.periodEndMs)}）之后再加 30 天。` : `Adds 30 days after your current period, which ends ${date(membership.periodEndMs)}. `) : null}
                {method === "card" ? (zh ? "美元报价，实付币种和金额以收银台为准。" : "Priced in USD. The checkout page shows the final currency and amount.") : (zh ? "下一步会显示二维码，用手机支付宝扫码付款，付完自动开通。" : "Next you will see a QR code. Scan it with Alipay on your phone; your plan starts once it is paid.")}
              </p>

              {plan === "atelier" && !membership?.referralUsed && (showReferral ? (
                <div className="checkout-referral">
                  <label htmlFor="checkout-referral">{zh ? "邀请码" : "Invitation code"}</label>
                  <div><input id="checkout-referral" type="text" maxLength={32} value={referral} onChange={(event) => setReferral(event.target.value)} />
                    <button type="button" disabled={busy || !referral.trim()} onClick={() => void act("/api/member/referral", { code: referral.trim() })}>{zh ? "使用" : "Apply"}</button></div>
                </div>
              ) : <button type="button" className="checkout-link" onClick={() => setShowReferral(true)}>{zh ? "有邀请码？免费体验 30 天" : "Have an invitation code? 30 days free"}</button>)}

              <p className="checkout-account">{zh ? "已登录" : "Signed in"}<button type="button" className="checkout-link" disabled={busy} onClick={() => void act("/api/member/auth/logout")}>{zh ? "退出" : "Sign out"}</button></p>
            </>}

            {notice && <p className="checkout-notice" role="status">{notice}</p>}
            {error && <p className="checkout-error" role="alert">{error}</p>}
          </>}
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
