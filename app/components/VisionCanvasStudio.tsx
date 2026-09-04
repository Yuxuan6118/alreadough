"use client";

import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from "react";

type Lang = "zh" | "en";
type Layout = "editorial" | "grid" | "mosaic" | "film" | "scrapbook";
type Ratio = "phone" | "square" | "landscape";
type LocalImage = { id: string; name: string; url: string; zoom: number; x: number; y: number; rotate: number };
type SavedVisionProject = { title: string; layout: Layout; ratio: Ratio; gap: number; corner: number; background: string; images: Array<Omit<LocalImage, "url">> };

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

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safe = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.roundRect(x, y, width, height, safe);
}

function drawFrame(context: CanvasRenderingContext2D, image: HTMLImageElement, item: LocalImage, x: number, y: number, width: number, height: number, radius: number, frameRotation = 0, border = 0) {
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(frameRotation * Math.PI / 180);
  if (border > 0) {
    context.fillStyle = "#f8f1eb";
    context.fillRect(-width / 2 - border, -height / 2 - border, width + border * 2, height + border * 2);
  }
  roundedRect(context, -width / 2, -height / 2, width, height, radius);
  context.clip();
  context.translate((item.x / 100) * width, (item.y / 100) * height);
  context.rotate(item.rotate * Math.PI / 180);
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * item.zoom;
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  context.drawImage(image, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight);
  context.restore();
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
  };
  const [images, setImages] = useState<LocalImage[]>([]);
  const [title, setTitle] = useState(lang === "zh" ? "我已经拥有的生活" : "The Life I Already Have");
  const [layout, setLayout] = useState<Layout>("editorial");
  const [ratio, setRatio] = useState<Ratio>("phone");
  const [selectedId, setSelectedId] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const [gap, setGap] = useState(5);
  const [corner, setCorner] = useState(0);
  const [background, setBackground] = useState("#eee3da");
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
    localStorage.setItem("already-vision-project-v1", JSON.stringify(project));
  }, [title, layout, ratio, gap, corner, background, images]);
  useEffect(() => () => imagesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/") && file.size <= 10_000_000);
    const room = Math.max(0, 12 - images.length);
    const added = files.slice(0, room).map((file) => {
      const id = crypto.randomUUID();
      void putVisionImage(id, file);
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
      void removeVisionImage(id);
      const next = current.filter((item) => item.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id || "");
      return next;
    });
  };

  const exportBoard = async () => {
    if (!images.length) return;
    const [width, height] = sizes[ratio];
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = background; context.fillRect(0, 0, width, height);
    const margin = Math.round(width * 0.045);
    const exportGap = Math.round((gap / 500) * width);
    const exportCorner = Math.round((corner / 500) * width);
    const heading = Math.round(height * 0.12);
    context.fillStyle = "#493630";
    context.font = `500 ${Math.round(width * 0.052)}px Georgia, serif`;
    context.textAlign = "center";
    context.fillText(title || "AlreaDough", width / 2, heading * 0.58, width - margin * 2);
    const loaded = await Promise.all(images.map((item) => loadImage(item.url)));
    const top = heading;
    const availableHeight = height - top - margin;
    if (layout === "editorial" && loaded.length > 1) {
      const heroHeight = availableHeight * 0.5;
      drawFrame(context, loaded[0], images[0], margin, top, width - margin * 2, heroHeight, exportCorner);
      const rest = loaded.slice(1);
      const cols = Math.min(3, rest.length);
      const rows = Math.ceil(rest.length / cols);
      const cellWidth = (width - margin * 2 - exportGap * (cols - 1)) / cols;
      const cellHeight = (availableHeight - heroHeight - exportGap - exportGap * (rows - 1)) / rows;
      rest.forEach((image, index) => drawFrame(context, image, images[index + 1], margin + (index % cols) * (cellWidth + exportGap), top + heroHeight + exportGap + Math.floor(index / cols) * (cellHeight + exportGap), cellWidth, cellHeight, exportCorner));
    } else if (layout === "scrapbook") {
      const positions = [
        [0.02, 0.02, -4], [0.43, 0.2, 5], [0.08, 0.56, 2], [0.39, 0.53, -3], [0.18, 0.3, 1], [0.4, 0.05, -2],
      ];
      const cellWidth = (width - margin * 2) * 0.55;
      const cellHeight = availableHeight * 0.42;
      loaded.slice(0, 6).forEach((image, index) => {
        const [left, vertical, rotation] = positions[index];
        drawFrame(context, image, images[index], margin + left * (width - margin * 2), top + vertical * availableHeight, cellWidth, cellHeight, exportCorner, rotation, Math.max(8, width * 0.008));
      });
    } else {
      const cols = layout === "mosaic" ? 2 : Math.min(ratio === "landscape" ? 4 : 3, Math.ceil(Math.sqrt(loaded.length)));
      const rows = Math.ceil(loaded.length / cols);
      const filmBorder = layout === "film" ? Math.max(8, width * 0.006) : 0;
      if (layout === "film") { context.fillStyle = "#211b19"; context.fillRect(margin, top, width - margin * 2, availableHeight); }
      const cellWidth = (width - margin * 2 - exportGap * (cols - 1) - filmBorder * 2) / cols;
      const cellHeight = (availableHeight - exportGap * (rows - 1) - filmBorder * 2) / rows;
      loaded.forEach((image, index) => drawFrame(context, image, images[index], margin + filmBorder + (index % cols) * (cellWidth + exportGap), top + filmBorder + Math.floor(index / cols) * (cellHeight + exportGap), cellWidth, cellHeight, exportCorner, 0, filmBorder));
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `alreadough-vision-board-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  };

  return <div className="vision-maker">
    <div className="vision-maker-heading"><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
    <label className="vision-upload">＋ {copy.upload}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages}/><small>{copy.uploadHint}</small></label>
    {!images.length && <div className="vision-first-step"><strong>{copy.quickSetup}</strong><span>{lang === "zh" ? "推荐从 4 至 8 张照片开始" : "Start with 4 to 8 photos"}</span></div>}
    {images.length > 0 && <div className="vision-controls">
      <label>{copy.boardTitle}<input value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <fieldset><legend>{copy.layout}</legend>{(["editorial", "grid", "mosaic", "film", "scrapbook"] as const).map((value) => <button className={layout === value ? "selected" : ""} key={value} onClick={() => setLayout(value)}>{copy.layouts[value]}</button>)}</fieldset>
      <fieldset><legend>{copy.ratio}</legend>{(["phone", "square", "landscape"] as const).map((value) => <button className={ratio === value ? "selected" : ""} key={value} onClick={() => setRatio(value)}>{copy.ratios[value]}</button>)}</fieldset>
      <details className="vision-advanced"><summary>{copy.advanced}</summary><div className="collage-style-controls"><label>{copy.gap}<input type="range" min="0" max="16" value={gap} onChange={(event) => setGap(Number(event.target.value))}/></label><label>{copy.corner}<input type="range" min="0" max="30" value={corner} onChange={(event) => setCorner(Number(event.target.value))}/></label><label>{copy.background}<input type="color" value={background} aria-label={copy.background} onChange={(event) => setBackground(event.target.value)}/></label></div></details>
    </div>}
    {images.length > 0 && <p className="drag-hint">{copy.dragHint}</p>}
    {images.length > 0 && <div className={`vision-preview ${layout} ${ratio}`} style={{ background, "--vision-gap": `${gap}px`, "--vision-corner": `${corner}px` } as CSSProperties}>
      <h3>{title}</h3>
      <div>{images.map((item) => <div role="button" tabIndex={0} aria-label={`${copy.selected}: ${item.name}`} className={`vision-frame ${selectedId === item.id ? "selected" : ""}`} draggable key={item.id} onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(item.id)} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.id); }}><img src={item.url} alt={item.name} style={{ transform: `translate(${item.x}%, ${item.y}%) scale(${item.zoom}) rotate(${item.rotate}deg)` }}/><button onClick={(event) => { event.stopPropagation(); removeImage(item.id); }} aria-label={`${copy.remove} ${item.name}`}>×</button></div>)}</div>
    </div>}
    {selected && <div className="frame-editor"><div><span>{copy.selected}</span><strong>{selected.name}</strong></div><label>{copy.zoom}<input type="range" min="1" max="2.5" step="0.05" value={selected.zoom} onChange={(event) => updateSelected({ zoom: Number(event.target.value) })}/></label><label>{copy.horizontal}<input type="range" min="-35" max="35" value={selected.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })}/></label><label>{copy.vertical}<input type="range" min="-35" max="35" value={selected.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })}/></label><label>{copy.rotate}<input type="range" min="-12" max="12" value={selected.rotate} onChange={(event) => updateSelected({ rotate: Number(event.target.value) })}/></label></div>}
    <button className="primary" disabled={!images.length} onClick={exportBoard}>{copy.export}</button>
  </div>;
}
