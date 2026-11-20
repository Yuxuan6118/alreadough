import { ArrowCounterClockwise, CaretRight, DownloadSimple, Moon, Sun, Trash } from "@phosphor-icons/react";
import { SiteRecord } from "../components/Compliance";
import FontSizePanel from "../components/FontSizePanel";
import SyncPanel from "../components/SyncPanel";
import { CopyrightIcon, PricingIcon, PrivacyIcon, ReportIcon, SafetyIcon, TermsIcon } from "../components/HelpIcons";
import type { Lang } from "./model";

// Sections of My space that only show settings and hand actions back to the page.

/** 外观与语言: day or night, interface language, text size. */
export function LookSection({ lang, dark, onTheme, onSwitchLanguage }: { lang: Lang; dark: boolean; onTheme: (theme: "light" | "dark") => void; onSwitchLanguage: () => void }) {
  return (
    <div className="settings-section profile-panel look-section">
        <div className="profile-cards">
          <section className="profile-card">
            <h3>{lang === "zh" ? "日夜间模式" : "Day and night"}</h3>
            <div className="look-options" role="radiogroup" aria-label={lang === "zh" ? "日夜间模式" : "Day and night"}>
              {([["light", Sun, "浅色", "Light"], ["dark", Moon, "深色", "Dark"]] as const).map(([option, Icon, zhLabel, enLabel]) => <button key={option} type="button" role="radio" aria-checked={(option === "dark") === dark} className={(option === "dark") === dark ? "selected" : ""} onClick={() => onTheme(option)}>
                <Icon size={22} aria-hidden="true" />
                <small>{lang === "zh" ? zhLabel : enLabel}</small>
              </button>)}
            </div>
            <p className="profile-sub theme-note">{lang === "zh" ? "手机最顶上那一条的颜色由手机系统决定，只能跟随手机自己的深色模式：在手机设置里打开深色模式时，顶部才会和页面一起变暗；没打开时，顶部就是浅色。换了模式后如果顶部和页面颜色对不上，在后台把 AlreaDough 上划关掉，再重新打开就好。" : "The strip at the very top of your phone takes its colour from the phone itself, so it can only follow your phone's Dark Mode: it darkens with the page only when Dark Mode is on in your phone's settings, and stays light when it's off. If the top and the page don't match after you switch, swipe AlreaDough away in the app switcher and open it again."}</p>
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? "界面语言" : "Language"}</h3>
            <div className="wish-pills" role="radiogroup" aria-label={lang === "zh" ? "界面语言" : "Language"}>
              {([["zh", "简体中文"], ["en", "English"]] as const).map(([option, label]) => <button key={option} type="button" role="radio" aria-checked={lang === option} className={lang === option ? "selected" : ""} onClick={() => { if (lang !== option) onSwitchLanguage(); }}>{label}</button>)}
            </div>
          </section>
          <FontSizePanel lang={lang} />
        </div>
      </div>
  );
}

/** 同步与数据: sync status, export, running the opening again, clearing everything. */
export function DataSection({ lang, syncStatus, onExport, onReplay, onClearEverything }: { lang: Lang; syncStatus: "loading" | "saved" | "saving" | "offline"; onExport: () => void; onReplay: () => void; onClearEverything: () => void }) {
  return (
    <div className="settings-section profile-panel data-section">
        <div className="profile-cards">
          <SyncPanel lang={lang} syncStatus={syncStatus} />
          <section className="profile-card">
            <h3>{lang === "zh" ? "导出我的数据" : "Export my data"}</h3>
            <p className="profile-sub">{lang === "zh" ? "下载一个压缩包：解压后双击里面的 index.html，就能在浏览器里查看、搜索你的愿望、对话、记忆和剧本；原始数据也一起附上（JSON 格式）。私密照片和录音不在里面。" : "Download a .zip: unzip it and open index.html to read and search your desires, conversations, memories and stories in a browser. The raw data comes along as JSON. Private photos and audio are not included."}</p>
            <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={onExport}><DownloadSimple size={16} /> {lang === "zh" ? "导出压缩包" : "Download .zip"}</button></div>
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? "重新走一遍开场" : "Run the opening again"}</h3>
            <p className="profile-sub">{lang === "zh" ? "把开场的问题再填一遍。你填的内容会加进现在的账号，已有的愿望、记忆和对话都不会被删除。" : "Answer the opening questions again. What you write is added to this account; nothing you already have is deleted."}</p>
            <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={onReplay}><ArrowCounterClockwise size={16} /> {lang === "zh" ? "开始" : "Start"}</button></div>
          </section>
          <section className="profile-card data-danger">
            <h3>{lang === "zh" ? "清除全部数据" : "Clear everything"}</h3>
            <p className="profile-sub">{lang === "zh" ? "云端和这台设备上的愿望、对话、记忆、剧本、照片与音频都会删除，不能恢复。需要的话先导出一份。" : "Desires, conversations, memories, stories, photos and audio in the cloud and on this device are deleted and cannot be recovered. Export a copy first if you want one."}</p>
            <div className="data-actions"><button type="button" className="data-danger-button" onClick={onClearEverything}><Trash size={16} /> {lang === "zh" ? "清除全部数据" : "Clear everything"}</button></div>
          </section>
        </div>
      </div>
  );
}

/** 帮助: reporting content, the site record, and the notices and terms. */
export function HelpSection({ lang, trustLabel, onReport }: { lang: Lang; trustLabel: string; onReport: () => void }) {
  return (
    <div className="settings-section profile-panel help-section">
        <div className="profile-cards">
          <section className="profile-card">
            <h3>{lang === "zh" ? "联系与举报" : "Contact & reports"}</h3>
            <p className="profile-sub">{lang === "zh" ? "发现不当、违法或让你不舒服的内容，可以在这里举报。每条 AI 回复下面也有“举报”按钮。我们会尽快查看。" : "If you see anything inappropriate, unlawful, or upsetting, report it here. Every AI reply also has a Report button. We read these as soon as we can."}</p>
            <div className="data-actions"><button type="button" className="profile-topic-plus" onClick={onReport}><ReportIcon size={16} /> {lang === "zh" ? "举报内容或反馈问题" : "Report content or send feedback"}</button></div>
            <SiteRecord lang={lang} />
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? "说明与条款" : "Notices & terms"}</h3>
            <ul className="help-links">
              {([
                ["/pricing", PricingIcon, lang === "zh" ? "会员与价格" : "Membership & pricing"],
                ["/trust", SafetyIcon, trustLabel],
                ["/privacy", PrivacyIcon, lang === "zh" ? "隐私说明" : "Privacy"],
                ["/terms", TermsIcon, lang === "zh" ? "测试版条款" : "Beta terms"],
                ["/copyright", CopyrightIcon, lang === "zh" ? "素材与版权" : "Content & copyright"],
              ] as const).map(([href, Icon, label]) => <li key={href}><a href={href}><span className="help-icon" aria-hidden="true"><Icon size={18} /></span><span>{label}</span><CaretRight size={16} aria-hidden="true" /></a></li>)}
            </ul>
          </section>
        </div>
      </div>
  );
}
