"use client";

import { useState } from "react";
import { readStored, writeStored } from "@/lib/safe-storage";

type Lang = "zh" | "en";
type Size = "small" | "medium" | "large";
const KEY = "already-font-size-v1";

const text = {
  zh: {
    title: "字号大小",
    intro: "调整整个应用的文字大小，只对这台设备生效。",
    labels: { small: "小", medium: "中", large: "大" },
  },
  en: {
    title: "Text size",
    intro: "Changes the text size across the app, on this device only.",
    labels: { small: "Small", medium: "Medium", large: "Large" },
  },
} as const;

function currentSize(): Size {
  const saved = readStored(KEY);
  return saved === "small" || saved === "large" ? saved : "medium";
}

export default function FontSizePanel({ lang }: { lang: Lang }) {
  const t = text[lang];
  const [size, setSize] = useState<Size>(currentSize);

  const choose = (next: Size) => {
    setSize(next);
    writeStored(KEY, next);
    if (next === "medium") document.documentElement.removeAttribute("data-font-size");
    else document.documentElement.setAttribute("data-font-size", next);
  };

  return <section className="profile-card font-size-card">
    <h3>{t.title}</h3>
    <div className="look-options" role="radiogroup" aria-label={t.title}>
      {(["small", "medium", "large"] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={size === option} className={size === option ? "selected" : ""} onClick={() => choose(option)}>
        <b className={`font-size-glyph ${option}`} aria-hidden="true">{lang === "zh" ? "字" : "Aa"}</b>
        <small>{t.labels[option]}</small>
      </button>)}
    </div>
  </section>;
}
