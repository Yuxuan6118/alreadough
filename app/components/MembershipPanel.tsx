"use client";

import { Capacitor } from "@capacitor/core";
import { ArrowRight, X } from "@phosphor-icons/react";
import DoughLineMark from "./DoughLineMark";
import { askConfirm } from "./ConfirmHost";
import { useCallback, useEffect, useRef, useState } from "react";
import DoughHop from "./DoughHop";
import {
  exhaustedWindow, fetchMemberStatus, MEMBER_PLANS, memberErrorText, memberPost, planName, resetLabel,
  submitCheckoutForm, usagePercent, type Membership, type MemberStatus,
} from "@/lib/member-client";
import "./membership.css";

type Lang = "zh" | "en";
export type MemberGate = "MEMBERSHIP_LIMIT" | "MEMBERSHIP_SIGN_IN_REQUIRED" | null;

/**
 * One status fetch for the whole app: the ring by the chat box, the out-of-usage notice and the panel in
 * My space all read it. It refreshes after each reply and when the tab comes back (e.g. from Alipay).
 */
export function useMemberStatus() {
  const [member, setMember] = useState<MemberStatus | null>(null);
  const [gate, setGate] = useState<MemberGate>(null);
  const apply = useCallback((next: MemberStatus | null) => {
    if (!next) return;
    setMember(next);
    setGate((current) => {
      if (current === "MEMBERSHIP_SIGN_IN_REQUIRED" && next.authenticated) return null;
      if (current === "MEMBERSHIP_LIMIT" && next.membership && !exhaustedWindow(next.membership)) return null;
      return current;
    });
  }, []);
  // offline: keep what we had
  const refresh = useCallback(() => fetchMemberStatus().then(apply).catch(() => undefined), [apply]);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);
  return { member, refresh, gate, setGate };
}

/** Short value for the My space row: the plan she is on, once signed in. */
export function memberPlanLabel(member: MemberStatus | null, lang: Lang) {
  return member?.authenticated && member.membership ? planName(member.membership.plan, lang) : undefined;
}

/** The two allowances as bars, the way Claude and ChatGPT show plan limits. */
function UsageBars({ membership, lang, compact = false }: { membership: Membership; lang: Lang; compact?: boolean }) {
  const zh = lang === "zh";
  const rows = [
    { id: "five", label: zh ? "5 小时用量" : "5-hour limit", units: membership.usage.fiveUnits, limit: membership.limits.fiveHours, reset: membership.usage.fiveResetMs },
    { id: "week", label: zh ? "本周用量" : "Weekly limit", units: membership.usage.weekUnits, limit: membership.limits.week, reset: membership.usage.weekResetMs },
  ];
  return (
    <div className={`usage-bars${compact ? " compact" : ""}`}>
      {rows.map((row) => {
        const percent = usagePercent(row.units, row.limit);
        const full = percent >= 100;
        return (
          <div key={row.id} className={`usage-row${full ? " full" : percent >= 80 ? " high" : ""}`}>
            <div className="usage-row-text">
              <span>{row.label}</span>
              <small>{zh ? `${resetLabel(row.reset, lang)} 恢复` : `Resets ${resetLabel(row.reset, lang)}`}</small>
              <strong>{full && !membership.unlimited ? (zh ? "已用完" : "Used up") : `${percent}%`}</strong>
            </div>
            <div className="usage-track" role="progressbar" aria-label={row.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>
            {!compact && <small className="usage-count">{zh ? `约 ${row.units} / ${row.limit} 次普通对话` : `About ${row.units} of ${row.limit} standard replies`}</small>}
          </div>
        );
      })}
    </div>
  );
}

function Ring({ percent }: { percent: number }) {
  const r = 7.5;
  const length = 2 * Math.PI * r;
  return (
    <svg className="usage-ring" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r={r} />
      <circle cx="10" cy="10" r={r} strokeDasharray={length} strokeDashoffset={length * (1 - percent / 100)} transform="rotate(-90 10 10)" />
    </svg>
  );
}

/** The small ring next to the send button; tap it to see both allowances without leaving the chat. */
export function UsageMeter({ lang, member, onOpen }: { lang: Lang; member: MemberStatus | null; onOpen: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const membership = member?.enabled && member.authenticated ? member.membership : null;
  if (!membership) return null;
  const zh = lang === "zh";
  const five = usagePercent(membership.usage.fiveUnits, membership.limits.fiveHours);
  const week = usagePercent(membership.usage.weekUnits, membership.limits.week);
  const peak = Math.max(five, week);
  return (
    <details ref={ref} className={`usage-meter${peak >= 100 && !membership.unlimited ? " full" : peak >= 80 ? " high" : ""}`} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label={zh ? `用量 ${peak}%` : `Usage ${peak}%`}><Ring percent={peak} /></summary>
      <div className="usage-popover" role="dialog" aria-label={zh ? "用量" : "Usage"}>
        <header>
          <span>{zh ? "用量" : "Plan usage"} · {planName(membership.plan, lang)}</span>
          <button type="button" onClick={() => { if (ref.current) ref.current.open = false; onOpen(); }}>{zh ? "详情" : "See all"}<ArrowRight size={14} /></button>
        </header>
        {membership.unlimited && <p className="usage-note">{zh ? "创始人账户，不受限制。下面按当前方案的额度显示。" : "Founder account, no limit. Shown against the plan's allowance."}</p>}
        <UsageBars membership={membership} lang={lang} compact />
      </div>
    </details>
  );
}

/** A card above the chat box when she cannot send: not signed in, or an allowance is used up. */
export function UsageBanner({ lang, member, gate, onOpen }: { lang: Lang; member: MemberStatus | null; gate: MemberGate; onOpen: () => void }) {
  const [dismissed, setDismissed] = useState("");
  const zh = lang === "zh";
  const native = Capacitor.isNativePlatform();
  const needsSignIn = gate === "MEMBERSHIP_SIGN_IN_REQUIRED" || (!!member?.enabled && member.emailAvailable && !member.authenticated);
  const used = exhaustedWindow(member?.membership) || (gate === "MEMBERSHIP_LIMIT" ? "five" : null);
  const kind = needsSignIn ? "signin" : used ? `limit-${used}` : "";
  if (!kind || dismissed === kind) return null;
  const reset = used === "week" ? member?.membership?.usage.weekResetMs : member?.membership?.usage.fiveResetMs;
  return (
    <div className="usage-banner" role="status">
      <DoughLineMark />
      <div>
        <strong>{needsSignIn ? (zh ? "用邮箱登录后就能开始对话" : "Sign in with email to start chatting")
          : used === "week" ? (zh ? "本周的用量用完了" : "You're out of this week's usage")
          : (zh ? "这 5 小时的用量用完了" : "You're out of usage for these 5 hours")}</strong>
        <span>{needsSignIn ? ""
          : `${reset ? (zh ? `${resetLabel(reset, lang)} 恢复` : `Resets ${resetLabel(reset, lang)}`) : ""}${native ? "" : (zh ? "，也可以升级会员继续聊。" : ", or upgrade to keep going.")}`}</span>
      </div>
      <button type="button" className="usage-banner-action" onClick={onOpen}>{needsSignIn ? (zh ? "登录" : "Sign in") : native ? (zh ? "查看用量" : "View usage") : (zh ? "升级" : "Upgrade")}</button>
      <button type="button" className="usage-banner-close" aria-label={zh ? "先关掉" : "Dismiss"} onClick={() => setDismissed(kind)}><X size={16} /></button>
    </div>
  );
}

/** My space → 会员与用量: sign in, see the plan and both allowances, buy or extend, all in one place. */
export default function MembershipPanel({ lang, member, onRefresh }: { lang: Lang; member: MemberStatus | null; onRefresh: () => Promise<void> }) {
  const zh = lang === "zh";
  const native = Capacitor.isNativePlatform();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [referral, setReferral] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(path: string, body: Record<string, string> = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await memberPost<{ action?: string; fields?: Record<string, string>; url?: string }>(path, body);
      if (path.endsWith("/otp")) setCodeSent(true);
      else if (path.endsWith("/checkout") && data.url) { window.location.href = data.url; return; }
      else if (path.endsWith("/checkout") && data.action && data.fields) { submitCheckoutForm(data.action, data.fields); return; }
      else {
        if (path.endsWith("/referral")) { setReferral(""); setNotice(zh ? "已开通 7 天丰盛工坊。" : "7 days of Dough Atelier added."); }
        // Signing in or out changes whose space the app shows: start again from a fresh load.
        if (path.endsWith("/verify") || path.endsWith("/logout")) { window.location.reload(); return; }
        await onRefresh();
      }
    } catch (failure) {
      setError(memberErrorText(failure instanceof Error ? failure.message : "", lang));
    } finally { setBusy(false); }
  }

  if (!member) return <div className="settings-section profile-panel"><div className="profile-cards"><section className="profile-card"><p className="setting-empty dough-loading" role="status"><DoughHop size="sm"/>{zh ? "正在读取会员信息…" : "Loading your membership…"}</p></section></div></div>;

  if (!member.enabled) return (
    <div className="settings-section profile-panel">
      <div className="profile-cards">
        <section className="profile-card">
          <h3>{zh ? "会员" : "Membership"}</h3>
          <p className="profile-sub">{zh ? "会员还没有开放，现在可以照常使用。" : "Membership is not open yet. Everything works as usual."}</p>
          {!native && <a className="profile-topic-plus member-pill-link" href={zh ? "/pricing" : "/en/pricing"}>{zh ? "看看会员方案" : "See the plans"}<ArrowRight size={14} /></a>}
        </section>
      </div>
    </div>
  );

  if (!member.authenticated) return (
    <div className="settings-section profile-panel">
      <div className="profile-cards">
        <section className="profile-card member-signin">
          <h3>{zh ? "用邮箱登录" : "Sign in with email"}</h3>
          {!member.emailAvailable ? <p className="setting-empty">{zh ? "邮箱登录暂时不可用，请稍后再试。" : "Email sign-in is unavailable right now. Please try again later."}</p> : <>
            <label className="wish-field"><span>{zh ? "邮箱" : "Email"}</span><input type="email" value={email} autoComplete="email" placeholder="name@example.com" disabled={codeSent} onChange={(event) => setEmail(event.target.value)} /></label>
            {codeSent && <label className="wish-field"><span>{zh ? "验证码" : "Code"}</span><input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={8} placeholder={zh ? "邮件里的验证码" : "Code from the email"} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>}
            <div className="wish-actions member-signin-actions">
              <button type="button" className="wish-primary" disabled={busy || !email.trim() || (codeSent && code.length < 6)} onClick={() => void act(codeSent ? "/api/member/auth/verify" : "/api/member/auth/otp", codeSent ? { email, code } : { email })}>{busy ? (zh ? "请稍候…" : "Please wait…") : codeSent ? (zh ? "验证并登录" : "Verify and sign in") : (zh ? "发送验证码" : "Send code")}</button>
              {codeSent && <button type="button" className="wish-delete" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); }}>{zh ? "换个邮箱" : "Change email"}</button>}
            </div>
            {codeSent && <small className="profile-sub">{zh ? "验证码已发到你的邮箱，几分钟内有效。没收到的话看看垃圾邮件。" : "We sent a code to your email. It expires in a few minutes; check spam if you don't see it."}</small>}
          </>}
          {error && <p className="member-error" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  );

  const membership = member.membership;
  if (!membership) return null;
  const current = MEMBER_PLANS.find((plan) => plan.id === membership.plan);
  const paidPlans = MEMBER_PLANS.filter((plan) => plan.price > 0);
  const date = (ms: number) => new Date(ms).toLocaleDateString(zh ? "zh-CN" : "en-US");
  return (
    <div className="settings-section profile-panel membership-section">
      <div className="profile-cards">
        <section className="profile-card member-plan">
          <div className="member-plan-top">
            <span className="member-plan-label">{zh ? "当前方案" : "Current plan"}</span>
            <div className="member-plan-chips">{membership.trial && <span className="wish-chip">{membership.welcome ? (zh ? "新用户体验" : "Welcome week") : (zh ? "试用中" : "Trial")}</span>}{membership.referral && <span className="wish-chip">{zh ? "邀请体验" : "Invitation"}</span>}{membership.unlimited && <span className="wish-chip is-current">{zh ? "创始人 · 不限用量" : "Founder · unlimited"}</span>}</div>
          </div>
          <strong className="member-plan-title">{current?.name[lang]}</strong>
          <p className="profile-sub member-plan-meta">
            {membership.referralEndMs ? (zh ? `丰盛工坊体验到 ${date(membership.referralEndMs)}，之后回到原来的方案。` : `Dough Atelier until ${date(membership.referralEndMs)}, then back to your own plan.`)
              : membership.welcome && membership.periodEndMs ? (zh ? `新用户免费体验丰盛工坊到 ${date(membership.periodEndMs)}，之后回到轻揉，体验期写的剧本都会保留。` : `Your first week of Dough Atelier lasts until ${date(membership.periodEndMs)}, then you are back on Soft Start. Scripts you write now stay yours.`)
              : membership.periodEndMs ? (zh ? `有效期到 ${date(membership.periodEndMs)}，到期不会自动扣款。` : `Active until ${date(membership.periodEndMs)}. It does not renew automatically.`)
              : (zh ? `免费方案：每 5 小时约 ${current?.session} 次、每周约 ${current?.week} 次普通对话。` : `Free plan: about ${current?.session} replies per 5 hours and ${current?.week} per week.`)}
          </p>
        </section>

        <section className="profile-card">
          <h3>{zh ? "用量" : "Usage"}</h3>
          {membership.unlimited && <p className="profile-sub">{zh ? "创始人账户不受限制。下面按当前方案的额度显示，方便你看到用户看到的样子。" : "Founder account, no limit. Shown against the plan's allowance so you can see what members see."}</p>}
          <UsageBars membership={membership} lang={lang} />
          {membership.story && <p className="profile-sub member-story-usage">{zh ? `本周 AI 剧本：已写 ${membership.story.used} 篇，` + (membership.story.limit >= 1000 ? "不限。" : `还能写 ${Math.max(0, membership.story.limit - membership.story.used)} 篇，${resetLabel(membership.story.resetMs, lang)} 恢复。`) : `AI scripts this week: ${membership.story.used} written, ` + (membership.story.limit >= 1000 ? "no limit." : `${Math.max(0, membership.story.limit - membership.story.used)} left; resets ${resetLabel(membership.story.resetMs, lang)}.`)}</p>}
        </section>

        {!native && (member.checkoutAvailable || member.cardCheckoutAvailable) && <section className="profile-card member-upgrade">
          <h3>{zh ? "升级或续费" : "Upgrade or extend"}</h3>
          <p className="profile-sub">{zh ? "支付宝或银行卡付款。一次购买 30 天，到期不会自动扣款。" : "Pay with Alipay or card. Each purchase covers 30 days and never renews on its own."}</p>
          <ul>
            {paidPlans.map((plan) => <li key={plan.id} className={plan.id === membership.plan ? "current" : ""}>
              <div><strong>{plan.name[lang]}{plan.id === membership.plan && <span className="wish-chip is-current">{zh ? "当前" : "Current"}</span>}</strong><span className="member-price">¥{plan.price}<small> / {zh ? "30 天" : "30 days"}</small></span><small>{zh ? `每 5 小时约 ${plan.session} 次 · 每周约 ${plan.week} 次 · ` + (plan.id === "atelier" ? "剧本几乎不限" : `每周 ${plan.stories} 篇剧本`) : `About ${plan.session} per 5 hours · ${plan.week} per week · ` + (plan.id === "atelier" ? "scripts almost unlimited" : `${plan.stories} scripts a week`)}</small></div>
              <a className={plan.id === "deep" && membership.plan === "soft" ? "wish-primary member-buy-link" : "profile-topic-plus member-buy-link"} href={`${zh ? "/checkout" : "/en/checkout"}?plan=${plan.id}`}>{plan.id === membership.plan && membership.periodEndMs && !membership.referral ? (zh ? "续 30 天" : "Add 30 days") : (zh ? "购买" : "Buy")}</a>
            </li>)}
          </ul>
        </section>}

        {!membership.referralUsed && <section className="profile-card member-referral">
          <h3>{zh ? "邀请码" : "Invitation code"}</h3>
          <p className="profile-sub">{zh ? "填邀请码可以免费体验 7 天丰盛工坊，每个账户一次。" : "An invitation code gives 7 days of Dough Atelier, once per account."}</p>
          <div className="profile-topic-add"><input type="text" value={referral} maxLength={32} placeholder={zh ? "邀请码" : "Code"} aria-label={zh ? "邀请码" : "Invitation code"} onChange={(event) => setReferral(event.target.value)} /><button type="button" className="profile-topic-plus" disabled={busy || !referral.trim()} onClick={() => void act("/api/member/referral", { code: referral.trim() })}>{zh ? "使用" : "Use"}</button></div>
        </section>}

        {(notice || error) && <p className={error ? "member-error" : "member-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}

        <section className="profile-card member-account">
          <span>{zh ? "已用邮箱登录" : "Signed in with email"}</span>
          <button type="button" className="wish-delete" disabled={busy} onClick={async () => { if (await askConfirm({ title: zh ? "确定要退出登录吗？" : "Sign out?", body: zh ? "退出后需要用邮箱重新登录，才能继续使用会员。" : "You'll need to sign in with your email again to use your membership.", confirmLabel: zh ? "退出登录" : "Sign out", cancelLabel: zh ? "取消" : "Cancel" })) void act("/api/member/auth/logout"); }}>{zh ? "退出登录" : "Sign out"}</button>
        </section>
      </div>
    </div>
  );
}
