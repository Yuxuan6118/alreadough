"use client";

import { AppleLogo, DownloadSimple, WindowsLogo } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

type Lang = "zh" | "en";
type Platform = "mac" | "windows" | "phone" | "other";

/** Flip to true once public/downloads/AlreaDough-Pet-windows.zip is built (bash desktop-pet/windows/build.sh). */
const WINDOWS_PET_READY = true;

const subscribe = () => () => {};
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch gives it away
  if (/iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "phone";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  return "other";
}

const builds = [
  {
    id: "mac" as const,
    icon: AppleLogo,
    name: { zh: "Mac 版", en: "For Mac" },
    file: "/downloads/AlreaDough-Pet-mac.zip",
    ready: true,
    size: "2.8 MB",
    needs: { zh: "macOS 12 及以上，Apple 芯片和 Intel 都可以", en: "macOS 12 or later, Apple silicon or Intel" },
    steps: {
      zh: ["解压后，把「AlreaDough Pet」拖进「应用程序」文件夹，双击打开。", "第一次打开如果提示无法验证开发者：到「系统设置 → 隐私与安全性」，点「仍要打开」。"],
      en: ["Unzip it, drag “AlreaDough Pet” into Applications, and open it.", "If macOS says it cannot verify the developer: System Settings → Privacy & Security → Open Anyway."],
    },
  },
  {
    id: "windows" as const,
    icon: WindowsLogo,
    name: { zh: "Windows 版", en: "For Windows" },
    file: "/downloads/AlreaDough-Pet-windows.zip",
    ready: WINDOWS_PET_READY,
    size: "0.7 MB",
    needs: { zh: "Windows 10 / 11，不用另外安装别的东西", en: "Windows 10 or 11, nothing else to install" },
    steps: {
      zh: ["解压后，双击「AlreaDough Pet.exe」。可以把整个文件夹放在任何地方。", "如果出现「Windows 已保护你的电脑」：点「更多信息」，再点「仍要运行」。"],
      en: ["Unzip it and double-click “AlreaDough Pet.exe”. The folder can live anywhere.", "If Windows says it protected your PC: click More info, then Run anyway."],
    },
  },
];

/** My space → 下载桌宠: one place to get the desktop dough for each kind of computer. */
export default function DesktopPetPanel({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => "other" as Platform);
  const ordered = platform === "windows" ? [...builds].reverse() : builds;
  const tips = zh
    ? ["轻点面团会弹一下，连点三下开醒发派对。", "拉一拉会拉长；拉得够远它会挣脱，跟着你走，放在屏幕任何地方都行。", "右键可以换大小、让它躲一会儿、放回右下角，或者让它下班。"]
    : ["Tap the dough to make it bounce; three quick taps start a proofing party.", "Pull it and it stretches; pull far enough and it breaks free and follows you anywhere on screen.", "Right-click to change its size, hide it for a while, send it back to the corner, or quit."];
  return (
    <div className="settings-section profile-panel pet-panel">
      <div className="profile-cards">
        <section className="profile-card pet-intro">
          <img src="/mascot/already-dough-fold-v3.png" alt="" aria-hidden="true" />
          <div>
            <h3>{zh ? "让面团住在你的桌面上" : "Let the dough live on your desktop"}</h3>
          </div>
        </section>
        {platform === "phone" && <div className="library-elsewhere"><p>{zh ? "桌宠是给电脑用的，请在电脑上打开这一页下载。手机上直接用 AlreaDough 就好，首页就有面团。" : "The desktop pet is for computers; open this page on your computer to download it. On a phone, just use AlreaDough — the dough is on the home screen."}</p></div>}
        {ordered.map((build) => {
          const Icon = build.icon;
          const mine = build.id === platform;
          return (
            <section key={build.id} className={`profile-card pet-build${mine ? " mine" : ""}`}>
              <div className="pet-build-head">
                <span className="pet-os" aria-hidden="true"><Icon size={22} weight="fill" /></span>
                <div>
                  <h3>{build.name[lang]}{mine && <span className="wish-chip is-current">{zh ? "你正在用的电脑" : "This computer"}</span>}</h3>
                  <span>{build.needs[lang]}{build.ready ? ` · ${build.size}` : ""}</span>
                </div>
                {build.ready && <a className={`pet-download ${mine ? "wish-primary" : "profile-topic-plus"}`} href={build.file} download><DownloadSimple size={17} /> {zh ? "下载" : "Download"}</a>}
              </div>
              {build.ready
                ? <ol className="pet-steps">{build.steps[lang].map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
                : <p className="profile-sub pet-soon">{zh ? "正在打包，很快就能下载。" : "Being packaged; available soon."}</p>}
            </section>
          );
        })}
        <section className="profile-card pet-tips">
          <h3>{zh ? "怎么玩" : "How to play"}</h3>
          <ul className="pet-steps">{tips.map((tip) => <li key={tip}><b aria-hidden="true">·</b><span>{tip}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
