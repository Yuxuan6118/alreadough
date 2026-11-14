"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, X } from "@phosphor-icons/react";
import { readStored, removeStored, writeStored } from "@/lib/safe-storage";
import {
  STEPS,
  WISH_KIND_OPTIONS,
  buildFlow,
  canAdvance,
  emptyAnswers,
  emptyWish,
  stepAnswer,
  wishModule,
  wishPersonName,
  type FlowSlot,
  type OnboardingAnswers,
  type OnboardingLang,
  type StepDef,
} from "@/lib/onboarding-flow";

import "./onboarding.css";

export type StyleOption = { id: string; zh: string; en: string; zhDescription: string; enDescription: string };

type Props = {
  lang: OnboardingLang;
  sessionId: string;
  /** "first": the whole opening. "extra": one more desire, short. */
  mode: "first" | "extra";
  styleOptions: StyleOption[];
  /** shown under the name question, for continuing on another device */
  syncSlot?: ReactNode;
  initialName?: string;
  maxWishes?: number;
  onCancel?: () => void;
  onComplete: (answers: OnboardingAnswers) => void;
};

const STORAGE_KEY = "already-opening-v1";
const INTENSITY: Record<OnboardingLang, string[]> = {
  zh: ["有也不错", "想要", "很想要", "特别想要", "最想要"],
  en: ["Nice to have", "Want it", "Really want it", "Want it a lot", "Want it most"],
};

type Saved = { answers: OnboardingAnswers; pos: number; finished: boolean };

function restore(): Saved | null {
  const raw = readStored(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Saved>;
    if (!data.answers || !Array.isArray(data.answers.wishes) || data.answers.wishes.length === 0) return null;
    return { answers: { ...emptyAnswers(), ...data.answers }, pos: Math.max(0, Number(data.pos) || 0), finished: Boolean(data.finished) };
  } catch {
    return null;
  }
}

/** Reveals text a few letters at a time, so a reply arrives like someone writing it. */
function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setShown(text.length), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => setShown((value) => (value >= text.length ? value : value + 1)), 28);
    return () => window.clearInterval(id);
  }, [text]);
  return <p className="onboard-reply" aria-live="polite">{text.slice(0, shown)}</p>;
}

export default function GuidedOnboarding({ lang, sessionId, mode, styleOptions, syncSlot, initialName = "", maxWishes = 8, onCancel, onComplete }: Props) {
  const zh = lang === "zh";
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => ({ ...emptyAnswers(), name: initialName }));
  const [pos, setPos] = useState(0);
  const [finished, setFinished] = useState(false);
  const [ready, setReady] = useState(mode === "extra");
  const [reply, setReply] = useState<{ key: string; text: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [personDraft, setPersonDraft] = useState({ name: "", relation: "" });
  const abortRef = useRef<AbortController | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time restoration from device storage */
  useEffect(() => {
    if (mode !== "first") return;
    const saved = restore();
    if (saved) {
      setAnswers((current) => ({ ...saved.answers, name: saved.answers.name || current.name }));
      setPos(saved.pos);
      setFinished(saved.finished);
    }
    setReady(true);
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (mode === "first" && ready) writeStored(STORAGE_KEY, JSON.stringify({ answers, pos, finished }));
  }, [mode, ready, answers, pos, finished]);

  const kinds = answers.wishes.map((wish) => wish.kind);
  const flow: FlowSlot[] = useMemo(() => {
    if (mode === "extra") return wishModule(kinds[0] || "", false).map((id) => ({ wish: 0, id }));
    return buildFlow(kinds, finished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finished, kinds.join("|")]);

  const index = Math.min(pos, flow.length - 1);
  const slot = flow[index];
  const def: StepDef = STEPS[slot.id];
  const wishIndex = slot.wish;
  const wish = wishIndex === null ? null : answers.wishes[wishIndex];
  const isLast = index === flow.length - 1 && slot.id !== "more";
  const slotKey = `${slot.wish ?? "g"}:${slot.id}`;
  const replyHere = reply?.key === slotKey ? reply.text : "";

  const setWish = (patch: Partial<typeof answers.wishes[number]>) => {
    if (wishIndex === null) return;
    setReply(null);
    setAnswers((current) => ({ ...current, wishes: current.wishes.map((item, i) => (i === wishIndex ? { ...item, ...patch } : item)) }));
  };
  const setTop = (patch: Partial<OnboardingAnswers>) => {
    setReply(null);
    setAnswers((current) => ({ ...current, ...patch }));
  };

  /** What she wrote on this step, as one string. */
  const currentText = (): string => stepAnswer(slot.id, answers, wishIndex);
  const setCurrentText = (value: string) => {
    if (!wish) {
      if (slot.id === "name") setTop({ name: value });
      else if (slot.id === "country") setTop({ country: value });
      else if (slot.id === "about") setTop({ about: value });
      else if (slot.id === "never") setTop({ never: value });
      else if (slot.id === "situation") setTop({ situation: value });
      return;
    }
    if (slot.id === "wish") setWish({ wish: value });
    else if (slot.id === "scene") setWish({ scene: value });
    else if (slot.id === "pullback") setWish({ pullback: value });
    else if (slot.id === "evidence") setWish({ evidence: value });
    else if (slot.id === "exclude") setWish({ exclude: value });
    else setWish({ specifics: { ...wish.specifics, [slot.id]: value } });
  };

  const group = (() => {
    if (slot.id === "more") return zh ? "你的愿望" : "Your desires";
    if (wishIndex !== null && mode === "extra") return zh ? "新的愿望" : "A new desire";
    if (wishIndex !== null) return zh ? `愿望 ${wishIndex + 1}` : `Desire ${wishIndex + 1}`;
    if (["people", "never", "situation"].includes(slot.id)) return zh ? "你和你的世界" : "You and your world";
    if (slot.id === "style") return zh ? "陪伴方式" : "Companion style";
    return zh ? "让 AlreaDough 更好地认识你" : "Help AlreaDough get to know you";
  })();

  const finish = () => {
    removeStored(STORAGE_KEY);
    onComplete(answers);
  };

  const advance = () => {
    abortRef.current?.abort();
    setThinking(false);
    setReply(null);
    if (isLast) { finish(); return; }
    setPos(index + 1);
  };

  const replyContext = (): Array<{ label: string; value: string }> => {
    const out: Array<{ label: string; value: string }> = [];
    if (answers.about.trim()) out.push({ label: zh ? "TA 自己" : "About them", value: answers.about });
    if (wish) {
      if (slot.id !== "wish" && wish.wish.trim()) out.push({ label: zh ? "TA 的愿望" : "Their desire", value: wish.wish });
      const person = wishPersonName(wish);
      if (person) out.push({ label: zh ? "TA 的称呼" : "Their name", value: person });
    }
    return out;
  };

  const onContinue = async () => {
    if (replyHere) { advance(); return; }
    const text = currentText().trim();
    if (!def.reply || !text) { advance(); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 9000);
    setThinking(true);
    try {
      const response = await fetch("/api/onboarding-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ sessionId, lang, step: slot.id, name: answers.name, answer: text, context: replyContext() }),
      });
      const data = await response.json().catch(() => ({})) as { reply?: string };
      window.clearTimeout(timer);
      if (controller.signal.aborted) return;
      setThinking(false);
      if (data.reply) setReply({ key: slotKey, text: data.reply });
      else advance();
    } catch {
      window.clearTimeout(timer);
      // she pressed Back or moved on herself: nothing to do. A timeout or a network error just moves on.
      if (controller.signal.aborted && !timedOut) return;
      setThinking(false);
      advance();
    }
  };

  const onBack = () => {
    abortRef.current?.abort();
    setThinking(false);
    setReply(null);
    if (index > 0) setPos(index - 1);
  };

  const addPerson = () => {
    const name = personDraft.name.trim();
    if (!name) return;
    setReply(null);
    setAnswers((current) => ({ ...current, people: [...current.people, { id: crypto.randomUUID(), name: name.slice(0, 40), relation: personDraft.relation.trim().slice(0, 80) }].slice(0, 12) }));
    setPersonDraft({ name: "", relation: "" });
  };

  const chooseMore = (another: boolean) => {
    if (another) {
      if (answers.wishes.length >= maxWishes) return;
      // the "add another?" slot disappears and the new desire's first step takes its place, so the position stays
      setAnswers((current) => ({ ...current, wishes: [...current.wishes, emptyWish()] }));
      setFinished(false);
    } else {
      setFinished(true);
      setPos(index + 1);
    }
  };

  const canContinue = canAdvance(slot.id, answers, wishIndex) && !thinking
    && (slot.id !== "style" || answers.style !== "custom" || answers.customTone.trim().length > 0);
  const progress = Math.round(((index + 1) / flow.length) * 100);
  const placeholder = def.placeholder?.[lang];

  const body = (() => {
    switch (def.type) {
      case "text":
        return <input autoFocus maxLength={60} value={currentText()} onChange={(event) => setCurrentText(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === "Enter" && canContinue) void onContinue(); }} />;
      case "long":
        return <textarea autoFocus rows={slot.id === "never" ? 4 : 5} maxLength={1200} value={currentText()} onChange={(event) => setCurrentText(event.target.value)} placeholder={placeholder} />;
      case "category":
        return <div className="option-card-grid category-grid">{WISH_KIND_OPTIONS.map((option) => <button key={option.id} type="button" className={wish?.kind === option.id ? "selected" : ""} onClick={() => setWish({ kind: option.id })}><strong>{zh ? option.zh : option.en}</strong><small>{zh ? option.zhHint : option.enHint}</small></button>)}</div>;
      case "scale":
        return <div className="onboard-scale" role="radiogroup" aria-label={def.prompt[lang]}>{INTENSITY[lang].map((label, i) => <button key={label} type="button" role="radio" aria-checked={wish?.intensity === i + 1} className={wish?.intensity === i + 1 ? "selected" : ""} onClick={() => setWish({ intensity: i + 1 })}><b>{i + 1}</b><span>{label}</span></button>)}</div>;
      case "people":
        return <div className="onboard-people">
          {answers.people.length > 0 && <ul>{answers.people.map((person) => <li key={person.id}><span><strong>{person.name}</strong>{person.relation && <small>{person.relation}</small>}</span><button type="button" aria-label={zh ? "移除" : "Remove"} onClick={() => setTop({ people: answers.people.filter((item) => item.id !== person.id) })}>×</button></li>)}</ul>}
          <div className="onboard-people-form">
            <input value={personDraft.name} maxLength={40} onChange={(event) => setPersonDraft((current) => ({ ...current, name: event.target.value }))} placeholder={zh ? "名字" : "Name"} />
            <input value={personDraft.relation} maxLength={80} onChange={(event) => setPersonDraft((current) => ({ ...current, relation: event.target.value }))} placeholder={zh ? "TA 是谁，例如：妈妈、最好的朋友" : "Who they are, e.g. mom, best friend"} onKeyDown={(event) => { if (event.key === "Enter") addPerson(); }} />
            <button type="button" className="outline-button" disabled={!personDraft.name.trim()} onClick={addPerson}>{zh ? "添加" : "Add"}</button>
          </div>
        </div>;
      case "style":
        return <>
          <div className="option-card-grid companion-style-grid">{styleOptions.map((option) => <button key={option.id} type="button" className={answers.style === option.id ? "selected" : ""} onClick={() => setTop({ style: option.id })}><strong>{zh ? option.zh : option.en}</strong><small>{zh ? option.zhDescription : option.enDescription}</small></button>)}</div>
          {answers.style === "custom" && <label><span>{zh ? "我的专属陪伴方式" : "MY CUSTOM STYLE"}</span><textarea rows={3} value={answers.customTone} onChange={(event) => setTop({ customTone: event.target.value })} /></label>}
        </>;
      case "more":
        return <div className="onboard-more">
          <button type="button" className="primary" disabled={answers.wishes.length >= maxWishes} onClick={() => chooseMore(true)}>{zh ? "再加一个愿望" : "Add another desire"}</button>
          <button type="button" className="outline-button" onClick={() => chooseMore(false)}>{zh ? "先这样，继续" : "That's enough for now"}</button>
        </div>;
      default:
        return null;
    }
  })();

  if (!ready) return <section className="onboarding-view" aria-busy="true" />;

  return (
    <section className="onboarding-view guided-onboarding" data-step={slot.id}>
      <div className="guided-top">
        {index === 0 && onCancel
          ? <button type="button" className="guided-back" onClick={onCancel} aria-label={zh ? "取消" : "Cancel"}><X size={22} /></button>
          : <button type="button" className="guided-back" onClick={onBack} disabled={index === 0} aria-label={zh ? "返回上一题" : "Back"} style={index === 0 ? { visibility: "hidden" } : undefined}><ArrowLeft size={22} /></button>}
        <div className="onboarding-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={zh ? "进度" : "Progress"}><i style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="onboarding-panel" key={slotKey}>
        <p className="guided-group">{group}</p>
        <h1>{def.prompt[lang]}</h1>
        {def.hint && <p className="guided-hint">{def.hint[lang]}</p>}
        {body}
        {def.optional && (def.type === "text" || def.type === "long") && <small className="guided-none">{zh ? "没有的话，写“没有”就好。" : "If there is nothing, just write “none”."}</small>}
        {slot.id === "name" && syncSlot}
        {thinking && <p className="onboard-reply onboard-thinking" aria-live="polite"><i /><i /><i /></p>}
        {replyHere && <Typed text={replyHere} />}
      </div>
      {def.type !== "more" && (
        <footer className="guided-footer">
          <button type="button" className="primary" disabled={!canContinue} onClick={() => void onContinue()}>{thinking ? (zh ? "……" : "…") : isLast ? (zh ? "进入 AlreaDough" : "Enter AlreaDough") : slot.id === "welcome" ? (zh ? "开始" : "Start") : def.type === "info" ? (zh ? "我明白了" : "I understand") : (zh ? "继续" : "Continue")}</button>
        </footer>
      )}
    </section>
  );
}
