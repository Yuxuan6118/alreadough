"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowClockwise, BookmarkSimple, ChatCircleText, PaperPlaneTilt, Plus, PushPin, SpeakerHigh, Trash, UploadSimple, X } from "@phosphor-icons/react";
import SpacePage from "./SpacePage";
import { PersonaIcon } from "./NavIcons";
import { askConfirm } from "./ConfirmHost";
import { readStored, writeStored } from "@/lib/safe-storage";
import { FACT_GROUPS, PERSONA_LIMITS, emptyPersona, type Persona, type PersonaMemory, type PersonaMessage } from "@/lib/persona";
import "./persona.css";

type Lang = "zh" | "en";
type Tab = "chat" | "profile" | "import" | "memories";
type Store = { personas: Persona[]; chats: Record<string, PersonaMessage[]> };
type Extracted = {
  styleSummary: string; neverSays: string; quotes: Array<{ text: string; topic?: string }>;
  taNameForHer: string; herNameForTa: string; facts: Record<string, string>; memories: string[];
};

const STORE_KEY = "already-personas-v1";
const ADULT_KEY = "already-persona-adult-v1";
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function loadStore(): Store {
  try {
    const raw = readStored(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) as Store : null;
    if (parsed && Array.isArray(parsed.personas)) return { personas: parsed.personas, chats: parsed.chats || {} };
  } catch { /* fall through */ }
  return { personas: [], chats: {} };
}

/** A long log is cut into evenly spaced windows so the whole history is sampled, not only its start. */
function sampleLog(text: string, max = PERSONA_LIMITS.importChars) {
  if (text.length <= max) return text;
  const windows = 30, size = Math.floor(max / windows), step = (text.length - size) / (windows - 1);
  return Array.from({ length: windows }, (_, i) => text.slice(Math.round(i * step), Math.round(i * step) + size)).join("\n…\n");
}

type Props = {
  lang: Lang;
  sessionId: string;
  herName: string;
  /** opens the membership page; left out in the iPhone app */
  onOpenMembership?: () => void;
};

export default function PersonaStudio({ lang, sessionId, herName, onOpenMembership }: Props) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  // The page only opens after the app has hydrated (the start view is home), so reading storage up front is safe.
  const [store, setStore] = useState<Store>(loadStore);
  const [activeId, setActiveId] = useState<string>(() => store.personas[0]?.id || "new");
  const [tab, setTab] = useState<Tab>(() => (store.personas[0] ? "chat" : "profile"));
  const [adult, setAdult] = useState(() => readStored(ADULT_KEY) === "1");
  const [hasVoice, setHasVoice] = useState(false);

  useEffect(() => { writeStored(STORE_KEY, JSON.stringify(store)); }, [store]);
  useEffect(() => {
    if (!sessionId || sessionId === "local-beta") return;
    fetch("/api/voice", { headers: { "x-already-session-id": sessionId } })
      .then((r) => r.json() as Promise<{ hasVoice?: boolean }>).then((d) => setHasVoice(!!d.hasVoice)).catch(() => undefined);
  }, [sessionId]);

  const persona = store.personas.find((p) => p.id === activeId) || null;
  const messages = persona ? store.chats[persona.id] || [] : [];

  const updatePersona = (id: string, change: (p: Persona) => Persona) =>
    setStore((s) => ({ ...s, personas: s.personas.map((p) => (p.id === id ? { ...change(p), updatedAt: now() } : p)) }));
  const setMessages = (id: string, change: (m: PersonaMessage[]) => PersonaMessage[]) =>
    setStore((s) => ({ ...s, chats: { ...s.chats, [id]: change(s.chats[id] || []).slice(-PERSONA_LIMITS.messagesKept) } }));

  const createPersona = (name: string) => {
    const fresh = { ...emptyPersona(), name: name.trim() };
    setStore((s) => ({ ...s, personas: [...s.personas, fresh] }));
    setActiveId(fresh.id);
    setTab("profile");
  };
  const deletePersona = async (p: Persona) => {
    const ok = await askConfirm({
      title: t(`删除 ${p.name}？`, `Delete ${p.name}?`),
      body: t("资料、记忆和对话都会从这台设备删除，不能恢复。", "The profile, memories and chat will be deleted from this device. This can't be undone."),
      confirmLabel: t("删除", "Delete"), cancelLabel: t("取消", "Cancel"),
    });
    if (!ok) return;
    setStore((s) => {
      const chats = { ...s.chats };
      delete chats[p.id];
      const personas = s.personas.filter((x) => x.id !== p.id);
      setActiveId(personas[0]?.id || "new");
      return { personas, chats };
    });
  };

  const groups = [
    ...(store.personas.length ? [{ title: t("TA", "TA"), rows: store.personas.map((p) => ({ id: p.id, label: p.name.trim() || "TA", icon: PersonaIcon })) }] : []),
    ...(store.personas.length < PERSONA_LIMITS.personas ? [{ title: "", rows: [{ id: "new", label: t("写一个新的 TA", "Write a new TA"), icon: Plus }] }] : []),
  ];

  return (
    <SpacePage className="persona-page" title={t("TA", "TA")} groups={groups} active={activeId} onSelect={(id) => { setActiveId(id); if (id !== "new") setTab("chat"); }}>
      {activeId === "new" || !persona
        ? <NewPersona lang={lang} adult={adult} onAdult={() => { setAdult(true); writeStored(ADULT_KEY, "1"); }} onCreate={createPersona} />
        : <>
          <div className="wish-pills persona-tabs" role="tablist">
            {([["chat", t("对话", "Chat")], ["profile", t("资料", "Profile")], ["import", t("导入聊天记录", "Import a chat")], ["memories", t("记忆", "Memories")]] as const).map(([id, label]) => (
              <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? "selected" : ""} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === "chat" && <PersonaChat key={persona.id} lang={lang} sessionId={sessionId} herName={herName} persona={persona} messages={messages}
            setMessages={(change) => setMessages(persona.id, change)} updatePersona={(change) => updatePersona(persona.id, change)} onOpenMembership={onOpenMembership} />}
          {tab === "profile" && <PersonaProfile lang={lang} persona={persona} hasVoice={hasVoice} update={(change) => updatePersona(persona.id, change)} onDelete={() => deletePersona(persona)} />}
          {tab === "import" && <PersonaImport lang={lang} sessionId={sessionId} persona={persona} update={(change) => updatePersona(persona.id, change)} onDone={() => setTab("profile")} onOpenMembership={onOpenMembership} />}
          {tab === "memories" && <PersonaMemories lang={lang} persona={persona} update={(change) => updatePersona(persona.id, change)} />}
        </>}
    </SpacePage>
  );
}

function NewPersona({ lang, adult, onAdult, onCreate }: { lang: Lang; adult: boolean; onAdult: () => void; onCreate: (name: string) => void }) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(adult);
  return (
    <section className="persona-card persona-new">
      <p className="persona-lead">{t("写下 TA 的样子、说话的方式和你们的故事，然后和已经选择了你的那一版 TA 说说话。", "Write down who TA is, how TA talks and your story, then talk with the version of TA who has already chosen you.")}</p>
      <p className="persona-note">{t("这里的 TA 由你写下的资料生成，是你心里那一版的 TA。", "This TA is made from what you write: the TA in your own imagination.")}</p>
      <label className="persona-field">
        <span>{t("TA 的名字", "TA's name")}</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t("你平时怎么叫 TA", "What you call TA")} />
      </label>
      {!adult && <label className="persona-check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{t("我已年满 18 岁", "I am 18 or older")}</label>}
      <div className="space-card-actions">
        <button type="button" className="persona-primary" disabled={!name.trim() || !agreed} onClick={() => { if (!adult) onAdult(); onCreate(name); }}>{t("开始写 TA", "Start writing TA")}</button>
      </div>
    </section>
  );
}

// ---------- chat ----------

type ChatProps = {
  lang: Lang; sessionId: string; herName: string; persona: Persona; messages: PersonaMessage[];
  setMessages: (change: (m: PersonaMessage[]) => PersonaMessage[]) => void;
  updatePersona: (change: (p: Persona) => Persona) => void;
  onOpenMembership?: () => void;
};

function PersonaChat({ lang, sessionId, herName, persona, messages, setMessages, updatePersona, onOpenMembership }: ChatProps) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [speaking, setSpeaking] = useState<string | null>(null);
  const audioCache = useRef(new Map<string, string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, streaming]);
  useEffect(() => () => { audioRef.current?.pause(); audioCache.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const ask = async (history: PersonaMessage[], personaNow: Persona = persona) => {
    setBusy(true); setError(null); setStreaming("");
    try {
      const response = await fetch("/api/persona/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-already-session-id": sessionId },
        body: JSON.stringify({ lang, sessionId, herName, persona: { ...personaNow, name: personaNow.name.trim() || "TA" }, messages: history.slice(-PERSONA_LIMITS.history).map(({ role, text }) => ({ role, text })) }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
        setError({ code: body.error || "AI_REQUEST_FAILED", message: body.message || t("AI 暂时没有连接成功，请稍后再试。", "AI could not connect. Please try again shortly.") });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setStreaming(text);
      }
      text = text.trim();
      if (!text) { setError({ code: "AI_REQUEST_FAILED", message: t("AI 暂时没有连接成功，请稍后再试。", "AI could not connect. Please try again shortly.") }); return; }
      setMessages(() => [...history, { id: uid(), role: "ta", text, at: now() }]);
    } catch {
      setError({ code: "AI_REQUEST_FAILED", message: t("网络断了一下，请再试一次。", "The connection dropped. Please try again.") });
    } finally {
      setBusy(false); setStreaming("");
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    const history = [...messages, { id: uid(), role: "her" as const, text, at: now() }];
    setMessages(() => history);
    setInput("");
    void ask(history);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); send(); }
  };
  const regenerate = (index: number, personaNow?: Persona) => {
    if (busy) return;
    const history = messages.slice(0, index);
    setMessages(() => history);
    void ask(history, personaNow);
  };
  const saveCorrection = (index: number) => {
    const note = correction.trim() || t(`TA 不会这样说：${messages[index].text.slice(0, 80)}`, `TA wouldn't say: ${messages[index].text.slice(0, 80)}`);
    const next = { ...persona, corrections: [note, ...persona.corrections].slice(0, PERSONA_LIMITS.corrections) };
    updatePersona(() => next);
    setCorrecting(null); setCorrection("");
    regenerate(index, next);
  };
  const remember = (message: PersonaMessage) => {
    const memory: PersonaMemory = { id: uid(), text: message.text.slice(0, 600), pinned: false, source: "chat", createdAt: now() };
    updatePersona((p) => ({ ...p, memories: [memory, ...p.memories].slice(0, PERSONA_LIMITS.memories) }));
  };
  const speak = async (message: PersonaMessage) => {
    audioRef.current?.pause();
    if (speaking === message.id) { setSpeaking(null); return; }
    setSpeaking(message.id);
    try {
      let url = audioCache.current.get(message.id);
      if (!url) {
        const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId }, body: JSON.stringify({ text: message.text, useMyVoice: persona.voice === "mine" }) });
        if (!response.ok) throw new Error("VOICE_FAILED");
        url = URL.createObjectURL(await response.blob());
        audioCache.current.set(message.id, url);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(null);
      await audio.play();
    } catch {
      setSpeaking(null);
      setError({ code: "VOICE_FAILED", message: t("这条暂时读不出来，稍后再试。", "This one can't be read aloud right now.") });
    }
  };
  const clearChat = async () => {
    if (await askConfirm({ title: t("清空和 TA 的对话？", "Clear this chat?"), body: t("资料和记忆会保留。", "The profile and memories stay."), confirmLabel: t("清空", "Clear"), cancelLabel: t("取消", "Cancel") })) setMessages(() => []);
  };

  return (
    <section className="persona-chat">
      <div className="persona-thread" aria-live="polite">
        {!messages.length && !busy && <p className="persona-empty">{t(`和 ${persona.name} 说点什么吧。`, `Say something to ${persona.name}.`)}</p>}
        {messages.map((message, index) => (
          <article key={message.id} className={`persona-bubble ${message.role}`}>
            <p>{message.text}</p>
            <div className="persona-bubble-actions">
              {message.role === "ta" && persona.voice !== "off" && <button type="button" onClick={() => speak(message)} aria-pressed={speaking === message.id}><SpeakerHigh size={15} />{speaking === message.id ? t("停止", "Stop") : t("听 TA 说", "Listen")}</button>}
              {message.role === "ta" && index === messages.length - 1 && <button type="button" disabled={busy} onClick={() => regenerate(index)}><ArrowClockwise size={15} />{t("重新回答", "Regenerate")}</button>}
              {message.role === "ta" && <button type="button" disabled={busy} onClick={() => { setCorrecting(message.id); setCorrection(""); }}><ChatCircleText size={15} />{t("TA 不会这样说", "TA wouldn't say that")}</button>}
              <button type="button" onClick={() => remember(message)}><BookmarkSimple size={15} />{t("记住这件事", "Remember this")}</button>
            </div>
            {correcting === message.id && (
              <div className="persona-correct">
                <textarea value={correction} maxLength={300} rows={2} onChange={(e) => setCorrection(e.target.value)} placeholder={t("哪里不像？TA 会怎么说？可以不填", "What's off? How would TA say it? Optional")} />
                <div className="space-card-actions">
                  <button type="button" className="persona-primary" onClick={() => saveCorrection(index)}>{t("记下并重写", "Save and rewrite")}</button>
                  <button type="button" className="space-outline" onClick={() => setCorrecting(null)}>{t("取消", "Cancel")}</button>
                </div>
              </div>
            )}
          </article>
        ))}
        {busy && <article className="persona-bubble ta pending"><p>{streaming || "…"}</p></article>}
        {error && (
          <div className="persona-error" role="alert">
            <span>{error.message}</span>
            {error.code === "ATELIER_REQUIRED" && onOpenMembership && <button type="button" className="space-outline" onClick={onOpenMembership}>{t("看看丰盛工坊", "See Dough Atelier")}</button>}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="persona-composer">
        <textarea value={input} rows={2} maxLength={2000} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder={t(`发给 ${persona.name}`, `Message ${persona.name}`)} />
        <button type="button" className="persona-send" disabled={!input.trim() || busy} onClick={send} aria-label={t("发送", "Send")}><PaperPlaneTilt size={20} /></button>
      </div>
      <p className="persona-ai-note">{t(`${persona.name}是 AI 扮演的角色，不是真人。`, `${persona.name} is a character played by AI, not a real person.`)}</p>
      {messages.length > 0 && <button type="button" className="persona-quiet" onClick={clearChat}>{t("清空对话", "Clear chat")}</button>}
    </section>
  );
}

// ---------- profile ----------

function Field({ label, value, onChange, long, placeholder, max }: { label: string; value: string; onChange: (v: string) => void; long?: boolean; placeholder?: string; max?: number }) {
  return (
    <label className="persona-field">
      <span>{label}</span>
      {long
        ? <textarea value={value} rows={3} maxLength={max ?? PERSONA_LIMITS.longField} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input value={value} maxLength={max ?? PERSONA_LIMITS.field} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function PersonaProfile({ lang, persona, hasVoice, update, onDelete }: { lang: Lang; persona: Persona; hasVoice: boolean; update: (change: (p: Persona) => Persona) => void; onDelete: () => void }) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const set = <K extends keyof Persona>(key: K) => (value: Persona[K]) => update((p) => ({ ...p, [key]: value }));
  const [quote, setQuote] = useState("");
  const filled = (keys: readonly string[]) => keys.filter((k) => persona.facts[k as keyof Persona["facts"]]).length;

  return (
    <div className="persona-profile">
      <section className="persona-card">
        <h3>{t("TA 是谁", "Who TA is")}</h3>
        <div className="persona-grid">
          <Field label={t("名字", "Name")} value={persona.name} max={40} onChange={set("name")} />
          <label className="persona-field">
            <span>{t("称呼 TA 用", "Refer to TA as")}</span>
            <select value={persona.pronoun} onChange={(e) => set("pronoun")(e.target.value as Persona["pronoun"])}>
              <option value="他">{t("他", "he")}</option><option value="她">{t("她", "she")}</option><option value="TA">TA</option>
            </select>
          </label>
        </div>
        {FACT_GROUPS.map((group) => (
          <details key={group.id} className="persona-group">
            <summary>{lang === "zh" ? group.zh : group.en}<small>{filled(group.fields.map(([k]) => k))}/{group.fields.length}</small></summary>
            <div className="persona-grid">
              {group.fields.map(([key, zh, en]) => (
                <Field key={key} label={lang === "zh" ? zh : en} value={persona.facts[key] || ""} long={key === "past" || key === "family" || key === "personality"}
                  onChange={(v) => update((p) => ({ ...p, facts: { ...p.facts, [key]: v } }))} />
              ))}
            </div>
          </details>
        ))}
      </section>

      <section className="persona-card">
        <h3>{t("TA 怎么说话", "How TA talks")}</h3>
        <Field long label={t("说话的样子", "TA's way of texting")} value={persona.styleSummary} onChange={set("styleSummary")}
          placeholder={t("一条消息多长、爱不爱连发、用什么语气词和表情、怎么开玩笑", "Message length, sends several in a row or not, filler words, emoji, how TA jokes")} />
        <Field long label={t("TA 绝不会这样说", "TA would never")} value={persona.neverSays} onChange={set("neverSays")} max={1200} />
        <div className="persona-field">
          <span>{t("TA 说过的原话", "TA's own words")}<small>{persona.quotes.length}/{PERSONA_LIMITS.quotes}</small></span>
          <ul className="persona-list">
            {persona.quotes.map((q) => (
              <li key={q.id}><p>{q.text}</p><button type="button" aria-label={t("删除", "Delete")} onClick={() => update((p) => ({ ...p, quotes: p.quotes.filter((x) => x.id !== q.id) }))}><X size={14} /></button></li>
            ))}
          </ul>
          <div className="persona-inline">
            <input value={quote} maxLength={400} onChange={(e) => setQuote(e.target.value)} placeholder={t("一句 TA 真的说过的话", "Something TA really said")} />
            <button type="button" className="space-outline" disabled={!quote.trim() || persona.quotes.length >= PERSONA_LIMITS.quotes} onClick={() => { update((p) => ({ ...p, quotes: [...p.quotes, { id: uid(), text: quote.trim() }] })); setQuote(""); }}><Plus size={14} />{t("加一句", "Add")}</button>
          </div>
        </div>
        {persona.corrections.length > 0 && (
          <div className="persona-field">
            <span>{t("你纠正过的地方", "Your corrections")}</span>
            <ul className="persona-list">
              {persona.corrections.map((c, i) => (
                <li key={i}><p>{c}</p><button type="button" aria-label={t("删除", "Delete")} onClick={() => update((p) => ({ ...p, corrections: p.corrections.filter((_, j) => j !== i) }))}><X size={14} /></button></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="persona-card">
        <h3>{t("你们的故事", "Your story")}</h3>
        <div className="persona-grid">
          <Field label={t("你怎么叫 TA", "What you call TA")} value={persona.herNameForTa} max={40} onChange={set("herNameForTa")} />
          <Field label={t("TA 怎么叫你", "What TA calls you")} value={persona.taNameForHer} max={40} onChange={set("taNameForHer")} />
        </div>
        <Field long label={t("你们怎么认识的", "How you met")} value={persona.howMet} onChange={set("howMet")} />
        <Field long label={t("还想让 TA 知道的", "Anything else")} value={persona.other} onChange={set("other")} />
      </section>

      <section className="persona-card">
        <h3>{t("已经实现的你们", "The two of you, already")}</h3>
        <Field long label={t("你们现在的关系", "Where you are now")} value={persona.relationship} onChange={set("relationship")}
          placeholder={t("用现在时写下你选择的那一版", "In the present tense, the version you chose")} />
        <Field long label={t("TA 对你的感觉", "How TA feels about you")} value={persona.feelings} onChange={set("feelings")} />
      </section>

      <section className="persona-card">
        <h3>{t("声音", "Voice")}</h3>
        <div className="wish-pills" role="radiogroup">
          {([["off", t("不朗读", "Off")], ["default", t("默认音色", "Default voice")], ...(hasVoice || persona.voice === "mine" ? [["mine", t("潜音里的声音", "Voice from Dreamscape")]] : [])] as Array<[Persona["voice"], string]>).map(([id, label]) => (
            <button type="button" role="radio" key={id} aria-checked={persona.voice === id} className={persona.voice === id ? "selected" : ""} onClick={() => set("voice")(id)}>{label}</button>
          ))}
        </div>
      </section>

      <button type="button" className="data-danger-button persona-delete" onClick={onDelete}><Trash size={16} />{t(`删除 ${persona.name}`, `Delete ${persona.name}`)}</button>
    </div>
  );
}

// ---------- import ----------

function PersonaImport({ lang, sessionId, persona, update, onDone, onOpenMembership }: { lang: Lang; sessionId: string; persona: Persona; update: (change: (p: Persona) => Persona) => void; onDone: () => void; onOpenMembership?: () => void }) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [log, setLog] = useState("");
  const [taName, setTaName] = useState(persona.name);
  const [herName, setHerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<Extracted | null>(null);
  const [pickQuotes, setPickQuotes] = useState<Set<number>>(new Set());
  const [pickMemories, setPickMemories] = useState<Set<number>>(new Set());
  const [pickFacts, setPickFacts] = useState<Set<string>>(new Set());
  const [useStyle, setUseStyle] = useState(true);
  const factLabel = useMemo(() => Object.fromEntries(FACT_GROUPS.flatMap((g) => g.fields.map(([k, zh, en]) => [k, lang === "zh" ? zh : en]))), [lang]);

  const readFile = async (file: File | undefined) => { if (file) setLog(await file.text()); };
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/persona/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-already-session-id": sessionId },
        body: JSON.stringify({ lang, sessionId, taName: taName.trim(), herName: herName.trim(), log: sampleLog(log) }),
      });
      const body = await response.json().catch(() => ({})) as Extracted & { error?: string; message?: string };
      if (!response.ok) { setError({ code: body.error || "AI_REQUEST_FAILED", message: body.message || t("整理失败了，请稍后再试。", "That didn't work. Please try again shortly.") }); return; }
      setResult(body);
      setPickQuotes(new Set(body.quotes.map((_, i) => i)));
      setPickMemories(new Set(body.memories.map((_, i) => i)));
      setPickFacts(new Set(Object.keys(body.facts)));
      setLog(""); // the raw log is not kept once it has been read
    } catch {
      setError({ code: "AI_REQUEST_FAILED", message: t("网络断了一下，请再试一次。", "The connection dropped. Please try again.") });
    } finally { setBusy(false); }
  };
  const apply = () => {
    if (!result) return;
    update((p) => {
      const facts = { ...p.facts };
      for (const key of pickFacts) if (!facts[key as keyof typeof facts]) facts[key as keyof typeof facts] = result.facts[key];
      const quotes = [...p.quotes, ...result.quotes.filter((_, i) => pickQuotes.has(i)).map((q) => ({ id: uid(), text: q.text, topic: q.topic }))].slice(0, PERSONA_LIMITS.quotes);
      const memories = [...p.memories, ...result.memories.filter((_, i) => pickMemories.has(i)).map((text) => ({ id: uid(), text, pinned: false, source: "import" as const, createdAt: now() }))].slice(0, PERSONA_LIMITS.memories);
      return {
        ...p, facts, quotes, memories,
        styleSummary: useStyle && result.styleSummary ? [p.styleSummary, result.styleSummary].filter(Boolean).join("\n") : p.styleSummary,
        neverSays: useStyle && result.neverSays ? [p.neverSays, result.neverSays].filter(Boolean).join("；") : p.neverSays,
        taNameForHer: p.taNameForHer || result.taNameForHer,
        herNameForTa: p.herNameForTa || result.herNameForTa,
      };
    });
    setResult(null);
    onDone();
  };
  const toggle = <T,>(set: Set<T>, value: T) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next; };

  if (result) return (
    <section className="persona-card persona-review">
      <h3>{t("看看哪些要留下", "Choose what to keep")}</h3>
      {result.styleSummary && <label className="persona-check block"><input type="checkbox" checked={useStyle} onChange={(e) => setUseStyle(e.target.checked)} /><span><b>{t("说话的样子", "How TA texts")}</b>{result.styleSummary}{result.neverSays && <><br /><b>{t("不会这样说", "Never")}</b>{result.neverSays}</>}</span></label>}
      {result.quotes.length > 0 && <><h4>{t("TA 的原话", "TA's words")}</h4>
        {result.quotes.map((q, i) => <label key={i} className="persona-check block"><input type="checkbox" checked={pickQuotes.has(i)} onChange={() => setPickQuotes((s) => toggle(s, i))} /><span>{q.text}</span></label>)}</>}
      {Object.keys(result.facts).length > 0 && <><h4>{t("TA 的资料", "Facts")}</h4>
        {Object.entries(result.facts).map(([k, v]) => <label key={k} className="persona-check block"><input type="checkbox" checked={pickFacts.has(k)} onChange={() => setPickFacts((s) => toggle(s, k))} /><span><b>{factLabel[k]}</b>{v}</span></label>)}</>}
      {result.memories.length > 0 && <><h4>{t("你们的事", "Shared memories")}</h4>
        {result.memories.map((m, i) => <label key={i} className="persona-check block"><input type="checkbox" checked={pickMemories.has(i)} onChange={() => setPickMemories((s) => toggle(s, i))} /><span>{m}</span></label>)}</>}
      <div className="space-card-actions">
        <button type="button" className="persona-primary" onClick={apply}>{t("加进 TA 的资料", "Add to TA's profile")}</button>
        <button type="button" className="space-outline" onClick={() => setResult(null)}>{t("都不要", "Discard")}</button>
      </div>
    </section>
  );

  return (
    <section className="persona-card">
      <p className="persona-lead">{t("贴进你们的聊天记录，会整理出 TA 说话的样子、TA 的原话和你们之间的事，你挑过之后再加进资料。记录本身读完就丢掉，不会保存。", "Paste your chat. It is turned into how TA texts, TA's own words and your shared moments for you to pick from. The chat itself is discarded once read.")}</p>
      <div className="persona-grid">
        <Field label={t("记录里 TA 的名字", "TA's name in the chat")} value={taName} max={40} onChange={setTaName} />
        <Field label={t("记录里你的名字", "Your name in the chat")} value={herName} max={40} onChange={setHerName} />
      </div>
      <label className="persona-field">
        <span>{t("聊天记录", "Chat")}<small>{log.length > PERSONA_LIMITS.importChars ? t("很长，会从头到尾均匀挑一部分读", "Long: an even sample from start to end will be read") : ""}</small></span>
        <textarea className="persona-log" value={log} rows={10} onChange={(e) => setLog(e.target.value)} />
      </label>
      <div className="space-card-actions">
        <label className="space-outline persona-file"><UploadSimple size={15} />{t("选择 .txt 文件", "Choose a .txt file")}<input type="file" accept=".txt,.csv,.md,text/plain" onChange={(e) => readFile(e.target.files?.[0])} /></label>
        <button type="button" className="persona-primary" disabled={busy || !taName.trim() || log.trim().length < 40} onClick={run}>{busy ? t("正在整理…", "Reading…") : t("整理", "Read it")}</button>
      </div>
      {error && <div className="persona-error" role="alert"><span>{error.message}</span>{error.code === "ATELIER_REQUIRED" && onOpenMembership && <button type="button" className="space-outline" onClick={onOpenMembership}>{t("看看丰盛工坊", "See Dough Atelier")}</button>}</div>}
    </section>
  );
}

// ---------- memories ----------

function PersonaMemories({ lang, persona, update }: { lang: Lang; persona: Persona; update: (change: (p: Persona) => Persona) => void }) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [draft, setDraft] = useState("");
  const sorted = [...persona.memories].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const add = () => {
    if (!draft.trim()) return;
    update((p) => ({ ...p, memories: [{ id: uid(), text: draft.trim(), pinned: false, source: "her" as const, createdAt: now() }, ...p.memories].slice(0, PERSONA_LIMITS.memories) }));
    setDraft("");
  };
  return (
    <section className="persona-card">
      <p className="persona-lead">{t("你们之间的趣事、约定、只有你们懂的梗。钉住的每次都会记得，其余的聊到相关话题时想起来。", "Funny moments, promises, inside jokes. Pinned ones are always remembered; the rest come back when the topic does.")}</p>
      <div className="persona-inline">
        <textarea value={draft} rows={2} maxLength={600} onChange={(e) => setDraft(e.target.value)} placeholder={t("你记得你们之间有什么趣事吗？", "Any funny moment between you two?")} />
        <button type="button" className="space-outline" disabled={!draft.trim()} onClick={add}><Plus size={14} />{t("记下", "Add")}</button>
      </div>
      <ul className="persona-list">
        {sorted.map((m) => (
          <li key={m.id} className={m.pinned ? "pinned" : ""}>
            <textarea value={m.text} rows={2} maxLength={600} aria-label={t("记忆", "Memory")} onChange={(e) => update((p) => ({ ...p, memories: p.memories.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)) }))} />
            <button type="button" aria-pressed={m.pinned} aria-label={m.pinned ? t("取消钉住", "Unpin") : t("钉住", "Pin")} onClick={() => update((p) => ({ ...p, memories: p.memories.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)) }))}><PushPin size={15} weight={m.pinned ? "fill" : "regular"} /></button>
            <button type="button" aria-label={t("删除", "Delete")} onClick={() => update((p) => ({ ...p, memories: p.memories.filter((x) => x.id !== m.id) }))}><X size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
