"use client";

import { useEffect } from "react";

/**
 * On phones the app shell is pinned to the *visual* viewport (see the "app shell" block at the end of
 * already.css): its height and offset come from window.visualViewport, so when the iOS keyboard opens,
 * closes, or the browser pans the page, the shell, and the nav and composer fixed inside it, always match
 * the area the person can actually see. Nothing is positioned against the layout viewport, which iOS can
 * leave stale after the keyboard closes.
 *
 * This component only publishes --vv-height / --vv-top and flags html.kb-open while a text field has focus
 * and the keyboard is up (the bottom nav steps aside then). It re-measures on every viewport event, on
 * focus changes, and on a slow timer as a safety net.
 */
const nonTyping = new Set(["checkbox", "radio", "button", "submit", "range", "file", "color", "image", "reset"]);

function isTyping(element: Element | null) {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName === "INPUT") return !nonTyping.has((element as HTMLInputElement).type);
  return (element as HTMLElement).isContentEditable === true;
}

export default function ViewportKeyboardFix() {
  useEffect(() => {
    const root = document.documentElement;
    let tallest = 0;
    let lastWidth = window.innerWidth;

    const sync = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport ? viewport.height : window.innerHeight);
      const top = Math.round(viewport ? viewport.offsetTop : 0);
      if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; tallest = 0; }
      tallest = Math.max(tallest, height);
      root.style.setProperty("--vv-height", `${height}px`);
      root.style.setProperty("--vv-top", `${top}px`);
      root.style.setProperty("--kb-offset", "0px");
      root.classList.toggle("kb-open", isTyping(document.activeElement) && tallest - height > 120);
      // The document itself never scrolls on phones; if iOS moved it anyway, put it back.
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
    };
    const timers: number[] = [];
    const burst = () => {
      schedule();
      [60, 180, 400, 800, 1500].forEach((ms) => timers.push(window.setTimeout(schedule, ms)));
    };

    sync();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("orientationchange", burst);
    window.addEventListener("pageshow", burst);
    document.addEventListener("visibilitychange", burst);
    document.addEventListener("focusin", burst);
    document.addEventListener("focusout", burst);
    const safety = window.setInterval(sync, 700);

    return () => {
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", burst);
      window.removeEventListener("pageshow", burst);
      document.removeEventListener("visibilitychange", burst);
      document.removeEventListener("focusin", burst);
      document.removeEventListener("focusout", burst);
      window.clearInterval(safety);
      timers.forEach((id) => window.clearTimeout(id));
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--kb-offset");
      root.classList.remove("kb-open");
    };
  }, []);

  return null;
}
