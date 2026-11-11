"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Export, X } from "@phosphor-icons/react";
import { readStored, writeStored } from "@/lib/safe-storage";

// Gentle "put it on your home screen" tip for phones. Android Chrome gets a real one-tap install
// button; iPhone has no such API, so we show the two taps it needs. Not shown on desktop, inside
// the native shell, or once the app is already running from the home screen.
const DISMISS_KEY = "already-install-tip-dismissed-v1";
const SNOOZE_MS = 14 * 86_400_000;
const SHOW_AFTER_MS = 8000;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Mode = "android" | "ios" | "wechat";

const copy = {
  zh: {
    title: "把 AlreaDough 放到手机桌面",
    android: "一点就能打开，像 App 一样全屏使用。",
    install: "安装",
    ios: "点底部的「分享」图标，再选「添加到主屏幕」。",
    wechat: "点右上角「···」，选「在浏览器打开」，再添加到桌面。",
    close: "关闭",
  },
  en: {
    title: "Put AlreaDough on your home screen",
    android: "One tap to open, full screen like an app.",
    install: "Install",
    ios: "Tap the Share icon at the bottom, then “Add to Home Screen”.",
    wechat: "Tap “···” at the top right, choose “Open in browser”, then add it to your home screen.",
    close: "Close",
  },
} as const;

function detectMode(): Mode | null {
  const ua = navigator.userAgent || "";
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || touchMac;
  const android = /Android/.test(ua);
  if (!ios && !android) return null;
  if (/MicroMessenger/i.test(ua)) return "wechat";
  return ios ? "ios" : "android";
}

export default function InstallTip({ lang }: { lang: "zh" | "en" }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [visible, setVisible] = useState(false);
  const promptRef = useRef<InstallEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || Capacitor.isNativePlatform()) return;
    const snoozedAt = Number(readStored(DISMISS_KEY) || 0);
    if (snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) return;
    const detected = detectMode();
    if (!detected) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallEvent;
      setMode("android");
    };
    const onInstalled = () => { setVisible(false); writeStored(DISMISS_KEY, String(Date.now())); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Android only offers the tip once Chrome says the app is installable; iPhone and WeChat show text instructions.
    if (detected !== "android") setMode(detected);
    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !mode) return null;
  const text = copy[lang];
  const dismiss = () => { setVisible(false); writeStored(DISMISS_KEY, String(Date.now())); };
  const install = async () => {
    const event = promptRef.current;
    if (!event) return;
    promptRef.current = null;
    try { await event.prompt(); await event.userChoice; } catch { /* the user can still add it from the browser menu */ }
    dismiss();
  };

  return (
    <aside className="install-tip" role="status">
      <span className="install-tip-icon" aria-hidden="true">{mode === "ios" ? <Export size={20}/> : <img src="/already-app-icon.png" alt="" width={28} height={28}/>}</span>
      <div>
        <strong>{text.title}</strong>
        <small>{mode === "android" ? text.android : mode === "ios" ? text.ios : text.wechat}</small>
      </div>
      {mode === "android" && <button className="install-tip-action" onClick={install}>{text.install}</button>}
      <button className="install-tip-close" onClick={dismiss} aria-label={text.close}><X size={16}/></button>
    </aside>
  );
}
