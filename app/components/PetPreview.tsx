"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import styles from "./product.module.css";

// A try-before-you-download desktop: the same dough and the same moves as the Mac and Windows pet
// (desktop-pet/main.swift): it breathes, squishes when tapped, stretches when pulled, throws a proofing party on
// three quick taps, dozes when left alone, and has the right-click menu (hide, size, put back, quit).

type Lang = "zh" | "en";
type Os = "mac" | "win";
type Size = "s" | "m" | "l";

const copy = {
  zh: {
    mac: "Mac", win: "Windows", os: "选择电脑系统",
    hint: ["点一下", "拖一拖", "连点三下", "右键（手机上长按）"],
    menuOpen: "打开 AlreaDough", hide: "躲一会儿", home: "放回屏幕右下角", size: "大小", sizes: { s: "小", m: "中", l: "大" }, quit: "退出桌宠",
    back: "叫它回来", hidden: "面团躲起来了，几秒后自己回来", gone: "桌宠下班了",
    pet: "桌宠预览：可以点、拖、连点三下或右键",
    notes: "今天的愿望", line: "我已经住在想要的生活里。",
  },
  en: {
    mac: "Mac", win: "Windows", os: "Choose a computer",
    hint: ["Tap it", "Pull it", "Tap three times", "Right-click (long-press on a phone)"],
    menuOpen: "Open AlreaDough", hide: "Hide for a while", home: "Back to the corner", size: "Size", sizes: { s: "Small", m: "Medium", l: "Large" }, quit: "Quit the pet",
    back: "Call it back", hidden: "The dough is hiding; it comes back in a few seconds", gone: "The pet has gone home",
    pet: "Desktop pet preview: tap, pull, tap three times or right-click",
    notes: "Today's wish", line: "I already live the life I wanted.",
  },
} as const;

const CONFETTI = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2 + (index % 3) * 0.2;
  const reach = 46 + (index % 4) * 14;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach - 18, r: index * 47 };
});

export default function PetPreview({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const reduce = useReducedMotion();
  const [os, setOs] = useState<Os>("mac");
  const [size, setSize] = useState<Size>("m");
  const [state, setState] = useState<"here" | "hidden" | "gone">("here");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [bursts, setBursts] = useState<{ id: number; big: boolean }[]>([]);
  const [napping, setNapping] = useState(false);
  const [clock, setClock] = useState("");
  const deskRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [shellRef, animate] = useAnimate<HTMLSpanElement>();
  const idle = useRef<{ stop: () => void } | null>(null);
  const taps = useRef<number[]>([]);
  const dragged = useRef(false);
  const lastTouch = useRef(0);
  const press = useRef<number | null>(null);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const stretchX = useTransform(() => 1 + Math.min(Math.abs(dragX.get()), 80) / 150 - Math.min(Math.abs(dragY.get()), 80) / 430);
  const stretchY = useTransform(() => 1 + Math.min(Math.abs(dragY.get()), 80) / 150 - Math.min(Math.abs(dragX.get()), 80) / 430);
  const tilt = useTransform(() => dragX.get() / 22);

  const breathe = (slow = false) => {
    idle.current?.stop();
    if (reduce || !shellRef.current) return;
    idle.current = animate(shellRef.current, { scaleX: [1, 1.035, 1], scaleY: [1, 1.055, 1], y: [0, -4, 0] }, { duration: slow ? 8 : 5.4, times: [0, 0.42, 1], ease: "easeInOut", repeat: Infinity });
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- the clock and the starting OS come from the visitor's device */
    if (/Win/i.test(navigator.platform || navigator.userAgent)) setOs("win");
    const tick = () => setClock(new Date().toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "numeric", minute: "2-digit" }));
    tick();
    /* eslint-enable react-hooks/set-state-in-effect */
    const clockTimer = window.setInterval(tick, 30000);
    lastTouch.current = Date.now();
    // left alone for 20 seconds, it dozes (the real pet waits 90)
    const napTimer = window.setInterval(() => { if (Date.now() - lastTouch.current > 20000) setNapping(true); }, 2000);
    return () => { window.clearInterval(clockTimer); window.clearInterval(napTimer); };
  }, [lang]);

  useEffect(() => { if (state === "here") breathe(napping); return () => idle.current?.stop(); }, [state, napping]); // eslint-disable-line react-hooks/exhaustive-deps

  // the menu closes on any press outside it, or on Escape
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.focus();
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);

  const wake = () => { lastTouch.current = Date.now(); if (napping) setNapping(false); };

  const confetti = (big: boolean) => {
    const id = Date.now() + Math.random();
    setBursts((list) => [...list, { id, big }]);
    window.setTimeout(() => setBursts((list) => list.filter((item) => item.id !== id)), 1000);
  };

  const squish = async (strength = 1) => {
    if (reduce || !shellRef.current) return;
    idle.current?.stop();
    await animate(shellRef.current, { scaleX: [1, 1 + 0.05 * strength, 0.98, 1], scaleY: [1, 1 - 0.09 * strength, 1.035, 1], y: [0, 5 * strength, -2, 0] }, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    breathe();
  };

  const party = async () => {
    confetti(true);
    if (reduce || !shellRef.current) return;
    idle.current?.stop();
    await animate(shellRef.current, { scale: [1, 1.14, 0.97, 1.04, 1] }, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    breathe();
  };

  const tap = () => {
    wake();
    setMenu(null);
    if (dragged.current) { dragged.current = false; return; }
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < 650), now];
    if (taps.current.length >= 3) { taps.current = []; void party(); return; }
    confetti(false);
    void squish();
  };

  const openMenu = (clientX: number, clientY: number) => {
    const box = deskRef.current?.getBoundingClientRect();
    if (!box) return;
    wake();
    setMenu({ x: Math.min(clientX - box.left, box.width - 190), y: Math.min(clientY - box.top, box.height - 190) });
  };
  const onContext = (event: ReactMouseEvent) => { event.preventDefault(); openMenu(event.clientX, event.clientY); };
  // long-press opens the menu on touch screens
  const onPointerDown = (event: ReactPointerEvent) => {
    dragged.current = false;
    if (event.pointerType === "mouse") return;
    const { clientX, clientY } = event;
    press.current = window.setTimeout(() => { dragged.current = true; openMenu(clientX, clientY); }, 520);
  };
  const cancelPress = () => { if (press.current) window.clearTimeout(press.current); press.current = null; };

  const hide = () => { setMenu(null); setState("hidden"); window.setTimeout(() => setState((current) => current === "hidden" ? "here" : current), 3500); };
  const callBack = () => { setState("here"); wake(); };

  return (
    <div className={styles.petDemo}>
      <div className={styles.osToggle} role="radiogroup" aria-label={t.os} data-os={os}>
        <span className={styles.osThumb} aria-hidden="true" />
        {(["mac", "win"] as Os[]).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={os === value} onClick={() => setOs(value)}>{t[value]}</button>
        ))}
      </div>

      <div ref={deskRef} className={styles.desk} data-os={os} onContextMenu={(event) => event.preventDefault()}>
        {os === "mac"
          ? <div className={styles.menubar}><span className={styles.menubarDots}><i /><i /><i /></span><span className={styles.tray}>{state !== "here" && <button type="button" onClick={callBack}>{t.back}</button>}<img src="/brand/already-dough-mark.png" alt="" />{clock}</span></div>
          : null}

        <div className={styles.window} aria-hidden="true">
          <div className={styles.windowBar}>{os === "mac" ? <span className={styles.lights}><i /><i /><i /></span> : <span className={styles.winCtl}>—&nbsp;&nbsp;▢&nbsp;&nbsp;✕</span>}</div>
          <div className={styles.windowBody}><b>{t.notes}</b><span>{t.line}</span><i /><i /><i /></div>
        </div>

        {state === "here" && (
          <div className={styles.pet} data-size={size}>
            <motion.button
              type="button"
              className={styles.petButton}
              aria-label={t.pet}
              drag={!reduce}
              dragConstraints={deskRef}
              dragElastic={0.22}
              dragMomentum={false}
              dragSnapToOrigin
              style={reduce ? undefined : { x: dragX, y: dragY, scaleX: stretchX, scaleY: stretchY, rotate: tilt }}
              onDrag={() => { dragged.current = true; cancelPress(); }}
              onClick={(event) => { event.stopPropagation(); tap(); }}
              onContextMenu={(event) => { event.stopPropagation(); onContext(event); }}
              onPointerDown={onPointerDown}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerEnter={wake}
            >
              <span ref={shellRef} className={styles.petShell}>
                <img src="/mascot/already-dough-fold-v3.png" alt="" draggable={false} />
              </span>
            </motion.button>
            {napping && <span className={styles.zzz} aria-hidden="true"><i>z</i><i>z</i><i>z</i></span>}
            {bursts.map((burst) => (
              <span key={burst.id} className={styles.confetti} aria-hidden="true">
                {CONFETTI.slice(0, burst.big ? 22 : 12).map((piece, index) => (
                  <i key={index} style={{ "--x": `${piece.x * (burst.big ? 1.5 : 1)}px`, "--y": `${piece.y * (burst.big ? 1.5 : 1)}px`, "--r": `${piece.r}deg` } as React.CSSProperties} />
                ))}
              </span>
            ))}
          </div>
        )}

        {state !== "here" && <p className={styles.deskNote} role="status">{state === "hidden" ? t.hidden : t.gone}{state === "gone" && <button type="button" onClick={callBack}>{t.back}</button>}</p>}

        {menu && (
          <div ref={menuRef} className={styles.menu} data-os={os} style={{ left: menu.x, top: menu.y }} role="menu" tabIndex={-1}>
            <a role="menuitem" href={`/app?lang=${lang}`}>{t.menuOpen}</a>
            <button role="menuitem" type="button" onClick={hide}>{t.hide}</button>
            <button role="menuitem" type="button" onClick={() => { setMenu(null); dragX.set(0); dragY.set(0); }}>{t.home}</button>
            <hr />
            <span className={styles.menuLabel}>{t.size}</span>
            <div className={styles.menuSizes}>
              {(["s", "m", "l"] as Size[]).map((value) => (
                <button key={value} type="button" role="menuitemradio" aria-checked={size === value} onClick={() => { setSize(value); setMenu(null); }}>{t.sizes[value]}</button>
              ))}
            </div>
            <hr />
            <button role="menuitem" type="button" onClick={() => { setMenu(null); setState("gone"); }}>{t.quit}</button>
          </div>
        )}

        {os === "mac"
          ? <div className={styles.dock} aria-hidden="true"><i /><i /><i /><i /><i /></div>
          : <div className={styles.taskbar}><span className={styles.taskIcons} aria-hidden="true"><i /><i /><i /><i /></span><span className={styles.tray}>{state !== "here" && <button type="button" onClick={callBack}>{t.back}</button>}<img src="/brand/already-dough-mark.png" alt="" />{clock}</span></div>}
      </div>

      <ul className={styles.petHints}>{t.hint.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}
