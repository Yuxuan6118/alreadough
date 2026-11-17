"use client";

import { Check, LockKey, Sparkle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getDeviceSessionId } from "@/lib/device-session";
import SiteFooter from "../components/SiteFooter";
import "./pricing.css";

const plans = [
  { id: "soft", name: { zh: "轻揉", en: "Soft Start" }, price: 0, session: 15, week: 60 },
  { id: "deep", name: { zh: "醒发", en: "Deep Practice" }, price: 39, session: 60, week: 400 },
  { id: "atelier", name: { zh: "丰盛工坊", en: "Dough Atelier" }, price: 149, session: 200, week: 1500 },
] as const;

type MemberStatus = {
  enabled: boolean;
  emailAvailable: boolean;
  authenticated: boolean;
  checkoutAvailable: boolean;
  membership: null | { plan: "soft" | "deep" | "atelier"; trial: boolean; referral: boolean; referralUsed: boolean; referralEndMs: number | null; periodEndMs: number | null; usage: { fiveUnits: number; weekUnits: number; fiveResetMs: number; weekResetMs: number }; limits: { fiveHours: number; week: number }; unlimited?: boolean };
};

export default function Pricing({ initialLang }: { initialLang: "zh" | "en" }) {
  const [lang, setLang] = useState(initialLang);
  const [selected, setSelected] = useState<(typeof plans)[1 | 2]>(plans[1]);
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "error">("idle");
  const [member, setMember] = useState<MemberStatus | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [referral, setReferral] = useState("");
  const [referralDone, setReferralDone] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberError, setMemberError] = useState("");
  const zh = lang === "zh";

  async function refreshMember() {
    const response = await fetch("/api/member/status", { cache: "no-store" });
    if (response.ok) setMember(await response.json() as MemberStatus);
  }
  useEffect(() => { void refreshMember().catch(() => undefined); }, []);

  async function memberAction(path: string, body: Record<string, string> = {}) {
    setMemberBusy(true); setMemberError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "REQUEST_FAILED");
      if (path.endsWith("/otp")) setCodeSent(true);
      else if (path.endsWith("/checkout")) {
        const form = document.createElement("form");
        form.method = "POST"; form.action = data.action;
        for (const [name, value] of Object.entries(data.fields as Record<string, string>)) {
          const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.appendChild(input);
        }
        document.body.appendChild(form); form.submit();
      } else {
        if (path.endsWith("/referral")) { setReferral(""); setReferralDone(true); }
        await refreshMember();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "REQUEST_FAILED";
      setMemberError(reason === "TOO_MANY_REQUESTS" ? (zh ? "操作太频繁，请稍后重试。" : "Too many attempts. Please try later.")
        : reason === "INVALID_CODE" ? (zh ? "验证码不正确或已过期。" : "The code is incorrect or expired.")
        : reason === "INVALID_REFERRAL" ? (zh ? "邀请码不对，再检查一下。" : "That invitation code did not work.")
        : reason === "REFERRAL_USED" ? (zh ? "这个账户已经用过邀请码了。" : "This account has already used an invitation code.")
        : (zh ? "暂时没成功，请稍后再试。" : "That did not work. Please try again."));
    } finally { setMemberBusy(false); }
  }

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
          <span>{member?.enabled ? (zh ? "按用量使用；支付宝购买为 30 天，到期不会自动扣款。" : "Usage-based allowances. Alipay purchases last 30 days and do not renew automatically.") : (zh ? "新会员方案预览。试用和付款尚未开放。" : "Preview of the new membership plans. Trials and payments are not open yet.")}</span>
        </header>
        <section className="pricing-plans">
          {plans.map((plan) => {
            const isSelected = selected.id === plan.id;
            return (
              <article key={plan.id} className={isSelected ? "selected" : undefined}>
                <h2>{plan.name[lang]}</h2>
                <strong>{plan.price ? <>¥{plan.price}<i> / {member?.enabled ? (zh ? "30 天" : "30 days") : (zh ? "月" : "month")}</i></> : (zh ? "免费" : "Free")}</strong>
                <ul>
                  <li><Check weight="bold" />{zh ? `每 5 小时约 ${plan.session} 次普通聊天的用量` : `About ${plan.session} standard chat turns per 5 hours`}</li>
                  <li><Check weight="bold" />{zh ? `每周约 ${plan.week} 次普通聊天的用量` : `About ${plan.week} standard chat turns per week`}</li>
                  {plan.id === "atelier" && <li><Check weight="bold" />{zh ? "填邀请码可免费体验 7 天" : "Try it free for 7 days with an invitation code"}</li>}
                  {plan.id === "atelier" && <li><Check weight="bold" />{zh ? "醒发用量的 3 倍以上" : "More than three times the Deep Practice allowance"}</li>}
                </ul>
                {plan.id !== "soft" && (
                  <button type="button" aria-pressed={isSelected} disabled={status === "busy"} onClick={() => { setSelected(plan); setStatus("idle"); }}>
                    {member?.enabled ? (zh ? "选择套餐" : "Select plan") : (zh ? "选择预约套餐" : "Select for launch notice")}
                  </button>
                )}
              </article>
            );
          })}
        </section>
        {member?.enabled ? <section className="checkout-preview member-checkout">
          <div><Sparkle /><h2>{zh ? "我的会员" : "My membership"}</h2>
            {member.authenticated && member.membership?.unlimited ? <p>{zh ? "创始人账户 · 不限用量" : "Founder account · no usage limit"}</p> : member.authenticated && member.membership ? <p>{zh ? "当前方案" : "Current plan"}：{plans.find(p => p.id === member.membership?.plan)?.name[lang]} · {zh ? "本 5 小时已用" : "Used this 5-hour window"} {member.membership.usage.fiveUnits}/{member.membership.limits.fiveHours} · {zh ? "本周已用" : "Used this week"} {member.membership.usage.weekUnits}/{member.membership.limits.week}</p> : <p>{zh ? "先用邮箱登录，会员和用量会跟着你的账户走。" : "Sign in with email to keep your membership and allowance with your account."}</p>}
            {member.membership?.referralEndMs && <p>{zh ? "丰盛工坊体验到期" : "Atelier trial ends"}：{new Date(member.membership.referralEndMs).toLocaleString(zh ? "zh-CN" : "en-US")}{zh ? "，之后回到你原来的方案" : ", then back to your own plan"}</p>}
            {member.membership?.periodEndMs && <p>{zh ? "当前方案到期" : "Current plan ends"}：{new Date(member.membership.periodEndMs).toLocaleDateString(zh ? "zh-CN" : "en-US")}</p>}
            {member.membership && <p>{zh ? "5 小时用量恢复" : "5-hour allowance resets"}：{new Date(member.membership.usage.fiveResetMs).toLocaleString(zh ? "zh-CN" : "en-US")}<br />{zh ? "周用量恢复" : "Weekly allowance resets"}：{new Date(member.membership.usage.weekResetMs).toLocaleString(zh ? "zh-CN" : "en-US")}</p>}
          </div>
          <aside>
            {!member.authenticated ? <>
              <label><span>{zh ? "邮箱" : "Email"}</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
              {codeSent && <label><span>{zh ? "邮件验证码" : "Email code"}</span><input type="text" inputMode="numeric" value={code} maxLength={8} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label>}
              <button type="button" disabled={memberBusy || !email.trim()} onClick={() => void memberAction(codeSent ? "/api/member/auth/verify" : "/api/member/auth/otp", codeSent ? { email, code } : { email })}>{memberBusy ? (zh ? "请稍候…" : "Please wait…") : codeSent ? (zh ? "验证并登录" : "Verify and sign in") : (zh ? "发送验证码" : "Send code")}</button>
              {codeSent && <button type="button" className="member-link" disabled={memberBusy} onClick={() => { setCodeSent(false); setCode(""); }}>{zh ? "重新输入邮箱" : "Change email"}</button>}
            </> : <>
              {!member.membership?.referralUsed && <>
              <label><span>{zh ? "邀请码（免费体验 7 天丰盛工坊）" : "Invitation code (7 days of Dough Atelier)"}</span><input type="text" inputMode="numeric" value={referral} maxLength={32} onChange={e => { setReferral(e.target.value); setReferralDone(false); }} /></label>
              <button type="button" disabled={memberBusy || !referral.trim()} onClick={() => void memberAction("/api/member/referral", { code: referral.trim() })}>{zh ? "使用邀请码" : "Use invitation code"}</button>
              </>}
              {referralDone && <p role="status">{zh ? "已开通 7 天丰盛工坊。" : "7 days of Dough Atelier added."}</p>}
              {member.checkoutAvailable && <button type="button" disabled={memberBusy} onClick={() => void memberAction("/api/pay/zpay/checkout", { plan: selected.id })}>{zh ? `支付宝购买${selected.name.zh} · ¥${selected.price} / 30 天` : `Buy ${selected.name.en} · ¥${selected.price} / 30 days`}</button>}
              {!member.checkoutAvailable && <p>{zh ? "支付入口正在开通。" : "Checkout is being set up."}</p>}
              <button type="button" className="member-link" disabled={memberBusy} onClick={() => void memberAction("/api/member/auth/logout")}>{zh ? "退出登录" : "Sign out"}</button>
            </>}
            {memberError && <p role="alert">{memberError}</p>}
            <small><LockKey />{zh ? "支付结果以服务器核实为准。" : "Payment status is verified by the server."}</small>
          </aside>
        </section> : <section className="checkout-preview">
          <div>
            <Sparkle />
            <h2>{zh ? `等「${selected.name.zh}」开放时通知我` : `Notify me when ${selected.name.en} opens`}</h2>
            <p>{zh ? "聊天次数是估算，长对话和生成内容会消耗更多用量。会员开放后，计划提供额外用量包。" : "Turn counts are estimates. Longer chats and generation tasks use more of the allowance. Extra usage packs are planned."}</p>
          </div>
          <aside>
            <label>
              <span>{zh ? "邮箱或微信号" : "Email or WeChat ID"}</span>
              <input type="text" maxLength={120} value={contact} disabled={status === "busy"} onChange={(event) => { setContact(event.target.value); setStatus("idle"); }} />
            </label>
            <button type="button" onClick={reserve} disabled={!contact.trim() || status === "busy" || status === "saved"}>
              {status === "busy" ? (zh ? "正在保存…" : "Saving…") : status === "saved" ? (zh ? "已登记" : "Saved") : (zh ? "通知我" : "Notify me")}
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
