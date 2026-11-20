import { useState, type Dispatch, type SetStateAction } from "react";
import { Brain, CaretDown, PencilSimple, Plus, PushPin, Trash, X } from "@phosphor-icons/react";
import { MAX_STORY_SETTING } from "@/lib/onboarding-flow";
import { MAX_BACKGROUND, MAX_BELIEFS, goalTitle, memoryKinds, type GoalProfile, type Lang, type MemoryItem, type MemoryKind } from "./model";

/** 背景与念头: the current desire's context, the people-and-life setting for scripts, and the thoughts to turn around. */
export function ContextSection({ lang, goal, setGoal, beliefs, beliefCount, beliefInput, onBeliefInput, onAddBelief, onTurnBelief, onRemoveBelief }: {
  lang: Lang;
  goal: GoalProfile;
  setGoal: Dispatch<SetStateAction<GoalProfile>>;
  beliefs: string[];
  beliefCount: number;
  beliefInput: string;
  onBeliefInput: (value: string) => void;
  onAddBelief: () => void;
  onTurnBelief: (belief: string) => void;
  onRemoveBelief: (belief: string) => void;
}) {
  return (
    <div className="settings-section profile-panel">
        <div className="profile-cards">
          <div className="memory-for"><span className="wish-chip is-current">{lang === "zh" ? "当前愿望" : "Current desire"}</span><span>{goalTitle(goal, lang)}</span></div>
          <section className="profile-card">
            <h3>{lang === "zh" ? "我的背景与处境" : "My context"}</h3>
            <label className="wish-field"><span className="profile-sub">{lang === "zh" ? "和这个愿望有关的经历、现状和顾虑" : "What has happened, where things stand, and what worries you"}</span><textarea maxLength={MAX_BACKGROUND} value={goal.background[lang]} onChange={(event) => setGoal((current) => ({ ...current, background: { ...current.background, [lang]: event.target.value } }))} placeholder={lang === "zh" ? "写得越具体，回复越贴合你的情况。" : "The more specific, the better the replies fit."}/></label>
            <small className="profile-count">{goal.background[lang].length} / {MAX_BACKGROUND}</small>
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? "人物与生活设定" : "People and life"}</h3>
            <label className="wish-field" aria-label={lang === "zh" ? "人物与生活设定" : "People and life"}><textarea maxLength={MAX_STORY_SETTING} value={goal.storySetting[lang]} onChange={(event) => { const value = event.target.value; setGoal((current) => ({ ...current, storySetting: { ...current.storySetting, [lang]: value } })); }} placeholder={lang === "zh" ? "比如：他家里条件很好，穿衣讲究但不张扬，说话慢。不要写他穿运动品牌。" : "For example: he comes from money, dresses well but quietly, speaks slowly. No sportswear on him."}/></label>
            <small className="profile-count">{goal.storySetting[lang].length} / {MAX_STORY_SETTING}</small>
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? "想换掉的念头" : "Thoughts to turn around"}</h3>
            {beliefs.length ? <ul className="thought-rows">{beliefs.map((item, index) => <li key={`${index}-${item}`}><span>{item}</span><button type="button" className="thought-turn" onClick={() => onTurnBelief(item)}>{lang === "zh" ? "转念" : "Reframe"}</button><button type="button" className="profile-remove" aria-label={lang === "zh" ? `删除：${item}` : `Delete: ${item}`} onClick={() => onRemoveBelief(item)}><X size={16}/></button></li>)}</ul> : <p className="setting-empty">{lang === "zh" ? "还没有写下想换掉的念头。" : "Nothing written here yet."}</p>}
            {beliefCount < MAX_BELIEFS && <div className="profile-topic-add"><input value={beliefInput} maxLength={200} onChange={(event) => onBeliefInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); onAddBelief(); } }} placeholder={lang === "zh" ? "例如：他根本不在乎我" : "e.g. They don't really care"} aria-label={lang === "zh" ? "添加一个想换掉的念头" : "Add a thought to turn around"}/><button type="button" className="profile-topic-plus" disabled={!beliefInput.trim()} onClick={onAddBelief}><Plus size={15}/> {lang === "zh" ? "添加" : "Add"}</button></div>}
            <small className={`profile-count${beliefCount > MAX_BELIEFS ? " over" : ""}`}>{beliefCount} / {MAX_BELIEFS}</small>
          </section>
        </div>
      </div>
  );
}

/** 记忆库: what AlreaDough understands about the current desire, what it remembers (filterable), and accepted scenes. */
export function LibrarySection({ lang, goal, currentMemoryItems, onEditMemory, onTogglePin, onDeleteMemory }: {
  lang: Lang;
  goal: GoalProfile;
  currentMemoryItems: MemoryItem[];
  /** No item: write a new one. */
  onEditMemory: (item?: MemoryItem) => void;
  onTogglePin: (id: string) => void;
  onDeleteMemory: (id: string) => void;
}) {
  const [memoryFilter, setMemoryFilter] = useState<MemoryKind | "all">("all");
  const [openScene, setOpenScene] = useState<number | null>(null);
  const filteredMemoryItems = currentMemoryItems
    .filter((item) => memoryFilter === "all" || item.kind === memoryFilter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="settings-section profile-panel library-section">
        <div className="profile-cards">
          <div className="memory-for"><span className="wish-chip is-current">{lang === "zh" ? "当前愿望" : "Current desire"}</span><span>{goalTitle(goal, lang)}</span></div>
          <section className="profile-card">
            <h3>{lang === "zh" ? "AlreaDough 对这个愿望的理解" : "What AlreaDough understands so far"}</h3>
            <p className="library-summary">{goal.journeySummary[lang] || (lang === "zh" ? "对话开始后，这里会形成简短摘要。" : "A short summary will form after conversations begin.")}</p>
            
          </section>
          <section className="profile-card">
            <div className="library-card-head"><h3>{lang === "zh" ? `记住的事 · ${currentMemoryItems.length}` : `Remembered · ${currentMemoryItems.length}`}</h3><button type="button" className="profile-topic-plus" onClick={() => onEditMemory()}><Plus size={15}/> {lang === "zh" ? "添加" : "Add"}</button></div>
            {currentMemoryItems.length > 0 && <div className="wish-pills library-filter" role="group" aria-label={lang === "zh" ? "筛选记忆" : "Filter memories"}><button type="button" className={memoryFilter === "all" ? "selected" : ""} onClick={() => setMemoryFilter("all")}>{lang === "zh" ? "全部" : "All"} <small>{currentMemoryItems.length}</small></button>{memoryKinds.map((kind) => { const count = currentMemoryItems.filter((item) => item.kind === kind.id).length; return count ? <button type="button" key={kind.id} className={memoryFilter === kind.id ? "selected" : ""} onClick={() => setMemoryFilter(kind.id)}>{lang === "zh" ? kind.zh : kind.en} <small>{count}</small></button> : null; })}</div>}
            {filteredMemoryItems.length ? <ul className="memory-rows">{filteredMemoryItems.map((item) => <li key={item.id} className={item.pinned ? "pinned" : ""}><div className="memory-row-head"><span className="wish-chip">{lang === "zh" ? memoryKinds.find((kind) => kind.id === item.kind)?.zh : memoryKinds.find((kind) => kind.id === item.kind)?.en}</span>{item.pinned && <span className="wish-chip is-current">{lang === "zh" ? "已置顶" : "Pinned"}</span>}<div className="memory-row-actions"><button type="button" onClick={() => onTogglePin(item.id)} aria-pressed={item.pinned} aria-label={item.pinned ? (lang === "zh" ? "取消置顶" : "Unpin") : (lang === "zh" ? "置顶" : "Pin")}><PushPin size={16} weight={item.pinned ? "fill" : "regular"}/></button><button type="button" onClick={() => onEditMemory(item)} aria-label={lang === "zh" ? "编辑记忆" : "Edit memory"}><PencilSimple size={16}/></button><button type="button" className="memory-row-delete" onClick={() => onDeleteMemory(item.id)} aria-label={lang === "zh" ? "删除记忆" : "Delete memory"}><Trash size={16}/></button></div></div><strong>{item.title}</strong><p>{item.detail}</p>{item.keywords.length > 0 && <footer>{item.keywords.map((keyword) => <small key={keyword}>{keyword}</small>)}</footer>}</li>)}</ul> : currentMemoryItems.length === 0 ? <div className="library-empty"><Brain size={22}/><p>{lang === "zh" ? "继续聊天，值得记住的事会慢慢出现在这里；也可以亲手写下第一条。" : "Keep talking and what is worth keeping will appear here, or write the first one yourself."}</p></div> : <p className="setting-empty">{lang === "zh" ? "这一类还没有记忆。" : "Nothing in this category yet."}</p>}
          </section>
          <section className="profile-card">
            <h3>{lang === "zh" ? `已接纳的新场景 · ${goal.acceptedSceneLedger[lang].length}` : `Accepted scenes · ${goal.acceptedSceneLedger[lang].length}`}</h3>
            {goal.acceptedSceneLedger[lang].length ? <ul className="scene-rows">{goal.acceptedSceneLedger[lang].map((item, index) => <li key={`${index}-${item.slice(0, 24)}`}><button type="button" className={openScene === index ? "open" : ""} aria-expanded={openScene === index} onClick={() => setOpenScene(openScene === index ? null : index)}><span>{item}</span><CaretDown size={15}/></button></li>)}</ul> : <p className="setting-empty">{lang === "zh" ? "在剧本里接纳的场景会出现在这里。" : "Scenes you accept in Stories will appear here."}</p>}
          </section>
        </div>
      </div>
  );
}
