"use client";

import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowClockwise, ArrowsOutCardinal, Check, DownloadSimple, FlipHorizontal, Plus, Swap, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { Capacitor } from "@capacitor/core";
import { readStored, writeStored } from "@/lib/safe-storage";
import { detectInstallMode } from "@/lib/install-mode";
import { askConfirm, showUndo } from "./ConfirmHost";
import "./vision-studio.css";

type Lang = "zh" | "en";
type Layout = "grid" | "editorial" | "mosaic" | "columns" | "strip" | "scrapbook";
type Ratio = "9:16" | "3:4" | "1:1" | "4:3" | "16:9" | "2:3";
type FrameStyle = "none" | "white" | "polaroid" | "shadow";
type Tool = "layout" | "ratio" | "frame" | "background" | "text";
type Photo = { id: string; name: string; url: string; w: number; h: number; zoom: number; x: number; y: number; rotate: number; flip: boolean; savedId?: number };
export type SavedPicture = { id: number; title: string; image?: string };
type StoredPhoto = Omit<Photo, "url">;
/** a line of text placed freely on the board: x, y are its centre as a share of the board; size is in board pixels (the board is 1080 wide) */
type TextBox = { id: string; text: string; font: string; size: number; color: string; x: number; y: number };
type Settings = { layout: Layout; ratio: Ratio; frame: FrameStyle; margin: number; gap: number; corner: number; background: string; texts: TextBox[] };
/** what older versions saved: one title above or below the photos */
type OldTitle = { title?: string; titlePlace?: "top" | "bottom"; titleFont?: "serif" | "sans" | "kai" };
type FontFace = { fontFamily: string; fontStyle?: string };
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
/** the plain font every phone and computer already has */
const SYSTEM_SANS = '-apple-system, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
/** the font library; every font but the plain one is a web font from lib/vision-fonts.ts, so it looks the same on every device */
const VISION_FONTS: Array<{ id: string; group: "zh" | "en"; label: string }> = [
  { id: "sans", group: "zh", label: "" },
  { id: "xiaowei", group: "zh", label: "站酷小薇" },
  { id: "mashan", group: "zh", label: "马善政楷书" },
  { id: "zhimang", group: "zh", label: "志莽行书" },
  { id: "longcang", group: "zh", label: "龙藏手写" },
  { id: "kuaile", group: "zh", label: "站酷快乐体" },
  { id: "huangyou", group: "zh", label: "庆科黄油体" },
  { id: "playfair", group: "en", label: "Playfair" },
  { id: "cormorant", group: "en", label: "Cormorant" },
  { id: "greatvibes", group: "en", label: "Great Vibes" },
  { id: "dancing", group: "en", label: "Dancing Script" },
  { id: "abril", group: "en", label: "Abril Fatface" },
  { id: "bebas", group: "en", label: "Bebas Neue" },
];
const TEXT_COLORS = ["#2f2a28", "#ffffff", "#a65f6b", "#c8a24a", "#5f7a96", "#6d4a44"];
const MAX_TEXTS = 8;
const DEFAULTS: Settings = { layout: "grid", ratio: "9:16", frame: "none", margin: 40, gap: 16, corner: 20, background: "#f4ece4", texts: [] };

function fontFace(id: string, faces: Record<string, FontFace> | null): FontFace {
  const face = faces?.[id];
  return face ? { fontFamily: `${face.fontFamily}, ${SYSTEM_SANS}`, fontStyle: face.fontStyle } : { fontFamily: SYSTEM_SANS };
}

/** saved settings from any version, with an old above/below title turned into a text box where it used to sit */
function upgradeSettings(raw: Partial<Settings> & OldTitle): Settings {
  const { title, titlePlace, titleFont, texts, ...rest } = raw;
  const settings: Settings = { ...DEFAULTS, ...rest, texts: Array.isArray(texts) ? texts.filter((item) => item && typeof item.text === "string").slice(0, MAX_TEXTS) : [] };
  if (!settings.texts.length && title?.trim()) {
    const { W, H } = boardSize(settings.ratio);
    const band = Math.min(W, H) * 0.13;
    const middle = (settings.margin + band / 2) / H;
    settings.texts = [{ id: crypto.randomUUID(), text: title.trim(), font: titleFont === "kai" ? "mashan" : titleFont === "sans" ? "sans" : "xiaowei", size: Math.round(band * 0.42), color: "", x: 0.5, y: titlePlace === "bottom" ? 1 - middle : middle }];
  }
  return settings;
}

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

function boardGeometry(settings: Omit<Settings, "background" | "texts">, count: number) {
  const { W, H } = boardSize(settings.ratio);
  const margin = settings.margin;
  // text floats over the board, so the photos always get the whole stage
  const stage: Rect = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 };
  if (settings.layout === "scrapbook") { stage.x += W * 0.03; stage.y += W * 0.03; stage.w -= W * 0.06; stage.h -= W * 0.06; }
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
  return { W, H, frames, frameStyle };
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

/** The main colours across the board's photos, most present first (each photo counts the same). */
async function photoPalette(urls: string[], limit = 6) {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  for (const url of urls) {
    let image: HTMLImageElement;
    try { image = await loadImage(url); } catch { continue; }
    const scale = 64 / Math.max(image.naturalWidth, image.naturalHeight, 1);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const share = 1 / (canvas.width * canvas.height);
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 128) continue;
      const r = data[index], g = data[index + 1], b = data[index + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += share; bucket.r += r * share; bucket.g += g * share; bucket.b += b * share;
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight).map((bucket) => [bucket.r / bucket.weight, bucket.g / bucket.weight, bucket.b / bucket.weight]);
  const distance = ([r1, g1, b1]: number[], [r2, g2, b2]: number[]) => {
    const mean = (r1 + r2) / 2;
    return Math.sqrt((2 + mean / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - mean) / 256) * (b1 - b2) ** 2);
  };
  const picked: number[][] = [];
  for (const color of ranked) {
    if (picked.every((other) => distance(color, other) > 90)) picked.push(color);
    if (picked.length >= limit) break;
  }
  return picked.map((color) => `#${color.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`);
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

/* ---------- picking a photo up to swap it, and settling it back down ---------- */

type Drag = {
  id: string; el: HTMLElement; startX: number; startY: number; originX: number; originY: number; mode: "" | "pan" | "swap";
  innerW: number; innerH: number; spanX: number; spanY: number;
  dx: number; dy: number; lastDx: number; lastT: number; vx: number; tilt: number; maxTilt: number; scale: number; target: string; raf: number;
  touch: boolean; hold: number;
};
type Box = Record<string, string>;
type Settle = { id: string; frame: Box; photo: Box; img: Box; x: number; y: number; turn: number; scale: number; z: number };

const LIFT_PROPS = ["--lift-x", "--lift-y", "--lift-tilt", "--lift-scale"];
/** how long a photo is held still before it lifts */
const HOLD_MS = 300;

/** a light tap felt in the hand when a photo lifts: the native haptic in the app, a short vibration in Android browsers */
async function buzz() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* no haptics on this device */ }
    return;
  }
  navigator.vibrate?.(10);
}
const BOX_KEYS = ["left", "top", "width", "height", "borderRadius"] as const;

function readBox(node: HTMLElement | null) {
  const box: Box = {};
  if (node) BOX_KEYS.forEach((key) => { if (node.style[key]) box[key] = node.style[key]; });
  return box;
}
const readBoxes = (frame: HTMLElement) => ({ frame: readBox(frame), photo: readBox(frame.querySelector<HTMLElement>(".vb-photo")), img: readBox(frame.querySelector<HTMLElement>("img")) });
const frameTurn = (frame: HTMLElement) => Number.parseFloat(frame.style.getPropertyValue("--vb-r")) || 0;

/** a spring (stiffness 300, damping 28) written out as a CSS easing curve */
let settleTiming: KeyframeAnimationOptions | null = null;
function springTiming(): KeyframeAnimationOptions {
  if (settleTiming) return settleTiming;
  if (!CSS.supports("animation-timing-function", "linear(0, 1)")) {
    settleTiming = { duration: 420, easing: "cubic-bezier(.2, .9, .3, 1)" };
    return settleTiming;
  }
  const step = 1 / 60;
  let position = 0;
  let velocity = 0;
  let time = 0;
  const points = ["0"];
  while (time < 1.5) {
    for (let index = 0; index < 4; index += 1) {
      velocity += (300 * (1 - position) - 28 * velocity) * (step / 4);
      position += velocity * (step / 4);
    }
    time += step;
    points.push(position.toFixed(4));
    if (Math.abs(1 - position) < 0.002 && Math.abs(velocity) < 0.05) break;
  }
  points[points.length - 1] = "1";
  settleTiming = { duration: Math.round(time * 1000), easing: `linear(${points.join(", ")})` };
  return settleTiming;
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
    custom: "自定义颜色", textPlaceholder: "输入文字",
    addText: "添加文字", removeText: "删除文字", textSize: "字号", fontZh: "中文", fontEn: "English", plainFont: "黑体", textRemoved: "已删除文字", undo: "撤销",
    replace: "替换", move: "拖动调整位置", rotate: "旋转", flip: "镜像", remove: "删除", done: "完成",
    saveToPhotos: "保存到相册", holdToSave: "长按图片，保存到相册", close: "关闭",
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
    custom: "Custom color", textPlaceholder: "Type here",
    addText: "Add text", removeText: "Delete text", textSize: "Size", fontZh: "Chinese", fontEn: "English", plainFont: "Plain", textRemoved: "Text deleted", undo: "Undo",
    replace: "Replace", move: "Drag to reposition", rotate: "Rotate", flip: "Mirror", remove: "Delete", done: "Done",
    saveToPhotos: "Save to Photos", holdToSave: "Press and hold the picture to save it to Photos", close: "Close",
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
  const [liftId, setLiftId] = useState("");
  const [loose, setLoose] = useState(false);
  const [toolsId, setToolsId] = useState("");
  const [textId, setTextId] = useState("");
  const [faces, setFaces] = useState<Record<string, FontFace> | null>(null);
  const [guide, setGuide] = useState(false);
  const textDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; boardW: number; boardH: number; moved: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const imagesRef = useRef<Photo[]>([]);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const settleRef = useRef<Settle[] | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const exportingRef = useRef(false);
  const studioRef = useRef<HTMLDivElement>(null);
  /** a finished picture shown on its own, when the share sheet could not open straight from the tap */
  const [ready, setReady] = useState<{ file: File; url: string; share: boolean; host: Element } | null>(null);

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
        let project: SavedProject & OldTitle;
        if (saved) project = { ...DEFAULTS, ...(JSON.parse(saved) as SavedProject & OldTitle) };
        else {
          const old = JSON.parse(legacy as string) as { layout?: string; ratio?: string; gap?: number; corner?: number; background?: string; images?: Array<{ id: string; name: string; zoom: number }> };
          const ratioMap: Record<string, Ratio> = { phone: "9:16", square: "1:1", landscape: "16:9" };
          project = { ...DEFAULTS, ratio: ratioMap[old.ratio || ""] || DEFAULTS.ratio, layout: LAYOUTS.includes(old.layout as Layout) ? old.layout as Layout : old.layout === "film" ? "strip" : DEFAULTS.layout, background: old.background || DEFAULTS.background, images: (old.images || []).map((item) => ({ id: item.id, name: item.name, w: 0, h: 0, zoom: item.zoom || 1, x: 0, y: 0, rotate: 0, flip: false })) };
        }
        if (cancelled) return;
        const { images: storedImages, ...rest } = project;
        setSettings(upgradeSettings(rest));
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

  // colours taken from the photos on the board, shown first in the backdrop swatches
  const [palette, setPalette] = useState<string[]>([]);
  const paletteKey = images.map((item) => item.url).join("|");
  useEffect(() => {
    let cancelled = false;
    const urls = paletteKey ? paletteKey.split("|") : [];
    photoPalette(urls).then((colors) => { if (!cancelled) setPalette(colors); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [paletteKey]);
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
      {onRemoveSaved && <button type="button" className="vision-tray-remove" onClick={() => onRemoveSaved(picture.id)} aria-label={`${copy.remove} ${picture.title}`}><X size={12} weight="bold"/></button>}
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
  // the photo tools stay rendered (hidden) after a photo is let go, so the two panels can cross-fade
  const toolsPhoto = selected || images.find((item) => item.id === toolsId) || images[0];

  /* ---------- text boxes ---------- */
  const activeText = settings.texts.find((item) => item.id === textId);
  const faceOf = (id: string) => fontFace(id, faces);
  // the font library loads the first time text is shown or the text tools open
  const needFonts = tool === "text" || settings.texts.length > 0;
  useEffect(() => {
    if (!needFonts || faces) return;
    let cancelled = false;
    import("@/lib/vision-fonts").then((module) => { if (!cancelled) setFaces(module.visionFontFaces); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [needFonts, faces]);
  // a new box gets the typing cursor straight away (in the same tap, so a phone opens its keyboard)
  const textInput = useRef<HTMLTextAreaElement>(null);
  const focusNewText = useRef(false);
  useLayoutEffect(() => {
    if (!focusNewText.current) return;
    focusNewText.current = false;
    textInput.current?.focus();
  }, [textId]);
  const updateText = (id: string, changes: Partial<TextBox>) => setSettings((current) => ({ ...current, texts: current.texts.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  /** choose a text box to edit ("" lets go); a box left empty disappears when it is let go */
  const pickText = (id: string) => {
    if (textId && textId !== id) setSettings((current) => ({ ...current, texts: current.texts.filter((item) => item.id !== textId || item.text.trim()) }));
    setTextId(id);
    if (id) { setSelectedId(""); setTool("text"); }
  };
  const addText = () => {
    const kept = settings.texts.filter((item) => item.id !== textId || item.text.trim());
    if (kept.length >= MAX_TEXTS) return;
    // new boxes start in the middle, each a little lower than the last so they don't stack exactly
    const box: TextBox = { id: crypto.randomUUID(), text: "", font: activeText?.font || "sans", size: 72, color: ink, x: 0.5, y: Math.min(0.85, 0.5 + (kept.length % 4) * 0.08) };
    setSettings((current) => ({ ...current, texts: [...current.texts.filter((item) => item.id !== textId || item.text.trim()), box] }));
    focusNewText.current = true;
    setTextId(box.id);
    setSelectedId("");
    setTool("text");
  };
  const removeText = (id: string) => {
    const index = settings.texts.findIndex((item) => item.id === id);
    const box = settings.texts[index];
    if (!box) return;
    setSettings((current) => ({ ...current, texts: current.texts.filter((item) => item.id !== id) }));
    if (textId === id) setTextId("");
    if (box.text.trim()) showUndo(copy.textRemoved, copy.undo, () => setSettings((current) => ({ ...current, texts: [...current.texts.slice(0, index), box, ...current.texts.slice(index)].slice(0, MAX_TEXTS) })));
  };
  // a text box moves as soon as it is dragged, with a finger or a mouse; it snaps to the board's centre line
  const onTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, box: TextBox) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const rect = boardRef.current?.getBoundingClientRect();
    textDragRef.current = { id: box.id, startX: event.clientX, startY: event.clientY, originX: box.x, originY: box.y, boardW: rect?.width || 1, boardH: rect?.height || 1, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
    if (textId !== box.id) pickText(box.id);
  };
  const onTextPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = textDragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    let x = Math.max(0.02, Math.min(0.98, drag.originX + dx / drag.boardW));
    const y = Math.max(0.02, Math.min(0.98, drag.originY + dy / drag.boardH));
    const centred = Math.abs(x - 0.5) < 0.015;
    if (centred) x = 0.5;
    setGuide(centred);
    updateText(drag.id, { x, y });
  };
  const onTextPointerUp = () => { textDragRef.current = null; setGuide(false); };
  const letGoAll = () => { setSelectedId(""); pickText(""); };

  const liftIndex = liftId ? images.findIndex((item) => item.id === liftId) : -1;
  const liftFrame = liftIndex >= 0 ? geometry.frames[liftIndex] : undefined;
  const boardRef = useRef<HTMLDivElement>(null);

  /* pointer: tap selects, drag a selected photo to reframe it, drag another photo onto a frame to swap.
     A swap drag picks the photo up: it follows the pointer, leans with its sideways speed, and springs into place on release. */
  const onFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>, photo: Photo, index: number) => {
    if (event.button !== 0) return;
    const el = event.currentTarget;
    el.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    const innerElement = el.querySelector<HTMLElement>(".vb-photo");
    const box = innerElement?.getBoundingClientRect();
    const placement = photoPlacement(photo, geometry.frames[index].inner);
    const drag: Drag = { id: photo.id, el, startX: event.clientX, startY: event.clientY, originX: placement.x, originY: placement.y, mode: "", innerW: box?.width || 1, innerH: box?.height || 1, spanX: placement.spanX, spanY: placement.spanY, dx: 0, dy: 0, lastDx: 0, lastT: 0, vx: 0, tilt: 0, maxTilt: 0, scale: 1, target: "", raf: 0, touch: event.pointerType !== "mouse", hold: 0 };
    dragRef.current = drag;
    try { el.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
    // holding a photo still picks it up, with a finger and with a mouse alike
    if (photo.id !== selectedId) drag.hold = window.setTimeout(() => {
      if (dragRef.current !== drag || drag.mode) return;
      drag.mode = "swap";
      liftPhoto(drag);
      void buzz();
    }, HOLD_MS);
  };
  const followPointer = (now: number) => {
    const drag = dragRef.current;
    if (!drag || drag.mode !== "swap") return;
    if (!drag.lastT) drag.lastT = now;
    const elapsed = Math.max(8, now - drag.lastT);
    drag.vx += (((drag.dx - drag.lastDx) / elapsed) * 1000 - drag.vx) * 0.3;
    drag.lastDx = drag.dx;
    drag.lastT = now;
    const lean = Math.max(-drag.maxTilt, Math.min(drag.maxTilt, drag.vx / 110));
    drag.tilt += (lean - drag.tilt) * 0.2;
    drag.el.style.setProperty("--lift-x", `${drag.dx}px`);
    drag.el.style.setProperty("--lift-y", `${drag.dy}px`);
    drag.el.style.setProperty("--lift-tilt", `${drag.tilt.toFixed(2)}deg`);
    drag.raf = requestAnimationFrame(followPointer);
  };
  const liftPhoto = (drag: Drag) => {
    const width = drag.el.offsetWidth || 1;
    // the lean is capped so the corners swing about the same distance whatever the photo's size
    drag.maxTilt = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.min(6, (Math.asin(Math.min(1, 32 / width)) * 180) / Math.PI);
    drag.scale = 1 + Math.min(0.05, 24 / width);
    drag.el.style.setProperty("--lift-scale", String(drag.scale));
    setLiftId(drag.id);
    setLoose(true);
    drag.raf = requestAnimationFrame(followPointer);
  };
  const dropPhoto = (drag: Drag, target: string) => {
    cancelAnimationFrame(drag.raf);
    const settle: Settle[] = [{ id: drag.id, ...readBoxes(drag.el), x: drag.dx, y: drag.dy, turn: frameTurn(drag.el) + drag.tilt, scale: drag.scale, z: 6 }];
    const other = target ? boardRef.current?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(target)}"]`) : null;
    if (other) settle.push({ id: target, ...readBoxes(other), x: 0, y: 0, turn: frameTurn(other), scale: 1, z: 5 });
    settleRef.current = settle;
    setLiftId("");
    setDropTarget("");
    if (!other) return;
    setImages((current) => {
      const next = [...current];
      const from = next.findIndex((item) => item.id === drag.id);
      const to = next.findIndex((item) => item.id === target);
      if (from < 0 || to < 0) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };
  const onFramePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.mode) {
      if (Math.hypot(dx, dy) < (drag.touch ? 10 : 6)) return;
      window.clearTimeout(drag.hold);
      // a finger that moves before the hold is scrolling or swiping past, not picking the photo up
      if (drag.touch && drag.id !== selectedId) { dragRef.current = null; return; }
      drag.mode = drag.id === selectedId ? "pan" : "swap";
      if (drag.mode === "swap") liftPhoto(drag);
    }
    if (drag.mode === "pan") {
      updatePhoto(drag.id, { x: Math.max(-drag.spanX, Math.min(drag.spanX, drag.originX + dx / drag.innerW)), y: Math.max(-drag.spanY, Math.min(drag.spanY, drag.originY + dy / drag.innerH)) });
    } else {
      drag.dx = dx;
      drag.dy = dy;
      // the lifted photo is under the pointer, so look past it for the frame below
      const target = document.elementsFromPoint(event.clientX, event.clientY).map((node) => node.closest<HTMLElement>("[data-photo-id]")?.dataset.photoId || "").find((id) => id && id !== drag.id) || "";
      if (target !== drag.target) { drag.target = target; setDropTarget(target); }
    }
  };
  const onFramePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    window.clearTimeout(drag.hold);
    if (!drag.mode) { setSelectedId((current) => current === drag.id ? "" : drag.id); setToolsId(drag.id); if (textId) pickText(""); return; }
    if (drag.mode === "swap") dropPhoto(drag, drag.target);
  };
  const onFramePointerCancel = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) window.clearTimeout(drag.hold);
    if (drag?.mode === "swap") dropPhoto(drag, "");
  };

  // once a photo is lifted by touch, the finger carries it instead of scrolling the page
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const keepPage = (event: TouchEvent) => { if (dragRef.current?.mode === "swap" && event.cancelable) event.preventDefault(); };
    board.addEventListener("touchmove", keepPage, { passive: false });
    return () => board.removeEventListener("touchmove", keepPage);
  }, [images.length]);

  // after a drop, fly the moved photos from where they were drawn to their new frames (FLIP)
  useLayoutEffect(() => {
    const settle = settleRef.current;
    if (!settle) return;
    settleRef.current = null;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timing = springTiming();
    const flights: Animation[] = [];
    settle.forEach((from) => {
      const frame = boardRef.current?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(from.id)}"]`);
      if (!frame) return;
      LIFT_PROPS.forEach((name) => frame.style.removeProperty(name));
      if (still) return;
      const to = readBoxes(frame);
      const z = String(from.z);
      flights.push(frame.animate([
        { ...from.frame, translate: `${from.x}px ${from.y}px`, rotate: `${from.turn}deg`, scale: String(from.scale), zIndex: z },
        { ...to.frame, translate: "0px 0px", rotate: `${frameTurn(frame)}deg`, scale: "1", zIndex: z },
      ], timing));
      const photo = frame.querySelector<HTMLElement>(".vb-photo");
      const image = frame.querySelector<HTMLElement>("img");
      if (photo) flights.push(photo.animate([from.photo, to.photo], timing));
      if (image) flights.push(image.animate([from.img, to.img], timing));
    });
    void Promise.all(flights.map((flight) => flight.finished)).catch(() => undefined).then(() => {
      if (dragRef.current?.mode !== "swap") setLoose(false);
    });
  });

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

  /** the board drawn at twice its size, as a JPEG: photo-sized, and quick enough to make that the share sheet can still open from the same tap */
  const drawBoard = async (): Promise<Blob | null> => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale; canvas.height = H * scale;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(scale, scale);
    context.fillStyle = settings.background;
    context.fillRect(0, 0, W, H);
    const texts = settings.texts.filter((item) => item.text.trim());
    const fontFaces = texts.length ? faces || (await import("@/lib/vision-fonts").then((module) => module.visionFontFaces).catch(() => null)) : faces;
    const canvasFont = (box: TextBox) => { const face = fontFace(box.font, fontFaces); return `${face.fontStyle === "italic" ? "italic " : ""}${box.size}px ${face.fontFamily}`; };
    // wait for the letters each text needs, so the picture uses the chosen font rather than a fallback
    await Promise.all(texts.map((box) => document.fonts.load(canvasFont(box), box.text).catch(() => undefined)));
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
    // text sits on top of the photos, line by line around its centre, as on screen
    texts.forEach((box) => {
      const lines = box.text.split("\n");
      const lineHeight = box.size * 1.2;
      context.save();
      context.font = canvasFont(box);
      context.fillStyle = box.color || ink;
      context.textAlign = "center";
      context.textBaseline = "middle";
      lines.forEach((line, index) => context.fillText(line, box.x * W, box.y * H + (index - (lines.length - 1) / 2) * lineHeight));
      context.restore();
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  };

  /** iPhone and the app keep pictures in the photo library, which a page reaches only through the share sheet (存储图像) */
  const savesToPhotos = () => {
    if (Capacitor.isNativePlatform()) return true;
    const mode = detectInstallMode(navigator.userAgent, navigator.maxTouchPoints);
    return mode === "ios-safari" || mode === "ios-other" || mode === "wechat-ios";
  };
  const canShareFile = (file: File) => { try { return Boolean(navigator.canShare?.({ files: [file] })); } catch { return false; } };
  /** true once the share sheet has opened and closed again (saved or dismissed); false when it could not open */
  const shareFile = async (file: File) => {
    try { await navigator.share({ files: [file] }); return true; }
    catch (error) { return (error as DOMException | null)?.name === "AbortError"; }
  };

  const exportBoard = async () => {
    if (!images.length || exportingRef.current) return;
    exportingRef.current = true;
    try {
      const blob = await drawBoard();
      if (!blob) return;
      const file = new File([blob], `alreadough-vision-board-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (savesToPhotos()) {
        const share = canShareFile(file);
        if (share && await shareFile(file)) return;
        // the tap ran out before the picture was ready (or this browser has no share sheet): show the picture, one more tap saves it
        setReady({ file, url: URL.createObjectURL(file), share, host: studioRef.current?.closest(".app-shell") || document.body });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } finally {
      exportingRef.current = false;
    }
  };
  const closeReady = () => {
    if (ready) URL.revokeObjectURL(ready.url);
    setReady(null);
  };
  useEffect(() => {
    if (!ready) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { URL.revokeObjectURL(ready.url); setReady(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

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

  // shown over the whole app (inside .app-shell, so it keeps the light or dark colours)
  const readySheet = ready && createPortal(<div className="vb-ready" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) closeReady(); }}>
    <div className="vb-ready-body" role="dialog" aria-modal="true" aria-label={copy.export}>
      <img src={ready.url} alt=""/>
      {!ready.share && <p>{copy.holdToSave}</p>}
      <div className="vb-ready-actions">
        <button type="button" onClick={closeReady}>{copy.close}</button>
        {ready.share && <button type="button" className="vb-ready-save" onClick={async () => { if (await shareFile(ready.file)) closeReady(); }}><DownloadSimple size={16}/>{copy.saveToPhotos}</button>}
      </div>
    </div>
  </div>, ready.host);

  return <div className="vb-studio" ref={studioRef}>
    {fileInputs}
    {readySheet}

    <div className="vb-topbar">
      <button type="button" className="vb-chip-button" onClick={() => addInput.current?.click()} disabled={images.length >= MAX_PHOTOS}><Plus size={16}/>{copy.add}<small>{images.length}/{MAX_PHOTOS}</small></button>
      <button type="button" className="vb-chip-button" onClick={clearAll}><Trash size={16}/>{copy.clear}</button>
      <button type="button" className="vb-chip-button vb-export" onClick={exportBoard}><DownloadSimple size={16}/>{copy.export}</button>
    </div>
    {tray}
    {notice && <p className="vb-notice" role="status">{notice}</p>}

    <div className="vb-board-wrap" role="presentation" onKeyDown={(event) => { if (event.key === "Escape") letGoAll(); }} onClick={(event) => { if (event.target === event.currentTarget) letGoAll(); }}>
      <div ref={boardRef} className={`vb-board${loose ? " lifting" : ""}`} style={{ aspectRatio: `${W} / ${H}`, background: settings.background, "--vb-max-w": `calc(70vh * ${W / H})` } as CSSProperties} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) letGoAll(); }}>
        {liftFrame && <div className="vb-slot" aria-hidden="true" style={{ left: pct(liftFrame.x, W), top: pct(liftFrame.y, H), width: pct(liftFrame.w, W), height: pct(liftFrame.h, H), borderRadius: unit(liftFrame.outerRadius), color: ink, "--vb-r": liftFrame.r ? `${liftFrame.r}deg` : undefined } as CSSProperties}/>}
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
            className={`vb-frame vb-frame-${style} ${selectedId === photo.id ? "selected" : ""} ${dropTarget === photo.id ? "drop" : ""} ${liftId === photo.id ? "lifted" : ""}`}
            // a selected photo pans and a lifted one is carried, so a swipe on it must not pull out the side panel
            data-no-drawer={selectedId === photo.id || liftId === photo.id ? "" : undefined}
            style={{ left: pct(frame.x, W), top: pct(frame.y, H), width: pct(frame.w, W), height: pct(frame.h, H), "--vb-r": frame.r ? `${frame.r}deg` : undefined, borderRadius: unit(frame.outerRadius), "--vb-shadow-bg": settings.background } as CSSProperties}
            onPointerDown={(event) => onFramePointerDown(event, photo, index)}
            onPointerMove={onFramePointerMove}
            onPointerUp={onFramePointerUp}
            onPointerCancel={onFramePointerCancel}
            onContextMenu={(event) => { if (dragRef.current) event.preventDefault(); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(photo.id); setToolsId(photo.id); } }}
          >
            <div className="vb-photo" style={{ left: pct(frame.inner.x - frame.x, frame.w), top: pct(frame.inner.y - frame.y, frame.h), width: pct(frame.inner.w, frame.w), height: pct(frame.inner.h, frame.h), borderRadius: unit(frame.innerRadius) }}>
              <img src={photo.url} alt="" draggable={false} style={{ width: pct(place.width, frame.inner.w), height: pct(place.height, frame.inner.h), left: pct(place.cx - place.width / 2, frame.inner.w), top: pct(place.cy - place.height / 2, frame.inner.h), transform: `rotate(${photo.rotate}deg)${photo.flip ? " scaleX(-1)" : ""}` }}/>
              {selectedId === photo.id && <span className="vb-move-hint" aria-hidden="true"><ArrowsOutCardinal size={16} weight="bold"/>{copy.move}</span>}
            </div>
          </div>;
        })}
        {guide && <i className="vb-guide" aria-hidden="true"/>}
        {settings.texts.map((box) => {
          const face = faceOf(box.font);
          const active = textId === box.id;
          return <div
            key={box.id}
            data-text-id={box.id}
            data-no-drawer=""
            role="button"
            tabIndex={0}
            aria-label={box.text.trim() || copy.textPlaceholder}
            aria-pressed={active}
            className={`vb-text${active ? " active" : ""}${box.text.trim() ? "" : " empty"}`}
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, fontFamily: face.fontFamily, fontStyle: face.fontStyle, fontSize: unit(box.size), color: box.color || ink }}
            onPointerDown={(event) => onTextPointerDown(event, box)}
            onPointerMove={onTextPointerMove}
            onPointerUp={onTextPointerUp}
            onPointerCancel={onTextPointerUp}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pickText(box.id); } }}
          >
            {box.text.trim() ? box.text : copy.textPlaceholder}
            {active && <button type="button" className="vb-text-remove" aria-label={copy.removeText} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeText(box.id); }}><X size={14} weight="bold"/></button>}
          </div>;
        })}
      </div>
    </div>

    <div className="vb-panels">
    {toolsPhoto && <div className={`vb-panel vb-photo-tools${selected ? " shown" : ""}`}>
      <div className="vb-row">
        <button type="button" className="vb-tool-button" onClick={() => replaceInput.current?.click()}><Swap size={18}/>{copy.replace}</button>
        <button type="button" className="vb-tool-button" onClick={() => updatePhoto(toolsPhoto.id, { rotate: (toolsPhoto.rotate + 90) % 360, x: 0, y: 0 })}><ArrowClockwise size={18}/>{copy.rotate}</button>
        <button type="button" className="vb-tool-button" onClick={() => updatePhoto(toolsPhoto.id, { flip: !toolsPhoto.flip })}><FlipHorizontal size={18}/>{copy.flip}</button>
        <button type="button" className="vb-tool-button" onClick={() => removePhoto(toolsPhoto.id)}><Trash size={18}/>{copy.remove}</button>
        <button type="button" className="vb-tool-button vb-done" onClick={() => setSelectedId("")}>{copy.done}</button>
      </div>
      <label className="vb-slider"><span>{copy.zoom}</span><input type="range" min="1" max="3" step="0.02" value={toolsPhoto.zoom} onChange={(event) => updatePhoto(toolsPhoto.id, { zoom: Number(event.target.value) })}/></label>
    </div>}
    <div className={`vb-panel${selected ? "" : " shown"}`}>
      <div className="vb-tabs" role="tablist" style={{ "--tab": (Object.keys(copy.tools) as Tool[]).indexOf(tool) } as CSSProperties}>
        <span className="vb-tab-pill" aria-hidden="true"/>
        {(Object.keys(copy.tools) as Tool[]).map((key) => <button type="button" role="tab" aria-selected={tool === key} className={tool === key ? "active" : ""} key={key} onClick={() => setTool(key)}>{copy.tools[key]}</button>)}
      </div>

      {tool === "layout" && <div className="vb-options vb-templates">
        {LAYOUTS.map((value) => {
          const thumb = boardGeometry({ ...settings, layout: value, margin: 50, gap: 26, frame: "none" }, Math.min(previewCount, 9));
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

      {tool === "background" && (() => {
        const current = settings.background.toLowerCase();
        const fromPhotos = palette.filter((value) => !SWATCHES.includes(value));
        const preset = SWATCHES.includes(current) || fromPhotos.includes(current);
        return <div className="vb-options vb-swatches">
        {fromPhotos.map((value) => <button type="button" key={`photo-${value}`} aria-label={value} className={current === value ? "selected" : ""} style={{ background: value }} onClick={() => set("background", value)}/>)}
        {fromPhotos.length > 0 && <span className="vb-divider vb-swatch-divider" aria-hidden="true"/>}
        {SWATCHES.map((value) => <button type="button" key={value} aria-label={value} className={current === value ? "selected" : ""} style={{ background: value }} onClick={() => set("background", value)}/>)}
        <label className={`vb-custom-color ${preset ? "" : "selected"}`} style={{ background: preset ? undefined : settings.background }} aria-label={copy.custom}><input type="color" value={settings.background} onChange={(event) => set("background", event.target.value)}/></label>
      </div>;
      })()}

      {tool === "text" && <div className="vb-stack">
        {activeText ? <>
          <textarea ref={textInput} key={activeText.id} className="vb-text-input" rows={2} value={activeText.text} maxLength={80} placeholder={copy.textPlaceholder} onChange={(event) => updateText(activeText.id, { text: event.target.value })}/>
          {(["zh", "en"] as const).map((group) => <div className="vb-font-group" key={group}>
            <span>{group === "zh" ? copy.fontZh : copy.fontEn}</span>
            <div className="vb-fonts">
              {VISION_FONTS.filter((font) => font.group === group).map((font) => {
                const face = faceOf(font.id);
                return <button type="button" key={font.id} className={activeText.font === font.id ? "selected" : ""} aria-pressed={activeText.font === font.id} style={{ fontFamily: face.fontFamily, fontStyle: face.fontStyle }} onClick={() => updateText(activeText.id, { font: font.id })}>{font.label || copy.plainFont}</button>;
              })}
            </div>
          </div>)}
          <label className="vb-slider"><span>{copy.textSize}</span><input type="range" min="28" max="260" step="2" value={activeText.size} onChange={(event) => updateText(activeText.id, { size: Number(event.target.value) })}/></label>
          <div className="vb-options vb-swatches">
            {TEXT_COLORS.map((value) => <button type="button" key={value} aria-label={value} className={(activeText.color || ink).toLowerCase() === value ? "selected" : ""} style={{ background: value }} onClick={() => updateText(activeText.id, { color: value })}/>)}
            <label className={`vb-custom-color ${TEXT_COLORS.includes((activeText.color || ink).toLowerCase()) ? "" : "selected"}`} style={{ background: TEXT_COLORS.includes((activeText.color || ink).toLowerCase()) ? undefined : activeText.color || ink }} aria-label={copy.custom}><input type="color" value={activeText.color || ink} onChange={(event) => updateText(activeText.id, { color: event.target.value })}/></label>
          </div>
          <div className="vb-row">
            <button type="button" className="vb-tool-button" onClick={addText} disabled={settings.texts.length >= MAX_TEXTS}><Plus size={18}/>{copy.addText}</button>
            <button type="button" className="vb-tool-button vb-danger" onClick={() => removeText(activeText.id)}><Trash size={18}/>{copy.removeText}</button>
            <button type="button" className="vb-tool-button vb-done" onClick={() => pickText("")}>{copy.done}</button>
          </div>
        </> : <button type="button" className="vb-add-text" onClick={addText} disabled={settings.texts.length >= MAX_TEXTS}><Plus size={20}/>{copy.addText}</button>}
      </div>}
    </div>
    </div>
  </div>;
}
