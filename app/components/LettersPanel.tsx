"use client";

import { useState } from "react";
import DoughLineMark from "./DoughLineMark";
import "./letters.css";

export type AppLetter = { id: string; subject: string; body: string; createdAt: number };

type Props = { lang: "zh" | "en"; letters: AppLetter[]; unread: Set<string> };

const when = (ms: number, lang: "zh" | "en") => new Date(ms).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" });

/** 来信: letters from AlreaDough, newest first. The newest is open; older ones open on tap. */
export default function LettersPanel({ lang, letters, unread }: Props) {
  const [open, setOpen] = useState<string | null>(letters[0]?.id ?? null);
  if (!letters.length) {
    return <div className="letters-empty"><DoughLineMark className="letters-empty-mark" /><p>{lang === "zh" ? "还没有来信。AlreaDough 写信给你时，会出现在这里。" : "No letters yet. When AlreaDough writes to you, it will be here."}</p></div>;
  }
  return (
    <div className="letters">
      {letters.map((letter) => {
        const isOpen = open === letter.id;
        return (
          <article key={letter.id} className={`letter${isOpen ? " open" : ""}`}>
            <button type="button" className="letter-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : letter.id)}>
              <DoughLineMark className="letter-mark" />
              <span className="letter-title"><strong>{letter.subject}</strong><small>{when(letter.createdAt, lang)}</small></span>
              {unread.has(letter.id) && <i className="letter-dot" aria-label={lang === "zh" ? "未读" : "Unread"} />}
            </button>
            {isOpen && <div className="letter-body">
              {letter.body.trim().split(/\n\s*\n/).map((block, index) => <p key={index}>{block.split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</p>)}
              <p className="letter-sign">AlreaDough</p>
            </div>}
          </article>
        );
      })}
    </div>
  );
}
