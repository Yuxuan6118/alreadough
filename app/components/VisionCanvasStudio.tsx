"use client";

import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowsOutCardinal, Check, DownloadSimple, FlipHorizontal, Plus, Swap, Trash, UploadSimple } from "@phosphor-icons/react";
import { readStored, writeStored } from "@/lib/safe-storage";
import { askConfirm } from "./ConfirmHost";
import "./vision-studio.css";

type Lang = "zh" | "en";
type Layout = "grid" | "editorial" | "mosaic" | "columns" | "strip" | "scrapbook";
type Ratio = "9:16" | "3:4" | "1:1" | "4:3" | "16:9" | "2:3";
type FrameStyle = "none" | "white" | "polaroid" | "shadow";
type TitlePlace = "top" | "bottom";
type TitleFont = "serif" | "sans" | "kai";
type Tool = "layout" | "ratio" | "frame" | "background" | "text";
type Photo = { id: string; name: string; url: string; w: number; h: number; zoom: number; x: number; y: number; rotate: number; flip: boolean; savedId?: number };
export type SavedPicture = { id: number; title: string; image?: string };
type StoredPhoto = Omit<Photo, "url">;
type Settings = { layout: Layout; ratio: Ratio; frame: FrameStyle; margin: number; gap: number; corner: number; background: string; title: string; titlePlace: TitlePlace; titleFont: TitleFont };
type SavedProject = Settings & { images: StoredPhoto[] };
type Rect = { x: number; y: number; w: number; h: number; r?: number };
type Frame = Rect & { inner: Rect; outerRadius: number; innerRadius: number };

const PROJECT_KEY = "already-vision-project-v2";
const LEGACY_KEY = "already-vision-project-v1";
const MAX_PHOTOS = 20;
const MAX_BYTES = 20_000_000;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const BASE_WIDTH = 1080;
const RATIOS: Ratio[] = ["9:16", "3:4", "2:3", "1:1", "4:3", "16:9"];
const LAYOUTS: Layout[] = ["grid", "editorial", "mosaic", "columns", "strip", "scrapbook"];
const FRAMES: FrameStyle[] = ["none", "white", "polaroid", "shadow"];
const SWATCHES = ["#f4ece4", "#ffffff", "#efe0d3", "#ecd5d3", "#dfe6da", "#dde3ec", "#2f2a28", "#6d4a44"];
const FONTS: Record<TitleFont, string> = {
  serif: '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif',
  sans: '-apple-system, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "Kaiti TC", serif',
};
const DEFAULTS: Settings = { layout: "grid", ratio: "9:16", frame: "none", margin: 40, gap: 16, corner: 20, background: "#f4ece4", title: "", titlePlace: "top", titleFont: "serif" };

/* ---------- device-local photo store ---------- */

const VISION_DB = "already-private-vision-v1";
const VISION_STORE = "images";

function openVisionDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(VISION_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(VISION_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function visionStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const database = await openVisionDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(VISION_STORE, mode);
      const request = run(transaction.objectStore(VISION_STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

const putVisionImage = (id: string, blob: Blob) => visionStore("readwrite", (store) => { store.put(blob, id); }).catch(() => undefined);
const getVisionImage = (id: string) => visionStore<Blob>("readonly", (store) => store.get(id) as IDBRequest<Blob>).catch(() => undefined);
const removeVisionImage = (id: string) => visionStore("readwrite", (store) => { store.delete(id); }).catch(() => undefined);

/* ---------- geometry (shared by preview and export) ---------- */

function boardSize(ratio: Ratio) {
  const [rw, rh] = ratio.split(":").map(Number);
  return { W: BASE_WIDTH, H: Math.round((BASE_WIDTH * rh) / rw) };
}

function bestColumns(count: number, width: number, height: number, minimum = 1) {
  let best = Math.max(1, Math.min(minimum, count));
  let score = Infinity;
  for (let columns = best; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const aspect = (width / columns) / (height / rows);
    const value = Math.abs(Math.log(aspect)) + (columns * rows - count) * 0.08;
    if (value < score) { score = value; best = columns; }
  }
  return best;
}

function rowsLayout(stage: Rect, gap: number, rows: Array<{ weight: number; items: number[] }>): Rect[] {
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const usableHeight = stage.h - gap * (rows.length - 1);
  let y = stage.y;
  const frames: Rect[] = [];
  rows.forEach((row) => {
    const height = (usableHeight * row.weight) / totalWeight;
    const itemWeight = row.items.reduce((sum, value) => sum + value, 0);
    const usableWidth = stage.w - gap * (row.items.length - 1);
    let x = stage.x;
    row.items.forEach((weight) => {
      const width = (usableWidth * weight) / itemWeight;
      frames.push({ x, y, w: width, h: height });
      x += width + gap;
    });
    y += height + gap;
  });
  return frames;
}

function gridRows(count: number, columns: number) {
  const rows: Array<{ weight: number; items: number[] }> = [];
  for (let left = count; left > 0; left -= columns) rows.push({ weight: 1, items: Array(Math.min(columns, left)).fill(1) });
  return rows;
}

function transpose(frames: Rect[], stage: Rect): Rect[] {
  return frames.map((frame) => ({ x: stage.x + (frame.y - stage.y), y: stage.y + (frame.x - stage.x), w: frame.h, h: frame.w }));
}

function layoutFrames(layout: Layout, count: number, stage: Rect, gap: number): Rect[] {
  if (!count) return [];
  if (count === 1) return [{ ...stage }];
  const portrait = stage.h >= stage.w;

  if (layout === "grid") return rowsLayout(stage, gap, gridRows(count, bestColumns(count, stage.w, stage.h)));

  if (layout === "editorial") {
    const rest = count - 1;
    const restHeight = stage.h * (portrait ? 0.46 : 0.42);
    const columns = bestColumns(rest, stage.w, restHeight);
    const restRows = gridRows(rest, columns);
    return rowsLayout(stage, gap, [{ weight: (stage.h - restHeight) / (restHeight / restRows.length), items: [1] }, ...restRows]);
  }

  if (layout === "mosaic") {
    if (count === 2) return rowsLayout(stage, gap, portrait ? [{ weight: 1.5, items: [1] }, { weight: 1, items: [1] }] : [{ weight: 1, items: [1.5, 1] }]);
    if (count === 3) {
      const base = portrait ? rowsLayout(stage, gap, [{ weight: 1.5, items: [1] }, { weight: 1, items: [1, 1] }]) : transpose(rowsLayout({ ...stage, w: stage.h, h: stage.w }, gap, [{ weight: 1.5, items: [1] }, { weight: 1, items: [1, 1] }]), stage);
      return base;
    }
    const rows: Array<{ weight: number; items: number[] }> = [];
    let left = count;
    let index = 0;
    while (left > 0) {
      const size = left === 4 ? 2 : Math.min(left, index % 2 === 0 ? 2 : 3);
      const pattern = size === 1 ? [1] : size === 2 ? (index % 4 === 0 ? [1.6, 1] : [1, 1.6]) : [1, 1.45, 1];
      rows.push({ weight: size === 2 ? 1.25 : 1, items: pattern });
      left -= size; index += 1;
    }
    return portrait || rows.length < 3 ? rowsLayout(stage, gap, rows) : transpose(rowsLayout({ ...stage, w: stage.h, h: stage.w }, gap, rows), stage);
  }

  if (layout === "columns") {
    const columns = Math.max(2, bestColumns(count, stage.w, stage.h, 2));
    const pattern = [1.35, 1, 1.15, 0.85, 1.25, 0.95];
    const buckets: number[][] = Array.from({ length: columns }, () => []);
    for (let index = 0; index < count; index += 1) buckets[index % columns].push(index);
    const columnWidth = (stage.w - gap * (columns - 1)) / columns;
    const frames: Rect[] = Array(count);
    buckets.forEach((bucket, column) => {
      const weights = bucket.map((index) => pattern[(index + column * 2) % pattern.length]);
      const total = weights.reduce((sum, value) => sum + value, 0);
      const usable = stage.h - gap * (bucket.length - 1);
      let y = stage.y;
      bucket.forEach((index, position) => {
        const height = (usable * weights[position]) / total;
        frames[index] = { x: stage.x + column * (columnWidth + gap), y, w: columnWidth, h: height };
        y += height + gap;
      });
    });
    return frames;
  }

  if (layout === "strip") {
    const frames = rowsLayout(portrait ? stage : { ...stage, w: stage.h, h: stage.w }, gap, Array.from({ length: count }, () => ({ weight: 1, items: [1] })));
    return portrait ? frames : transpose(frames, stage);
  }

  // scrapbook: overlapping, gently tilted prints
  const columns = bestColumns(count, stage.w, stage.h);
  const rows = Math.ceil(count / columns);
  const cellWidth = stage.w / columns;
  const cellHeight = stage.h / rows;
  const tilt = [-5, 4, -2.5, 6, -4, 2, 5, -3, 3.5, -6];
  const jitter = [[0.04, -0.03], [-0.05, 0.04], [0.03, 0.05], [-0.03, -0.04], [0.05, 0.02], [-0.04, -0.02]];
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const offset = ((columns - inRow) * cellWidth) / 2;
    const width = cellWidth * (count <= 4 ? 1.02 : 1.14);
    const height = cellHeight * (count <= 4 ? 0.98 : 1.1);
    const [jx, jy] = jitter[index % jitter.length];
    const cx = stage.x + offset + (index % columns + 0.5) * cellWidth + jx * cellWidth;
    const cy = stage.y + (row + 0.5) * cellHeight + jy * cellHeight;
    const x = Math.min(Math.max(cx - width / 2, stage.x - cellWidth * 0.04), stage.x + stage.w - width + cellWidth * 0.04);
    const y = Math.min(Math.max(cy - height / 2, stage.y - cellHeight * 0.04), stage.y + stage.h - height + cellHeight * 0.04);
    return { x, y, w: width, h: height, r: tilt[index % tilt.length] };
  });
}

function boardGeometry(settings: Settings, count: number) {
  const { W, H } = boardSize(settings.ratio);
  const hasTitle = settings.title.trim().length > 0;
  const titleHeight = hasTitle ? Math.min(W, H) * 0.13 : 0;
  const margin = settings.margin;
  const stage: Rect = {
    x: margin,
    y: margin + (settings.titlePlace === "top" ? titleHeight : 0),
    w: W - margin * 2,
    h: H - margin * 2 - titleHeight,
  };
  if (settings.layout === "scrapbook") { stage.x += W * 0.03; stage.y += W * 0.03; stage.w -= W * 0.06; stage.h -= W * 0.06; }
  const title: Rect | null = hasTitle ? { x: margin, y: settings.titlePlace === "top" ? margin : H - margin - titleHeight, w: W - margin * 2, h: titleHeight } : null;
  const frameStyle = settings.layout === "scrapbook" && settings.frame === "none" ? "white" : settings.frame;
  const frames: Frame[] = layoutFrames(settings.layout, count, stage, settings.gap).map((rect) => {
    const short = Math.min(rect.w, rect.h);
    if (frameStyle === "white") {
      const border = Math.max(8, short * 0.04);
      return { ...rect, inner: { x: rect.x + border, y: rect.y + border, w: rect.w - border * 2, h: rect.h - border * 2 }, outerRadius: settings.corner, innerRadius: Math.max(0, settings.corner - border * 0.6) };
    }
    if (frameStyle === "polaroid") {
      const border = Math.max(8, short * 0.055);
      const bottom = border * 3.2;
      const radius = Math.min(settings.corner, 10);
      return { ...rect, inner: { x: rect.x + border, y: rect.y + border, w: rect.w - border * 2, h: rect.h - border - bottom }, outerRadius: radius, innerRadius: Math.min(radius, 4) };
    }
    return { ...rect, inner: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, outerRadius: settings.corner, innerRadius: settings.corner };
  });
  return { W, H, title, frames, frameStyle };
}

/** Where the photo sits inside its frame, in frame-inner pixels. */
function photoPlacement(photo: Photo, inner: Rect) {
  const turned = Math.abs(photo.rotate % 180) === 90;
  const effectiveW = turned ? photo.h : photo.w;
  const effectiveH = turned ? photo.w : photo.h;
  const scale = Math.max(inner.w / effectiveW, inner.h / effectiveH) * photo.zoom;
  const spanX = Math.max(0, (effectiveW * scale - inner.w) / 2 / inner.w);
  const spanY = Math.max(0, (effectiveH * scale - inner.h) / 2 / inner.h);
  const x = Math.max(-spanX, Math.min(spanX, photo.x));
  const y = Math.max(-spanY, Math.min(spanY, photo.y));
  return { width: photo.w * scale, height: photo.h * scale, cx: inner.w / 2 + x * inner.w, cy: inner.h / 2 + y * inner.h, x, y, spanX, spanY };
}

function textOnColor(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#3b2f2c" : "#fbf5f1";
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function roundedPath(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
  context.beginPath();
  context.roundRect(rect.x, rect.y, rect.w, rect.h, Math.max(0, Math.min(radius, rect.w / 2, rect.h / 2)));
}

/* ---------- component ---------- */

export default function VisionCanvasStudio({ lang, saved = [], onRemoveSaved }: { lang: Lang; saved?: SavedPicture[]; onRemoveSaved?: (id: number) => void }) {
  const zh = lang === "zh";
  const copy = zh ? {
    upload: "选择照片", add: "添加照片", clear: "清空", export: "导出图片",
    tools: { layout: "模板", ratio: "比例", frame: "边框", background: "背景", text: "文字" },
    layouts: { grid: "网格", editorial: "主图", mosaic: "错落", columns: "瀑布流", strip: "拼接", scrapbook: "拼贴" },
    frames: { none: "无边", white: "白边", polaroid: "拍立得", shadow: "投影" },
    margin: "外边距", gap: "间距", corner: "圆角", zoom: "缩放",
    custom: "自定义颜色", textPlaceholder: "输入文字", top: "上方", bottom: "下方",
    fonts: { serif: "宋体", sans: "黑体", kai: "楷体" },
    replace: "替换", move: "拖动调整位置", rotate: "旋转", flip: "镜像", remove: "删除", done: "完成",
    clearTitle: "清空愿景板上的全部照片？", clearBody: "照片只存在这台设备上，清空后不能恢复。",
    removeTitle: "从愿景板删除这张照片？", removeBody: "照片只存在这台设备上，删除后不能恢复。",
    cancel: "取消",
    full: (added: number) => added ? `已加入 ${added} 张，最多放 ${MAX_PHOTOS} 张，其余没有放进来` : `已经放满 ${MAX_PHOTOS} 张了，先删掉几张再加`,
    rejected: (count: number) => `${count} 张不是 JPG、PNG、WebP，或超过 20MB，没有放进来`,
  } : {
    upload: "Choose photos", add: "Add photos", clear: "Clear", export: "Export image",
    tools: { layout: "Layout", ratio: "Size", frame: "Border", background: "Backdrop", text: "Text" },
    layouts: { grid: "Grid", editorial: "Hero", mosaic: "Mosaic", columns: "Columns", strip: "Strip", scrapbook: "Scrapbook" },
    frames: { none: "None", white: "White", polaroid: "Polaroid", shadow: "Shadow" },
    margin: "Margin", gap: "Spacing", corner: "Corners", zoom: "Zoom",
    custom: "Custom color", textPlaceholder: "Type a line", top: "Top", bottom: "Bottom",
    fonts: { serif: "Serif", sans: "Sans", kai: "Brush" },
    replace: "Replace", move: "Drag to reposition", rotate: "Rotate", flip: "Mirror", remove: "Delete", done: "Done",
    clearTitle: "Clear every photo from the board?", clearBody: "The photos live only on this device and can't be recovered.",
    removeTitle: "Remove this photo from the board?", removeBody: "The photo lives only on this device and can't be recovered.",
    cancel: "Cancel",
    full: (added: number) => added ? `Added ${added}. The board holds ${MAX_PHOTOS} photos, so the rest were left out` : `The board already holds ${MAX_PHOTOS} photos. Remove some to add more`,
    rejected: (count: number) => `${count} file${count > 1 ? "s were" : " was"} not JPG, PNG or WebP, or over 20MB, and ${count > 1 ? "were" : "was"} left out`,
  };

  const [images, setImages] = useState<Photo[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [tool, setTool] = useState<Tool>("layout");
  const [selectedId, setSelectedId] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const imagesRef = useRef<Photo[]>([]);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; mode: "" | "pan" | "swap"; innerW: number; innerH: number; spanX: number; spanY: number } | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const showNotice = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 7000);
  };

  // restore the device-local project after mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = readStored(PROJECT_KEY);
        const legacy = saved ? null : readStored(LEGACY_KEY);
        if (!saved && !legacy) return;
        let project: SavedProject;
        if (saved) project = { ...DEFAULTS, ...(JSON.parse(saved) as SavedProject) };
        else {
          const old = JSON.parse(legacy as string) as { layout?: string; ratio?: string; gap?: number; corner?: number; background?: string; images?: Array<{ id: string; name: string; zoom: number }> };
          const ratioMap: Record<string, Ratio> = { phone: "9:16", square: "1:1", landscape: "16:9" };
          project = { ...DEFAULTS, ratio: ratioMap[old.ratio || ""] || DEFAULTS.ratio, layout: LAYOUTS.includes(old.layout as Layout) ? old.layout as Layout : old.layout === "film" ? "strip" : DEFAULTS.layout, background: old.background || DEFAULTS.background, images: (old.images || []).map((item) => ({ id: item.id, name: item.name, w: 0, h: 0, zoom: item.zoom || 1, x: 0, y: 0, rotate: 0, flip: false })) };
        }
        if (cancelled) return;
        const { images: storedImages, ...rest } = project;
        setSettings({ ...DEFAULTS, ...rest });
        const items = await Promise.all(storedImages.slice(0, MAX_PHOTOS).map(async (item) => {
          const blob = await getVisionImage(item.id);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          let { w, h } = item;
          if (!w || !h) { try { const image = await loadImage(url); w = image.naturalWidth; h = image.naturalHeight; } catch { return null; } }
          return { ...item, w, h, url } as Photo;
        }));
        if (cancelled) return;
        const found = items.filter((item): item is Photo => Boolean(item));
        // keep anything the person added while the saved board was still loading
        setImages((current) => [...found, ...current.filter((item) => !found.some((entry) => entry.id === item.id))].slice(0, MAX_PHOTOS));
      } catch { /* start with a blank board */ } finally {
        if (!cancelled) setRestored(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    if (!restored) return;
    const project: SavedProject = { ...settings, images: images.map((item) => ({ id: item.id, name: item.name, w: item.w, h: item.h, zoom: item.zoom, x: item.x, y: item.y, rotate: item.rotate, flip: item.flip, savedId: item.savedId })) };
    writeStored(PROJECT_KEY, JSON.stringify(project));
  }, [settings, images, restored]);
  useEffect(() => () => { imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)); window.clearTimeout(noticeTimer.current); }, []);

  const acceptable = (file: File) => ACCEPTED.includes(file.type) && file.size <= MAX_BYTES;

  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (!picked.length) return;
    const files = picked.filter(acceptable);
    const rejected = picked.length - files.length;
    const room = Math.max(0, MAX_PHOTOS - imagesRef.current.length);
    const taking = files.slice(0, room);
    const loaded = (await Promise.all(taking.map(async (file) => {
      const url = URL.createObjectURL(file);
      try {
        const image = await loadImage(url);
        const id = crypto.randomUUID();
        void putVisionImage(id, file);
        return { id, name: file.name, url, w: image.naturalWidth, h: image.naturalHeight, zoom: 1, x: 0, y: 0, rotate: 0, flip: false } as Photo;
      } catch { URL.revokeObjectURL(url); return null; }
    }))).filter((item): item is Photo => Boolean(item));
    setImages((current) => {
      const next = [...current, ...loaded];
      next.slice(MAX_PHOTOS).forEach((item) => { URL.revokeObjectURL(item.url); void removeVisionImage(item.id); });
      return next.slice(0, MAX_PHOTOS);
    });
    const broken = taking.length - loaded.length;
    if (files.length > room) showNotice(copy.full(loaded.length));
    else if (rejected + broken > 0) showNotice(copy.rejected(rejected + broken));
    else setNotice("");
  };

  const replaceSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) return;
    if (!acceptable(file)) { showNotice(copy.rejected(1)); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      void putVisionImage(selectedId, file);
      setImages((current) => current.map((item) => {
        if (item.id !== selectedId) return item;
        URL.revokeObjectURL(item.url);
        return { ...item, name: file.name, url, w: image.naturalWidth, h: image.naturalHeight, zoom: 1, x: 0, y: 0, rotate: 0, flip: false };
      }));
    } catch { URL.revokeObjectURL(url); showNotice(copy.rejected(1)); }
  };

  // a saved picture is copied onto this device, so the board still exports when the photo site is slow or gone
  const [adding, setAdding] = useState<number | null>(null);
  const addSaved = async (picture: SavedPicture) => {
    if (!picture.image || adding !== null || imagesRef.current.length >= MAX_PHOTOS || imagesRef.current.some((item) => item.savedId === picture.id)) return;
    setAdding(picture.id);
    try {
      const response = await fetch(picture.image);
      const blob = await response.blob();
      if (!response.ok || !blob.type.startsWith("image/")) throw new Error("not an image");
      const url = URL.createObjectURL(blob);
      const image = await loadImage(url).catch((error) => { URL.revokeObjectURL(url); throw error; });
      const id = crypto.randomUUID();
      await putVisionImage(id, blob);
      setImages((current) => current.length >= MAX_PHOTOS ? current : [...current, { id, name: picture.title, url, w: image.naturalWidth, h: image.naturalHeight, zoom: 1, x: 0, y: 0, rotate: 0, flip: false, savedId: picture.id }]);
    } catch { /* leave the board as it was */ }
    setAdding(null);
  };
  // a saved picture can always be added again, so taking it off the board needs no confirmation
  const takeOffBoard = (savedId: number) => {
    const target = imagesRef.current.find((item) => item.savedId === savedId);
    if (!target) return;
    URL.revokeObjectURL(target.url);
    void removeVisionImage(target.id);
    setImages((current) => current.filter((item) => item.id !== target.id));
    setSelectedId((current) => current === target.id ? "" : current);
  };
  const trayPictures = saved.filter((picture) => picture.image);
  const tray = trayPictures.length > 0 && <div className="vision-tray">{trayPictures.map((picture) => {
    const placed = images.some((item) => item.savedId === picture.id);
    return <div className={`vision-tray-item${placed ? " placed" : ""}`} key={picture.id}>
      <button type="button" onClick={() => placed ? takeOffBoard(picture.id) : addSaved(picture)} disabled={!placed && (adding !== null || images.length >= MAX_PHOTOS)} aria-pressed={placed} aria-label={picture.title}><img src={picture.image} alt="" onError={(event) => { const tile = event.currentTarget.closest<HTMLElement>(".vision-tray-item"); if (tile) tile.hidden = true; }}/><span className="vision-tray-check" aria-hidden="true">{placed && <Check size={13} weight="bold"/>}</span></button>
      {onRemoveSaved && <button type="button" className="vision-tray-remove" onClick={() => onRemoveSaved(picture.id)} aria-label={`${copy.remove} ${picture.title}`}>×</button>}
    </div>;
  })}</div>;

  const updatePhoto = (id: string, changes: Partial<Photo>) => setImages((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));

  const removePhoto = async (id: string) => {
    if (!await askConfirm({ title: copy.removeTitle, body: copy.removeBody, confirmLabel: copy.remove, cancelLabel: copy.cancel })) return;
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
    void removeVisionImage(id);
    setSelectedId("");
  };

  const clearAll = async () => {
    if (!images.length) return;
    if (!await askConfirm({ title: copy.clearTitle, body: copy.clearBody, confirmLabel: copy.clear, cancelLabel: copy.cancel })) return;
    imagesRef.current.forEach((item) => { URL.revokeObjectURL(item.url); void removeVisionImage(item.id); });
    setImages([]);
    setSelectedId("");
    setNotice("");
  };

  const geometry = boardGeometry(settings, images.length);
  const { W, H } = geometry;
  const ink = textOnColor(settings.background);
  const selected = images.find((item) => item.id === selectedId);

  /* pointer: tap selects, drag a selected photo to reframe it, drag another photo onto a frame to swap */
  const onFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>, photo: Photo, index: number) => {
    if (event.button !== 0) return;
    const innerElement = event.currentTarget.querySelector<HTMLElement>(".vb-photo");
    const box = innerElement?.getBoundingClientRect();
    const placement = photoPlacement(photo, geometry.frames[index].inner);
    dragRef.current = { id: photo.id, startX: event.clientX, startY: event.clientY, originX: placement.x, originY: placement.y, mode: "", innerW: box?.width || 1, innerH: box?.height || 1, spanX: placement.spanX, spanY: placement.spanY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onFramePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.mode) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.mode = drag.id === selectedId ? "pan" : "swap";
    }
    if (drag.mode === "pan") {
      updatePhoto(drag.id, { x: Math.max(-drag.spanX, Math.min(drag.spanX, drag.originX + dx / drag.innerW)), y: Math.max(-drag.spanY, Math.min(drag.spanY, drag.originY + dy / drag.innerH)) });
    } else {
      const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-photo-id]")?.dataset.photoId || "";
      setDropTarget(target && target !== drag.id ? target : "");
    }
  };
  const onFramePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.mode) { setSelectedId((current) => current === drag.id ? "" : drag.id); return; }
    if (drag.mode === "swap" && dropTarget) {
      setImages((current) => {
        const next = [...current];
        const from = next.findIndex((item) => item.id === drag.id);
        const to = next.findIndex((item) => item.id === dropTarget);
        if (from < 0 || to < 0) return current;
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    }
    setDropTarget("");
  };

  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !selectedId) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(`[data-photo-id="${selectedId}"]`)) return;
      event.preventDefault();
      setImages((current) => current.map((item) => item.id === selectedId ? { ...item, zoom: Math.max(1, Math.min(3, item.zoom * Math.exp(-event.deltaY * 0.004))) } : item));
    };
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
  }, [selectedId, images.length]);

  const exportBoard = async () => {
    if (!images.length) return;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale; canvas.height = H * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(scale, scale);
    context.fillStyle = settings.background;
    context.fillRect(0, 0, W, H);
    if (geometry.title) {
      context.fillStyle = ink;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `500 ${Math.round(geometry.title.h * 0.42)}px ${FONTS[settings.titleFont]}`;
      context.fillText(settings.title.trim(), W / 2, geometry.title.y + geometry.title.h / 2, geometry.title.w);
    }
    const loaded = await Promise.all(images.map((item) => loadImage(item.url)));
    geometry.frames.forEach((frame, index) => {
      const photo = images[index];
      if (!photo) return;
      context.save();
      context.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
      context.rotate(((frame.r || 0) * Math.PI) / 180);
      context.translate(-frame.w / 2, -frame.h / 2);
      const outer: Rect = { x: 0, y: 0, w: frame.w, h: frame.h };
      if (geometry.frameStyle !== "none") {
        context.save();
        context.shadowColor = "rgba(45, 28, 22, 0.2)";
        context.shadowBlur = geometry.frameStyle === "shadow" ? 34 : 18;
        context.shadowOffsetY = geometry.frameStyle === "shadow" ? 12 : 6;
        context.fillStyle = geometry.frameStyle === "shadow" ? settings.background : "#fffdfb";
        roundedPath(context, outer, frame.outerRadius);
        context.fill();
        context.restore();
      }
      const inner: Rect = { x: frame.inner.x - frame.x, y: frame.inner.y - frame.y, w: frame.inner.w, h: frame.inner.h };
      roundedPath(context, inner, frame.innerRadius);
      context.clip();
      const place = photoPlacement(photo, frame.inner);
      context.translate(inner.x + place.cx, inner.y + place.cy);
      context.rotate((photo.rotate * Math.PI) / 180);
      if (photo.flip) context.scale(-1, 1);
      context.drawImage(loaded[index], -place.width / 2, -place.height / 2, place.width, place.height);
      context.restore();
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `alreadough-vision-board-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  };

  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  const unit = (value: number) => `calc(${(value / W) * 100} * 1cqw)`;
  const previewCount = Math.max(images.length, 3);

  const fileInputs = <>
    <input ref={addInput} type="file" accept={ACCEPTED.join(",")} multiple hidden onChange={addImages}/>
    <input ref={replaceInput} type="file" accept={ACCEPTED.join(",")} hidden onChange={replaceSelected}/>
  </>;

  if (!images.length) return <div className="vb-studio">
    {fileInputs}
    <button type="button" className="vb-empty" onClick={() => addInput.current?.click()}>
      <UploadSimple size={26}/>
      <span>{copy.upload}</span>
    </button>
    {tray}
    {notice && <p className="vb-notice" role="status">{notice}</p>}
  </div>;

  return <div className="vb-studio">
    {fileInputs}

    <div className="vb-topbar">
      <button type="button" className="vb-chip-button" onClick={() => addInput.current?.click()} disabled={images.length >= MAX_PHOTOS}><Plus size={16}/>{copy.add}<small>{images.length}/{MAX_PHOTOS}</small></button>
      <button type="button" className="vb-chip-button" onClick={clearAll}><Trash size={16}/>{copy.clear}</button>
      <button type="button" className="vb-chip-button vb-export" onClick={exportBoard}><DownloadSimple size={16}/>{copy.export}</button>
    </div>
    {tray}
    {notice && <p className="vb-notice" role="status">{notice}</p>}

    <div className="vb-board-wrap" role="presentation" onKeyDown={(event) => { if (event.key === "Escape") setSelectedId(""); }} onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}>
      <div ref={boardRef} className="vb-board" style={{ aspectRatio: `${W} / ${H}`, background: settings.background, "--vb-max-w": `calc(70vh * ${W / H})` } as CSSProperties} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}>
        {geometry.title && <div className="vb-title" style={{ left: pct(geometry.title.x, W), top: pct(geometry.title.y, H), width: pct(geometry.title.w, W), height: pct(geometry.title.h, H), color: ink, fontFamily: FONTS[settings.titleFont], fontSize: unit(geometry.title.h * 0.42) }}>{settings.title.trim()}</div>}
        {images.map((photo, index) => {
          const frame = geometry.frames[index];
          if (!frame) return null;
          const place = photoPlacement(photo, frame.inner);
          const style = geometry.frameStyle;
          return <div
            key={photo.id}
            data-photo-id={photo.id}
            role="button"
            tabIndex={0}
            aria-label={photo.name}
            aria-pressed={selectedId === photo.id}
            className={`vb-frame vb-frame-${style} ${selectedId === photo.id ? "selected" : ""} ${dropTarget === photo.id ? "drop" : ""}`}
            style={{ left: pct(frame.x, W), top: pct(frame.y, H), width: pct(frame.w, W), height: pct(frame.h, H), transform: frame.r ? `rotate(${frame.r}deg)` : undefined, borderRadius: unit(frame.outerRadius), "--vb-shadow-bg": settings.background } as CSSProperties}
            onPointerDown={(event) => onFramePointerDown(event, photo, index)}
            onPointerMove={onFramePointerMove}
            onPointerUp={onFramePointerUp}
            onPointerCancel={() => { dragRef.current = null; setDropTarget(""); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(photo.id); } }}
          >
            <div className="vb-photo" style={{ left: pct(frame.inner.x - frame.x, frame.w), top: pct(frame.inner.y - frame.y, frame.h), width: pct(frame.inner.w, frame.w), height: pct(frame.inner.h, frame.h), borderRadius: unit(frame.innerRadius) }}>
              <img src={photo.url} alt="" draggable={false} style={{ width: pct(place.width, frame.inner.w), height: pct(place.height, frame.inner.h), left: pct(place.cx - place.width / 2, frame.inner.w), top: pct(place.cy - place.height / 2, frame.inner.h), transform: `rotate(${photo.rotate}deg)${photo.flip ? " scaleX(-1)" : ""}` }}/>
              {selectedId === photo.id && <span className="vb-move-hint" aria-hidden="true"><ArrowsOutCardinal size={16} weight="bold"/>{copy.move}</span>}
            </div>
          </div>;
        })}
      </div>
    </div>

    {selected ? <div className="vb-panel vb-photo-tools">
      <div className="vb-row">
        <button type="button" className="vb-tool-button" onClick={() => replaceInput.current?.click()}><Swap size={18}/>{copy.replace}</button>
        <button type="button" className="vb-tool-button" onClick={() => updatePhoto(selected.id, { rotate: (selected.rotate + 90) % 360, x: 0, y: 0 })}><ArrowClockwise size={18}/>{copy.rotate}</button>
        <button type="button" className="vb-tool-button" onClick={() => updatePhoto(selected.id, { flip: !selected.flip })}><FlipHorizontal size={18}/>{copy.flip}</button>
        <button type="button" className="vb-tool-button" onClick={() => removePhoto(selected.id)}><Trash size={18}/>{copy.remove}</button>
        <button type="button" className="vb-tool-button vb-done" onClick={() => setSelectedId("")}>{copy.done}</button>
      </div>
      <label className="vb-slider"><span>{copy.zoom}</span><input type="range" min="1" max="3" step="0.02" value={selected.zoom} onChange={(event) => updatePhoto(selected.id, { zoom: Number(event.target.value) })}/></label>
    </div> : <div className="vb-panel">
      <div className="vb-tabs" role="tablist">
        {(Object.keys(copy.tools) as Tool[]).map((key) => <button type="button" role="tab" aria-selected={tool === key} className={tool === key ? "active" : ""} key={key} onClick={() => setTool(key)}>{copy.tools[key]}</button>)}
      </div>

      {tool === "layout" && <div className="vb-options vb-templates">
        {LAYOUTS.map((value) => {
          const thumb = boardGeometry({ ...settings, layout: value, title: "", margin: 50, gap: 26, frame: "none" }, Math.min(previewCount, 9));
          return <button type="button" key={value} className={settings.layout === value ? "selected" : ""} onClick={() => set("layout", value)}>
            <span className="vb-thumb" style={{ aspectRatio: `${thumb.W} / ${thumb.H}` }}>{thumb.frames.map((frame, index) => <i key={index} style={{ left: pct(frame.x, thumb.W), top: pct(frame.y, thumb.H), width: pct(frame.w, thumb.W), height: pct(frame.h, thumb.H), transform: frame.r ? `rotate(${frame.r}deg)` : undefined }}/>)}</span>
            {copy.layouts[value]}
          </button>;
        })}
      </div>}

      {tool === "ratio" && <div className="vb-options vb-ratios">
        {RATIOS.map((value) => {
          const [rw, rh] = value.split(":").map(Number);
          const size = 30 / Math.max(rw, rh);
          return <button type="button" key={value} className={settings.ratio === value ? "selected" : ""} onClick={() => set("ratio", value)}>
            <span className="vb-ratio-shape" style={{ width: rw * size, height: rh * size }}/>{value}
          </button>;
        })}
      </div>}

      {tool === "frame" && <div className="vb-stack">
        <div className="vb-options vb-frames">{FRAMES.map((value) => <button type="button" key={value} className={settings.frame === value ? "selected" : ""} onClick={() => set("frame", value)}><span className={`vb-frame-swatch vb-frame-swatch-${value}`}/>{copy.frames[value]}</button>)}</div>
        <label className="vb-slider"><span>{copy.margin}</span><input type="range" min="0" max="140" value={settings.margin} onChange={(event) => set("margin", Number(event.target.value))}/></label>
        <label className="vb-slider"><span>{copy.gap}</span><input type="range" min="0" max="60" value={settings.gap} onChange={(event) => set("gap", Number(event.target.value))}/></label>
        <label className="vb-slider"><span>{copy.corner}</span><input type="range" min="0" max="80" value={settings.corner} onChange={(event) => set("corner", Number(event.target.value))}/></label>
      </div>}

      {tool === "background" && <div className="vb-options vb-swatches">
        {SWATCHES.map((value) => <button type="button" key={value} aria-label={value} className={settings.background.toLowerCase() === value ? "selected" : ""} style={{ background: value }} onClick={() => set("background", value)}/>)}
        <label className={`vb-custom-color ${SWATCHES.includes(settings.background.toLowerCase()) ? "" : "selected"}`} style={{ background: SWATCHES.includes(settings.background.toLowerCase()) ? undefined : settings.background }} aria-label={copy.custom}><input type="color" value={settings.background} onChange={(event) => set("background", event.target.value)}/></label>
      </div>}

      {tool === "text" && <div className="vb-stack">
        <input className="vb-text-input" value={settings.title} maxLength={40} placeholder={copy.textPlaceholder} onChange={(event) => set("title", event.target.value)}/>
        <div className="vb-options vb-small-options">
          {(["top", "bottom"] as const).map((value) => <button type="button" key={value} className={settings.titlePlace === value ? "selected" : ""} onClick={() => set("titlePlace", value)}>{copy[value]}</button>)}
          <span className="vb-divider"/>
          {(["serif", "sans", "kai"] as const).map((value) => <button type="button" key={value} className={settings.titleFont === value ? "selected" : ""} style={{ fontFamily: FONTS[value] }} onClick={() => set("titleFont", value)}>{copy.fonts[value]}</button>)}
        </div>
      </div>}
    </div>}
  </div>;
}
