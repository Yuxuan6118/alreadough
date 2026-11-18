"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, useReducedMotion } from "motion/react";
import styles from "./product.module.css";

// The desktop pet, as it is on the computer: a port of desktop-pet/main.swift at the same sizes (中 = 190 px wide)
// with the same moves. The card it sits in plays the part of the desktop.
//   idle         breathing, three proofing specks rising now and then
//   tap          squish and bounce, a ripple ring and 14 pieces of confetti
//   pull         drag it and it stretches like dough, let go and it springs back
//   pull far     past 92 px it breaks free and follows the pointer; drop it anywhere
//   hold 0.4 s   then drag: the same pick-up
//   pinch        trackpad pinch (or two fingers on a phone): grows or shrinks, springs back when you let go
//   3 taps       a proofing party: it puffs up and bursts into a bigger confetti
//   nap          left alone it dozes, slower breathing and drifting z; point at it to wake it
//   double-click opens AlreaDough
//   right-click  open, hide for a while, hide in full screen, back to the corner, size, quit (long-press on a phone)

type Lang = "zh" | "en";
type Spot = { x: number; y: number };

const SIZES = [130, 160, 190, 270, 520] as const;
const NAP_AFTER_MS = 30_000;   // the computer waits 90 s; shortened so a visitor sees it
const BREAK_FREE = 92;
const EASE = [0.16, 1, 0.3, 1] as const;

const copy = {
  zh: {
    label: "桌宠：可以点、拉、连点三下、双指缩放、右键",
    open: "打开 AlreaDough", hide: "躲一会儿", hideFor: ["30 分钟", "1 小时", "2 小时", "到明天早上", "直到我叫它回来"],
    autoHide: "全屏时自动躲起来", home: "放回屏幕右下角", size: "大小", sizes: ["特小", "小", "中", "大", "特大"], quit: "退出桌宠",
    back: "叫面团回来",
  },
  en: {
    label: "Desktop pet: tap, pull, tap three times, pinch, right-click",
    open: "Open AlreaDough", hide: "Hide for a while", hideFor: ["30 minutes", "1 hour", "2 hours", "Until tomorrow morning", "Until I call it back"],
    autoHide: "Hide in full screen", home: "Back to the corner", size: "Size", sizes: ["Extra small", "Small", "Medium", "Large", "Extra large"], quit: "Quit the pet",
    back: "Call the dough back",
  },
} as const;

// the 14 confetti directions of the real pet (CSS pixels, y down)
const SPOTS: [number, number, number][] = [
  [-62, -68, -24], [-28, -86, 18], [10, -82, 42], [48, -64, 72], [70, -28, 94], [62, 22, 116], [28, 54, 148],
  [-14, 58, 184], [-52, 38, 214], [-72, 4, 244], [-76, -34, 282], [78, 8, 312], [34, -52, 338], [-36, -50, 8],
];

const elastic = (value: number, low: number, high: number) => value > high ? high + (value - high) * 0.22 : value < low ? low + (value - low) * 0.22 : value;
const rubber = (value: number) => value > 1.55 ? 1.55 + (value - 1.55) * 0.25 : value < 0.55 ? 0.55 - (0.55 - value) * 0.25 : value;

export default function PetPreview({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const squishRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState<number>(190);
  const [spot, setSpot] = useState<Spot | null>(null);   // null = the bottom-right corner
  const [shown, setShown] = useState<"here" | "hidden" | "quit">("here");
  const [autoHide, setAutoHide] = useState(true);
  const [napping, setNapping] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; flip: boolean; up: boolean } | null>(null);
  const [sub, setSub] = useState<"hide" | "size" | null>(null);
  const [fx, setFx] = useState<{ id: number; kind: "ripple" | "confetti" | "party" | "z"; seed: number }[]>([]);

  const unit = width / 190;
  const gesture = useRef<{ mode: "idle" | "pending" | "pull" | "carry"; x: number; y: number; start: Spot; last: Spot; hold?: number; pointerId?: number }>({ mode: "idle", x: 0, y: 0, start: { x: 0, y: 0 }, last: { x: 0, y: 0 } });
  const taps = useRef<number[]>([]);
  const lastUp = useRef(0);
  const lastTouched = useRef(0);
  const pinch = useRef({ value: 1, fingers: new Map<number, Spot>(), startDistance: 0 });

  const addFx = (kind: "ripple" | "confetti" | "party" | "z", life: number) => {
    const id = Date.now() + Math.random();
    setFx((list) => [...list, { id, kind, seed: Math.random() }]);
    window.setTimeout(() => setFx((list) => list.filter((item) => item.id !== id)), life);
  };

  // where the pet stands right now, in stage pixels (top-left of the dough)
  const currentSpot = (): Spot => {
    const stage = stageRef.current?.getBoundingClientRect();
    const pet = petRef.current?.getBoundingClientRect();
    if (!stage || !pet) return { x: 0, y: 0 };
    return { x: pet.left - stage.left, y: pet.top - stage.top };
  };
  const clampSpot = (value: Spot): Spot => {
    const stage = stageRef.current?.getBoundingClientRect();
    const pet = petRef.current?.getBoundingClientRect();
    if (!stage || !pet) return value;
    return { x: Math.min(Math.max(value.x, -pet.width * 0.3), stage.width - pet.width * 0.7), y: Math.min(Math.max(value.y, -pet.height * 0.3), stage.height - pet.height * 0.7) };
  };

  // ---- reactions
  const squish = (strength = 1) => {
    if (reduce || !squishRef.current) return;
    animate(squishRef.current, { scaleX: [1, 1 + 0.05 * strength, 1 - 0.02 * strength, 1], scaleY: [1, 1 - 0.09 * strength, 1 + 0.035 * strength, 1], y: [0, 5 * strength * unit, -2 * strength * unit, 0] }, { duration: 0.7, ease: EASE });
  };
  const respond = () => { squish(); addFx("ripple", 900); addFx("confetti", 950); };
  const party = () => {
    squish(1.7); addFx("ripple", 900); addFx("party", 950);
    if (!reduce && dragRef.current) animate(dragRef.current, { scale: [1, 1.14, 0.97, 1.04, 1] }, { duration: 0.9, times: [0, 0.3, 0.55, 0.78, 1], ease: EASE });
  };
  const touchedNow = () => { lastTouched.current = performance.timeOrigin + performance.now(); };
  const wake = (playful = true) => {
    touchedNow();
    if (!napping) return;
    setNapping(false);
    if (playful) squish(0.7);
  };

  // ---- nap
  useEffect(() => {
    lastTouched.current = Date.now();
    const timer = window.setInterval(() => {
      if (gesture.current.mode !== "idle") return;
      setNapping((now) => {
        if (now) { addFx("z", 2500); return true; }
        return Date.now() - lastTouched.current > NAP_AFTER_MS;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // ---- pointer: tap, pull, break free, hold and carry
  const setDrag = (x: number, y: number) => {
    const ax = Math.min(Math.abs(x), 76), ay = Math.min(Math.abs(y), 76);
    if (dragRef.current) dragRef.current.style.transform = `translate(${x * unit}px, ${y * unit}px) rotate(${x / 22}deg) scale(${1 + ax / 150 - ay / 430}, ${1 + ay / 150 - ax / 430})`;
  };
  const springHome = (from: string, stiffness: number, damping: number) => {
    const el = dragRef.current;
    if (!el) return;
    el.style.transform = "";
    if (reduce) return;
    // read the stretch back as a matrix and let a spring carry each part home
    const m = new DOMMatrix(from);
    const sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d), rot = Math.atan2(m.b, m.a) * 180 / Math.PI;
    animate(el, { x: [m.e, 0], y: [m.f, 0], rotate: [rot, 0], scaleX: [sx, 1], scaleY: [sy, 1] }, { type: "spring", stiffness, damping, mass: 1 });
  };
  const lift = (on: boolean) => {
    if (!dragRef.current || reduce) return;
    if (on) animate(dragRef.current, { scale: 1.06 }, { duration: 0.18 });
    else animate(dragRef.current, { scale: [1.06, 1] }, { type: "spring", stiffness: 360, damping: 14 });
  };

  const onDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (pinch.current.fingers.size > 0 || event.pointerType === "touch") {
      pinch.current.fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.current.fingers.size === 2) {
        const [a, b] = [...pinch.current.fingers.values()];
        pinch.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
        window.clearTimeout(gesture.current.hold);
        gesture.current.mode = "idle";
        if (dragRef.current) dragRef.current.style.transform = "";
        return;
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    wake(false);
    setMenu(null);
    const start = currentSpot();
    gesture.current = { mode: "pending", x: event.clientX, y: event.clientY, start, last: { x: 0, y: 0 }, pointerId: event.pointerId };
    if (!reduce && dragRef.current) animate(dragRef.current, { scale: 0.97 }, { duration: 0.12 });
    gesture.current.hold = window.setTimeout(() => {
      if (gesture.current.mode !== "pending") return;
      if (event.pointerType === "touch") { openMenu(event.clientX, event.clientY); gesture.current.mode = "idle"; return; }   // long-press = right-click
      gesture.current.mode = "carry";
      setSpot(start);
      lift(true);
    }, event.pointerType === "touch" ? 520 : 400);
  };

  const onMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (napping) wake();
    const fingers = pinch.current.fingers;
    if (fingers.has(event.pointerId)) {
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size === 2 && pinch.current.startDistance > 0) {
        const [a, b] = [...fingers.values()];
        applyPinch(rubber(Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.startDistance), true);
        return;
      }
    }
    const g = gesture.current;
    if (g.mode === "idle" || g.pointerId !== event.pointerId) return;
    const dx = event.clientX - g.x, dy = event.clientY - g.y;
    if (g.mode === "pending" && Math.abs(dx) + Math.abs(dy) > 4) {
      window.clearTimeout(g.hold);
      g.mode = "pull";
      if (dragRef.current) animate(dragRef.current, { scale: 1 }, { duration: 0.05 });
    }
    if (g.mode === "pull") {
      if (Math.hypot(dx, dy) > BREAK_FREE * unit) {
        // break free: the pet moves to where the dough looks now and the stretch relaxes with a spring
        const from = dragRef.current?.style.transform || "";
        g.mode = "carry";
        g.start = { x: g.start.x + g.last.x, y: g.start.y + g.last.y };
        g.x = event.clientX; g.y = event.clientY;
        setSpot(clampSpot(g.start));
        springHome(from, 380, 15);
        lift(true);
        return;
      }
      const x = elastic(dx / unit, -52, 52), y = elastic(dy / unit, -52, 22);   // less room downward, toward the floor
      g.last = { x: x * unit, y: y * unit };
      if (!reduce) setDrag(x, y);
    } else if (g.mode === "carry") {
      setSpot(clampSpot({ x: g.start.x + dx, y: g.start.y + dy }));
    }
  };

  const onUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const fingers = pinch.current.fingers;
    if (fingers.has(event.pointerId)) {
      fingers.delete(event.pointerId);
      if (fingers.size < 2 && pinch.current.startDistance > 0) { pinch.current.startDistance = 0; releasePinch(); gesture.current.mode = "idle"; return; }
    }
    const g = gesture.current;
    if (g.pointerId !== event.pointerId) return;
    window.clearTimeout(g.hold);
    if (dragRef.current && g.mode === "pending" && !reduce) animate(dragRef.current, { scale: 1 }, { duration: 0.12 });
    if (g.mode === "pull") springHome(dragRef.current?.style.transform || "", 420, 17);
    else if (g.mode === "carry") lift(false);
    else if (g.mode === "pending" && event.type === "pointerup") {
      const now = event.timeStamp;
      const second = now - lastUp.current < 400;   // the second click of a double-click
      lastUp.current = second ? 0 : now;
      if (second) { taps.current = []; window.open(`/app?lang=${lang}`, "_blank", "noopener"); }
      else {
        taps.current = [...taps.current.filter((time) => now - time < 900), now];
        if (taps.current.length >= 3) { taps.current = []; party(); } else respond();
      }
    }
    g.mode = "idle";
    touchedNow();
  };

  // ---- pinch (trackpad pinch arrives as ctrl + wheel)
  const releaseTimer = useRef<number | undefined>(undefined);
  const applyPinch = (value: number, absolute = false) => {
    pinch.current.value = absolute ? value : rubber(pinch.current.value * value);
    if (pinchRef.current) pinchRef.current.style.transform = `scale(${pinch.current.value})`;
  };
  const releasePinch = () => {
    const el = pinchRef.current;
    if (!el || pinch.current.value === 1) return;
    const from = pinch.current.value;
    pinch.current.value = 1;
    el.style.transform = "";
    if (!reduce) animate(el, { scale: [from, 1] }, { type: "spring", stiffness: 230, damping: 11, mass: 0.9 });
  };
  useEffect(() => {
    const el = petRef.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;   // a plain wheel scrolls the page as usual
      event.preventDefault();
      wake(false);
      applyPinch(Math.exp(-event.deltaY * 0.012));
      window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(releasePinch, 200);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  // ---- right-click menu
  const openMenu = (clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    wake(false);
    setSub(null);
    const x = Math.min(clientX - box.left, box.width - 200);
    const y = Math.max(8, Math.min(clientY - box.top, box.height - 250));
    setMenu({ x: Math.max(8, x), y, flip: x + 200 + 180 > box.width, up: y > box.height * 0.4 });
  };
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.focus();
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);

  const hideFor = (index: number) => {
    setMenu(null);
    setShown("hidden");
    // the real choices are 30 min to "until I call it back"; on this page a timed hide lasts a few seconds
    if (index < 4) window.setTimeout(() => setShown((now) => (now === "hidden" ? "here" : now)), 4000);
  };
  const callBack = () => { setShown("here"); wake(); };

  const confettiPieces = (big: boolean, seed: number) => {
    const pieces = SPOTS.map(([x, y, r]) => ({ x, y, r }));
    if (big) for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const reach = 70 + ((index * 37 + Math.round(seed * 100)) % 36);
      pieces.push({ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, r: (index * 67) % 360 });
    }
    return pieces;
  };

  const place = spot ? { left: spot.x, top: spot.y } : { right: 28, bottom: 22 };

  return (
    <div ref={stageRef} className={styles.petStage} onContextMenu={(event) => event.preventDefault()}>
      {shown !== "here" && (
        <button type="button" className={styles.petCallBack} onClick={callBack} aria-label={t.back} title={t.back}>
          <img src="/brand/already-dough-mark.png" alt="" />
        </button>
      )}

      <div ref={petRef} className={styles.pet} data-shown={shown} style={{ ...place, width: `min(${width}px, 86%)` }}>
        <div ref={pinchRef} className={styles.petPinch}>
          <div ref={dragRef} className={styles.petDrag}>
            <button
              type="button"
              className={styles.petButton}
              aria-label={t.label}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerEnter={() => wake()}
              onContextMenu={(event) => { event.preventDefault(); openMenu(event.clientX, event.clientY); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); respond(); } }}
            >
              <div ref={squishRef} className={styles.petSquish}>
                <img className={styles.petBreath} data-nap={napping ? "true" : undefined} src="/mascot/already-dough-fold-v3.png" alt="" draggable={false} />
              </div>
            </button>
          </div>
        </div>
        <span className={styles.specks} aria-hidden="true"><i /><i /><i /></span>
        {fx.map((item) => item.kind === "ripple"
          ? <span key={item.id} className={styles.petRipple} aria-hidden="true" />
          : item.kind === "z"
            ? <span key={item.id} className={styles.petZ} style={{ fontSize: `${(13 + item.seed * 5) * unit}px` }} aria-hidden="true">z</span>
            : <span key={item.id} className={styles.petConfetti} aria-hidden="true">
                {confettiPieces(item.kind === "party", item.seed).map((piece, index) => (
                  <i key={index} style={{ "--x": `${piece.x * unit}px`, "--y": `${piece.y * unit}px`, "--r": `${piece.r}deg`, width: `${7 * unit}px`, height: `${12 * unit}px` } as React.CSSProperties} />
                ))}
              </span>)}
      </div>

      {menu && (
        <div ref={menuRef} className={styles.menu} style={{ left: menu.x, top: menu.y }} role="menu" tabIndex={-1} data-flip={menu.flip ? "true" : undefined} data-up={menu.up ? "true" : undefined}>
          <a role="menuitem" href={`/app?lang=${lang}`} target="_blank" rel="noreferrer">{t.open}</a>
          <div className={styles.menuParent} onPointerEnter={() => setSub("hide")}>
            <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={sub === "hide"} onClick={() => setSub("hide")}>{t.hide}<span aria-hidden="true">›</span></button>
            {sub === "hide" && <div className={styles.submenu} role="menu">{t.hideFor.map((label, index) => <button key={label} role="menuitem" type="button" onClick={() => hideFor(index)}>{label}</button>)}</div>}
          </div>
          <button role="menuitemcheckbox" type="button" aria-checked={autoHide} onPointerEnter={() => setSub(null)} onClick={() => setAutoHide((value) => !value)}><span className={styles.tick} aria-hidden="true">{autoHide ? "✓" : ""}</span>{t.autoHide}</button>
          <hr />
          <button role="menuitem" type="button" onPointerEnter={() => setSub(null)} onClick={() => { setMenu(null); setSpot(null); }}>{t.home}</button>
          <div className={styles.menuParent} onPointerEnter={() => setSub("size")}>
            <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={sub === "size"} onClick={() => setSub("size")}>{t.size}<span aria-hidden="true">›</span></button>
            {sub === "size" && <div className={styles.submenu} role="menu">{SIZES.map((value, index) => (
              <button key={value} role="menuitemradio" type="button" aria-checked={width === value} onClick={() => { setWidth(value); setSpot(null); setMenu(null); }}><span className={styles.tick} aria-hidden="true">{width === value ? "✓" : ""}</span>{t.sizes[index]}</button>
            ))}</div>}
          </div>
          <hr />
          <button role="menuitem" type="button" onPointerEnter={() => setSub(null)} onClick={() => { setMenu(null); setShown("quit"); }}>{t.quit}</button>
        </div>
      )}
    </div>
  );
}
