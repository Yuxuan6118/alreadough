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

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
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
    rights: "我确认上传的照片为本人拥有、已获授权，或仅用于法律允许的私人用途。",
    export: "导出愿景板 PNG",
    needRights: "导出前请确认图片使用权。",
    local: "LOCAL-ONLY WORKSPACE",
    localCopy: "这个工具在浏览器内完成拼贴，不把上传照片发送给 AI 或图片搜索服务。作品会留在这个浏览器的本机存储中；清除网站数据会同时删除它。",
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
    rights: "I confirm that I own these photos, have permission to use them, or will use them only as privately permitted by law.",
    export: "Export vision board PNG",
    needRights: "Confirm your image rights before exporting.",
    local: "LOCAL-ONLY WORKSPACE",
    localCopy: "Your collage is created inside this browser. Uploaded photos are not sent to AI or image search and remain in this browser's on-device storage until site data is cleared.",
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
  };
  const [images, setImages] = useState<LocalImage[]>([]);
  const [title, setTitle] = useState(lang === "zh" ? "我已经拥有的生活" : "The Life I Already Have");
  const [layout, setLayout] = useState<Layout>("editorial");
  const [ratio, setRatio] = useState<Ratio>("phone");
  const [rights, setRights] = useState(false);
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
    if (!rights) { window.alert(copy.needRights); return; }
    if (!images.length) return;
    const [width, height] = sizes[ratio];
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = background; context.fillRect(0, 0, width, height);
    const margin = Math.round(width * 0.045);
    const gap = Math.round(width * 0.012);
    const heading = Math.round(height * 0.12);
    context.fillStyle = "#493630";
    context.font = `500 ${Math.round(width * 0.052)}px Georgia, serif`;
    context.textAlign = "center";
    context.fillText(title || "ALREADY", width / 2, heading * 0.58, width - margin * 2);
    const loaded = await Promise.all(images.map((item) => loadImage(item.url)));
    const top = heading;
    const availableHeight = height - top - margin;
    if (layout === "editorial" && loaded.length > 1) {
      const heroHeight = availableHeight * 0.5;
      drawCover(context, loaded[0], margin, top, width - margin * 2, heroHeight);
      const rest = loaded.slice(1);
      const cols = Math.min(3, rest.length);
      const rows = Math.ceil(rest.length / cols);
      const cellWidth = (width - margin * 2 - gap * (cols - 1)) / cols;
      const cellHeight = (availableHeight - heroHeight - gap - gap * (rows - 1)) / rows;
      rest.forEach((image, index) => drawCover(context, image, margin + (index % cols) * (cellWidth + gap), top + heroHeight + gap + Math.floor(index / cols) * (cellHeight + gap), cellWidth, cellHeight));
    } else {
      const cols = layout === "mosaic" ? 2 : Math.min(ratio === "landscape" ? 4 : 3, Math.ceil(Math.sqrt(loaded.length)));
      const rows = Math.ceil(loaded.length / cols);
      const cellWidth = (width - margin * 2 - gap * (cols - 1)) / cols;
      const cellHeight = (availableHeight - gap * (rows - 1)) / rows;
      loaded.forEach((image, index) => drawCover(context, image, margin + (index % cols) * (cellWidth + gap), top + Math.floor(index / cols) * (cellHeight + gap), cellWidth, cellHeight));
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `already-vision-board-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  };

  return <div className="vision-maker">
    <div className="vision-maker-heading"><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
    <label className="vision-upload">＋ {copy.upload}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages}/><small>{copy.uploadHint}</small></label>
    <div className="vision-controls">
      <label>{copy.boardTitle}<input value={title} onChange={(event) => setTitle(event.target.value)}/></label>
      <fieldset><legend>{copy.layout}</legend>{(["editorial", "grid", "mosaic", "film", "scrapbook"] as const).map((value) => <button className={layout === value ? "selected" : ""} key={value} onClick={() => setLayout(value)}>{copy.layouts[value]}</button>)}</fieldset>
      <fieldset><legend>{copy.ratio}</legend>{(["phone", "square", "landscape"] as const).map((value) => <button className={ratio === value ? "selected" : ""} key={value} onClick={() => setRatio(value)}>{copy.ratios[value]}</button>)}</fieldset>
      <div className="collage-style-controls"><label>{copy.gap}<input type="range" min="0" max="16" value={gap} onChange={(event) => setGap(Number(event.target.value))}/></label><label>{copy.corner}<input type="range" min="0" max="30" value={corner} onChange={(event) => setCorner(Number(event.target.value))}/></label><label>{copy.background}<input type="color" value={background} onChange={(event) => setBackground(event.target.value)}/></label></div>
    </div>
    <p className="drag-hint">↕ {copy.dragHint}</p>
    <div className={`vision-preview ${layout} ${ratio}`} style={{ background, "--vision-gap": `${gap}px`, "--vision-corner": `${corner}px` } as CSSProperties}>
      <h3>{title}</h3>
      {images.length ? <div>{images.map((item) => <div role="button" tabIndex={0} aria-label={`${copy.selected}: ${item.name}`} className={`vision-frame ${selectedId === item.id ? "selected" : ""}`} draggable key={item.id} onDragStart={() => setDraggedId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(item.id)} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.id); }}><img src={item.url} alt={item.name} style={{ transform: `translate(${item.x}%, ${item.y}%) scale(${item.zoom}) rotate(${item.rotate}deg)` }}/><button onClick={(event) => { event.stopPropagation(); removeImage(item.id); }} aria-label={`${copy.remove} ${item.name}`}>×</button></div>)}</div> : <p>{copy.empty}</p>}
    </div>
    {selected && <div className="frame-editor"><div><span>{copy.selected}</span><strong>{selected.name}</strong></div><label>{copy.zoom}<input type="range" min="1" max="2.5" step="0.05" value={selected.zoom} onChange={(event) => updateSelected({ zoom: Number(event.target.value) })}/></label><label>{copy.horizontal}<input type="range" min="-35" max="35" value={selected.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })}/></label><label>{copy.vertical}<input type="range" min="-35" max="35" value={selected.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })}/></label><label>{copy.rotate}<input type="range" min="-12" max="12" value={selected.rotate} onChange={(event) => updateSelected({ rotate: Number(event.target.value) })}/></label></div>}
    <label className="rights-check"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)}/><span>{copy.rights}</span></label>
    <button className="primary" disabled={!images.length} onClick={exportBoard}>{copy.export}</button>
    <div className="studio-notice"><strong>{copy.local}</strong><p>{copy.localCopy}</p></div>
  </div>;
}
