"use client";

import { useEffect } from "react";

/**
 * iOS keeps `position: fixed` elements glued to the *layout* viewport, and after the on-screen
 * keyboard closes it can leave that viewport at the keyboard-sized height. The bottom bars then
 * hang in mid-screen with blank space under them until the page is reloaded.
 *
 * We do not trust window.innerHeight. A hidden probe fixed at bottom:0 shows where the layout
 * viewport really ends, and visualViewport shows where the screen really ends. Their difference
 * is published as --kb-offset (px, may be negative) and added to the bars' `bottom`:
 *   positive: the keyboard covers the bottom, so the bars ride up above it;
 *   negative: the layout viewport is stale-short, so the bars are pushed back down.
 * While a text field has focus and the keyboard is up, the bottom nav steps aside (html.kb-open).
 * The value is re-measured on every viewport event, after blur, and on a slow timer as a safety net.
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
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);

    const sync = () => {
      const viewport = window.visualViewport;
      const layoutBottom = probe.getBoundingClientRect().bottom;
      const visualBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const raw = Math.round(layoutBottom - visualBottom);
      const gap = Math.abs(raw) < 2 ? 0 : Math.max(-900, Math.min(900, raw));
      root.style.setProperty("--kb-offset", `${gap}px`);
      root.classList.toggle("kb-open", isTyping(document.activeElement) && gap > 120);
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
    };
    const later = [0, 80, 250, 600, 1200];
    const timers: number[] = [];
    const afterFocusChange = () => {
      schedule();
      later.forEach((ms) => timers.push(window.setTimeout(schedule, ms)));
    };
    const afterBlur = () => {
      afterFocusChange();
      // Nudging the scroll position makes iOS recompute its viewport after the keyboard closes.
      later.slice(2).forEach((ms) => timers.push(window.setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), ms)));
    };

    sync();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("orientationchange", afterFocusChange);
    window.addEventListener("pageshow", afterFocusChange);
    document.addEventListener("visibilitychange", afterFocusChange);
    document.addEventListener("focusin", afterFocusChange);
    document.addEventListener("focusout", afterBlur);
    const safety = window.setInterval(sync, 700);

    return () => {
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", afterFocusChange);
      window.removeEventListener("pageshow", afterFocusChange);
      document.removeEventListener("visibilitychange", afterFocusChange);
      document.removeEventListener("focusin", afterFocusChange);
      document.removeEventListener("focusout", afterBlur);
      window.clearInterval(safety);
      timers.forEach((id) => window.clearTimeout(id));
      if (frame) window.cancelAnimationFrame(frame);
      probe.remove();
      root.style.removeProperty("--kb-offset");
      root.classList.remove("kb-open");
    };
  }, []);

  return null;
}
