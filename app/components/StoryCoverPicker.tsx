"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import DoughHop from "./DoughHop";
import { Check, ImageSquare, MagnifyingGlass, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { saveLocalCover } from "@/lib/cover-store";
import CoverPrint, { COVER_PRINTS, DoughIcon, isPrintCover, PRINT_COVER_PREFIX } from "./CoverPrints";

// phones and tablets open the photo library; computers open a file window
const subscribe = () => () => {};
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

type Lang = "zh" | "en";
type Cover = { image: string; credit?: string; source?: string };
type SearchImage = { title: string; image: string; source: string; credit: string; downloadLocation?: string };
type BoardPhoto = { image: string; title: string; source: string };

/** Choose a story's cover: her own photo (kept on this device), a licensed photo from search, one from the vision board, or a built-in dough print. */
export default function StoryCoverPicker({ lang, title, initialQuery, board, hasCover, current, onPick, onRemove, onClose }: {
  lang: Lang;
  title: string;
  initialQuery: string;
  board: BoardPhoto[];
  hasCover: boolean;
  /** The story's cover image now, to tick the built-in print it uses. */
  current?: string;
  onPick: (cover: Cover, downloadLocation?: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const zh = lang === "zh";
  const [tab, setTab] = useState<"search" | "board" | "prints">("search");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchImage[]>([]);
  // opens already searching for the story's own words
  const [searching, setSearching] = useState(Boolean(initialQuery.trim()));
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const touch = useSyncExternalStore(subscribe, isTouch, () => false);
  // no cover yet shows the first print, so that one is ticked
  const currentPrint = isPrintCover(current) ? current?.slice(PRINT_COVER_PREFIX.length) : current ? null : COVER_PRINTS[0].id;
  const uploadLabel = touch ? (zh ? "从相册选" : "From photos") : (zh ? "从电脑上传" : "Upload a photo");

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError(zh ? "请选择一张图片。" : "Please choose an image."); return; }
    setUploading(true); setUploadError("");
    try { onPick({ image: await saveLocalCover(file) }); }
    catch { setUploadError(zh ? "这张图片读不出来，换一张试试。" : "Couldn't read that image. Try another one."); }
    finally { setUploading(false); }
  };

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

  const uploadTile = <button type="button" className="cover-upload-tile" onClick={() => fileInput.current?.click()} disabled={uploading}>
    <span><UploadSimple size={22}/></span>
    <strong>{uploading ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "正在放进来……" : "Adding…"}</span> : uploadLabel}</strong>
    <small>{zh ? "只存在这台设备上" : "Stays on this device"}</small>
  </button>;
  const grid = (items: Array<{ key: string; image: string; label: string; pick: () => void }>) => <div className="cover-picker-scroll"><div className="cover-picker-grid">
    {uploadTile}
    {items.map((item) => <button type="button" key={item.key} onClick={item.pick}><img src={item.image} alt="" loading="lazy"/>{item.label && <small>{item.label}</small>}</button>)}
  </div></div>;

  return <div className="story-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="story-editor-modal cover-picker" role="dialog" aria-modal="true" aria-labelledby="cover-picker-title">
      <header className="cover-picker-head">
        <div><h2 id="cover-picker-title">{hasCover ? (zh ? "换封面" : "Change cover") : (zh ? "加封面" : "Add a cover")}</h2><p>{title}</p></div>
        <button type="button" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X size={18}/></button>
      </header>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }}/>
      <div className="cover-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "search"} className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}><MagnifyingGlass size={15}/> {zh ? "搜索照片" : "Search photos"}</button>
        <button type="button" role="tab" aria-selected={tab === "board"} className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}><ImageSquare size={15}/> {zh ? `我的愿景 · ${board.length}` : `My vision · ${board.length}`}</button>
        <button type="button" role="tab" aria-selected={tab === "prints"} className={tab === "prints" ? "active" : ""} onClick={() => setTab("prints")}><DoughIcon size={15}/> {zh ? "面团封面" : "Dough covers"}</button>
      </div>
      {uploadError && <p className="cover-picker-note is-error" role="alert">{uploadError}</p>}
      {tab === "prints" ? <div className="cover-picker-scroll"><div className="cover-picker-grid">
        {COVER_PRINTS.map((print) => {
          const on = print.id === currentPrint;
          return <button type="button" key={print.id} className={on ? "is-current" : undefined} aria-label={zh ? print.name[0] : print.name[1]} aria-current={on || undefined} onClick={() => onPick({ image: PRINT_COVER_PREFIX + print.id })}>
            <CoverPrint id={print.id}/>{on && <span className="cover-print-check"><Check size={13} weight="bold"/></span>}
          </button>;
        })}
      </div></div> : tab === "search" ? <>
        <form className="cover-picker-search" onSubmit={(event) => { event.preventDefault(); search(); }}>
          <MagnifyingGlass size={18} aria-hidden="true"/>
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder={zh ? "描述你想要的画面" : "Describe the picture you want"} aria-label={zh ? "搜索照片" : "Search photos"}/>
          <button type="submit" disabled={searching || !query.trim()}>{searching ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "搜索中" : "Searching"}</span> : (zh ? "搜索" : "Search")}</button>
        </form>
        {error && <p className="cover-picker-note">{error}</p>}
        {searching && !results.length && <p className="cover-picker-note dough-loading is-block" role="status"><DoughHop size="md"/>{zh ? "正在找照片……" : "Finding photos…"}</p>}
        {grid(results.map((item) => ({ key: item.source, image: item.image, label: "", pick: () => onPick({ image: item.image, credit: item.credit, source: item.source }, item.downloadLocation) })))}
      </> : <>
        {!board.length && <p className="cover-picker-note">{zh ? "愿景里还没有收藏的图片。在「愿景」里收藏的照片会出现在这里。" : "Nothing on your vision board yet. Photos you keep in Vision show up here."}</p>}
        {grid(board.map((item, index) => ({ key: `${index}-${item.source}`, image: item.image, label: item.title, pick: () => onPick({ image: item.image, source: item.source }) })))}
      </>}
      {hasCover && <footer className="cover-picker-foot"><button type="button" className="wish-delete" onClick={onRemove}><Trash size={16}/> {zh ? "换成默认封面" : "Use the default cover"}</button></footer>}
    </section>
  </div>;
}
