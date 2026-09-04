"use client";

import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from "react";
import { DownloadSimple, SlidersHorizontal, UploadSimple } from "@phosphor-icons/react";

type Lang = "zh" | "en";
type Layout = "editorial" | "grid" | "mosaic" | "film" | "scrapbook";
type Ratio = "phone" | "square" | "landscape";
type LocalImage = { id: string; name: string; url: string; zoom: number; x: number; y: number; rotate: number };
type SavedVisionProject = { title: string; layout: Layout; ratio: Ratio; gap: number; corner: number; background: string; images: Array<Omit<LocalImage, "url">> };
type FrameGeometry = { x: number; y: number; width: number; height: number; rotation?: number; border?: number };

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

async function putVisionImage(id: string, blob: Blob) {
  const database = await openVisionDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VISION_STORE, "readwrite");
    transaction.objectStore(VISION_STORE).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function getVisionImage(id: string) {
  const database = await openVisionDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database.transaction(VISION_STORE, "readonly").objectStore(VISION_STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return blob;
}

async function removeVisionImage(id: string) {
  const database = await openVisionDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VISION_STORE, "readwrite");
    transaction.objectStore(VISION_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

const sizes: Record<Ratio, [number, number]> = {
  phone: [1080, 1920],
  square: [1400, 1400],
  landscape: [1920, 1080],
};

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function textOnColor(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156 ? "#2b2726" : "#fffaf7";
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safe = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.roundRect(x, y, width, height, safe);
}

function boardGeometry(ratio: Ratio) {
  const [width, height] = sizes[ratio];
  const margin = width * 0.045;
  const heading = height * 0.12;
  return { width, height, margin, heading, stageWidth: width - margin * 2, stageHeight: height - heading - margin };
}

function frameGeometry(layout: Layout, count: number, stageWidth: number, stageHeight: number, gap: number): FrameGeometry[] {
  if (!count) return [];
  if (count === 1) return [{ x: 0, y: 0, width: stageWidth, height: stageHeight }];
  if (layout === "film") {
    const frameHeight = (stageHeight - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, index) => ({ x: 0, y: index * (frameHeight + gap), width: stageWidth, height: frameHeight, border: Math.max(5, stageWidth * 0.006) }));
  }
  if (layout === "editorial") {
    const heroHeight = stageHeight * 0.54;
    const rest = count - 1;
    const columns = Math.min(2, rest);
    const rows = Math.ceil(rest / columns);
    const cellWidth = (stageWidth - gap * (columns - 1)) / columns;
    const cellHeight = (stageHeight - heroHeight - gap - gap * (rows - 1)) / rows;
    return [{ x: 0, y: 0, width: stageWidth, height: heroHeight }, ...Array.from({ length: rest }, (_, index) => {
      const isLastAlone = rest % columns === 1 && index === rest - 1;
      return { x: isLastAlone ? 0 : (index % columns) * (cellWidth + gap), y: heroHeight + gap + Math.floor(index / columns) * (cellHeight + gap), width: isLastAlone ? stageWidth : cellWidth, height: cellHeight };
    })];
  }
  if (layout === "mosaic" && count <= 4) {
    if (count === 2) return [
      { x: 0, y: 0, width: stageWidth * 0.59 - gap / 2, height: stageHeight },
      { x: stageWidth * 0.59 + gap / 2, y: 0, width: stageWidth * 0.41 - gap / 2, height: stageHeight },
    ];
    const leftWidth = stageWidth * 0.58 - gap / 2;
    const rightX = leftWidth + gap;
    const rightWidth = stageWidth - rightX;
    const rightHeight = (stageHeight - gap) / 2;
    const frames: FrameGeometry[] = [
      { x: 0, y: 0, width: leftWidth, height: count === 4 ? stageHeight * 0.62 - gap / 2 : stageHeight },
      { x: rightX, y: 0, width: rightWidth, height: rightHeight },
      { x: rightX, y: rightHeight + gap, width: rightWidth, height: rightHeight },
    ];
    if (count === 4) frames.push({ x: 0, y: stageHeight * 0.62 + gap / 2, width: leftWidth, height: stageHeight * 0.38 - gap / 2 });
    return frames;
  }
  if (layout === "scrapbook" && count <= 6) {
    const placements = [
      [0.01, 0.02, 0.57, 0.43, -4], [0.43, 0.17, 0.56, 0.42, 5], [0.06, 0.55, 0.55, 0.42, 2],
      [0.42, 0.55, 0.53, 0.4, -3], [0.2, 0.31, 0.54, 0.4, 1], [0.36, 0.03, 0.54, 0.4, -2],
    ];
    return placements.slice(0, count).map(([x, y, width, height, rotation]) => ({ x: x * stageWidth, y: y * stageHeight, width: width * stageWidth, height: height * stageHeight, rotation, border: Math.max(7, stageWidth * 0.008) }));
  }
  const columns = Math.min(layout === "mosaic" || stageWidth > stageHeight ? 3 : 2, count);
  const rows = Math.ceil(count / columns);
  const cellWidth = (stageWidth - gap * (columns - 1)) / columns;
  const cellHeight = (stageHeight - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => {
    const isLastAlone = count % columns === 1 && index === count - 1;
    return { x: isLastAlone ? 0 : (index % columns) * (cellWidth + gap), y: Math.floor(index / columns) * (cellHeight + gap), width: isLastAlone ? stageWidth : cellWidth, height: cellHeight };
  });
}

function drawFrame(context: CanvasRenderingContext2D, image: HTMLImageElement, item: LocalImage, x: number, y: number, width: number, height: number, radius: number, frameRotation = 0, border = 0) {
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(frameRotation * Math.PI / 180);
  roundedRect(context, -width / 2, -height / 2, width, height, radius);
  context.clip();
  context.translate((item.x / 100) * width, (item.y / 100) * height);
  context.rotate(item.rotate * Math.PI / 180);
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * item.zoom;
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(image, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight);
  context.restore();
  if (border > 0) {
    context.save();
    context.translate(x + width / 2, y + height / 2);
    context.rotate(frameRotation * Math.PI / 180);
    roundedRect(context, -width / 2 + border / 2, -height / 2 + border / 2, width - border, height - border, Math.max(0, radius - border / 2));
    context.strokeStyle = "#f8f1eb";
    context.lineWidth = border;
    context.stroke();
    context.restore();
  }
}

export default function VisionCanvasStudio({ lang }: { lang: Lang }) {
  const copy = lang === "zh" ? {
    title: "编织我的愿景",
    subtitle: "像拼图编辑器一样选择模板、调整画面、拖动换位，再导出你的专属愿景板。",
    upload: "选择照片",
    uploadHint: "支持 2-12 张 JPG、PNG 或 WebP；单张不超过 10MB",
    boardTitle: "愿景板标题",
    layout: "排版",
    ratio: "尺寸",
    layouts: { editorial: "杂志感", grid: "整齐网格", mosaic: "错落拼贴", film: "胶片故事", scrapbook: "手帐剪贴" },
    ratios: { phone: "手机壁纸", square: "正方形", landscape: "横向" },
    empty: "先选择几张真实照片，预览会出现在这里",
    export: "导出愿景板 PNG",
    remove: "移除",
    editPhoto: "画面调整",
    zoom: "缩放",
    horizontal: "水平位置",
    vertical: "垂直位置",
    rotate: "旋转",
    dragHint: "拖动照片可以交换顺序；点选照片后可单独调整。",
    gap: "留白",
    corner: "圆角",
    background: "底色",
    selected: "已选画面",
    quickSetup: "先选照片，AlreaDough 会先排出一个可用版本。之后再按需要调整。",
    advanced: "高级画面设置",
    invalidFiles: "有些照片未加入：请使用 JPG、PNG 或 WebP，且单张不超过 10MB。你已经加入的照片仍然保留。",
    storageError: "照片可以在本次打开期间编辑，但浏览器没有允许长期保存。请不要关闭页面，或检查隐私浏览设置。",
    exportError: "愿景板暂时没有导出成功，当前排版仍然保留。请检查照片是否仍可显示后再试。",
  } : {
    title: "Weave My Vision",
    subtitle: "Choose a collage template, refine each frame, drag to reorder, and export a personal vision board.",
    upload: "Choose photos",
    uploadHint: "Add 2-12 JPG, PNG, or WebP files; 10MB maximum each",
    boardTitle: "Vision board title",
    layout: "Layout",
    ratio: "Size",
    layouts: { editorial: "Editorial", grid: "Clean grid", mosaic: "Asymmetric", film: "Film story", scrapbook: "Scrapbook" },
    ratios: { phone: "Phone wallpaper", square: "Square", landscape: "Landscape" },
    empty: "Choose a few real photos to see your preview here",
    export: "Export vision board PNG",
    remove: "Remove",
    editPhoto: "FRAME EDITING",
    zoom: "Zoom",
    horizontal: "Horizontal position",
    vertical: "Vertical position",
    rotate: "Rotation",
    dragHint: "Drag photos to reorder. Select one to refine its frame.",
    gap: "Spacing",
    corner: "Corners",
    background: "Backdrop",
    selected: "SELECTED FRAME",
    quickSetup: "Choose photos first. AlreaDough will create a usable layout before you refine it.",
    advanced: "Advanced visual settings",
    invalidFiles: "Some photos were not added. Use JPG, PNG, or WebP files up to 10MB each. Photos already added are still here.",
    storageError: "You can edit these photos while this page stays open, but the browser did not allow long-term storage. Check private-browsing settings before closing it.",
    exportError: "The vision board could not be exported just now. Your layout is still here. Check that every photo is visible, then try again.",
  };
  const [images, setImages] = useState<LocalImage[]>([]);
  const [title, setTitle] = useState(lang === "zh" ? "我已经拥有的生活" : "The Life I Already Have");
  const [layout, setLayout] = useState<Layout>("editorial");
  const [ratio, setRatio] = useState<Ratio>("phone");
  const [selectedId, setSelectedId] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const [gap, setGap] = useState(5);
  const [corner, setCorner] = useState(18);
  const [background, setBackground] = useState("#eee3da");
  const [visionError, setVisionError] = useState("");
  const imagesRef = useRef<LocalImage[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect -- restore the device-local project after mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("already-vision-project-v1");
      if (!saved) return;
      const project = JSON.parse(saved) as SavedVisionProject;
      setTitle(project.title); setLayout(project.layout); setRatio(project.ratio); setGap(project.gap); setCorner(project.corner); setBackground(project.background);
      Promise.all(project.images.slice(0, 12).map(async (item) => {
        const blob = await getVisionImage(item.id);
        return blob ? { ...item, url: URL.createObjectURL(blob) } : null;
      })).then((items) => {
        const restored = items.filter((item): item is LocalImage => Boolean(item));
        setImages(restored);
        if (restored[0]) setSelectedId(restored[0].id);
      }).catch(() => { /* IndexedDB may be unavailable in strict private browsing */ });
    } catch { /* start with a blank canvas */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    const project: SavedVisionProject = { title, layout, ratio, gap, corner, background, images: images.map((item) => ({ id: item.id, name: item.name, zoom: item.zoom, x: item.x, y: item.y, rotate: item.rotate })) };
    try { localStorage.setItem("already-vision-project-v1", JSON.stringify(project)); }
    catch { queueMicrotask(() => setVisionError(copy.storageError)); }
  }, [title, layout, ratio, gap, corner, background, images, copy.storageError]);
  useEffect(() => () => imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const files = selectedFiles.filter((file) => /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type) && file.size <= 10_000_000);
    setVisionError(files.length === selectedFiles.length ? "" : copy.invalidFiles);
    const room = Math.max(0, 12 - images.length);
    const added = files.slice(0, room).map((file) => {
      const id = crypto.randomUUID();
      void putVisionImage(id, file).catch(() => setVisionError(copy.storageError));
      return { id, name: file.name, url: URL.createObjectURL(file), zoom: 1, x: 0, y: 0, rotate: 0 };
    });
    setImages((current) => [...current, ...added]);
    if (!selectedId && added[0]) setSelectedId(added[0].id);
    event.target.value = "";
  };

  const selected = images.find((item) => item.id === selectedId);
  const updateSelected = (changes: Partial<LocalImage>) => setImages((current) => current.map((item) => item.id === selectedId ? { ...item, ...changes } : item));
  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setImages((current) => {
      const from = current.findIndex((item) => item.id === draggedId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next;
    });
    setDraggedId("");
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      void removeVisionImage(id).catch(() => setVisionError(copy.storageError));
      const next = current.filter((item) => item.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id || "");
      return next;
    });
  };

  const exportBoard = async () => {
    if (!images.length) return;
    setVisionError("");
    try {
      const { width, height, margin, heading, stageWidth, stageHeight } = boardGeometry(ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.fillStyle = background; context.fillRect(0, 0, width, height);
      const exportGap = (gap / 500) * width;
      const exportCorner = Math.round((corner / 500) * width);
      context.fillStyle = "#493630";
      context.font = `500 ${Math.round(width * 0.052)}px Georgia, serif`;
      context.textAlign = "center";
      context.fillText(title || "AlreaDough", width / 2, heading * 0.58, width - margin * 2);
      const loaded = await Promise.all(images.map((item) => loadImage(item.url)));
      if (layout === "film") { context.fillStyle = "#211b19"; roundedRect(context, margin, heading, stageWidth, stageHeight, exportCorner); context.fill(); }
      const frames = frameGeometry(layout, loaded.length, stageWidth, stageHeight, exportGap);
      frames.forEach((frame, index) => drawFrame(context, loaded[index], images[index], margin + frame.x, heading + frame.y, frame.width, frame.height, exportCorner, frame.rotation || 0, frame.border || 0));
      canvas.toBlob((blob) => {
        if (!blob) { setVisionError(copy.exportError); return; }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `alreadough-vision-board-${Date.now()}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch { setVisionError(copy.exportError); }
  };

  const metrics = boardGeometry(ratio);
  const previewGap = (gap / 500) * metrics.width;
  const previewFrames = frameGeometry(layout, images.length, metrics.stageWidth, metrics.stageHeight, previewGap);
  const previewStyle = (frame: FrameGeometry): CSSProperties => ({
    left: `${(frame.x / metrics.stageWidth) * 100}%`, top: `${(frame.y / metrics.stageHeight) * 100}%`, width: `${(frame.width / metrics.stageWidth) * 100}%`, height: `${(frame.height / metrics.stageHeight) * 100}%`, transform: `rotate(${frame.rotation || 0}deg)`, borderWidth: frame.border ? `${Math.max(3, (frame.border / metrics.stageWidth) * 420)}px` : undefined,
  });

  return <div className="vision-maker">
    <div className="vision-maker-heading"><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
    <label className="vision-upload"><UploadSimple size={20}/><span>{copy.upload}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages}/><small>{copy.uploadHint}</small></label>
    {visionError && <p className="vision-editor-error" role="alert">{visionError}</p>}
    {!images.length && <div className="vision-first-step"><strong>{copy.quickSetup}</strong><span>{lang === "zh" ? "推荐从 4 至 8 张照片开始" : "Start with 4 to 8 photos"}</span></div>}
    {images.length > 0 && <div className="vision-controls">
      <label>{copy.boardTitle}<input value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <fieldset><legend>{copy.layout}</legend>{(["editorial", "grid", "mosaic", "film", "scrapbook"] as const).map((value) => <button className={layout === value ? "selected" : ""} key={value} onClick={() => setLayout(value)}>{copy.layouts[value]}</button>)}</fieldset>
      <fieldset><legend>{copy.ratio}</legend>{(["phone", "square", "landscape"] as const).map((value) => <button className={ratio === value ? "selected" : ""} key={value} onClick={() => setRatio(value)}>{copy.ratios[value]}</button>)}</fieldset>
      <details className="vision-advanced"><summary><SlidersHorizontal size={16}/>{copy.advanced}</summary><div className="collage-style-controls"><label>{copy.gap}<input type="range" min="0" max="16" value={gap} onChange={(event) => setGap(Number(event.target.value))}/></label><label>{copy.corner}<input type="range" min="0" max="30" value={corner} onChange={(event) => setCorner(Number(event.target.value))}/></label><label className="vision-color-field"><span>{copy.background}</span><span className="vision-color-button" style={{ backgroundColor: background, color: textOnColor(background) }}><i aria-hidden="true"/><b>{background.toUpperCase()}</b><input type="color" value={background} aria-label={copy.background} onChange={(event) => setBackground(event.target.value)}/></span></label></div></details>
    </div>}
    {images.length > 0 && <p className="drag-hint">{copy.dragHint}</p>}
    {images.length > 0 && <div className={`vision-preview ${layout} ${ratio}`} style={{ "--vision-background": background, "--vision-corner": `${corner}px` } as CSSProperties}>
      <h3>{title}</h3>
      <div className="vision-stage">{images.map((item, index) => <div role="button" tabIndex={0} style={previewStyle(previewFrames[index])} aria-label={`${copy.selected}: ${item.name}`} className={`vision-frame ${selectedId === item.id ? "selected" : ""}`} draggable key={item.id} onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(item.id)} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.id); }}><img src={item.url} alt={item.name} style={{ transform: `translate(${item.x}%, ${item.y}%) rotate(${item.rotate}deg) scale(${item.zoom})` }}/><button onClick={(event) => { event.stopPropagation(); removeImage(item.id); }} aria-label={`${copy.remove} ${item.name}`}>×</button></div>)}</div>
    </div>}
    {selected && <div className="frame-editor"><div><span>{copy.selected}</span><strong>{selected.name}</strong></div><label>{copy.zoom}<input type="range" min="1" max="2.5" step="0.05" value={selected.zoom} onChange={(event) => updateSelected({ zoom: Number(event.target.value) })}/></label><label>{copy.horizontal}<input type="range" min="-35" max="35" value={selected.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })}/></label><label>{copy.vertical}<input type="range" min="-35" max="35" value={selected.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })}/></label><label>{copy.rotate}<input type="range" min="-12" max="12" value={selected.rotate} onChange={(event) => updateSelected({ rotate: Number(event.target.value) })}/></label></div>}
    <button className="primary vision-export" disabled={!images.length} onClick={exportBoard}><DownloadSimple size={18}/>{copy.export}</button>
  </div>;
}
