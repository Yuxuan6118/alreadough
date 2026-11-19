"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

type Lang = "zh" | "en";
type Cover = { image: string; credit?: string; source?: string };
type SearchImage = { title: string; image: string; source: string; credit: string; downloadLocation?: string };
type BoardPhoto = { image: string; title: string; source: string };

/** Choose a story's cover: a licensed photo from search, or one already kept on the vision board. */
export default function StoryCoverPicker({ lang, title, initialQuery, board, hasCover, onPick, onRemove, onClose }: {
  lang: Lang;
  title: string;
  initialQuery: string;
  board: BoardPhoto[];
  hasCover: boolean;
  onPick: (cover: Cover, downloadLocation?: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  const [tab, setTab] = useState<"search" | "board">("search");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchImage[]>([]);
  // opens already searching for the story's own words
  const [searching, setSearching] = useState(Boolean(initialQuery.trim()));
  const [error, setError] = useState("");

  const runSearch = (q: string) => fetch(`/api/images?q=${encodeURIComponent(q)}`)
    .then((response) => response.ok ? response.json() as Promise<{ results?: SearchImage[] }> : Promise.reject(new Error("search failed")))
    .then((data) => {
      setResults(data.results || []);
      setError(data.results?.length ? "" : zh ? "没有找到合适的照片，换个更宽泛的说法试试。" : "No suitable photos. Try a broader phrase.");
    })
    .catch(() => setError(zh ? "照片搜索暂时连不上，请稍后再试。" : "Photo search couldn't connect. Try again later."))
    .finally(() => setSearching(false));

  const search = () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true); setError("");
    void runSearch(q);
  };

  useEffect(() => { if (initialQuery.trim()) void runSearch(initialQuery.trim()); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="story-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="story-editor-modal cover-picker" role="dialog" aria-modal="true" aria-labelledby="cover-picker-title">
      <header>
        <div><p className="eyebrow">{zh ? "换封面" : "CHANGE COVER"}</p><h2 id="cover-picker-title">{title}</h2></div>
        <button type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X size={18}/></button>
      </header>
      <div className="cover-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>{zh ? "搜索照片" : "Search photos"}</button>
        <button type="button" role="tab" aria-selected={tab === "board"} className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}>{zh ? `我的愿景 · ${board.length}` : `My vision · ${board.length}`}</button>
      </div>
      {tab === "search" ? <>
        <form className="cover-picker-search" onSubmit={(event) => { event.preventDefault(); search(); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder={zh ? "描述你想要的画面" : "Describe the picture you want"} aria-label={zh ? "搜索照片" : "Search photos"}/>
          <button type="submit" disabled={searching} aria-label={zh ? "搜索" : "Search"}><MagnifyingGlass size={18}/></button>
        </form>
        {error && <p className="cover-picker-note">{error}</p>}
        {searching && !results.length ? <p className="cover-picker-note">{zh ? "正在找照片……" : "Finding photos…"}</p> : <div className="cover-picker-grid">
          {results.map((item) => <button type="button" key={item.source} onClick={() => onPick({ image: item.image, credit: item.credit, source: item.source }, item.downloadLocation)}><img src={item.image} alt={item.title} loading="lazy"/><small>{item.credit}</small></button>)}
        </div>}
      </> : board.length ? <div className="cover-picker-grid">
        {board.map((item, index) => <button type="button" key={`${index}-${item.source}`} onClick={() => onPick({ image: item.image, source: item.source })}><img src={item.image} alt={item.title} loading="lazy"/><small>{item.title}</small></button>)}
      </div> : <p className="cover-picker-note">{zh ? "愿景里还没有收藏的图片。在「愿景」里收藏的照片会出现在这里。" : "Nothing on your vision board yet. Photos you keep in Vision show up here."}</p>}
      {hasCover && <footer><button type="button" className="outline-button" onClick={onRemove}>{zh ? "不用封面" : "Remove cover"}</button></footer>}
    </section>
  </div>;
}
