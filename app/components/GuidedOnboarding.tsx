"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DoughHop from "./DoughHop";
import { ArrowLeft, X } from "@phosphor-icons/react";
import { readStored, removeStored, writeStored } from "@/lib/safe-storage";
import {
  STEPS,
  WISH_KIND_OPTIONS,
  buildFlow,
  canAdvance,
  emptyAnswers,
  emptyWish,
  isCloseRelation,
  RELATION_KIND_OPTIONS,
  stepAnswer,
  wishModule,
  wishPersonName,
  type FlowSlot,
  type OnboardingAnswers,
  type OnboardingLang,
  type RelationKind,
  type StepDef,
} from "@/lib/onboarding-flow";

import "./onboarding.css";

type Props = {
  lang: OnboardingLang;
  sessionId: string;
  /** "first": the whole opening. "extra": one more desire, short. */
  mode: "first" | "extra";
  /** shown under the name question, for continuing on another device */
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

export default function GuidedOnboarding({ lang, sessionId, mode, initialName = "", maxWishes = 8, onCancel, onComplete }: Props) {
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
  const relations = answers.wishes.map((wish) => (wish.specifics.relationship_kind || "") as RelationKind | "");
  const kindsKey = `${kinds.join("|")}/${relations.join("|")}`;
  const flow: FlowSlot[] = useMemo(() => {
    if (mode === "extra") return wishModule(kinds[0] || "", false, relations[0] || "").map((id) => ({ wish: 0, id }));
    return buildFlow(kinds, finished, relations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, finished, kindsKey]);

  const index = Math.min(pos, flow.length - 1);
  const slot = flow[index];
  const def: StepDef = STEPS[slot.id];
  const wishIndex = slot.wish;
  const wish = wishIndex === null ? null : answers.wishes[wishIndex];
  const meetingSomeoneNew = wish?.specifics.relationship_target === "new";
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
    else {
      const field = slot.id === "rel_state" && meetingSomeoneNew ? "new_rel_state" : slot.id;
      setWish({ specifics: { ...wish.specifics, [field]: value } });
    }
  };

  const group = (() => {
    if (slot.id === "more") return zh ? "你的愿望" : "Your desires";
    if (wishIndex !== null && mode === "extra") return zh ? "新的愿望" : "A new desire";
    if (wishIndex !== null) return zh ? `愿望 ${wishIndex + 1}` : `Desire ${wishIndex + 1}`;
    if (["people", "never", "situation"].includes(slot.id)) return zh ? "你和你的世界" : "You and your world";
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

  const canContinue = canAdvance(slot.id, answers, wishIndex) && !thinking;
  const progress = Math.round(((index + 1) / flow.length) * 100);
  const placeholder = slot.id === "rel_state" && meetingSomeoneNew
    ? (zh ? "比如：温柔坦诚、说到做到、尊重边界。希望我们彼此信任，有话直说，也给彼此留一点自己的空间。" : "For example: Kind, honest, dependable, and respectful of boundaries. I’d like us to trust each other, speak openly, and make room for our own lives.")
    : slot.id === "rel_state" && wish && isCloseRelation(wish)
      ? (zh ? "比如：最近常吵架、很久没联系、住得很远，或者关系还不错，想更亲近。" : "For example: We argue a lot lately, we haven't talked in a long time, we live far apart, or we get along fine and I want to be closer.")
      : def.placeholder?.[lang];

  const body = (() => {
    switch (def.type) {
      case "text":
        if (slot.id === "sp_name" && wish) {
          return <>
            <div className="option-card-grid category-grid">
              <button type="button" aria-pressed={!meetingSomeoneNew} className={!meetingSomeoneNew ? "selected" : ""} onClick={() => setWish({ specifics: { ...wish.specifics, relationship_target: "specific" } })}>{zh ? "我有特定对象" : "I have a specific person in mind"}</button>
              <button type="button" aria-pressed={!!meetingSomeoneNew} className={meetingSomeoneNew ? "selected" : ""} onClick={() => setWish({ specifics: { ...wish.specifics, relationship_target: "new" } })}>{zh ? "我想遇见新的人" : "I want to meet someone new"}</button>
            </div>
            {!meetingSomeoneNew && <input aria-label={zh ? "TA 的名字或称呼" : "Their name or what you call them"} maxLength={24} value={currentText()} onChange={(event) => setCurrentText(event.target.value)} placeholder={zh ? "TA 的名字或称呼" : "Their name or what you call them"} />}
          </>;
        }
        // eslint-disable-next-line jsx-a11y/no-autofocus -- each step asks one thing; its field takes the focus
        return <input autoFocus maxLength={60} value={currentText()} onChange={(event) => setCurrentText(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && canContinue) void onContinue(); }} />;
      case "long":
        // eslint-disable-next-line jsx-a11y/no-autofocus -- each step asks one thing; its field takes the focus
        return <textarea autoFocus rows={slot.id === "never" ? 4 : 5} maxLength={1200} value={currentText()} onChange={(event) => setCurrentText(event.target.value)} placeholder={placeholder} />;
      case "relkind":
        return <div className="option-card-grid category-grid">{RELATION_KIND_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={wish?.specifics.relationship_kind === option.id} className={wish?.specifics.relationship_kind === option.id ? "selected" : ""} onClick={() => wish && setWish({ specifics: { ...wish.specifics, relationship_kind: option.id, ...(option.id === "love" ? {} : { relationship_target: "" }) } })}><strong>{zh ? option.zh : option.en}</strong></button>)}</div>;
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
        <h1>{slot.id === "rel_state" && meetingSomeoneNew
          ? (zh ? "你想遇见怎样的人，和 TA 建立怎样的关系？" : "Who would you like to meet, and what relationship would you like to build?")
          : def.prompt[lang]}</h1>
        {def.hint && <p className="guided-hint">{def.hint[lang]}</p>}
        {body}
        {thinking && <p className="onboard-reply onboard-thinking" role="status" aria-label={zh ? "正在想" : "Thinking"}><DoughHop size="sm"/></p>}
        {replyHere && <Typed text={replyHere} />}
      </div>
      {def.type !== "more" && (
        <footer className="guided-footer">
          <button type="button" className="primary" disabled={!canContinue} onClick={() => void onContinue()}>{thinking ? <DoughHop size="xs"/> : isLast ? (zh ? "进入 AlreaDough" : "Enter AlreaDough") : slot.id === "welcome" ? (zh ? "开始" : "Start") : def.type === "info" ? (zh ? "我明白了" : "I understand") : (zh ? "继续" : "Continue")}</button>
        </footer>
      )}
    </section>
  );
}
