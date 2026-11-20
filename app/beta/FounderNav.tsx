import type { ReactNode } from "react";
import Link from "next/link";
import "./founder-nav.css";

type Page = "cockpit" | "chats" | "mail";

const PAGES: Array<{ id: Page; href: string; label: string }> = [
  { id: "cockpit", href: "/beta", label: "驾驶舱" },
  { id: "chats", href: "/beta/chats", label: "对话记录" },
  { id: "mail", href: "/beta/mail", label: "给用户写信" },
];

/** The same row of links on every founder page; the page you are on is marked. `badges` puts a count on a link (e.g. reports waiting). */
export default function FounderNav({ current, badges, children }: { current: Page; badges?: Partial<Record<Page, number>>; children?: ReactNode }) {
  return <nav className="founder-nav" aria-label="创始人页面">
    {children}
    {PAGES.map((page) => <a key={page.id} href={page.href} className={page.id === current ? "current" : ""} aria-current={page.id === current ? "page" : undefined}>
      {page.label}{badges?.[page.id] ? <b>{badges[page.id]}</b> : null}
    </a>)}
    <Link href="/" className="founder-nav-home">返回 AlreaDough</Link>
  </nav>;
}
