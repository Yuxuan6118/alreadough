"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Export, X } from "@phosphor-icons/react";
import { detectInstallMode, localDayKey, type InstallMode } from "@/lib/install-mode";
import { readStored, writeStored } from "@/lib/safe-storage";

// "Put it on your home screen" tip for phones, at most once per day. Android Chrome gets a real
// one-tap install button; iPhone has no such API, so Safari users get the two taps it needs and
// everyone on another iPhone browser is told to reopen the page in Safari. Not shown on desktop,
// inside the native shell, or once the app is already running from the home screen.
const DAY_KEY = "already-install-tip-day-v1";
const INSTALLED_KEY = "already-install-tip-installed-v1";
const SHOW_AFTER_MS = 8000;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const copy = {
  zh: {
    title: "把 AlreaDough 放到手机桌面",
    android: "一点就能打开，像 App 一样全屏使用。",
    install: "安装",
    iosSafari: "点底部的「分享」图标，再选「添加到主屏幕」。",
    iosOther: (host: string) => `只有 Safari 可以安装到主屏幕。请用 Safari 打开 ${host}，再点「分享」→「添加到主屏幕」。`,
    copy: "复制网址",
    copied: "已复制",
    wechatIos: "请点右上角「···」，选「在 Safari 打开」，再用 Safari 的「分享」→「添加到主屏幕」。",
    wechatAndroid: "请点右上角「···」，选「在浏览器打开」，再添加到桌面。",
    close: "关闭",
  },
  en: {
    title: "Put AlreaDough on your home screen",
    android: "One tap to open, full screen like an app.",
    install: "Install",
    iosSafari: "Tap the Share icon at the bottom, then “Add to Home Screen”.",
    iosOther: (host: string) => `Only Safari can add this to your home screen. Open ${host} in Safari, then tap Share → “Add to Home Screen”.`,
    copy: "Copy link",
    copied: "Copied",
    wechatIos: "Tap “···” at the top right, choose “Open in Safari”, then use Safari's Share → “Add to Home Screen”.",
    wechatAndroid: "Tap “···” at the top right, choose “Open in browser”, then add it to your home screen.",
    close: "Close",
  },
} as const;

export default function InstallTip({ lang }: { lang: "zh" | "en" }) {
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const promptRef = useRef<InstallEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || Capacitor.isNativePlatform()) return;
    if (readStored(INSTALLED_KEY) === "yes") return;
    const detected = detectInstallMode(navigator.userAgent, navigator.maxTouchPoints);
    if (!detected) return;

    const today = localDayKey();
    const reveal = () => {
      if (readStored(DAY_KEY) === today) return;
      writeStored(DAY_KEY, today); // counted when it appears, so a reload cannot bring it back the same day
      setVisible(true);
    };

    let timer = 0;
    const arm = () => { window.clearTimeout(timer); timer = window.setTimeout(reveal, SHOW_AFTER_MS); };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallEvent;
      setMode("android");
      arm();
    };
    const onInstalled = () => { setVisible(false); writeStored(INSTALLED_KEY, "yes"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Android only offers the tip once Chrome says the app is installable; everyone else gets text steps.
    if (detected !== "android") { setMode(detected); arm(); }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !mode) return null;
  const text = copy[lang];
  const host = typeof window === "undefined" ? "" : window.location.host;
  const body = mode === "android" ? text.android
    : mode === "ios-safari" ? text.iosSafari
    : mode === "ios-other" ? text.iosOther(host)
    : mode === "wechat-ios" ? text.wechatIos
    : text.wechatAndroid;
  const dismiss = () => setVisible(false);
  const install = async () => {
    const event = promptRef.current;
    if (!event) return;
    promptRef.current = null;
    try {
      await event.prompt();
      if ((await event.userChoice).outcome === "accepted") writeStored(INSTALLED_KEY, "yes");
    } catch { /* the user can still add it from the browser menu */ }
    dismiss();
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin); setCopied(true); }
    catch { /* clipboard blocked: the text above already names the address */ }
  };

  return (
    <aside className="install-tip" role="status">
      <span className="install-tip-icon" aria-hidden="true">{mode === "android" ? <img src="/already-app-icon.png" alt="" width={28} height={28}/> : <Export size={20}/>}</span>
      <div>
        <strong>{text.title}</strong>
        <small>{body}</small>
      </div>
      {mode === "android" && <button className="install-tip-action" onClick={install}>{text.install}</button>}
      {mode === "ios-other" && <button className="install-tip-action" onClick={copyLink}>{copied ? text.copied : text.copy}</button>}
      <button className="install-tip-close" onClick={dismiss} aria-label={text.close}><X size={16}/></button>
    </aside>
  );
}
