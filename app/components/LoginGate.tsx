"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";

// Sign-in comes first: with membership on, nobody reaches the app without an account.
// The app itself still renders underneath (and in the server HTML); this layer covers it until sign-in.
// If the status check itself fails, the app opens, because chat still refuses requests without an account.

type Status = { enabled: boolean; emailAvailable: boolean; googleAvailable?: boolean; authenticated: boolean };
type Lang = "zh" | "en";

const copy = {
  zh: {
    title: "登录后继续。",
    intro: "你的愿望、对话和会员用量都跟着账户走，换设备也在。",
    google: "使用 Google 登录",
    or: "或用邮箱登录",
    email: "邮箱",
    code: "邮件验证码",
    send: "发送验证码",
    verify: "验证并登录",
    change: "重新输入邮箱",
    sent: "验证码已发到你的邮箱，几分钟内没收到可以看看垃圾邮件。",
    wait: "请稍候…",
    agree: "继续即表示你同意",
    terms: "服务条款",
    and: "与",
    privacy: "隐私说明",
    errors: {
      TOO_MANY_REQUESTS: "操作太频繁，请过一分钟再试。",
      INVALID_CODE: "验证码不正确或已过期。",
      INVALID_EMAIL: "邮箱格式不对，再检查一下。",
      failed: "Google 登录没有完成，请再试一次，或改用邮箱。",
      other: "暂时没成功，请稍后再试。",
    },
  },
  en: {
    title: "Sign in to continue.",
    intro: "Your desires, conversations and allowance stay with your account, on any device.",
    google: "Continue with Google",
    or: "or sign in with email",
    email: "Email",
    code: "Email code",
    send: "Send code",
    verify: "Verify and sign in",
    change: "Use a different email",
    sent: "The code is on its way. If it does not arrive in a few minutes, check spam.",
    wait: "Please wait…",
    agree: "By continuing you agree to the",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Notice",
    errors: {
      TOO_MANY_REQUESTS: "Too many attempts. Please wait a minute.",
      INVALID_CODE: "The code is incorrect or expired.",
      INVALID_EMAIL: "That email address does not look right.",
      failed: "Google sign-in did not finish. Try again, or use email.",
      other: "That did not work. Please try again.",
    },
  },
} as const;

type ErrorKey = keyof typeof copy.zh.errors;

function pickLang(): Lang {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "zh" || requested === "en") return requested;
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "open" | "login">("checking");
  const [lang, setLang] = useState<Lang>("zh");
  const [google, setGoogle] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const t = copy[lang];

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL and account status on mount */
    setLang(pickLang());
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "failed") setError("failed");
    if (params.has("login")) {
      params.delete("login");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
    fetch("/api/member/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<Status> : Promise.reject(new Error("STATUS")))
      .then((status) => {
        if (!status.enabled || status.authenticated) { setState("open"); return; }
        // Google refuses sign-in inside an embedded app view, so the iPhone app offers email only.
        setGoogle(Boolean(status.googleAvailable) && !Capacitor.isNativePlatform());
        setState("login");
      })
      .catch(() => setState("open"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError(null);
    try {
      const path = codeSent ? "/api/member/auth/verify" : "/api/member/auth/otp";
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codeSent ? { email: email.trim(), code } : { email: email.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "other");
      if (codeSent) setState("open"); else setCodeSent(true);
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "other";
      setError(reason in copy.zh.errors ? reason as ErrorKey : "other");
    } finally { setBusy(false); }
  }

  if (state === "open") return <>{children}</>;
  return (
    <>
      {children}
      <div className={`login-gate${state === "checking" ? " checking" : ""}`} role={state === "login" ? "dialog" : undefined} aria-modal={state === "login" ? true : undefined} aria-labelledby="login-gate-title">
        {state === "login" && <div className="login-gate-inner">
          <header>
            <span className="login-gate-brand">AlreaDough</span>
            <button type="button" className="login-gate-lang" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button>
          </header>
          <section className="login-gate-copy">
            <h1 id="login-gate-title">{t.title}</h1>
            <p>{t.intro}</p>
          </section>
          <section className="login-gate-card">
            {google && <>
              <a className="login-gate-google" href="/api/member/auth/google/start">
                <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                {t.google}
              </a>
              <div className="login-gate-or"><span>{t.or}</span></div>
            </>}
            <form onSubmit={submit}>
              <label><span>{t.email}</span><input type="email" autoComplete="email" value={email} disabled={codeSent || busy} onChange={(event) => { setEmail(event.target.value); setError(null); }} placeholder="you@example.com" /></label>
              {codeSent && <label><span>{t.code}</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} disabled={busy} autoFocus onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setError(null); }} /></label>}
              <button type="submit" disabled={busy || !email.trim() || (codeSent && code.length < 6)}>{busy ? t.wait : codeSent ? t.verify : t.send}</button>
              {codeSent && !error && <p className="login-gate-note">{t.sent}</p>}
              {codeSent && <button type="button" className="login-gate-link" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setError(null); }}>{t.change}</button>}
              {error && <p className="login-gate-error" role="alert">{t.errors[error]}</p>}
            </form>
            <small>{t.agree} <a href={lang === "zh" ? "/terms" : "/terms#english"}>{t.terms}</a> {t.and} <a href={lang === "zh" ? "/privacy" : "/privacy#english"}>{t.privacy}</a>{lang === "zh" ? "。" : "."}</small>
          </section>
        </div>}
      </div>
    </>
  );
}
