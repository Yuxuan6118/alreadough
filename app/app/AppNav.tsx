import type { ComponentType } from "react";
import { GearSix, Plus } from "@phosphor-icons/react";
import DoughLineMark from "../components/DoughLineMark";
import { HistoryIcon } from "../components/NavIcons";
import type { Conversation, Lang, View } from "./model";

export type NavItem = { id: View; label: string; icon: ComponentType<{ size?: number; weight?: string }> };

type NavProps = {
  lang: Lang;
  view: View;
  items: NavItem[];
  navLabel: string;
  unreadCount: number;
  companionName: string;
  conversations: Conversation[];
  onLetters: () => void;
  onNewConversation: () => void;
  onNavigate: (view: View) => void;
  onOpenSpace: () => void;
};

/** The phone's side panel: letters, new conversation, the sections, past conversations, and My space. */
export function SwipeSidebar({ lang, view, items, navLabel, unreadCount, companionName, conversations, conversationId, open, dark, onLetters, onNewConversation, onNavigate, onOpenSpace, onPickConversation, onClose }: NavProps & {
  conversationId: string;
  open: boolean;
  dark: boolean;
  onPickConversation: (conversation: Conversation) => void;
  onClose: () => void;
}) {
  const sidebarOpen = open;
  return (
    <aside className={`swipe-sidebar${sidebarOpen ? " open" : ""}`} aria-label={lang === "zh" ? "侧边栏" : "Sidebar"} aria-hidden={!sidebarOpen} inert={!sidebarOpen} data-theme={dark ? "dark" : "light"}>
      <header><button type="button" className="swipe-brand" onClick={() => { onLetters(); onClose(); }} aria-label={lang === "zh" ? "来信" : "Letters"}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" />{unreadCount > 0 && <i className="brand-dot" />}</span><strong>Alrea<span className="brand-dough">Dough</span></strong></button></header>
      <button type="button" className="swipe-new" onClick={() => { onNewConversation(); onClose(); }}><Plus size={18}/>{lang === "zh" ? "新对话" : "New conversation"}</button>
      <nav className="swipe-nav" aria-label={navLabel}>
        {items.map((item) => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => { onNavigate(item.id); onClose(); }}><Icon size={28} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="swipe-history">
        <small>{lang === "zh" ? "对话记录" : "Conversations"}</small>
        {conversations.length ? conversations.map((conversation) => <button type="button" key={conversation.id} className={conversation.id === conversationId ? "is-open" : ""} aria-current={conversation.id === conversationId ? "true" : undefined} onClick={() => { onPickConversation(conversation); onClose(); }}><span>{conversation.title}</span><small>{conversation.id === conversationId ? (lang === "zh" ? "正在聊" : "Open now") : new Date(conversation.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</small></button>) : <p>{lang === "zh" ? "完成第一段对话后，它会出现在这里。" : "Your first conversation will appear here."}</p>}
      </div>
      <footer><button type="button" onClick={() => { onOpenSpace(); onClose(); }}><DoughLineMark className="avatar-mark avatar-mark-lg" /><span>{companionName || (lang === "zh" ? "我的空间" : "My space")}</span><GearSix size={24} className="swipe-gear" aria-hidden="true"/></button></footer>
    </aside>
  );
}

/** The desktop rail: the same entries, always visible, with the conversation history behind a button. */
export function AppRail({ lang, view, items, navLabel, unreadCount, companionName, conversations, onLetters, onNewConversation, onNavigate, onOpenSpace, onOpenHistory }: NavProps & { onOpenHistory: () => void }) {
  return (
    <aside className="app-rail">
      <button className="brand" onClick={onLetters} aria-label={lang === "zh" ? (unreadCount ? "有新来信" : "来信") : (unreadCount ? "New letter" : "Letters")} title={unreadCount ? (lang === "zh" ? "有一封来信" : "You have a letter") : undefined}><span className="brand-mark"><img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" />{unreadCount > 0 && <i className="brand-dot" />}</span><strong>Alrea<span className="brand-dough">Dough</span></strong></button>
      <button className="rail-new-chat" onClick={onNewConversation}><Plus size={18}/><span>{lang === "zh" ? "新对话" : "New conversation"}</span></button>
      <button className="rail-history" onClick={() => onOpenHistory()}><HistoryIcon size={26}/><span>{lang === "zh" ? "对话记录" : "Conversation history"}</span><small>{conversations.length}</small></button>
      <nav className="rail-nav" aria-label={navLabel}>
        {items.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => onNavigate(item.id)}><Icon size={26} weight={view === item.id ? "fill" : "regular"}/><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="rail-footer">
        <button className={`rail-menu-button${view === "settings" ? " active" : ""}`} onClick={() => onOpenSpace()}><span className="rail-avatar"><DoughLineMark className="avatar-mark" /></span><span>{companionName || (lang === "zh" ? "我的空间" : "My space")}</span></button>
      </div>
    </aside>
  );
}
