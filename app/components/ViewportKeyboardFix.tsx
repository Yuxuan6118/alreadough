"use client";

import { useEffect } from "react";

/**
 * iOS Safari bug: `position: fixed` elements are placed against the layout
 * viewport, not the visual viewport. When the on-screen keyboard opens (or
 * is mid-dismiss), those two disagree — a fixed bottom bar (the chat
 * composer, the bottom nav) visibly detaches from the real bottom edge,
 * leaving a blank gap below it or stranding the bar off-screen. This is
 * exactly the "bar flies up once you tap into a text field" report.
 *
 * Fix: track window.visualViewport and feed the gap between it and the
 * layout viewport back as a CSS variable (--kb-offset) that the fixed bottom
 * bars add to their `bottom` value. That keeps them pinned to what is
 * actually visible, and lets them ride up above the keyboard like a native
 * chat input instead of floating away. Safe everywhere: visualViewport is
 * undefined on old browsers and this just no-ops there, and on browsers
 * that don't have the bug the computed gap is ~0.
 */
export default function ViewportKeyboardFix() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const sync = () => {
      const gap = window.innerHeight - viewport.height - viewport.offsetTop;
      root.style.setProperty("--kb-offset", `${Math.max(0, Math.round(gap))}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      root.style.removeProperty("--kb-offset");
    };
  }, []);

  return null;
}
