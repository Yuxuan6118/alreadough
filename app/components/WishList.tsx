"use client";

import { useState } from "react";
import { CaretDown, ChatCircle, Plus, Trash } from "@phosphor-icons/react";
import { validateSpName } from "@/lib/name-policy";

type Lang = "zh" | "en";

export type WishItem = {
  id: string;
  intensity: number;
  wishCategory: string;
  spName: string;
  desire: { zh: string; en: string };
};

type Category = { id: string; zh: string; en: string };

type Props<T extends WishItem> = {
  lang: Lang;
  items: T[];
  currentId: string;
  categories: Category[];
  intensityLabels: string[];
  onUpdate: (id: string, patch: Partial<WishItem>) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
};

/** My desires: one card per desire. Tap a card to edit that desire in place. */
export default function WishList<T extends WishItem>({ lang, items, currentId, categories, intensityLabels, onUpdate, onOpen, onDelete, onAdd }: Props<T>) {
  const zh = lang === "zh";
  const [openId, setOpenId] = useState<string | null>(currentId);
  const [spDrafts, setSpDrafts] = useState<Record<string, string>>({});

  return (
    <div className="wish-list">
      <ul>
        {items.map((item) => {
          const open = openId === item.id;
          const current = item.id === currentId;
          const category = categories.find((entry) => entry.id === item.wishCategory);
          const text = (item.desire[lang] || item.desire.zh || item.desire.en || "").trim();
          const spDraft = spDrafts[item.id] ?? item.spName;
          const spError = spDraft.trim() ? validateSpName(spDraft, lang) : "";
          return (
            <li key={item.id} className={`wish-card${open ? " open" : ""}${current ? " current" : ""}`}>
              <button type="button" className="wish-card-head" aria-expanded={open} onClick={() => setOpenId(open ? null : item.id)}>
                <span className="wish-card-meta">
                  {category && <span className="wish-chip">{zh ? category.zh : category.en}</span>}
                  {current && <span className="wish-chip is-current">{zh ? "正在聊" : "Active"}</span>}
                </span>
                <span className="wish-card-text">{text || (zh ? "还没写下这个愿望" : "Not written yet")}</span>
                <span className="wish-card-foot">
                  <span className="wish-level" aria-label={intensityLabels[item.intensity - 1]}>
                    {intensityLabels.map((_, index) => <i key={index} className={index < item.intensity ? "on" : ""} />)}
                    <small>{intensityLabels[item.intensity - 1]}</small>
                  </span>
                  <CaretDown size={16} className="wish-caret" />
                </span>
              </button>
              {open && (
                <div className="wish-card-body">
                  <label className="wish-field">
                    <span>{zh ? "愿望内容" : "The desire"}</span>
                    <textarea value={item.desire[lang]} onChange={(event) => onUpdate(item.id, { desire: { ...item.desire, [lang]: event.target.value } })} />
                  </label>
                  <div className="wish-field">
                    <span>{zh ? "愿望方向" : "Category"}</span>
                    <div className="wish-pills" role="radiogroup">
                      {categories.map((entry) => (
                        <button type="button" role="radio" aria-checked={item.wishCategory === entry.id} key={entry.id} className={item.wishCategory === entry.id ? "selected" : ""} onClick={() => onUpdate(item.id, { wishCategory: entry.id })}>{zh ? entry.zh : entry.en}</button>
                      ))}
                    </div>
                  </div>
                  <label className="wish-field">
                    <span>{item.wishCategory === "relationship" ? (zh ? "显化对象" : "Manifestation person") : (zh ? "愿望焦点" : "Desire focus")}</span>
                    <input value={spDraft} maxLength={24} aria-invalid={Boolean(spError)} placeholder={zh ? "可以不填" : "Optional"} onChange={(event) => {
                      const value = event.target.value;
                      setSpDrafts((drafts) => ({ ...drafts, [item.id]: value }));
                      if (!value.trim() || !validateSpName(value, lang)) onUpdate(item.id, { spName: value });
                    }} />
                    {spError && <small className="field-error" role="alert">{spError}</small>}
                  </label>
                  <div className="wish-field">
                    <span>{zh ? "想要的程度" : "How much you want it"}</span>
                    <div className="wish-pills" role="radiogroup">
                      {intensityLabels.map((label, index) => (
                        <button type="button" role="radio" aria-checked={item.intensity === index + 1} key={label} className={item.intensity === index + 1 ? "selected" : ""} onClick={() => onUpdate(item.id, { intensity: index + 1 })}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {!current && (
                    <div className="wish-actions">
                      <button type="button" className="wish-primary" onClick={() => onOpen(item.id)}><ChatCircle size={17} /> {zh ? "去聊这个愿望" : "Talk about this one"}</button>
                      <button type="button" className="wish-delete" onClick={() => onDelete(item.id)}><Trash size={16} /> {zh ? "删除" : "Delete"}</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" className="wish-add" onClick={onAdd}><Plus size={17} /> {zh ? "添加愿望" : "Add a desire"}</button>
    </div>
  );
}
