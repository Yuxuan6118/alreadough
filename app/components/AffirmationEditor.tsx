"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DotsSixVertical, Pause, Play, Plus, X } from "@phosphor-icons/react";
import DoughHop from "./DoughHop";

type Lang = "zh" | "en";

type Props = {
  lang: Lang;
  lines: string[];
  onChange: (lines: string[]) => void;
  /** Lines she may add: new thoughts, picks from a conversation, AI ideas, lines she removed. */
  suggestions: string[];
  onAccept: (line: string) => void;
  onDismiss: (line: string) => void;
  onAskIdeas: () => void;
  asking: boolean;
  /** Which line is being prepared or played in her voice. */
  preview: { line: string; state: "loading" | "playing" } | null;
  onPreview: (line: string) => void;
  maxLines: number;
  maxLength: number;
};

/** Her own affirmations: tap a line to change it, drag the handle to reorder, play one line in her voice. */
export default function AffirmationEditor({ lang, lines, onChange, suggestions, onAccept, onDismiss, onAskIdeas, asking, preview, onPreview, maxLines, maxLength }: Props) {
  const zh = lang === "zh";
  const t = (a: string, b: string) => (zh ? a : b);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const rowsRef = useRef<Array<HTMLLIElement | null>>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const shown = order || lines;

  useEffect(() => {
    if (editing === null || !inputRef.current) return;
    const input = inputRef.current;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [editing]);

  // grow the box with the text, so a long line is never hidden
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [draft, editing]);

  // the row being edited, read synchronously so Enter and the blur that follows save only once
  const editingRef = useRef<number | null>(null);
  const openEditor = (index: number | null, text = "") => { editingRef.current = index; setEditing(index); setDraft(text); };
  const startEdit = (index: number) => openEditor(index, shown[index] || "");
  // a new line stays here until it has words, then it is added
  const adding = editing !== null && editing >= lines.length;
  const commit = () => {
    const index = editingRef.current;
    if (index === null) return;
    openEditor(null);
    const text = draft.replace(/\s+/g, " ").trim();
    const elsewhere = lines.some((line, i) => line === text && i !== index);
    const next = [...lines];
    if (index >= lines.length) { if (text && !elsewhere) next.push(text); }
    else if (text && !elsewhere) next[index] = text;
    else if (!text) next.splice(index, 1);
    if (next.join("\n") !== lines.join("\n")) onChange(next);
  };
  const cancel = () => openEditor(null);
  const addLine = () => {
    if (lines.length >= maxLines) return;
    openEditor(lines.length);
  };
  const remove = (index: number) => {
    openEditor(null);
    onChange(lines.filter((_, i) => i !== index));
  };

  const beginDrag = (index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    openEditor(null);
    setDragging(index);
    setOrder([...lines]);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging === null || !order) return;
    const y = event.clientY;
    let target = dragging;
    rowsRef.current.forEach((row, index) => {
      if (!row || index === dragging) return;
      const box = row.getBoundingClientRect();
      const middle = box.top + box.height / 2;
      if (index < dragging && y < middle) target = Math.min(target, index);
      if (index > dragging && y > middle) target = Math.max(target, index);
    });
    if (target === dragging) return;
    const next = [...order];
    const [moved] = next.splice(dragging, 1);
    next.splice(target, 0, moved);
    setOrder(next);
    setDragging(target);
  };
  const endDrag = () => {
    if (order && order.join("\n") !== lines.join("\n")) onChange(order);
    setOrder(null);
    setDragging(null);
  };
  const nudge = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <section className="affirm-editor" aria-label={t("我的肯定语", "My affirmations")}>
      <ol className="affirm-lines">
        {(adding ? [...shown, ""] : shown).map((line, index) => {
          const state = preview?.line === line && line ? preview.state : null;
          return (
            <li key={`${index}-${line}`} ref={(node) => { rowsRef.current[index] = node; }} className={`${dragging === index ? "is-dragging" : ""}${editing === index ? " is-editing" : ""}`}>
              <button type="button" className="affirm-handle" aria-label={t("拖动换位置", "Drag to reorder")} onPointerDown={beginDrag(index)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(event) => { if (event.key === "ArrowUp") { event.preventDefault(); nudge(index, -1); } if (event.key === "ArrowDown") { event.preventDefault(); nudge(index, 1); } }}><DotsSixVertical size={18} weight="bold" /></button>
              {editing === index ? (
                <textarea
                  ref={inputRef}
                  className="affirm-input"
                  rows={1}
                  value={draft}
                  maxLength={maxLength}
                  aria-label={t("这一句", "This line")}
                  onChange={(event) => setDraft(event.target.value.replace(/\n/g, ""))}
                  onBlur={commit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); commit(); }
                    if (event.key === "Escape") { event.preventDefault(); cancel(); }
                  }}
                />
              ) : (
                <button type="button" className="affirm-text" onClick={() => startEdit(index)}>{line}</button>
              )}
              {editing !== index && line && (
                <button type="button" className={`affirm-play${state ? " is-on" : ""}`} aria-label={state === "playing" ? t("停止", "Stop") : t("用我的声音听这一句", "Hear this line")} onClick={() => onPreview(line)}>
                  {state === "loading" ? <DoughHop size="xs" /> : state === "playing" ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                </button>
              )}
              {editing !== index && <button type="button" className="affirm-remove" aria-label={t("删掉这一句", "Remove this line")} onClick={() => remove(index)}><X size={15} weight="bold" /></button>}
            </li>
          );
        })}
      </ol>

      <div className="affirm-actions">
        <button type="button" onClick={addLine} disabled={lines.length >= maxLines || editing !== null}><Plus size={16} weight="bold" />{t("写一句", "Write a line")}</button>
        <button type="button" onClick={onAskIdeas} disabled={asking}>{asking && <DoughHop size="xs" />}{t("帮我想几句", "Suggest a few")}</button>
      </div>

      {suggestions.length > 0 && (
        <div className="affirm-suggest">
          <h3>{t("可以加进来", "You could add")}</h3>
          <ul>
            {suggestions.map((line) => (
              <li key={line}>
                <button type="button" className="affirm-take" onClick={() => onAccept(line)} disabled={lines.length >= maxLines}><Plus size={14} weight="bold" /><span>{line}</span></button>
                <button type="button" className="affirm-skip" aria-label={t("不要这句", "Skip this one")} onClick={() => onDismiss(line)}><X size={13} weight="bold" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
