import { SITE_RECORD } from "@/lib/site-info";

export default function SiteFooter({ lang = "zh" }: { lang?: "zh" | "en" }) {
  return (
    <footer className="public-site-footer">
      <span>© AlreaDough</span>
      <nav aria-label={lang === "zh" ? "网站信息" : "Site information"}>
        <a href={lang === "en" ? "/en/about" : "/about"}>{lang === "zh" ? "产品介绍" : "About AlreaDough"}</a>
        <a href={lang === "en" ? "/en/pricing" : "/pricing"}>{lang === "zh" ? "会员与价格" : "Membership & pricing"}</a>
        <a href={lang === "en" ? "/terms#english" : "/terms"}>{lang === "zh" ? "服务条款" : "Terms of Service"}</a>
        <a href={lang === "en" ? "/privacy#english" : "/privacy"}>{lang === "zh" ? "隐私声明" : "Privacy Notice"}</a>
        <a href={lang === "en" ? "/en/trust" : "/trust"}>{lang === "zh" ? "AI 与安全" : "AI & safety"}</a>
        {SITE_RECORD.contactEmail && <a href={`mailto:${SITE_RECORD.contactEmail}`}>{lang === "zh" ? "联系客服" : "Contact support"}</a>}
      </nav>
    </footer>
  );
}
