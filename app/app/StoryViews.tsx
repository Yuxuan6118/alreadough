import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, DotsThree, ImageSquare, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import StoryCoverImage from "../components/StoryCoverImage";
import DoughHop from "../components/DoughHop";
import DoughPageIcon from "../components/DoughPageIcon";
import { MAX_STORIES, storyMeta, type Lang, type Story } from "./model";

/** 剧本库: every script as a cover tile, each with its own small menu, and a tile to add a new one. */
export function StoryLibrary({ lang, stories, onOpen, onEdit, onChangeCover, onDelete }: {
  lang: Lang;
  stories: Story[];
  onOpen: (index: number) => void;
  /** No story: start a new one. */
  onEdit: (story?: Story) => void;
  onChangeCover: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  return <section className="full-view story-library-view">
    <div className="view-heading"><p className="eyebrow">{lang === "zh" ? "你的剧本库" : "YOUR SCRIPT LIBRARY"}</p><h1>{lang === "zh" ? "写下已经发生的生活" : "Write the life already lived"}</h1></div>
    <div className="story-library-meta"><span>{stories.length} / {MAX_STORIES}</span></div>
    <div className="story-grid">
      {stories.map((story, index) => <article className="story-tile" key={story.id}>
        <button type="button" className="story-tile-open" onClick={() => { setMenuId(null); onOpen(index); }}>
          <StoryCoverImage image={story.cover?.image} tone={story.tone} lazy/>
          <span className="story-tile-text">{storyMeta(story, lang) && <small>{storyMeta(story, lang)}</small>}<strong>{story.title[lang]}</strong></span>
        </button>
        <button type="button" className="story-tile-more" aria-label={lang === "zh" ? `${story.title[lang]}的更多操作` : `More for ${story.title[lang]}`} aria-expanded={menuId === story.id} onClick={() => setMenuId((id) => id === story.id ? null : story.id)}><DotsThree size={22} weight="bold"/></button>
        {menuId === story.id && <>
          <button type="button" className="story-tile-scrim" aria-label={lang === "zh" ? "关闭菜单" : "Close menu"} onClick={() => setMenuId(null)}/>
          <div className="story-tile-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuId(null); onEdit(story); }}><PencilSimple size={17}/>{lang === "zh" ? "编辑剧本" : "Edit story"}</button>
            <button type="button" role="menuitem" onClick={() => { setMenuId(null); onChangeCover(story.id); }}><ImageSquare size={17}/>{lang === "zh" ? "换封面" : "Change cover"}</button>
            <button type="button" role="menuitem" className="danger" onClick={() => { setMenuId(null); onDelete(story.id); }}><Trash size={17}/>{lang === "zh" ? "删除" : "Delete"}</button>
          </div>
        </>}
      </article>)}
      {stories.length < MAX_STORIES && <button type="button" className="story-tile-add" onClick={() => onEdit()}><span><Plus size={26}/></span><strong>{lang === "zh" ? "添加新剧本" : "Add a script"}</strong><small>{lang === "zh" ? "写下一段已经发生的回忆" : "Write down a memory already lived"}</small></button>}
    </div>
  </section>;
}

/** Reading one script: cover, text, writing it (again) as a script, and stepping to the previous or next one. */
export function StoryReader({ lang, story, stories, index, writing, busy, storiesLeft, quotaOut, aiError, aiErrorTitle, onBack, onEdit, onChangeCover, onWrite, onGo, onUpgrade }: {
  lang: Lang;
  story: Story;
  stories: Story[];
  index: number;
  /** This story is being written right now. */
  writing: boolean;
  /** Another story is being written: one at a time. */
  busy: boolean;
  storiesLeft: number | null;
  quotaOut: boolean;
  aiError: string;
  aiErrorTitle: string;
  onBack: () => void;
  onEdit: () => void;
  onChangeCover: () => void;
  onWrite: () => void;
  onGo: (index: number) => void;
  /** Absent in the iPhone app (no way to pay outside the App Store). */
  onUpgrade?: () => void;
}) {
  return <section className="full-view story-reader">
    {/* Pinned while reading, so back and edit are one tap away at any point of a long script. */}
    <header className="story-reader-bar">
      <button type="button" className="story-bar-back" onClick={onBack}><ArrowLeft size={20}/><span>{lang === "zh" ? "剧本库" : "Scripts"}</span></button>
      <button type="button" className="story-bar-edit" onClick={onEdit}><PencilSimple size={18}/><span>{lang === "zh" ? "编辑剧本" : "Edit"}</span></button>
    </header>
    <div className="story-hero">
      <StoryCoverImage image={story.cover?.image} tone={story.tone}/>
      <button type="button" className="story-cover-change" onClick={onChangeCover}><ImageSquare size={18}/><span>{story.cover?.image ? (lang === "zh" ? "换封面" : "Change cover") : (lang === "zh" ? "加封面" : "Add a cover")}</span></button>
    </div>
    <div className="story-stack">
      <header className="story-card story-sheet-head">{storyMeta(story, lang) && <small>{storyMeta(story, lang)}</small>}<h1>{story.title[lang]}</h1>{story.subtitle[lang] && <p>{story.subtitle[lang]}</p>}</header>
      <article className={`story-card story-body${writing ? " is-writing" : ""}`} aria-busy={writing}>{story.text[lang].map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}{story.anchor[lang] && !story.scripted && <blockquote>{story.anchor[lang]}</blockquote>}</article>
      <div className="story-card story-expand">
        <div className="story-expand-text">
          <strong>{story.scripted ? (lang === "zh" ? "想换一种写法？" : "Want a different version?") : (lang === "zh" ? "把这段回忆写成剧本" : "Turn this memory into a script")}</strong>
          {storiesLeft !== null && <StoryQuotaNote lang={lang} left={storiesLeft} onUpgrade={onUpgrade}/>}
        </div>
        {writing ? <StoryWritingLoader lang={lang}/> : <button type="button" className={story.scripted ? "profile-topic-plus" : "wish-primary"} onClick={onWrite} disabled={busy || quotaOut}>{story.scripted ? <DoughPageIcon size={16}/> : null} {story.scripted ? (lang === "zh" ? "重新写一版" : "Write it again") : (lang === "zh" ? "写成剧本" : "Write it as a script")}</button>}
      </div>
      {aiError && <div className="ai-notice story-ai-notice"><strong>{aiErrorTitle}</strong><span>{aiError}</span></div>}
      {stories.length > 1 && (() => {
        const prevIndex = (index - 1 + stories.length) % stories.length;
        const nextIndex = (index + 1) % stories.length;
        return <nav className="story-controls" aria-label={lang === "zh" ? "切换剧本" : "Switch story"}>
          <button type="button" className="story-card" onClick={() => onGo(prevIndex)}><small><ArrowLeft size={14}/> {lang === "zh" ? "上一个" : "Previous"}</small><strong>{stories[prevIndex].title[lang]}</strong></button>
          <button type="button" className="story-card" onClick={() => onGo(nextIndex)}><small>{lang === "zh" ? "下一个" : "Next"} <ArrowRight size={14}/></small><strong>{stories[nextIndex].title[lang]}</strong></button>
        </nav>;
      })()}
    </div>
  </section>;
}

/** Scripts left this week; when none are left, when they come back and a way to upgrade (not in the iPhone app). */
export function StoryQuotaNote({ lang, left, onUpgrade }: { lang: Lang; left: number; onUpgrade?: () => void }) {
  const zh = lang === "zh";
  if (left > 0) return <p className="story-quota-note">{zh ? `本周还能写 ${left} 篇剧本` : `${left} script${left === 1 ? "" : "s"} left this week`}</p>;
  return <p className="story-quota-note is-out">{zh ? "本周剧本额度用完了，周一恢复。你仍然可以自己写好场景，只保存。" : "This week's scripts are used up; they come back on Monday. You can still write the scene yourself and save it."}{onUpgrade && <button type="button" onClick={onUpgrade}>{zh ? "升级会员" : "Upgrade"}</button>}</p>;
}

/** While a script is being written: the line-drawn dough hops in place above a soft shadow. */
function StoryWritingLoader({ lang }: { lang: Lang }) {
  const ref = useRef<HTMLDivElement>(null);
  // once, when it appears: she sees the dough whether she pressed at the top or the bottom of a long script
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);
  return <div className="story-writing" role="status" ref={ref}>
    <DoughHop size="lg"/>
    <p>{lang === "zh" ? "正在把你的关键词写成剧本，大约半分钟……" : "Writing your keywords into a script, about half a minute…"}</p>
  </div>;
}
