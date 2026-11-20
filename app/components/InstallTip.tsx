"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { DotsThree, Export, PlusSquare, X } from "@phosphor-icons/react";
import { detectInstallMode, localDayKey, type InstallMode } from "@/lib/install-mode";
import { readStored, writeStored } from "@/lib/safe-storage";

// "Put it on your home screen" tip for iPhone (and WeChat), at most once per day. Safari users get the
// two taps it needs and everyone on another iPhone browser is told to reopen the page in Safari. Not
// shown on desktop, inside the native shell, or once the app is already running from the home screen.
// No tip in Android browsers: many (Huawei's among them) add a plain shortcut that reopens inside the
// browser, so the page can't tell it is already on the home screen and the tip would come back daily.
const DAY_KEY = "already-install-tip-day-v1";
const SHOW_AFTER_MS = 8000;

// The words in 「」 are exactly what the phone's own menu says, with the same little icon beside them,
// so people can match what they see. Checked on iPhone Safari (iOS 26, Chinese): ··· → 共享 → 添加到主屏幕.
type Glyph = "share" | "add" | "dots";
const glyphs: Record<Glyph, ReactNode> = {
  share: <Export size={13} weight="bold" />,
  add: <PlusSquare size={13} weight="bold" />,
  dots: <DotsThree size={13} weight="bold" />,
};
function Key({ icon, children }: { icon?: Glyph; children: ReactNode }) {
  return <span className="install-key">「{icon && <i aria-hidden="true">{glyphs[icon]}</i>}{children}」</span>;
}

const copy = {
  zh: {
    title: "把 AlreaDough 放到手机桌面",
    iosSafari: <>点 Safari 的<Key icon="share">共享</Key>（看不到就先点底部的<Key icon="dots">···</Key>），再选<Key icon="add">添加到主屏幕</Key>。</>,
    iosOther: (host: string) => <>只有 Safari 可以添加到主屏幕。请用 Safari 打开 {host}，点<Key icon="share">共享</Key>，再选<Key icon="add">添加到主屏幕</Key>。</>,
    copy: "复制网址",
    copied: "已复制",
    wechatIos: <>点右上角<Key icon="dots">···</Key>，选在 Safari 中打开，再点<Key icon="share">共享</Key>→<Key icon="add">添加到主屏幕</Key>。</>,
    wechatAndroid: <>点右上角<Key icon="dots">···</Key>，选在浏览器中打开，再从浏览器菜单添加到桌面。</>,
    close: "关闭",
  },
  en: {
    title: "Put AlreaDough on your home screen",
    iosSafari: <>Tap Safari&apos;s <Key icon="share">Share</Key> (if you can&apos;t see it, tap <Key icon="dots">···</Key> at the bottom first), then <Key icon="add">Add to Home Screen</Key>.</>,
    iosOther: (host: string) => <>Only Safari can add this to your home screen. Open {host} in Safari, tap <Key icon="share">Share</Key>, then <Key icon="add">Add to Home Screen</Key>.</>,
    copy: "Copy link",
    copied: "Copied",
    wechatIos: <>Tap <Key icon="dots">···</Key> at the top right, open the page in Safari, then tap <Key icon="share">Share</Key> → <Key icon="add">Add to Home Screen</Key>.</>,
    wechatAndroid: <>Tap <Key icon="dots">···</Key> at the top right, open the page in your browser, then add it to your home screen from the browser menu.</>,
    close: "Close",
  },
};

type TipMode = Exclude<InstallMode, "android">;

function pageLang(): "zh" | "en" {
  try {
    const saved = JSON.parse(readStored("already-private-state-v5") || "{}") as { lang?: string };
    if (saved.lang === "zh" || saved.lang === "en") return saved.lang;
  } catch { /* fall through to the browser language */ }
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export default function InstallTip({ lang: forcedLang }: { lang?: "zh" | "en" }) {
  const [lang, setLang] = useState<"zh" | "en">(forcedLang || "zh");
  const [mode, setMode] = useState<TipMode | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const tipRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!forcedLang) setLang(pageLang()); // eslint-disable-line react-hooks/set-state-in-effect -- one-time read of the saved language
    const secure = window.location.protocol === "https:" || window.location.hostname === "localhost";
    if (secure && "serviceWorker" in navigator && !Capacitor.isNativePlatform()) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* the manual menu route still works */ });
    }
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const forced = new URLSearchParams(window.location.search).get("install") === "1"; // /app?install=1 always shows the tip
    if (!forced && (standalone || Capacitor.isNativePlatform())) return;
    const detected = detectInstallMode(navigator.userAgent, navigator.maxTouchPoints);
    if (!detected || detected === "android") return;

    const today = localDayKey();
    const reveal = () => {
      if (!forced && readStored(DAY_KEY) === today) return;
      setVisible(true); // today is only used up once the tip is confirmed on screen (see the effect below)
    };

    setMode(detected);
    const timer = window.setTimeout(reveal, forced ? 1000 : SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // A browser's ad or pop-up blocker can hide the tip without telling the page. Only count today as used
  // when the tip really has a box on screen, so a hidden tip gets another chance on the next visit.
  useEffect(() => {
    if (!visible || new URLSearchParams(window.location.search).get("install") === "1") return;
    const timer = window.setTimeout(() => {
      const box = tipRef.current;
      if (box && box.offsetHeight > 0 && window.getComputedStyle(box).visibility !== "hidden" && window.getComputedStyle(box).display !== "none") {
        writeStored(DAY_KEY, localDayKey());
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible || !mode) return null;
  const text = copy[lang];
  const host = typeof window === "undefined" ? "" : window.location.host;
  const body = mode === "ios-safari" ? text.iosSafari
    : mode === "ios-other" ? text.iosOther(host)
    : mode === "wechat-ios" ? text.wechatIos
    : text.wechatAndroid;
  const dismiss = () => setVisible(false);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(new URL("/app", window.location.origin).href); setCopied(true); }
    catch { /* clipboard blocked: the text above already names the address */ }
  };

  return (
    <aside className="install-tip" role="status" ref={tipRef}>
      <span className="install-tip-icon" aria-hidden="true"><Export size={20}/></span>
      <div>
        <strong>{text.title}</strong>
        <p className="install-tip-body">{body}</p>
      </div>
      {mode === "ios-other" && <button className="install-tip-action" onClick={copyLink}>{copied ? text.copied : text.copy}</button>}
      <button className="install-tip-close" onClick={dismiss} aria-label={text.close}><X size={16}/></button>
    </aside>
  );
}
